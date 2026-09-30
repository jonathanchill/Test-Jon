import type { Item } from '../content/types';

export function CheckMarker({ item }: { item: Item }) {
  if (!item.check) return null;
  return (
    <span className="tag tag-check" title="Reconstructed or corrected without Charlotte. Ask her next lesson.">
      verify with Charlotte
    </span>
  );
}

export function RegisterTag({ item }: { item: Item }) {
  if (item.register === 'neutral') return null;
  return <span className={`tag tag-${item.register}`}>{item.register}</span>;
}

export function SourceTag({ item }: { item: Item }) {
  const label = item.source === 'lesson' && item.lesson_date ? `lesson ${formatDate(item.lesson_date)}` : item.source;
  return <span className="tag tag-source">{label}</span>;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[(m ?? 1) - 1]} ${y}`;
}
