'use strict';

const FIELDS = {
  enabled: 'checked',
  apiKey: 'value',
  model: 'value',
  listMode: 'value',
  openMode: 'value',
  showCleanBadge: 'checked',
  dailyCallLimit: 'value',
};

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response && response.ok ? response.data : null);
    });
  });
}

function el(id) {
  return document.getElementById(id);
}

let savedTimer = null;
function flashSaved() {
  const badge = el('saved');
  badge.hidden = false;
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { badge.hidden = true; }, 1200);
}

async function save() {
  const settings = {};
  for (const [id, prop] of Object.entries(FIELDS)) {
    let value = el(id)[prop];
    if (id === 'dailyCallLimit') value = Math.max(0, parseInt(value, 10) || 0);
    if (id === 'apiKey') value = String(value).trim();
    settings[id] = value;
  }
  await send({ type: 'setSettings', settings });
  flashSaved();
  renderStats();
}

function renderStatsInto(status) {
  const stats = status.stats || {};
  const rows = [
    ['API calls today', (stats.calls || 0) + ' of ' + status.dailyCallLimit],
    ['Emails judged today', stats.emails || 0],
    ['Tokens in / out', (stats.inputTokens || 0).toLocaleString() + ' / ' + (stats.outputTokens || 0).toLocaleString()],
    ['Failed calls', stats.errors || 0],
    ['Cached verdicts', status.cacheSize || 0],
  ];
  if (status.lastError) rows.push(['Last error', status.lastError]);
  el('stats').innerHTML = rows
    .map(([term, value]) => '<dt>' + escapeHtml(term) + '</dt><dd>' + escapeHtml(String(value)) + '</dd>')
    .join('');
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderStats() {
  const status = await send({ type: 'getStatus' });
  if (status) renderStatsInto(status);
}

async function init() {
  const data = await send({ type: 'getSettings' });
  const settings = (data && data.settings) || {};
  for (const [id, prop] of Object.entries(FIELDS)) {
    if (settings[id] !== undefined) el(id)[prop] = settings[id];
  }
  await renderStats();

  for (const id of Object.keys(FIELDS)) {
    const node = el(id);
    node.addEventListener('change', save);
    if (node.type === 'password' || node.type === 'number') {
      node.addEventListener('blur', save);
    }
  }

  el('toggleKey').addEventListener('click', () => {
    const input = el('apiKey');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    el('toggleKey').textContent = showing ? 'Show' : 'Hide';
  });

  el('testKey').addEventListener('click', async () => {
    const status = el('keyStatus');
    const key = el('apiKey').value.trim();
    if (!key) {
      status.className = 'status bad';
      status.textContent = 'Enter a key first.';
      return;
    }
    status.className = 'status';
    status.textContent = 'Checking…';
    await save();
    const result = await send({ type: 'testKey', apiKey: key, model: el('model').value });
    if (result && result.ok) {
      status.className = 'status ok';
      status.textContent = 'Working — answered with ' + result.model + '.';
    } else {
      status.className = 'status bad';
      status.textContent = (result && result.error) || 'The test call failed.';
    }
    renderStats();
  });

  el('clearCache').addEventListener('click', async () => {
    await send({ type: 'clearCache' });
    flashSaved();
    renderStats();
  });
}

init();
