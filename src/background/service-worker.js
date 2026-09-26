/*
 * Service worker: owns the API key, the classification queue and the cache.
 *
 * The content script never sees the key and never talks to Anthropic directly;
 * it sends an extracted email here and gets a verdict back.
 */
'use strict';

importScripts('../lib/util.js', '../lib/heuristics.js', '../lib/claude.js');

const { cacheKeys, truncate } = self.MailLensUtil;

const DEFAULT_SETTINGS = {
  enabled: true,
  apiKey: '',
  model: 'claude-opus-5',
  // Offline is the default: the extension is fully useful with no API key and
  // no account. A key upgrades the human-vs-AI call; it is never required.
  listMode: 'heuristics', // 'api' | 'heuristics' | 'off' - how message-list rows are judged
  openMode: 'heuristics', // 'api' | 'heuristics' - how an opened message is judged
  showCleanBadge: true, // show a badge even when a mail is plain human, not spam
  dailyCallLimit: 400,
};

const CACHE_MAX = 3000;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BATCH_SIZE = 8;
const BATCH_DELAY_MS = 500;

let settings = { ...DEFAULT_SETTINGS };
let cache = Object.create(null); // key -> { result, ts }
let stats = { day: today(), calls: 0, emails: 0, inputTokens: 0, outputTokens: 0, errors: 0 };
let lastError = null;
let ready = load();

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function load() {
  const stored = await chrome.storage.local.get(['settings', 'cache', 'stats']);
  settings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
  cache = stored.cache || Object.create(null);
  if (stored.stats && stored.stats.day === today()) stats = stored.stats;
  pruneCache();
}

let saveTimer = null;
function saveCacheSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    pruneCache();
    chrome.storage.local.set({ cache });
  }, 2000);
}

function saveStats() {
  if (stats.day !== today()) {
    stats = { day: today(), calls: 0, emails: 0, inputTokens: 0, outputTokens: 0, errors: 0 };
  }
  chrome.storage.local.set({ stats });
}

function pruneCache() {
  const now = Date.now();
  let entries = Object.entries(cache).filter(([, v]) => v && now - v.ts < CACHE_TTL_MS);
  if (entries.length > CACHE_MAX) {
    entries.sort((a, b) => b[1].ts - a[1].ts);
    entries = entries.slice(0, CACHE_MAX);
  }
  cache = Object.fromEntries(entries);
}

function cacheGet(keys) {
  for (const key of keys) {
    const hit = cache[key];
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.result;
  }
  return null;
}

function cachePut(keys, result) {
  const ts = Date.now();
  for (const key of keys) cache[key] = { result, ts };
  saveCacheSoon();
}

/* ------------------------------------------------------------------ verdicts */

function normalizeVerdict(raw, level, engine) {
  const clamp = self.MailLensUtil.clamp;
  const spamVerdict = raw && raw.spam && raw.spam.verdict === 'spam' ? 'spam' : 'not_spam';
  const allowed = ['ai', 'human', 'mixed', 'automated', 'unclear'];
  const authorship = raw && raw.authorship && allowed.includes(raw.authorship.verdict)
    ? raw.authorship.verdict
    : 'unclear';
  return {
    spam: {
      verdict: spamVerdict,
      confidence: clamp(raw && raw.spam ? Math.round(raw.spam.confidence) : 0, 0, 100),
    },
    authorship: {
      verdict: authorship,
      confidence: clamp(raw && raw.authorship ? Math.round(raw.authorship.confidence) : 0, 0, 100),
    },
    reason: String((raw && raw.reason) || '').slice(0, 240),
    engine,
    level,
  };
}

function heuristicVerdict(email, note) {
  const result = self.MailLensHeuristics.classify(email, email.level);
  if (note) result.note = note;
  return result;
}

function overBudget() {
  return stats.day === today() && stats.calls >= settings.dailyCallLimit;
}

function modeFor(level) {
  return level === 'full' ? settings.openMode : settings.listMode;
}

/* -------------------------------------------------------------------- queue */

const inFlight = new Map(); // primary cache key -> Promise<result>
let pending = []; // { email, keys, resolve }
let flushTimer = null;

function enqueuePreview(email, keys) {
  return new Promise((resolve) => {
    pending.push({ email, keys, resolve });
    if (pending.length >= BATCH_SIZE) flushBatch();
    else if (!flushTimer) flushTimer = setTimeout(flushBatch, BATCH_DELAY_MS);
  });
}

async function flushBatch() {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  const batch = pending.splice(0, BATCH_SIZE);
  if (!batch.length) return;
  if (pending.length) flushTimer = setTimeout(flushBatch, 50);

  const payload = batch.map((item, i) => ({ ...item.email, id: 'e' + i }));
  try {
    const { results, usage } = await self.MailLensClaude.classify(payload, {
      apiKey: settings.apiKey,
      model: settings.model,
      effort: 'low',
    });
    recordUsage(usage, batch.length);
    lastError = null;
    const byId = new Map(results.map((r) => [r.id, r]));
    batch.forEach((item, i) => {
      const raw = byId.get('e' + i);
      const result = raw
        ? normalizeVerdict(raw, item.email.level, 'claude')
        : heuristicVerdict(item.email, 'Model skipped this one.');
      cachePut(item.keys, result);
      item.resolve(result);
    });
  } catch (err) {
    failBatch(batch, err);
  }
}

