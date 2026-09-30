import { getUnit } from '../content/loader';
import { useProgress } from '../engine/progress';
import { MODE_LABELS, type Mode, unitStats, visibleItems } from '../engine/session';
import { href } from '../router';
import { Explanation } from '../ui/Explanation';
import { CheckMarker, RegisterTag, SourceTag } from '../ui/Tags';
import { NotFound } from './NotFound';

const MODES: Mode[] = ['flash-fr', 'flash-en', 'gapfill', 'mixed'];

export function UnitScreen({ id }: { id: string }) {
  const unit = getUnit(id);
  const state = useProgress();
  if (!unit) return <NotFound what={`unit "${id}"`} />;

  const stats = unitStats(unit, state, Date.now());
  const items = visibleItems(unit.items, state.settings.showVulgar);
  const counts = { flashcard: 0, gapfill: 0 };
  for (const i of items) if (i.type in counts) counts[i.type as keyof typeof counts]++;

  return (
    <div className="screen">
      <p className="crumbs">
        <a href={href({ name: 'home' })}>Units</a>
      </p>
      <h1>{unit.title}</h1>
      <p className="muted">
        {stats.total} items · {stats.seen} seen{stats.due > 0 && <> · {stats.due} due</>}
      </p>

      <section>
        <h2>The rule</h2>
        <Explanation text={unit.explanation} />
      </section>

      <section>
        <h2>Drill</h2>
        <div className="mode-list">
          {MODES.map((mode) => {
            const n = mode === 'mixed' ? counts.flashcard + counts.gapfill : mode === 'gapfill' ? counts.gapfill : counts.flashcard;
            if (n === 0) return null;
            return (
              <a key={mode} className="btn btn-block" href={href({ name: 'drill', id: unit.id, mode })}>
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
              <span className="fr">{item.fr}</span>
              <span className="muted"> {item.en}</span>
              <span className="tags">
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
