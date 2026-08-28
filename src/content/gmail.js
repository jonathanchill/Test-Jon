/*
 * Gmail content script.
 *
 * Reads what Gmail has already rendered - the rows of the message list, and the
 * body of whatever conversation is open - asks the service worker to classify
 * it, and paints the verdict in both places.
 *
 * Gmail's class names are obfuscated and change over time, so every selector
 * here has fallbacks and nothing throws if one stops matching.
 */
(function () {
  'use strict';

  const { hash, norm } = window.MailLensUtil;

  const PILL = 'ml-pill';
  const CARD = 'ml-card';
  const SCAN_MARGIN = 600; // px beyond the viewport that still counts as visible

  let settings = { showCleanBadge: true, enabled: true };
  let scanTimer = null;

  /* ----------------------------------------------------------- extraction */

  function textOf(el) {
    return el ? norm(el.innerText || el.textContent || '') : '';
  }

  function senderFrom(scope) {
    const el = scope.querySelector('span[email], .gD, .yP, .zF');
    if (!el) return { senderName: '', senderEmail: '' };
    return {
      senderName: el.getAttribute('name') || textOf(el),
      senderEmail: (el.getAttribute('email') || '').toLowerCase(),
    };
  }

  function threadIdFrom(scope) {
    const own = scope.getAttribute && scope.getAttribute('data-legacy-thread-id');
    if (own) return own;
    const inner = scope.querySelector && scope.querySelector('[data-legacy-thread-id]');
    if (inner) return inner.getAttribute('data-legacy-thread-id');
    const up = scope.closest && scope.closest('[data-legacy-thread-id]');
    if (up) return up.getAttribute('data-legacy-thread-id');
    const perm = scope.closest && scope.closest('[data-thread-perm-id]');
    if (perm) return perm.getAttribute('data-thread-perm-id');
    return '';
  }

  function keyOf(email) {
    if (email.threadId) return 't:' + email.threadId;
    return 'h:' + hash(norm(email.senderEmail || email.senderName) + ' ' + norm(email.subject));
  }

  function extractRow(row) {
    const subjectEl = row.querySelector('.bog') || row.querySelector('.y6 span[id]');
    const snippetEl = row.querySelector('.y2');
    const senderScope = row.querySelector('.yW') || row.querySelector('.bA4') || row;
    const email = {
      level: 'preview',
      subject: textOf(subjectEl),
      snippet: textOf(snippetEl).replace(/^[\s–—-]+/, ''),
      threadId: threadIdFrom(row),
      ...senderFrom(senderScope),
    };
    if (!email.subject && !email.snippet) return null;
    return email;
  }

  /** The visible body text of one open message, with quoted history removed. */
  function bodyTextOf(bodyEl) {
    const clone = bodyEl.cloneNode(true);
    clone.querySelectorAll('blockquote, .gmail_quote, .adL, .' + CARD).forEach((n) => n.remove());
    return norm(clone.innerText || clone.textContent || '').slice(0, 8000);
  }

  function extractOpenMessage(bodyEl) {
    const container =
      bodyEl.closest('.adn') || bodyEl.closest('.h7') || bodyEl.closest('[data-message-id]') || bodyEl.parentElement;
    if (!container) return null;
    const header = container.querySelector('.gE') || container;
    const subjectEl =
      document.querySelector('div[role="main"] h2.hP') || document.querySelector('h2.hP');
    const email = {
      level: 'full',
      subject: textOf(subjectEl),
      body: bodyTextOf(bodyEl),
      threadId: threadIdFrom(container),
      ...senderFrom(header),
    };
    if (email.body.length < 2) return null;
    return email;
  }

  /* -------------------------------------------------------------- verdicts */

  function labelFor(result) {
    if (result.spam.verdict === 'spam') {
      return { text: 'SPAM', cls: 'ml-spam', confidence: result.spam.confidence };
    }
    switch (result.authorship.verdict) {
      case 'ai':
        return { text: 'AI', cls: 'ml-ai', confidence: result.authorship.confidence };
      case 'mixed':
        return { text: 'AI+H', cls: 'ml-mixed', confidence: result.authorship.confidence };
      case 'human':
        return { text: 'HUMAN', cls: 'ml-human', confidence: result.authorship.confidence };
      default:
        return { text: '?', cls: 'ml-unclear', confidence: result.authorship.confidence };
    }
  }

  function tooltip(result) {
    const lines = [
      'Spam: ' + (result.spam.verdict === 'spam' ? 'yes' : 'no') + ' (' + result.spam.confidence + '% sure)',
      'Written by: ' + authorshipWord(result.authorship.verdict) + ' (' + result.authorship.confidence + '% sure)',
    ];
    if (result.reason) lines.push('', result.reason);
    lines.push('', source(result));
    if (result.note) lines.push(result.note);
    return lines.join('\n');
  }

  function authorshipWord(verdict) {
    return { ai: 'AI', human: 'a human', mixed: 'a human, AI-polished', unclear: 'not clear' }[verdict] || verdict;
  }

  function source(result) {
    const engine = result.engine === 'claude' ? 'Claude' : 'offline scoring';
    const level = result.level === 'full' ? 'full message' : 'subject + preview only';
    return 'Judged by ' + engine + ', from the ' + level + '.';
  }

  function isBoring(result) {
    return result.spam.verdict !== 'spam' &&
      (result.authorship.verdict === 'human' || result.authorship.verdict === 'unclear');
  }

  /* ------------------------------------------------------------- rendering */

  function renderRowPill(row, result) {
    const anchor = row.querySelector('.y6') || row.querySelector('.xT') || row.querySelector('td.xY');
    if (!anchor) return;
    let pill = row.querySelector(':scope .' + PILL);

    if (result && isBoring(result) && !settings.showCleanBadge) {
      if (pill) pill.remove();
      return;
    }
    if (!pill) {
      pill = document.createElement('span');
      pill.className = PILL;
      anchor.insertBefore(pill, anchor.firstChild);
    }
    if (!result) {
      pill.className = PILL + ' ml-pending';
      pill.textContent = '···';
      pill.title = 'Mail Lens is looking at this message';
      return;
    }
    const label = labelFor(result);
    pill.className = PILL + ' ' + label.cls + (result.level === 'full' ? ' ml-full' : ' ml-preview');
    pill.textContent = label.text + ' ' + label.confidence;
    pill.title = tooltip(result);
  }

  /**
   * One scored row: the question, the answer, and how sure we are of *that
   * answer* - the bar tracks confidence, never "how spammy", so it must always
   * sit next to the word it belongs to.
   */
  function metric(label, answer, percent, fill) {
    return '<div class="ml-metric">' +
      '<label>' + escapeHtml(label) + '</label>' +
      '<b class="ml-answer ml-fg-' + fill + '">' + escapeHtml(answer) + '</b>' +
      '<span class="ml-bar"><i class="ml-fill-' + fill + '" style="width:' + percent + '%"></i></span>' +
      '<span class="ml-pct">' + percent + '% sure</span>' +
      '</div>';
  }

  function renderCard(bodyEl, result) {
    const parent = bodyEl.parentElement;
    if (!parent) return;
    let card = parent.querySelector(':scope > .' + CARD);
    if (!card) {
      card = document.createElement('div');
      card.className = CARD;
      parent.insertBefore(card, bodyEl);
    }
    if (!result) {
      card.className = CARD + ' ml-pending';
      card.textContent = 'Mail Lens is reading this message…';
      return;
    }

    const label = labelFor(result);
    const isSpam = result.spam.verdict === 'spam';
    const author = result.authorship.verdict;
    const authorAnswer = { ai: 'yes', mixed: 'partly', human: 'no', unclear: 'cannot tell' }[author] || author;
    const authorFill = author === 'ai' || author === 'mixed' ? 'ai' : author === 'human' ? 'human' : 'ok';

    card.className = CARD + ' ' + label.cls;
    card.innerHTML =
      '<div class="ml-card-head">' +
        '<span class="ml-chip ' + label.cls + '">' + escapeHtml(label.text) + '</span>' +
        '<span class="ml-headline">' +
          (isSpam ? 'Looks like spam' : 'Not spam') + ' · ' +
          'written by ' + escapeHtml(authorshipWord(author)) +
        '</span>' +
        '<button type="button" class="ml-recheck">Re-check</button>' +
      '</div>' +
      '<div class="ml-metrics">' +
        metric('Spam?', isSpam ? 'yes' : 'no', result.spam.confidence, isSpam ? 'spam' : 'ok') +
        metric('AI-written?', authorAnswer, result.authorship.confidence, authorFill) +
      '</div>' +
      (result.reason ? '<div class="ml-reason">' + escapeHtml(result.reason) + '</div>' : '') +
      '<div class="ml-source">' + escapeHtml(source(result)) + (result.note ? ' — ' + escapeHtml(result.note) : '') + '</div>';

    const button = card.querySelector('.ml-recheck');
    if (button) {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        delete bodyEl.dataset.mlKey;
        renderCard(bodyEl, null);
        classifyAndPaint(bodyEl, true);
      });
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* --------------------------------------------------------------- plumbing */

  function ask(message) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError || !response || !response.ok) return resolve(null);
          resolve(response.data);
        });
      } catch (_) {
        resolve(null); // extension reloaded out from under the page
      }
    });
  }

  function inViewport(el) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) return false;
    return rect.bottom > -SCAN_MARGIN && rect.top < window.innerHeight + SCAN_MARGIN;
  }

  async function classifyAndPaint(bodyEl, force) {
    const email = extractOpenMessage(bodyEl);
    if (!email) return;
    const key = keyOf(email) + ':' + hash(email.body.slice(0, 200));
    if (!force && bodyEl.dataset.mlKey === key) return;
    bodyEl.dataset.mlKey = key;

    renderCard(bodyEl, null);
    const result = await ask({ type: 'classify', email, force: Boolean(force) });
    if (!result) {
      const card = bodyEl.parentElement && bodyEl.parentElement.querySelector(':scope > .' + CARD);
      if (card) card.remove();
      return;
    }
    renderCard(bodyEl, result);
    refreshRowsFor(email);
  }

  /** A full-message verdict beats the preview one, so repaint the matching row. */
  function refreshRowsFor(email) {
    const wanted = keyOf(email);
    document.querySelectorAll('tr.zA').forEach((row) => {
      const rowEmail = extractRow(row);
      if (rowEmail && keyOf(rowEmail) === wanted) delete row.dataset.mlKey;
    });
    scanSoon();
  }

  async function scanRows() {
    const rows = document.querySelectorAll('tr.zA');
    for (const row of rows) {
      if (!inViewport(row)) continue;
      const email = extractRow(row);
      if (!email) continue;
      const key = keyOf(email) + ':' + hash(email.subject + email.snippet);
      if (row.dataset.mlKey === key) continue;
      row.dataset.mlKey = key;

      renderRowPill(row, null);
      // eslint-disable-next-line no-loop-func
      ask({ type: 'classify', email }).then((result) => {
        if (row.dataset.mlKey !== key) return; // Gmail recycled the row
        if (!result) {
          const pill = row.querySelector(':scope .' + PILL);
          if (pill) pill.remove();
          return;
        }
        renderRowPill(row, result);
      });
    }
  }

  function scanOpenMessages() {
    document.querySelectorAll('div.a3s').forEach((bodyEl) => {
      if (bodyEl.closest('.gmail_quote')) return;
      if (!inViewport(bodyEl)) return;
      classifyAndPaint(bodyEl, false);
    });
  }

  function scan() {
    if (!settings.enabled) return;
    try {
      scanRows();
      scanOpenMessages();
    } catch (err) {
      console.warn('[Mail Lens] scan failed', err);
    }
  }

  function scanSoon() {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 250);
  }

  async function refreshSettings() {
    const status = await ask({ type: 'getStatus' });
    if (status) settings = status;
  }

  async function start() {
    await refreshSettings();
    if (!settings.enabled) return;

    new MutationObserver(scanSoon).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', scanSoon, { passive: true, capture: true });
    window.addEventListener('hashchange', scanSoon);
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === 'settingsChanged') {
        refreshSettings().then(() => {
          document.querySelectorAll('[data-ml-key]').forEach((el) => delete el.dataset.mlKey);
          document.querySelectorAll('.' + PILL + ', .' + CARD).forEach((el) => el.remove());
          scan();
        });
      }
    });
    scanSoon();
  }

  start();
})();
