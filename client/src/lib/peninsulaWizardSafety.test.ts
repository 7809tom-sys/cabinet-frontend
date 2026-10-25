import { describe, expect, it } from 'vitest';
import { peninsulaWizardEditBlockReason, resolvePeninsulaWizardSelection, removeSinksOwnedByCabinets, reconcilePeninsulaWizardSinks } from './peninsulaWizardSafety';
import { type PlacedCabinet, type RoomData, makeSinkForCabinet } from './design';
import type { PeninsulaWizardCabinet } from './peninsulaWizardPlan';
const root = 'peninsula_wizard_test';
const room: RoomData = { width: 240, depth: 240, peninsulaRuns: [
  { id: root, parentWall: 'top', startOffset: 100, turn: 90, direction: 'right', length: 60, height: 34.5, cabinetSide: 'left' },
  { id: `${root}_45_end`, parentRunId: root, startOffset: 0, turn: 45, direction: 'right', length: 35, height: 34.5, cabinetSide: 'left' },
] };
const base: PlacedCabinet = { uid: 'old-base', cabinetId: 36, masterCode: 'SB36', description: '36 inch sink base', placement: 'base', width: 36, depth: 24, height: 34.5, x: 100, y: 0, rotation: 90, wallId: root, peninsulaWizardId: root };
const option: PeninsulaWizardCabinet = { id: 24, masterCode: 'B24', description: 'base', width: 24, depth: 24, height: 34.5, category: 'Base', subCategory: null, catalogImageUrl: null, placement: 'base' };
describe('Peninsula Wizard transaction safety', () => {
  it('preserves duplicate selected IDs and reports every missing occurrence', () => {
    expect(resolvePeninsulaWizardSelection([24, 99, 24, 99], [option])).toEqual({ items: [option, option], missingIds: [99, 99] });
  });
  it('refuses a locked assembly before any recipe edit', () => {
    const locked = { ...room, peninsulaRuns: room.peninsulaRuns!.map(run => run.id === root ? { ...run, locked: true } : run) };
    expect(peninsulaWizardEditBlockReason(locked, [], root)).toContain('Unlock');
    expect(peninsulaWizardEditBlockReason(room, [], root)).toBeNull();
  });
  it('refuses an edit of a deleted assembly but allows a new build', () => {
    expect(peninsulaWizardEditBlockReason(room, [], 'missing')).toContain('no longer exists');
    expect(peninsulaWizardEditBlockReason(room, [], null)).toBeNull();
  });
  it('preserves ordinary cabinet support on both root and child runs', () => {
    for (const run of room.peninsulaRuns!) {
      const ordinary = { ...base, uid: 'ordinary', wallId: run.id, peninsulaWizardId: undefined };
      expect(peninsulaWizardEditBlockReason(room, [ordinary], root, room.peninsulaRuns)).toBeNull();
      const changed = room.peninsulaRuns!.map(item => item.id === root ? { ...item, startOffset: 101 } : item);
      expect(peninsulaWizardEditBlockReason(room, [ordinary], root, changed)).toContain('ordinary cabinet');
      expect(peninsulaWizardEditBlockReason(room, [ordinary], root, room.peninsulaRuns!.slice(0, 1))).toContain('ordinary cabinet');
    }
  });
  it('allows geometry edits when there are only Wizard-owned cabinets', () => {
    const next = room.peninsulaRuns!.map(run => ({ ...run, length: run.length + 3 }));
    expect(peninsulaWizardEditBlockReason(room, [base], root, next)).toBeNull();
  });
  it('removes explicit and legacy sinks but preserves unrelated explicit ownership', () => {
    const sink = makeSinkForCabinet('single', base, room);
    const legacy = { ...sink, uid: 'legacy', cabinetUid: undefined };
    const unrelated = { ...sink, uid: 'unrelated', cabinetUid: 'ordinary-base' };
    expect(removeSinksOwnedByCabinets([sink, legacy, unrelated], [base])).toEqual([unrelated]);
  });
  it('rebinds a configured sink to the same real cabinet after an edit', () => {
    const sink = { ...makeSinkForCabinet('single', base, room), faucet: true };
    const replacement = { ...base, uid: 'new-base', x: base.x + 6 };
    const result = reconcilePeninsulaWizardSinks([sink], [base], [replacement], root);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ uid: sink.uid, cabinetUid: replacement.uid, faucet: true, x: sink.x + 6 });
    expect(reconcilePeninsulaWizardSinks([sink], [base], [], root)).toEqual([]);
  });
  it('rebinds legacy unowned fixtures without creating duplicates', () => {
    const sink = { ...makeSinkForCabinet('single', base, room), cabinetUid: undefined };
    const replacement = { ...base, uid: 'new-base' };
    expect(reconcilePeninsulaWizardSinks([sink], [base], [replacement], root)[0]?.cabinetUid).toBe('new-base');
  });
});
