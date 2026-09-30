import { getUnit } from '../content/loader';
import { useProgress } from '../engine/progress';
import { MODES, MODE_LABELS, countByType, typesForMode, unitStats, visibleItems } from '../engine/session';
import { href } from '../router';
import { Explanation } from '../ui/Explanation';
import { CheckMarker, RegisterTag, SourceTag } from '../ui/Tags';
import { NotFound } from './NotFound';

export function UnitScreen({ id }: { id: string }) {
  const unit = getUnit(id);
  const state = useProgress();
  if (!unit) return <NotFound what={`unit "${id}"`} />;

  const stats = unitStats(unit, state, Date.now());
  const items = visibleItems(unit.items, state.settings.showVulgar);
  const counts = countByType(items);

  return (
    <div className="screen">
      <p className="crumbs">
        <a href={href({ name: 'home' })}>Units</a>
      </p>
      <h1>{unit.title}</h1>
      <p className="muted">
        {stats.total} items · {stats.seen} seen{stats.due > 0 && <> · {stats.due} due</>}
        {stats.inBank > 0 && <> · {stats.inBank} in mistake bank</>}
      </p>

      <section>
        <h2>The rule</h2>
        <Explanation text={unit.explanation} />
      </section>

      <section>
        <h2>Drill</h2>
        <div className="mode-list">
          {MODES.map((mode) => {
            const n = typesForMode(mode).reduce((sum, t) => sum + (counts[t] ?? 0), 0);
            if (n === 0) return null;
            return (
              <a key={mode} className={`btn btn-block ${mode === 'mixed' ? 'btn-primary' : ''}`} href={href({ name: 'drill', id: unit.id, mode })}>
                {MODE_LABELS[mode]} <span className="muted">({n})</span>
              </a>
            );
          })}
        </div>
      </section>

      <details className="browse">
        <summary>Browse all {items.length} items</summary>
        <ul className="item-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="fr">{item.type === 'errorspot' ? item.fr : item.type === 'open' ? item.prompt_fr : item.fr}</span>
              <span className="muted"> {item.en}</span>
              <span className="tags">
                <span className="tag">{item.type}</span>
                <RegisterTag item={item} />
                <SourceTag item={item} />
                <CheckMarker item={item} />
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
