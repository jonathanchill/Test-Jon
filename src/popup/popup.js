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

function banner(text) {
  const node = document.getElementById('banner');
  node.hidden = !text;
  node.textContent = text || '';
}

async function render() {
  const status = await send({ type: 'getStatus' });
  if (!status) {
    banner('The extension background is not responding. Reload it from chrome://extensions.');
    return;
  }

  document.getElementById('enabled').checked = Boolean(status.enabled);

  if (!status.enabled) banner('Mail Lens is off. Nothing is being read or sent.');
  else if (!status.hasKey) banner('No Claude API key yet — running on offline scoring. Add a key in Settings for sharper verdicts.');
  else if (status.overBudget) banner('Daily API cap reached. Falling back to offline scoring until tomorrow.');
  else if (status.lastError) banner('Last API call failed: ' + status.lastError);
  else banner('');

  const stats = status.stats || {};
  const rows = [
    ['Engine', status.hasKey ? status.model : 'offline scoring'],
    ['API calls today', (stats.calls || 0) + ' / ' + status.dailyCallLimit],
    ['Emails judged today', stats.emails || 0],
    ['Cached verdicts', status.cacheSize || 0],
  ];
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
