import { useCallback } from 'react';
import { allUnits, getUnit } from '../content/loader';
import type { ProgressState } from '../engine/progress';
import { MODE_LABELS, type Mode, buildBankSession, buildErrorSession, buildReviewSession, buildUnitSession, modeIsGraded } from '../engine/session';
import { href } from '../router';
import { Drill } from './Drill';
import { NotFound } from './NotFound';

export function UnitDrillScreen({ id, mode }: { id: string; mode: Mode }) {
  const unit = getUnit(id);
  const build = useCallback((state: ProgressState, seed: number) => (unit ? buildUnitSession(unit, mode, state, seed) : []), [unit, mode]);
  if (!unit) return <NotFound what={`unit "${id}"`} />;
  return (
    <Drill
      title={MODE_LABELS[mode]}
      crumbs={
        <>
          <a href={href({ name: 'home' })}>Units</a> › <a href={href({ name: 'unit', id: unit.id })}>{unit.title}</a>
        </>
      }
      build={build}
      flashFront={mode === 'flash-en' ? 'en' : 'fr'}
      backHref={href({ name: 'unit', id: unit.id })}
      backLabel="Back to the unit"
      emptyMessage="This unit has no items of that kind yet."
      shadow={!modeIsGraded(mode)}
    />
  );
}

const home = <a href={href({ name: 'home' })}>Units</a>;

export function ReviewScreen() {
  const build = useCallback((state: ProgressState, seed: number) => buildReviewSession(allUnits(), state, seed), []);
  return (
    <Drill
      title="Review: everything due today"
      crumbs={home}
      build={build}
      flashFront="en"
      backHref={href({ name: 'home' })}
      backLabel="Back to the units"
      emptyMessage="Nothing is due. Drill a unit to add items to your review, or come back tomorrow."
    />
  );
}

export function BankScreen() {
  const build = useCallback((state: ProgressState, seed: number) => buildBankSession(allUnits(), state, seed), []);
  return (
    <Drill
      title="Mistake bank"
      crumbs={home}
      build={build}
      flashFront="en"
      backHref={href({ name: 'home' })}
      backLabel="Back to the units"
      emptyMessage="Your mistake bank is empty. Anything you get wrong lands here until you get it right twice in a row."
    />
  );
}

export function ErrorsScreen() {
  const build = useCallback((state: ProgressState, seed: number) => buildErrorSession(allUnits(), state, seed), []);
  return (
    <Drill
      title="Spot the mistake: your real slips"
      crumbs={home}
      build={build}
      flashFront="fr"
      backHref={href({ name: 'home' })}
      backLabel="Back to the units"
      emptyMessage="No error-spotting items yet."
    />
  );
}
