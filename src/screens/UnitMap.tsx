import { allUnits, curriculumWithContent } from '../content/loader';
import { useProgress } from '../engine/progress';
import { unitStats } from '../engine/session';
import { href } from '../router';

export function UnitMap() {
  const state = useProgress();
  const now = Date.now();
  const entries = curriculumWithContent();
  let dueTotal = 0;
  let bankTotal = 0;
  for (const u of allUnits()) {
    const s = unitStats(u, state, now);
    dueTotal += s.due;
    bankTotal += s.inBank;
  }

  return (
    <div className="screen">
      <h1>Today</h1>
      <div className="today-row">
        <a className={`btn btn-block ${dueTotal > 0 ? 'btn-primary' : ''}`} href={href({ name: 'review' })}>
          Review {dueTotal > 0 ? `${dueTotal} due` : ''}
        </a>
        <a className="btn btn-block" href={href({ name: 'bank' })}>
          Mistake bank {bankTotal > 0 ? `(${bankTotal})` : ''}
        </a>
        <a className="btn btn-block" href={href({ name: 'errors' })}>
          Spot the mistake
        </a>
      </div>
      <p className="muted">
        {dueTotal === 0 ? 'Nothing due right now. ' : ''}
        {state.streak.current > 1 ? `Streak: ${state.streak.current} days. ` : ''}
        Priority 1 units keep coming up in lessons. Start there.
      </p>

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
                  {stats.seen}/{stats.total} seen
                  {stats.due > 0 && <> · {stats.due} due</>}
                  {stats.inBank > 0 && <> · {stats.inBank} in mistake bank</>}
                </p>
              ) : (
                <p className="unit-stats muted">arrives with the audio milestone</p>
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