function failBatch(batch, err) {
  stats.errors += 1;
  lastError = String(err && err.message ? err.message : err);
  saveStats();
  for (const item of batch) {
    const result = heuristicVerdict(item.email, 'Offline scoring - ' + lastError);
    cachePut(item.keys, result);
    item.resolve(result);
  }
}

function recordUsage(usage, emailCount) {
  stats.calls += 1;
  stats.emails += emailCount;
  if (usage) {
    stats.inputTokens += usage.input_tokens || 0;
    stats.outputTokens += usage.output_tokens || 0;
  }
  saveStats();
}

/** Tell every open Gmail tab to repaint (settings changed, cache cleared). */
async function broadcast(message) {
  const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
  }
}

/* ------------------------------------------------------------- entry points */

async function classifyEmail(email, force) {
  await ready;
  if (!settings.enabled) return null;

  const level = email.level === 'full' ? 'full' : 'preview';
  const trimmed = {
    ...email,
    level,
    subject: truncate(email.subject || '', 300),
    snippet: truncate(email.snippet || '', 600),
    body: truncate(email.body || '', 8000),
  };
  const keys = cacheKeys(trimmed);
  const primary = keys[0];

  if (!force) {
    const hit = cacheGet(keys);
    // A full-message verdict supersedes a preview one; never downgrade.
    if (hit && (hit.level === 'full' || level === 'preview')) return hit;
    const running = inFlight.get(primary + ':' + level);
    if (running) return running;
  }

  const mode = modeFor(level);
  if (mode === 'off') return null;

  let promise;
  if (mode === 'heuristics' || !settings.apiKey) {
    // Offline is a chosen mode, not a failure - only say something when the
    // user asked for Claude and there is no key to do it with.
    const note = mode === 'api' && !settings.apiKey
      ? 'Set to ask Claude, but no API key is configured.'
      : null;
    const result = heuristicVerdict(trimmed, note);
    cachePut(keys, result);
    promise = Promise.resolve(result);
  } else if (overBudget()) {
    const result = heuristicVerdict(trimmed, 'Daily API limit reached - using offline scoring.');
    cachePut(keys, result);
    promise = Promise.resolve(result);
  } else if (level === 'full') {
    promise = classifyFull(trimmed, keys);
  } else {
    promise = enqueuePreview(trimmed, keys);
  }

  const tracked = promise.finally(() => inFlight.delete(primary + ':' + level));
  inFlight.set(primary + ':' + level, tracked);
  return tracked;
}

async function classifyFull(email, keys) {
  const single = [{ ...email, id: 'e0' }];
  try {
    const { results, usage } = await self.MailLensClaude.classify(single, {
      apiKey: settings.apiKey,
      model: settings.model,
      effort: 'medium',
    });
    recordUsage(usage, 1);
    lastError = null;
    const result = results.length
      ? normalizeVerdict(results[0], 'full', 'claude')
      : heuristicVerdict(email, 'Model returned nothing.');
    cachePut(keys, result);
    return result;
  } catch (err) {
    stats.errors += 1;
    lastError = String(err && err.message ? err.message : err);
    saveStats();
    const result = heuristicVerdict(email, 'Offline scoring - ' + lastError);
    cachePut(keys, result);
    return result;
  }
}

async function testKey(apiKey, model) {
  const res = await self.MailLensClaude.classify(
    [{
      id: 'e0',
      level: 'preview',
      subject: 'Lunch tomorrow?',
      senderName: 'Sam',
      senderEmail: 'sam@example.com',
      snippet: 'hey, still on for 1pm? i can move it if not',
    }],
    { apiKey, model, effort: 'low' },
  );
  return { ok: true, model: res.model };
}

/* ------------------------------------------------------------------ routing */

const handlers = {
  async classify(msg) {
    return classifyEmail(msg.email, msg.force);
  },
  async getSettings() {
    await ready;
    return { settings, hasKey: Boolean(settings.apiKey) };
  },
  async setSettings(msg) {
    await ready;
    settings = { ...settings, ...msg.settings };
    await chrome.storage.local.set({ settings });
    broadcast({ type: 'settingsChanged' });
    return { settings };
  },
  async getStatus() {
    await ready;
    return {
      enabled: settings.enabled,
      hasKey: Boolean(settings.apiKey),
      model: settings.model,
      listMode: settings.listMode,
      openMode: settings.openMode,
      showCleanBadge: settings.showCleanBadge,
      stats,
      lastError,
      cacheSize: Object.keys(cache).length,
      overBudget: overBudget(),
      dailyCallLimit: settings.dailyCallLimit,
    };
  },
  async clearCache() {
    cache = Object.create(null);
    await chrome.storage.local.set({ cache });
    broadcast({ type: 'settingsChanged' });
    return { ok: true };
  },
  async testKey(msg) {
    try {
      return await testKey(msg.apiKey, msg.model);
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handler = handlers[msg && msg.type];
  if (!handler) return false;
  handler(msg)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
  return true; // keep the channel open for the async reply
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
