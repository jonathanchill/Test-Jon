'use strict';

function send(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response && response.ok ? response.data : null);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function banner(text, warn) {
  const node = document.getElementById('banner');
  node.hidden = !text;
  node.className = warn ? 'banner warn' : 'banner';
  node.textContent = text || '';
}

async function render() {
  const status = await send({ type: 'getStatus' });
  if (!status) {
    banner('The extension background is not responding. Reload it from chrome://extensions.');
    return;
  }

  document.getElementById('enabled').checked = Boolean(status.enabled);

  const offline = status.listMode !== 'api' && status.openMode !== 'api';
  if (!status.enabled) banner('Mail Lens is off. Nothing is being read or sent.');
  else if (status.lastError) banner('Last Claude call failed: ' + status.lastError, true);
  else if (status.overBudget) banner('Daily API cap reached — using offline scoring until tomorrow.', true);
  else if (!offline && !status.hasKey) banner('A mode is set to Claude but there is no API key, so both are running offline.', true);
  else if (offline) banner('Running offline. Nothing leaves your browser. SPAM and AUTO are solid; HUMAN vs AI is a hunch.');
  else banner('');

  const stats = status.stats || {};
  const rows = [
    ['Engine', offline ? 'offline scoring' : status.model],
    ['Emails judged today', stats.emails || 0],
    ['Cached verdicts', status.cacheSize || 0],
  ];
  if (!offline) rows.splice(1, 0, ['API calls today', (stats.calls || 0) + ' / ' + status.dailyCallLimit]);
  document.getElementById('stats').innerHTML = rows
    .map(([term, value]) => '<dt>' + escapeHtml(term) + '</dt><dd>' + escapeHtml(String(value)) + '</dd>')
    .join('');
}

document.getElementById('enabled').addEventListener('change', async (event) => {
  await send({ type: 'setSettings', settings: { enabled: event.target.checked } });
  render();
});

document.getElementById('options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
  window.close();
});

document.getElementById('clearCache').addEventListener('click', async () => {
  await send({ type: 'clearCache' });
  render();
});

render();
