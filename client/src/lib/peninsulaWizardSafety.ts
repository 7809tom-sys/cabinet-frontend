import {
  fixtureIsOnCabinetFootprint, isSinkBaseCabinet, peninsulaRunAssemblyLocked,
  type PlacedCabinet, type RoomData, type SinkFixture, type PeninsulaRun,
} from './design';
import { peninsulaWizardAssemblyRunIds } from './peninsulaWizardEdit';
import type { PeninsulaWizardCabinet } from './peninsulaWizardPlan';

/** Preserve every ordered choice, including repeated IDs; never silently drop unavailable products. */
export function resolvePeninsulaWizardSelection(ids: readonly number[], pool: readonly PeninsulaWizardCabinet[]) {
  const byId = new Map(pool.map(item => [item.id, item]));
  return {
    items: ids.map(id => byId.get(id)).filter((item): item is PeninsulaWizardCabinet => item != null),
    missingIds: ids.filter(id => !byId.has(id)),
  };
}

/** Changes must not unlock an assembly or orphan an ordinary cabinet's supporting run. */
export function peninsulaWizardEditBlockReason(
  room: RoomData, placed: readonly PlacedCabinet[], rootId: string | null, nextRuns?: readonly PeninsulaRun[],
): string | null {
  if (!rootId) return null;
  const root = room.peninsulaRuns?.find(run => run.id === rootId);
  if (!root) return 'This Wizard peninsula no longer exists. Close the Wizard and reopen the current plan.';
  if (peninsulaRunAssemblyLocked(root, room)) return 'Unlock this peninsula before updating its Wizard recipe.';
  if (!nextRuns) return null;
  const assemblyIds = peninsulaWizardAssemblyRunIds(room, rootId);
  const ordinary = placed.filter(item => assemblyIds.has(item.wallId ?? '') && item.peninsulaWizardId !== rootId);
  if (!ordinary.length) return null;
  const geometry = (run: PeninsulaRun) => JSON.stringify([
    run.parentWall ?? null, run.parentRunId ?? null, run.startOffset, run.turn ?? 90,
    run.direction, run.length, run.cabinetSide ?? 'left',
  ]);
  const changed = Array.from(assemblyIds).some(id => {
    const old = room.peninsulaRuns!.find(run => run.id === id)!;
    const next = nextRuns.find(run => run.id === id);
    return !next || geometry(old) !== geometry(next);
  });
  return changed
    ? 'An ordinary cabinet uses this peninsula assembly. Move it first before changing the attachment, length, side, or return; no Wizard items were changed.'
    : null;
}

/** Explicit fixture ownership wins; footprint matching is only for older unowned sinks. */
export function removeSinksOwnedByCabinets(sinks: readonly SinkFixture[], outgoing: readonly PlacedCabinet[]): SinkFixture[] {
  const bases = outgoing.filter(isSinkBaseCabinet);
  return sinks.filter(sink => !bases.some(base => sink.cabinetUid
    ? sink.cabinetUid === base.uid
    : fixtureIsOnCabinetFootprint(sink, base)));
}

/** Keep a configured sink when its exact catalog base survives an edit; remove obsolete fixtures. */
export function reconcilePeninsulaWizardSinks(
  sinks: readonly SinkFixture[], before: readonly PlacedCabinet[], after: readonly PlacedCabinet[], rootId: string,
): SinkFixture[] {
  const outgoing = before.filter(item => item.peninsulaWizardId === rootId && isSinkBaseCabinet(item));
  const available = after.filter(item => item.peninsulaWizardId === rootId && isSinkBaseCabinet(item));
  const mapped = new Map<string, PlacedCabinet>();
  for (const old of outgoing) {
    const index = available.findIndex(item => item.cabinetId === old.cabinetId && item.masterCode === old.masterCode);
    if (index >= 0) mapped.set(old.uid, available.splice(index, 1)[0]!);
  }
  return sinks.flatMap(sink => {
    const old = outgoing.find(base => sink.cabinetUid ? sink.cabinetUid === base.uid : fixtureIsOnCabinetFootprint(sink, base));
    if (!old) return [sink];
    const next = mapped.get(old.uid);
    return next ? [{ ...sink, cabinetUid: next.uid, x: sink.x + next.x - old.x, y: sink.y + next.y - old.y }] : [];
  });
}
