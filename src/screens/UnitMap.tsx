import { curriculumWithContent } from '../content/loader';
import { useProgress } from '../engine/progress';
import { unitStats } from '../engine/session';
import { href } from '../router';

export function UnitMap() {
  const state = useProgress();
  const now = Date.now();
  const entries = curriculumWithContent();
  const dueTotal = entries.reduce((n, e) => n + (e.unit ? unitStats(e.unit, state, now).due : 0), 0);

  return (
    <div className="screen">
      <h1>Units</h1>
      <p className="muted">
        Priority 1 units keep coming up in lessons. Start there.
        {dueTotal > 0 && <> {dueTotal} item{dueTotal === 1 ? '' : 's'} due for review.</>}
        {state.streak.current > 1 && <> Streak: {state.streak.current} days.</>}
      </p>
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
