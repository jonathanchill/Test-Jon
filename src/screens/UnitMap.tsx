import { allUnits, curriculumWithContent } from '../content/loader';
import { useProgress } from '../engine/progress';
import { unitStats } from '../engine/session';
import { percent, unitMastery, weakestUnit } from '../engine/mastery';
import { formatDate } from '../ui/Tags';
import { href } from '../router';

export function UnitMap() {
  const state = useProgress();
  const now = Date.now();
  const entries = curriculumWithContent();
  let dueTotal = 0;
  let bankTotal = 0;
  let known = 0;
  let total = 0;
  for (const u of allUnits()) {
    const s = unitStats(u, state, now);
    dueTotal += s.due;
    bankTotal += s.inBank;
    known += Math.round(unitMastery(u, state) * s.total);
    total += s.total;
  }
  const weakest = weakestUnit(allUnits(), state);
  const exportStale = state.updatedAt > 0 && (!state.lastExportAt || state.updatedAt - state.lastExportAt > 7 * 24 * 60 * 60 * 1000);

  return (
    <div className="screen">
      <h1>Today</h1>
      <a className="btn btn-primary btn-block today-main" href={href({ name: 'today' })}>
        Today's lesson <span className="muted-on-dark">{dueTotal > 0 ? `${dueTotal} due` : ''}{weakest ? ` + ${weakest.title}` : ''}</span>
      </a>
      <div className="today-row">
        <a className="btn btn-block" href={href({ name: 'review' })}>
          Review {dueTotal > 0 ? `(${dueTotal})` : ''}
        </a>
        <a className="btn btn-block" href={href({ name: 'bank' })}>
          Mistake bank {bankTotal > 0 ? `(${bankTotal})` : ''}
        </a>
        <a className="btn btn-block" href={href({ name: 'errors' })}>
          Spot the mistake
        </a>
      </div>
      <p className="muted">
        {total > 0 ? `${percent(known / total)}% of ${total} items known. ` : ''}
        {state.streak.current > 0 ? `Streak: ${state.streak.current} day${state.streak.current === 1 ? '' : 's'}. ` : ''}
        {dueTotal === 0 ? 'Nothing due right now.' : ''}
      </p>
      {exportStale && (
        <p className="notice">
          Progress lives on this device only.{' '}
          {state.lastExportAt ? `Last exported ${formatDate(new Date(state.lastExportAt).toISOString().slice(0, 10))}.` : 'Never exported.'}{' '}
          <a href={href({ name: 'settings' })}>Export it</a> to carry it to your other device.
        </p>
      )}

      <h1>Units</h1>
      <ol className="unit-list">
        {entries.map(({ planned, unit }, i) => {
          const stats = unit ? unitStats(unit, state, now) : null;
          const inner = (
            <>
              <div className="unit-head">
                <span className="unit-number">{i + 1}</span>
                <span className="unit-title">{planned.title}</span>
                <span className={`tag tag-p${planned.priority}`}>P{planned.priority}</span>
              </div>
              <p className="muted unit-blurb">{planned.blurb}</p>
              {stats ? (
                <p className="unit-stats">
                  {unit && percent(unitMastery(unit, state))}% known · {stats.seen}/{stats.total} seen
                  {stats.due > 0 && <> · {stats.due} due</>}
                  {stats.inBank > 0 && <> · {stats.inBank} in mistake bank</>}
                </p>
              ) : (
                <p className="unit-stats muted">not yet added</p>
              )}
            </>
          );
          return (
            <li key={planned.id} className={`unit-card ${unit ? '' : 'unit-card-disabled'}`}>
              {unit ? <a href={href({ name: 'unit', id: unit.id })}>{inner}</a> : <div>{inner}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
