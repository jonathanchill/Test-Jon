import { type ChangeEvent, useState } from 'react';
import { allItems } from '../content/loader';
import { getState, mergeStates, parseState, resetAll, serialise, setSettings, setState, useProgress } from '../engine/progress';
import { href } from '../router';

export function SettingsScreen() {
  const state = useProgress();
  const [message, setMessage] = useState<string | null>(null);
  const seen = Object.values(state.items).filter((p) => p.last > 0).length;
  const inBank = Object.values(state.items).filter((p) => p.inBank).length;
  const vulgarCount = allItems().filter((i) => i.register === 'vulgar').length;

  function exportProgress() {
    const blob = new Blob([serialise(getState())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `french-progress-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage('Exported. Move the file to your other device and import it there.');
  }

  async function importProgress(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const incoming = parseState(await file.text());
      const { state: merged, imported } = mergeStates(getState(), incoming);
      setState(merged);
      setMessage(`Imported ${imported} item${imported === 1 ? '' : 's'}. Newer answers won where both devices had the same item.`);
    } catch (err) {
      setMessage(`Could not import: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  function reset() {
    if (window.confirm('Delete all progress on this device? Export first if you want to keep it.')) {
      resetAll();
      setMessage('Progress cleared.');
    }
  }

  return (
    <div className="screen">
      <p className="crumbs">
        <a href={href({ name: 'home' })}>Units</a>
      </p>
      <h1>Settings</h1>

      <section>
        <h2>Content</h2>
        <label className="toggle">
          <input type="checkbox" checked={state.settings.showVulgar} onChange={(e) => setSettings({ showVulgar: e.target.checked })} />
          <span>
            Show vulgar items <span className="muted">({vulgarCount} in the content, hidden by default)</span>
          </span>
        </label>
      </section>

      <section>
        <h2>Progress</h2>
        <p className="muted">
          Progress is saved on this device only. To carry it between laptop and phone, export here and import on the other
          device. Importing merges: for each item the more recently answered copy wins.
        </p>
        <p>
          {seen} items seen · {inBank} in the mistake bank · streak {state.streak.current} day{state.streak.current === 1 ? '' : 's'}
        </p>
        <div className="mode-list">
          <button className="btn btn-primary btn-block" onClick={exportProgress}>
            Export progress as JSON
          </button>
          <label className="btn btn-block file-btn">
            Import progress from JSON
            <input type="file" accept="application/json,.json" onChange={importProgress} hidden />
          </label>
          <button className="btn btn-block btn-danger" onClick={reset}>
            Reset all progress on this device
          </button>
        </div>
        {message && (
          <p className="notice" role="status">
            {message}
          </p>
        )}
      </section>

      <section>
        <h2>About</h2>
        <p className="muted">
          Everything runs in your browser. No accounts, no tracking, nothing is sent anywhere. Items marked{' '}
          <span className="tag tag-check">verify with Charlotte</span> were reconstructed from unclear transcripts or corrected
          without her, so check them next lesson.
        </p>
      </section>
    </div>
  );
}
