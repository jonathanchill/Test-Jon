import { href } from '../router';

export function NotFound({ what }: { what: string }) {
  return (
    <div className="screen">
      <h1>Not found</h1>
      <p className="muted">There is no {what}.</p>
      <a className="btn" href={href({ name: 'home' })}>
        Back to the units
      </a>
    </div>
  );
}
