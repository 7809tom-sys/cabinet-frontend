import { useEffect, useMemo, useRef, useState } from "react";
import { Columns3, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { masterTracFinishColor, masterTracProduct } from "@/lib/closet";
import { cabinetWallRunSegment, type PlacedCabinet, type RoomData, type WallOpening, type WallSide } from "@/lib/design";
import {
  CORNER_FOOTPRINT_IN, CORNER_SHELF_THICKNESS_IN, cornerShelfClearances, masterTracCornerParts, nextAvailableCornerShelfElevation, planMasterTracTower, towerCleatReferenceItems, towerConceptStorageReferenceItems, towerRodHardwareTakeoff, towerTotalWidth, towerWidths,
  type MasterTracTowerConfig, type TowerBay, type TowerStorage, type TowerStorageItem,
} from "@/lib/masterTracTower";

const FINISHES = ["Glacier White", "Slate Rift", "Spiced Mahogany"];
const WALLS: { value: WallSide; label: string }[] = [
  { value: "top", label: "Back wall" },
  { value: "bottom", label: "Front wall" },
  { value: "left", label: "Left wall" },
  { value: "right", label: "Right wall" },
];
const money = (amount: number) => `$${amount.toFixed(2)}`;

function positionedItems(bay: TowerBay): TowerStorageItem[] {
  if (bay.storageItems) return bay.storageItems;
  return [
    ...bay.adjustableHeightsIn.map((elevationIn): TowerStorageItem => ({ kind: "shelf", elevationIn })),
    ...(bay.storage?.kind === "rod" ? bay.storage.heightsIn.map((elevationIn): TowerStorageItem => ({ kind: "rod", elevationIn, rodFinish: bay.storage!.kind === "rod" ? bay.storage!.rodFinish : "Chrome" })) : []),
    ...(bay.storage?.kind === "drawers" ? Array.from({ length: bay.storage.count }, (_, n): TowerStorageItem => ({ kind: "drawer", elevationIn: bay.fixedBottomIn + 1 + n * (bay.storage!.kind === "drawers" && bay.storage!.drawerSize === "large" ? 12 : 7), drawerSize: bay.storage!.kind === "drawers" ? bay.storage!.drawerSize : "small", frontStyle: bay.storage!.kind === "drawers" ? bay.storage!.frontStyle : "slab" })) : []),
    ...(bay.storage?.kind === "shoe" ? Array.from({ length: bay.storage.count }, (_, n): TowerStorageItem => ({ kind: "shoe", elevationIn: bay.fixedTopIn - 10 - n * 12, fenceFinish: bay.storage!.kind === "shoe" ? bay.storage!.fenceFinish : "Chrome" })) : []),
  ];
}

function mixedItemVisualHeight(item: TowerStorageItem): number {
  return item.kind === "drawer" ? item.drawerSize === "small" ? 5 : 10 : item.kind === "rod" ? 0 : CORNER_SHELF_THICKNESS_IN;
}

function defaultMixedItem(bay: TowerBay, kind: TowerStorageItem["kind"]): TowerStorageItem {
  const elevationIn = bay.fixedBottomIn + 1;
  return kind === "drawer" ? { kind, elevationIn, drawerSize: "small", frontStyle: "slab" }
    : kind === "shoe" ? { kind, elevationIn, fenceFinish: "Chrome" }
      : kind === "rod" ? { kind, elevationIn, rodFinish: "Chrome" }
        : { kind, elevationIn };
}

function nextMixedItemElevation(bay: TowerBay, item: TowerStorageItem): number | null {
  const occupied = [...positionedItems(bay), { kind: "shelf" as const, elevationIn: bay.fixedBottomIn }, { kind: "shelf" as const, elevationIn: bay.fixedTopIn }];
  const size = mixedItemVisualHeight(item);
  for (let elevation = bay.fixedBottomIn + CORNER_SHELF_THICKNESS_IN; elevation + size <= bay.fixedTopIn; elevation += 0.25) {
    if (occupied.every((entry) => elevation >= entry.elevationIn + mixedItemVisualHeight(entry) - 0.001 || elevation + size <= entry.elevationIn + 0.001)) return elevation;
  }
  return null;
}

function TowerDiagram({ config }: { config: MasterTracTowerConfig }) {
  const total = towerTotalWidth(config);
  const color = masterTracFinishColor(config.finish);
  const isWhite = config.finish === "Glacier White";
  const board = { backgroundColor: color, borderColor: isWhite ? "#92918d" : "#221f1d" };
  const cornerHeight = config.cornerElevationIn ?? (config.corner === "start" ? config.bays[0].fixedTopIn : config.bays.at(-1)!.fixedTopIn);
  const cornerHeights = [cornerHeight, ...(config.cornerAdjustableHeightsIn ?? []), ...((config.cornerShelfType ?? "fixed") === "fixed" && config.corner ? [(config.corner === "start" ? config.bays[0] : config.bays.at(-1)!).fixedBottomIn] : [])];
  const cornerClearances = cornerShelfClearances(config);
  const cornerFace = config.corner && <div className="relative h-full shrink-0 border-x border-dashed border-amber-600 bg-amber-50/40" style={{ width: `${CORNER_FOOTPRINT_IN / total * 100}%` }} data-testid="tower-corner-elevation-face">
    {cornerClearances.some((shelf) => shelf.issue === "overlap") && <span data-testid="tower-corner-elevation-collision-badge" className="absolute inset-x-1 top-2 z-10 rounded bg-red-700 px-1 py-0.5 text-center text-[9px] font-bold leading-tight text-white">Overlapping shelves</span>}
    {cornerHeights.map((height, index) => Number.isFinite(height) ? <div key={`${height}-${index}`} data-testid="tower-corner-elevation-level" data-clearance-state={cornerClearances[index]?.issue ?? "clear"} role="img" aria-label={`${index ? `Adjustable corner shelf ${index}` : "Primary corner shelf"} at ${height} inches: ${cornerClearances[index]?.issue ?? "clear"}`} className={`absolute inset-x-0 border-y-2 shadow-sm ${cornerClearances[index]?.issue === "overlap" || cornerClearances[index]?.issue === "out-of-panel" ? "border-red-700 bg-red-500 ring-2 ring-red-400" : cornerClearances[index]?.issue === "touching" ? "border-amber-700 bg-amber-400" : "border-amber-700"}`} style={{ ...board, ...(cornerClearances[index]?.issue === "overlap" || cornerClearances[index]?.issue === "out-of-panel" ? { backgroundColor: "#ef4444", borderColor: "#b91c1c" } : {}), height: "5px", bottom: `${Math.max(0, Math.min(100, height / config.heightIn * 100))}%` }} /> : null)}
    <span className="absolute inset-x-0 top-1/3 text-center text-[9px] leading-tight text-amber-950">Curved corner<br />29.5″ · illustrative</span>
  </div>;
  return (
    <div className="rounded-xl border border-stone-300 bg-gradient-to-b from-[#f6f4ef] to-[#ebe8e0] p-4" data-testid="mastertrac-tower-elevation">
      <div className="mb-3 flex items-center justify-between text-xs font-medium text-stone-600">
        <span>Front elevation · board layout</span><span>{total.toFixed(2)}″ overall × {config.heightIn}″ high</span>
      </div>
      <div className="mx-auto flex h-52 max-w-[650px] border-b-2 border-stone-500" role="img" aria-label={`${config.bays.length} connected MasterTrac bays with shared center uprights and individually adjustable shelves`}>
        {config.corner === "start" && cornerFace}
        <div className="relative h-full shrink-0 border-x" style={{ ...board, width: `${Math.max(0.75, PANEL_PCT(total))}%` }} aria-hidden="true" />
        {config.bays.map((bay, index) => (
          <div key={index} className="relative h-full min-w-0" style={{ width: `${bay.widthIn / total * 100}%` }}>
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-bold text-stone-700">{bay.widthIn}″ clear{bay.stockWidthIn && bay.stockWidthIn > bay.widthIn ? <span className="block text-[9px] font-normal">from {bay.stockWidthIn}″ stock</span> : null}</div>
            {[bay.fixedBottomIn, ...bay.adjustableHeightsIn, ...(config.corner && index === (config.corner === "start" ? 0 : config.bays.length - 1) ? (config.cornerAdjustableHeightsIn ?? []).filter((height) => !bay.adjustableHeightsIn.some((original) => Math.abs(original - height) < 0.000001)) : []), bay.fixedTopIn].map((height, shelfIndex) => (
              <div key={`${height}-${shelfIndex}`} className="absolute inset-x-0 border-y" style={{ ...board, height: "3px", bottom: `${height / config.heightIn * 100}%` }} aria-hidden="true" />
            ))}
            {bay.storage?.kind === "drawers" && Array.from({ length: bay.storage.count }, (_, drawerIndex) => {
              const size = (bay.storage as Extract<TowerStorage, { kind: "drawers" }>).drawerSize;
              return <div key={`drawer-${drawerIndex}`} className="absolute inset-x-1 flex items-center justify-center rounded-sm border border-stone-600 bg-[#b49b79] text-[8px] font-bold text-stone-900"
                style={{ bottom: `${(bay.fixedBottomIn + 1 + drawerIndex * (size === "small" ? 7 : 12)) / config.heightIn * 100}%`, height: `${(size === "small" ? 5 : 10) / config.heightIn * 100}%` }}>
                <span aria-hidden="true" className="h-px w-5 bg-stone-700" />
              </div>;
            })}
            {bay.storage?.kind === "shoe" && Array.from({ length: bay.storage.count }, (_, shoeIndex) => <div key={`shoe-${shoeIndex}`} className="absolute inset-x-1 border-b-[3px] border-stone-600" style={{ bottom: `${(bay.fixedTopIn - 10 - shoeIndex * 12) / config.heightIn * 100}%`, transform: "rotate(-8deg)" }} aria-hidden="true" />)}
            {bay.storage?.kind === "rod" && bay.storage.heightsIn.map((height, rodIndex) => <div key={`rod-${rodIndex}`} className="absolute inset-x-0 border-b-[4px] border-[#84817d]" style={{ bottom: `${height / config.heightIn * 100}%` }} aria-label={`Hanging rod at ${height} inches · illustrated diameter`} />)}
            {bay.storageItems?.map((item, itemIndex) => <div key={`mixed-${itemIndex}`} data-testid={`tower-diagram-${item.kind}`} title={`${item.kind} at ${item.elevationIn}″ · illustrative`} className={`absolute inset-x-1 border ${item.kind === "rod" ? "border-[#84817d]" : item.kind === "shoe" ? "border-stone-600 bg-[#b8a58b]" : item.kind === "drawer" ? "border-stone-600 bg-[#b49b79]" : "border-stone-600"}`} style={{ bottom: `${item.elevationIn / config.heightIn * 100}%`, height: item.kind === "drawer" ? `${(item.drawerSize === "small" ? 5 : 10) / config.heightIn * 100}%` : "3px" }} aria-label={`${item.kind} at ${item.elevationIn} inches`} />)}
          </div>
        )).flatMap((element, index) => [element, <div key={`upright-${index}`} className="relative h-full shrink-0 border-x" style={{ ...board, width: `${Math.max(0.75, PANEL_PCT(total))}%` }} aria-hidden="true" />])}
        {config.corner === "end" && cornerFace}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-stone-600">Real stock SKUs and shared uprights; cut bays show finished installed widths. Curved corner edge, H-joint placement, drawer faces and shoe shelf tilt are <strong>illustrative only</strong>. 3D is not a cutting or drilling guide.</p>
    </div>
  );
}
function PANEL_PCT(total: number) { return 0.75 / total * 100; }

export function MasterTracTowerPlanner({
  initialConfig, initialWall, initialStartIn, room, placed, openings, editGroupId, onClose, onCommit,
}: {
  initialConfig: MasterTracTowerConfig;
  initialWall: WallSide;
  initialStartIn: number;
  room: RoomData;
  placed: PlacedCabinet[];
  openings: WallOpening[];
  editGroupId: string | null;
  onClose: () => void;
  onCommit: (config: MasterTracTowerConfig, wall: WallSide, startIn: number, editGroupId: string | null) => { ok: boolean; reason?: string };
}) {
  const [config, setConfig] = useState(initialConfig);
  const [wall, setWall] = useState(initialWall);
  const [startIn, setStartIn] = useState(initialStartIn);
  const [commitError, setCommitError] = useState<string | null>(null);
  const cornerShelfListRef = useRef<HTMLDivElement>(null);
  const scrollAfterCornerAddRef = useRef(false);
  const mixedItemListsRef = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollAfterMixedAddRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollAfterCornerAddRef.current) return;
    scrollAfterCornerAddRef.current = false;
    const list = cornerShelfListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [config.cornerAdjustableHeightsIn?.length]);
  useEffect(() => {
    const index = scrollAfterMixedAddRef.current;
    if (index == null) return;
    scrollAfterMixedAddRef.current = null;
    const list = mixedItemListsRef.current[index];
    if (list) list.scrollTop = list.scrollHeight;
  }, [config.bays]);
  const available = useMemo(() => placed.filter((board) => board.masterTracTowerId !== editGroupId || !editGroupId), [placed, editGroupId]);
  const run = cabinetWallRunSegment(wall, room);
  const effectiveStartIn = config.corner === "start" ? run.start : config.corner === "end"
    ? run.start + run.length - towerTotalWidth(config) : startIn;
  const preview = useMemo(() => planMasterTracTower(config, room, wall, effectiveStartIn, available, openings), [config, room, wall, effectiveStartIn, available, openings]);
  const updateBay = (index: number, patch: Partial<TowerBay>) => setConfig((prev) => ({
    ...prev, bays: prev.bays.map((bay, bayIndex) => bayIndex === index ? { ...bay, ...patch } : bay),
  }));
  const addMixedItem = (index: number, kind: TowerStorageItem["kind"]) => setConfig((prev) => ({ ...prev, bays: prev.bays.map((bay, i) => {
    if (i !== index) return bay;
    const existing = positionedItems(bay);
    const item = defaultMixedItem(bay, kind);
    const elevation = nextMixedItemElevation(bay, item);
    if (elevation == null) return bay;
    item.elevationIn = elevation;
    return { ...bay, storage: undefined, adjustableHeightsIn: [], storageItems: [...existing, item] };
  }) }));
  const setHeight = (heightIn: 87 | 94) => setConfig((prev) => ({
    ...prev, heightIn, cornerElevationIn: prev.cornerShelfType === "adjustable" ? prev.cornerElevationIn : undefined, bays: prev.bays.map((bay) => ({
      ...bay, fixedTopIn: heightIn - 0.75,
      adjustableHeightsIn: bay.adjustableHeightsIn.filter((height) => height < heightIn - 1.5),
    })),
  }));
  const setDepth = (depthIn: 14.5 | 23.5) => setConfig((prev) => ({
    ...prev, depthIn, bays: prev.bays.map((bay) => {
      const stock = bay.stockWidthIn ?? bay.widthIn;
      return towerWidths(depthIn).includes(stock) ? bay : { ...bay, widthIn: 24, stockWidthIn: undefined };
    }),
  }));
  const chooseCorner = (side: "start" | "end" | undefined) => {
    setConfig((prev) => ({ ...prev, corner: side, cornerShelfType: side ? (prev.cornerShelfType ?? "fixed") : undefined, cornerElevationIn: undefined,
      cornerAdjustableHeightsIn: side ? prev.cornerAdjustableHeightsIn : undefined }));
    const run = cabinetWallRunSegment(wall, room);
    const nextWidth = towerTotalWidth({ ...config, corner: side });
    setStartIn(side === "end" ? run.start + run.length - nextWidth : run.start);
  };
  const submit = () => {
    setCommitError(null);
    if (!preview.ok) { setCommitError(preview.reason); return; }
    const result = onCommit(config, wall, effectiveStartIn, editGroupId);
    if (!result.ok) setCommitError(result.reason ?? "The tower could not be placed. No boards were added.");
  };
  const panelCount = config.bays.length + 1 + (config.corner ? 1 : 0);
  const fixedCount = config.bays.length * 2;
  const adjustableCount = config.bays.reduce((sum, bay) => sum + bay.adjustableHeightsIn.length, 0);
  const cornerParts = config.corner ? masterTracCornerParts(config.finish, config.cornerShelfType ?? "fixed") : null;
  const cornerExtraCount = config.corner ? config.cornerAdjustableHeightsIn?.length ?? 0 : 0;
  const additionalCornerParts = cornerExtraCount ? masterTracCornerParts(config.finish, "adjustable") : null;
  const nextCornerElevation = nextAvailableCornerShelfElevation(config);
  const cornerClearances = cornerShelfClearances(config);
  const invalidCornerIssues = ["overlap", "out-of-panel", "invalid-height"];
  const hardCornerIssue = cornerClearances.find((shelf) => invalidCornerIssues.includes(shelf.issue));
  const shelfName = (shelf: { kind: "primary" | "adjustable" | "fixed-bottom"; index?: number }) => shelf.kind === "primary" ? "Primary corner shelf" : shelf.kind === "fixed-bottom" ? "Fixed bottom corner shelf" : `Shelf ${(shelf.index ?? 0) + 1}`;
  const gapLabel = (gap: number) => Number(gap.toFixed(4)).toString();
  const clearanceNote = (shelf: (typeof cornerClearances)[number]) => shelf.issue === "invalid-height"
    ? `${shelfName(shelf)} needs a valid bottom height in inches.`
    : shelf.issue === "out-of-panel"
      ? `${shelfName(shelf)} is outside the selected ${config.heightIn} in panel height. Bottom height must be 0–${config.heightIn - CORNER_SHELF_THICKNESS_IN} in.`
      : shelf.issue === "overlap" && shelf.nearest
        ? `${shelfName(shelf)} overlaps ${shelfName(shelf.nearest)} by ${gapLabel(Math.abs(shelf.nearest.clearIn))} in. Keep at least ¾ in between shelf bottoms (actual board thickness).`
        : shelf.issue === "touching" && shelf.nearest
          ? `${shelfName(shelf)} touches ${shelfName(shelf.nearest)}: no clear gap. Support spacing not specified; verify with installer.`
          : "";
  const canStepCornerShelf = (index: number, delta: number) => {
    const heights = config.cornerAdjustableHeightsIn ?? [];
    const next = Math.round((heights[index] + delta) * 100) / 100;
    if (!Number.isFinite(next)) return false;
    const proposed = cornerShelfClearances({ ...config, cornerAdjustableHeightsIn: heights.map((height, i) => i === index ? next : height) })[index + 1];
    return Boolean(proposed && !invalidCornerIssues.includes(proposed.issue));
  };
  const stepCornerShelf = (index: number, delta: number) => setConfig((prev) => ({ ...prev,
    cornerAdjustableHeightsIn: (prev.cornerAdjustableHeightsIn ?? []).map((height, i) => i === index ? Math.round((height + delta) * 100) / 100 : height),
  }));
  const cutLines = new Map<string, { sku: string; quantity: number; bay: number; stock: number; installed: number; offcut: number; price: number }>();
  if (preview.ok) for (const board of preview.plan.boards) {
    const cut = board.masterTracShelfCut;
    if (!cut) continue;
    const key = `${board.masterTracTowerBayIndex}|${board.masterCode}|${cut.installedWidthIn}`;
    const existing = cutLines.get(key);
    if (existing) existing.quantity += 1;
    else cutLines.set(key, { sku: board.masterCode, quantity: 1, bay: (board.masterTracTowerBayIndex ?? 0) + 1, stock: cut.stockWidthIn, installed: cut.installedWidthIn, offcut: cut.offcutIn, price: masterTracProduct(board.masterCode)?.listEachUsd ?? 0 });
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[92dvh] w-[min(96vw,910px)] max-w-[910px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[910px]" data-testid="mastertrac-tower-planner">
        <DialogHeader className="shrink-0 border-b border-stone-200 bg-[#192432] px-5 py-4 text-left text-white">
          <DialogTitle className="flex items-center gap-2 text-xl"><Columns3 className="h-5 w-5 text-[#d8b275]" /> {editGroupId ? "Edit connected towers" : "Plan connected towers"}</DialogTitle>
          <DialogDescription className="text-stone-200">2–4 connected bays · real MasterTrac board sizes. Drawer and shoe previews are illustrative.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(310px,0.9fr)]">
          <div className="space-y-4 px-5 py-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label htmlFor="tower-finish" className="text-xs">Board finish</Label><Select value={config.finish} onValueChange={(finish) => setConfig((prev) => ({ ...prev, finish }))}><SelectTrigger id="tower-finish" aria-label="Tower finish" className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{FINISHES.map((finish) => <SelectItem key={finish} value={finish}>{finish}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Actual panel height</Label><Select value={String(config.heightIn)} onValueChange={(height) => setHeight(Number(height) as 87 | 94)}><SelectTrigger aria-label="Panel height" className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="87">87″ floor panel</SelectItem><SelectItem value="94">94″ actual (nominal 96)</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Board depth</Label><Select value={String(config.depthIn)} onValueChange={(depth) => setDepth(Number(depth) as 14.5 | 23.5)}><SelectTrigger aria-label="Board depth" className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="14.5">14.5″</SelectItem><SelectItem value="23.5">23.5″</SelectItem></SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-xs">Wall</Label><Select value={wall} onValueChange={(side) => setWall(side as WallSide)}><SelectTrigger aria-label="Tower wall" className="w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{WALLS.map((side) => <SelectItem key={side.value} value={side.value}>{side.label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3" data-testid="tower-corner-first">
              <p className="text-xs font-bold text-stone-800">1. Curved corner shelf · 29.5″ sourced footprint</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {([ [undefined, "No corner"], ["start", "Left / start corner"], ["end", "Right / end corner"] ] as const).map(([side, label]) => <Button key={side ?? "none"} type="button" size="sm" variant={config.corner === side ? "default" : "outline"} aria-pressed={config.corner === side} onClick={() => chooseCorner(side)}>{label}</Button>)}
              </div>
              {config.corner && <div className="mt-2 space-y-2 text-xs">
                <div className="flex flex-wrap items-center gap-2"><Label>Primary corner shelf</Label><Select value={config.cornerShelfType ?? "fixed"} onValueChange={(type) => setConfig((prev) => ({ ...prev, cornerShelfType: type as "fixed" | "adjustable", cornerElevationIn: type === "fixed" ? undefined : (prev.cornerElevationIn ?? 42) }))}><SelectTrigger aria-label="Corner shelf type" className="h-11 w-full bg-white text-sm sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fixed">Fixed corner shelf</SelectItem><SelectItem value="adjustable">Adjustable corner shelf</SelectItem></SelectContent></Select>
                  {config.cornerShelfType === "adjustable" ? <><Label htmlFor="tower-corner-elevation">Bottom height from floor</Label><Input id="tower-corner-elevation" aria-label="Corner shelf elevation in inches" aria-invalid={Boolean(hardCornerIssue && hardCornerIssue.kind === "primary")} inputMode="decimal" type="number" min="0" max={config.heightIn - CORNER_SHELF_THICKNESS_IN} step="0.25" value={Number.isFinite(config.cornerElevationIn ?? 42) ? config.cornerElevationIn ?? 42 : ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setConfig((prev) => ({ ...prev, cornerElevationIn: event.target.valueAsNumber }))} className={`h-11 w-28 bg-white text-base ${hardCornerIssue?.kind === "primary" ? "border-red-600 ring-2 ring-red-200" : ""}`} /><span className="text-sm">in</span></> : <span className="text-stone-600">Level with adjacent fixed top shelf · H-joint listed separately</span>}
                </div>
                {hardCornerIssue && <p role="alert" data-testid="corner-clearance-warning" className="rounded-md border border-red-400 bg-red-50 p-2 text-xs font-semibold leading-5 text-red-900">{clearanceNote(hardCornerIssue)} Placement is blocked until every corner shelf clears the physical minimum.</p>}
                {!hardCornerIssue && cornerClearances.some((shelf) => shelf.issue === "touching") && <p role="status" data-testid="corner-clearance-contact" className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs leading-5 text-amber-950">Boards touch at ¾ in between shelf bottoms: no clear gap. Support spacing not specified; verify with installer before installation.</p>}
                <div className="rounded-md border border-stone-200 bg-white p-2" data-testid="tower-adjustable-corner-shelves">
                  <div className="flex items-center justify-between gap-2"><div><strong className="text-xs text-stone-800">Adjustable corner shelves</strong><p className="text-[11px] text-stone-600">Bottom height from floor · inches</p></div><span className="shrink-0 text-[11px] font-semibold text-stone-600" aria-live="polite">{cornerExtraCount} added</span></div>
                  <div ref={cornerShelfListRef} className="mt-2 max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1" role="list" aria-label="Adjustable corner shelf levels" data-testid="corner-shelf-elevation-list">
                    {(config.cornerAdjustableHeightsIn ?? []).map((height, shelfIndex) => {
                      const clearance = cornerClearances[shelfIndex + 1];
                      const invalid = Boolean(clearance && invalidCornerIssues.includes(clearance.issue));
                      return <div key={shelfIndex} role="listitem" data-testid="corner-shelf-elevation-row" data-clearance-state={clearance?.issue ?? "clear"} className={`rounded-md border p-2 sm:gap-2 ${invalid ? "border-red-400 bg-red-50" : clearance?.issue === "touching" ? "border-amber-300 bg-amber-50" : "border-stone-200 bg-stone-50"}`}>
                        <div className="sm:flex sm:items-center sm:justify-between sm:gap-2">
                        <div className="flex items-center justify-between gap-2"><Label htmlFor={`tower-corner-extra-${shelfIndex}`} className="text-xs font-semibold text-stone-800">Shelf {shelfIndex + 1}</Label><button type="button" aria-label={`Remove adjustable corner shelf ${shelfIndex + 1}`} title={`Remove shelf ${shelfIndex + 1}`} onClick={() => setConfig((prev) => ({ ...prev, cornerAdjustableHeightsIn: (prev.cornerAdjustableHeightsIn ?? []).filter((_, index) => index !== shelfIndex) }))} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-stone-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192432]"><Trash2 className="h-4 w-4" /></button></div>
                        <div className="flex min-w-0 items-center gap-1.5"><Button type="button" size="icon" variant="outline" aria-label={`Lower adjustable corner shelf ${shelfIndex + 1} by one inch`} title="Lower one inch" disabled={!canStepCornerShelf(shelfIndex, -1)} onClick={() => stepCornerShelf(shelfIndex, -1)} className="h-11 w-11 shrink-0 bg-white"><Minus className="h-4 w-4" /></Button><Input id={`tower-corner-extra-${shelfIndex}`} aria-label={`Adjustable corner shelf ${shelfIndex + 1} elevation`} aria-invalid={invalid} aria-describedby={clearance?.issue !== "clear" ? `tower-corner-issue-${shelfIndex}` : undefined} inputMode="decimal" type="number" min="0" max={config.heightIn - CORNER_SHELF_THICKNESS_IN} step="0.25" value={Number.isFinite(height) ? height : ""} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setConfig((prev) => ({ ...prev, cornerAdjustableHeightsIn: (prev.cornerAdjustableHeightsIn ?? []).map((old, index) => index === shelfIndex ? event.target.valueAsNumber : old) }))} className={`h-11 min-w-0 flex-1 bg-white text-center text-base sm:w-20 sm:flex-none ${invalid ? "border-red-600 ring-2 ring-red-200" : ""}`} /><Button type="button" size="icon" variant="outline" aria-label={`Raise adjustable corner shelf ${shelfIndex + 1} by one inch`} title="Raise one inch" disabled={!canStepCornerShelf(shelfIndex, 1)} onClick={() => stepCornerShelf(shelfIndex, 1)} className="h-11 w-11 shrink-0 bg-white"><Plus className="h-4 w-4" /></Button><span className="shrink-0 text-sm text-stone-600">in</span></div>
                        </div>
                        {clearance && clearance.issue !== "clear" && <p id={`tower-corner-issue-${shelfIndex}`} className={`mt-1 text-[11px] leading-snug ${invalid ? "font-semibold text-red-900" : "text-amber-950"}`}>{clearanceNote(clearance)}</p>}
                      </div>;
                    })}
                  </div>
                  <Button type="button" size="sm" variant="outline" data-testid="add-adjustable-corner-shelf" disabled={nextCornerElevation == null || Boolean(hardCornerIssue)} onClick={() => { scrollAfterCornerAddRef.current = true; setConfig((prev) => { const next = nextAvailableCornerShelfElevation(prev); return next == null ? prev : { ...prev, cornerAdjustableHeightsIn: [...(prev.cornerAdjustableHeightsIn ?? []), next] }; }); }} className="mt-2 h-11 w-full justify-center border-dashed bg-white px-3 text-sm sm:w-auto"><Plus className="mr-1 h-4 w-4" /> Add adjustable corner shelf</Button>
                </div>
                <p className="text-[10px] text-stone-600">Minimum ¾″ between shelf bottoms = actual board thickness, not an installation clearance. Add as many sourced shelves as physically fit; support spacing is not specified.</p>
              </div>}
              <p className="mt-1.5 text-[11px] text-stone-600">Actual shelf SKU/finish and 29.5 × 29.5 × 0.75″ catalog bounding size. The curved front faces the room between two 14.5″-deep sourced uprights on perpendicular walls. Fixed corners include top and bottom at the adjacent bay levels; adjustable corners pair with real adjacent bay shelves. One return upright is included in the List reference; a complete return bay and cam-lock holes remain <strong>unmodeled</strong>. This is not an installation drawing. {config.corner === "end" ? "End" : "Start"} corner anchors to the selected wall end. {config.corner && config.depthIn !== 14.5 ? "Select 14.5″ straight bays for this documented H-joint reference." : ""}</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2"><Label htmlFor="tower-start" className="shrink-0 text-xs">Start on wall</Label><Input id="tower-start" aria-label="Tower start in inches" type="number" min="0" step="0.25" value={effectiveStartIn} disabled={Boolean(config.corner)} onChange={(event) => setStartIn(Number(event.target.value))} className="h-8 w-24 bg-white" /><span className="text-xs text-stone-600">inches from wall start · {towerTotalWidth(config).toFixed(2)}″ overall</span></div>
            <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Bay openings <span className="font-normal text-stone-500">({config.bays.length} shared)</span></h3><Button type="button" variant="outline" size="sm" className="h-8 text-xs" disabled={config.bays.length >= 4} onClick={() => setConfig((prev) => ({ ...prev, bays: [...prev.bays, { widthIn: towerWidths(prev.depthIn)[0] === 12 ? 24 : towerWidths(prev.depthIn)[0], fixedBottomIn: 6, fixedTopIn: prev.heightIn - 0.75, adjustableHeightsIn: [30, 54] }] }))}><Plus className="mr-1 h-3.5 w-3.5" /> Add bay</Button></div>
            {config.bays.map((bay, index) => (
              <div key={index} className="rounded-lg border border-stone-200 bg-white p-3 shadow-sm" data-testid={`tower-bay-${index + 1}`}>
                <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-stone-800">BAY {index + 1}</span><Button type="button" variant="ghost" size="sm" className="h-7 px-1 text-xs" disabled={config.bays.length <= 2} onClick={() => setConfig((prev) => ({ ...prev, bays: prev.bays.filter((_, i) => i !== index) }))}><Trash2 className="mr-1 h-3 w-3" /> Remove</Button></div>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <div><Label className="text-[11px]">{bay.stockWidthIn != null ? "Stock shelf SKU width" : "Clear width"}</Label><Select value={String(bay.stockWidthIn ?? bay.widthIn)} onValueChange={(width) => updateBay(index, bay.stockWidthIn != null ? { stockWidthIn: Number(width), widthIn: Math.min(bay.widthIn, Number(width)) } : { widthIn: Number(width) })}><SelectTrigger aria-label={`Bay ${index + 1} ${bay.stockWidthIn != null ? "stock shelf width" : "clear width"}`} className="h-8 w-full text-xs"><SelectValue /></SelectTrigger><SelectContent>{towerWidths(config.depthIn).map((width) => <SelectItem key={width} value={String(width)}>{width}″</SelectItem>)}</SelectContent></Select></div>
                  <div><Label htmlFor={`tower-bottom-${index}`} className="text-[11px]">Fixed bottom</Label><Input id={`tower-bottom-${index}`} aria-label={`Bay ${index + 1} fixed bottom elevation`} type="number" step="0.25" className="h-8 text-xs" value={bay.fixedBottomIn} onChange={(event) => updateBay(index, { fixedBottomIn: Number(event.target.value) })} /></div>
                  <div><Label htmlFor={`tower-top-${index}`} className="text-[11px]">Fixed top</Label><Input id={`tower-top-${index}`} aria-label={`Bay ${index + 1} fixed top elevation`} type="number" step="0.25" className="h-8 text-xs" value={bay.fixedTopIn} onChange={(event) => updateBay(index, { fixedTopIn: Number(event.target.value) })} /></div>
                </div>
                <div className="mt-2 rounded-md border border-stone-200 bg-stone-50 p-2" data-testid={`tower-cut-to-fit-${index + 1}`}>
                  <button type="button" aria-label={`Bay ${index + 1} cut stock shelf to fit`} aria-pressed={bay.stockWidthIn != null} disabled={Boolean(bay.storage) || Boolean(bay.storageItems?.some((item) => item.kind !== "shelf"))} className="text-[11px] font-semibold text-[#192432] underline underline-offset-2 disabled:cursor-not-allowed disabled:text-stone-400" onClick={() => updateBay(index, bay.stockWidthIn != null ? { widthIn: bay.stockWidthIn, stockWidthIn: undefined } : { stockWidthIn: bay.widthIn })}>{bay.stockWidthIn != null ? "Use full stock width" : "Cut stock shelf to fit"}</button>
                  {bay.stockWidthIn != null && <div className="mt-2 flex flex-wrap items-center gap-2"><Label htmlFor={`tower-cut-width-${index}`} className="text-[11px]">Installed clear width</Label><Input id={`tower-cut-width-${index}`} aria-label={`Bay ${index + 1} installed cut width in inches`} type="number" min={12} max={bay.stockWidthIn} step={0.125} value={bay.widthIn} onChange={(event) => updateBay(index, { widthIn: Number(event.target.value) })} className="h-8 w-24 bg-white text-xs" /><span className="text-[11px] text-stone-600">inches · offcut {Number.isFinite(bay.widthIn) ? Math.max(0, Math.round((bay.stockWidthIn - bay.widthIn) * 1000) / 1000) : "—"}″ per shelf</span></div>}
                  {bay.stockWidthIn != null && <p className="mt-1 text-[10px] text-amber-900">Purchased stock SKU and full 2022 List price remain. Measure the clear opening on site. Adjustable shelves need the manufacturer template at the cut edge; fixed shelves need connector reboring. This preview is not a cutting or drilling guide.</p>}
                </div>
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50/50 p-2" data-testid={`tower-storage-${index + 1}`}>
                  <div data-testid={`tower-mixed-storage-${index + 1}`} className="mb-3 rounded border border-amber-300 bg-white p-2">
                    <p className="text-[11px] font-semibold">Mix positioned contents · any quantity and order</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">{(["drawer", "shoe", "rod", "shelf"] as const).map((kind) => <Button key={kind} type="button" variant="outline" className="h-11 px-2 text-xs" disabled={(bay.stockWidthIn != null && kind !== "shelf") || nextMixedItemElevation(bay, defaultMixedItem(bay, kind)) == null} title={nextMixedItemElevation(bay, defaultMixedItem(bay, kind)) == null ? "No remaining vertical slot; move or remove an item" : undefined} onClick={() => { scrollAfterMixedAddRef.current = index; addMixedItem(index, kind); }}>+ Add {kind === "drawer" ? "Drawer" : kind === "shoe" ? "Shoe" : kind === "rod" ? "Rod" : "Shelf"}</Button>)}</div>
                    <div ref={(element) => { mixedItemListsRef.current[index] = element; }} data-testid={`tower-mixed-items-${index + 1}`} className="max-h-[min(40dvh,19rem)] overflow-y-auto overscroll-contain pr-1">
                    {bay.storageItems?.map((item, itemIndex) => <div key={itemIndex} data-testid="tower-mixed-item-row" className="mt-2 rounded border border-stone-200 p-2">
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold capitalize">{item.kind} {itemIndex + 1}</span><Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label={`Remove bay ${index + 1} ${item.kind} ${itemIndex + 1}`} onClick={() => updateBay(index, { storageItems: bay.storageItems!.filter((_, i) => i !== itemIndex) })}><Trash2 className="h-4 w-4" /></Button></div>
                      <div className="grid grid-cols-2 gap-2"><label className="text-[11px]">Bottom elevation (in)<Input type="number" inputMode="decimal" step="0.25" value={Number.isFinite(item.elevationIn) ? item.elevationIn : ""} aria-label={`Bay ${index + 1} ${item.kind} ${itemIndex + 1} elevation`} className="h-11 text-base" onChange={(event) => updateBay(index, { storageItems: bay.storageItems!.map((old, i) => i === itemIndex ? { ...old, elevationIn: event.target.valueAsNumber } : old) })} /></label>
                      {item.kind === "drawer" ? <div className="space-y-1"><Select value={item.drawerSize} onValueChange={(drawerSize) => updateBay(index, { storageItems: bay.storageItems!.map((old, i) => i === itemIndex && old.kind === "drawer" ? { ...old, drawerSize: drawerSize as "small" | "large", frontStyle: drawerSize === "small" ? "slab" : old.frontStyle } : old) })}><SelectTrigger aria-label={`Bay ${index + 1} drawer ${itemIndex + 1} size`} className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">5″ small</SelectItem><SelectItem value="large">10″ large</SelectItem></SelectContent></Select>{item.drawerSize === "large" && <Select value={item.frontStyle} onValueChange={(frontStyle) => updateBay(index, { storageItems: bay.storageItems!.map((old, i) => i === itemIndex && old.kind === "drawer" ? { ...old, frontStyle: frontStyle as "slab" | "shaker" } : old) })}><SelectTrigger aria-label={`Bay ${index + 1} drawer ${itemIndex + 1} front`} className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="slab">Slab</SelectItem><SelectItem value="shaker">Shaker</SelectItem></SelectContent></Select>}</div>
                        : item.kind === "shoe" || item.kind === "rod" ? <Select value={item.kind === "rod" ? item.rodFinish : item.fenceFinish} onValueChange={(finish) => updateBay(index, { storageItems: bay.storageItems!.map((old, i) => i === itemIndex ? old.kind === "rod" ? { ...old, rodFinish: finish as "Chrome" | "Matt Nickel" } : old.kind === "shoe" ? { ...old, fenceFinish: finish as "Chrome" | "Matt Nickel" } : old : old) })}><SelectTrigger aria-label={`Bay ${index + 1} ${item.kind} ${itemIndex + 1} finish`} className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Chrome">Chrome</SelectItem><SelectItem value="Matt Nickel">Matt Nickel</SelectItem></SelectContent></Select> : null}</div>
                    </div>)}
                    </div>
                    <p className="mt-1 text-[10px] text-stone-600">Vertical fit checks sourced face heights and ¾″ boards. Shoe tilt, slides, rod diameter and installation clearances are not certified; verify with installer.</p>
                  </div>
                  {!bay.storageItems && <>
                  <Label className="text-[11px] font-semibold">2. What goes in this bay?</Label>
                  <Select value={bay.storage?.kind ?? "shelves"} onValueChange={(value) => updateBay(index, {
                    storage: value === "drawers" ? { kind: "drawers", count: 1, drawerSize: "small", frontStyle: "slab" }
                      : value === "shoe" ? { kind: "shoe", count: 3, fenceFinish: "Chrome" }
                        : value === "rod" ? { kind: "rod", count: 1, rodFinish: "Chrome", heightsIn: [Math.min(bay.fixedTopIn - 3, 64)] } : undefined,
                    adjustableHeightsIn: value === "shelves" ? bay.adjustableHeightsIn : [],
                  })}>
                    <SelectTrigger aria-label={`Bay ${index + 1} storage type`} className="mt-1 h-8 bg-white text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="shelves">Open shelves</SelectItem><SelectItem value="rod" disabled={bay.stockWidthIn != null}>Hanging poles · sourced rod + cups</SelectItem><SelectItem value="drawers" disabled={bay.stockWidthIn != null}>Drawers · illustrated</SelectItem><SelectItem value="shoe" disabled={bay.stockWidthIn != null}>Shoe organizer · illustrated</SelectItem></SelectContent>
                  </Select>
                  {bay.storage?.kind === "drawers" && <div className="mt-2 flex flex-wrap gap-2">
                    <Select value={bay.storage.drawerSize} onValueChange={(drawerSize) => updateBay(index, { storage: { ...bay.storage!, drawerSize: drawerSize as "small" | "large", frontStyle: drawerSize === "small" ? "slab" : (bay.storage as Extract<TowerStorage, { kind: "drawers" }>).frontStyle } as TowerStorage })}><SelectTrigger aria-label={`Bay ${index + 1} drawer size`} className="h-8 w-24 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="small">5″ small</SelectItem><SelectItem value="large">10″ large</SelectItem></SelectContent></Select>
                    <Select value={String(bay.storage.count)} onValueChange={(count) => updateBay(index, { storage: { ...bay.storage!, count: Number(count) } as TowerStorage })}><SelectTrigger aria-label={`Bay ${index + 1} drawer count`} className="h-8 w-20 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3].filter((n) => bay.storage?.kind === "drawers" && (bay.storage.drawerSize === "small" || n <= 2)).map((n) => <SelectItem key={n} value={String(n)}>{n} ×</SelectItem>)}</SelectContent></Select>
                    {bay.storage.drawerSize === "large" && <Select value={bay.storage.frontStyle} onValueChange={(frontStyle) => updateBay(index, { storage: { ...bay.storage!, frontStyle: frontStyle as "slab" | "shaker" } as TowerStorage })}><SelectTrigger aria-label={`Bay ${index + 1} drawer front`} className="h-8 w-24 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="slab">Slab</SelectItem><SelectItem value="shaker">Shaker</SelectItem></SelectContent></Select>}
                  </div>}
                  {bay.storage?.kind === "shoe" && <div className="mt-2 flex flex-wrap gap-2"><Select value={String(bay.storage.count)} onValueChange={(count) => updateBay(index, { storage: { ...bay.storage!, count: Number(count) } as TowerStorage })}><SelectTrigger aria-label={`Bay ${index + 1} shoe shelf count`} className="h-8 w-28 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4].map((n) => <SelectItem key={n} value={String(n)}>{n} shelves</SelectItem>)}</SelectContent></Select><Select value={bay.storage.fenceFinish} onValueChange={(fenceFinish) => updateBay(index, { storage: { kind: "shoe", count: (bay.storage as Extract<TowerStorage, { kind: "shoe" }>).count, fenceFinish: fenceFinish as "Chrome" | "Matt Nickel" } })}><SelectTrigger aria-label={`Bay ${index + 1} shoe fence finish`} className="h-8 w-40 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Chrome">Chrome fence</SelectItem><SelectItem value="Matt Nickel">Matt Nickel fence</SelectItem></SelectContent></Select></div>}
                  {bay.storage?.kind === "rod" && <div className="mt-2 space-y-2" data-testid={`tower-rods-${index + 1}`}>
                    <div className="flex flex-wrap gap-2"><Select value={String(bay.storage.count)} onValueChange={(count) => updateBay(index, { storage: { kind: "rod", count: Number(count), rodFinish: (bay.storage as Extract<TowerStorage, { kind: "rod" }>).rodFinish, heightsIn: Number(count) === 2 ? [40, 70] : [64] } })}><SelectTrigger aria-label={`Bay ${index + 1} hanging rod count`} className="h-8 w-28 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Single hang</SelectItem><SelectItem value="2">Double hang</SelectItem></SelectContent></Select><Select value={bay.storage.rodFinish} onValueChange={(finish) => updateBay(index, { storage: { ...bay.storage!, rodFinish: finish as "Chrome" | "Matt Nickel" } as TowerStorage })}><SelectTrigger aria-label={`Bay ${index + 1} hanging rod finish`} className="h-8 w-36 bg-white text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Chrome">Chrome</SelectItem><SelectItem value="Matt Nickel">Matt Nickel</SelectItem></SelectContent></Select></div>
                    <div className="flex flex-wrap gap-2">{bay.storage.heightsIn.map((height, rodIndex) => <label key={rodIndex} className="flex items-center gap-1 text-[11px]">Rod {rodIndex + 1} height <Input type="number" aria-label={`Bay ${index + 1} rod ${rodIndex + 1} elevation`} step="1" min={bay.fixedBottomIn + 2} max={bay.fixedTopIn - 2} value={height} onChange={(event) => updateBay(index, { storage: { ...bay.storage!, heightsIn: (bay.storage as Extract<TowerStorage, { kind: "rod" }>).heightsIn.map((old, i) => i === rodIndex ? Number(event.target.value) : old) } as TowerStorage })} className="h-8 w-16 bg-white text-xs" />″</label>)}</div>
                    <p className="text-[10px] text-stone-600">One 8′ stock rod per level, cut for the actual bay. Manufacturer manual calls for 2 cups per rod; billed in full 10-cup packs for the whole tower. Rod thickness/cup holes shown only schematically; verify installation height and load.</p>
                  </div>}
                  {bay.storage?.kind !== "rod" && <p className="mt-1 text-[10px] text-stone-600">18/24/30″ shallow bays only for drawers/shoes. Drawer envelope, tilt angle and hardware clearances are illustrative.</p>}
                  </>}
                </div>
                {!bay.storage && !bay.storageItems && <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[11px] text-stone-600">3. Adjustable shelves · bottom height</span>{bay.adjustableHeightsIn.map((height, shelfIndex) => (
                  <span key={shelfIndex} className="inline-flex items-center rounded border border-stone-200 bg-stone-50"><Input aria-label={`Bay ${index + 1} adjustable shelf ${shelfIndex + 1} elevation`} type="number" step="0.25" value={height} onChange={(event) => updateBay(index, { adjustableHeightsIn: bay.adjustableHeightsIn.map((old, i) => i === shelfIndex ? Number(event.target.value) : old) })} className="h-7 w-16 border-0 bg-transparent px-1 text-center text-xs" /><span className="text-[10px]">″</span><button aria-label={`Remove shelf ${shelfIndex + 1} from bay ${index + 1}`} type="button" onClick={() => updateBay(index, { adjustableHeightsIn: bay.adjustableHeightsIn.filter((_, i) => i !== shelfIndex) })} className="px-1.5 text-stone-500 hover:text-red-700">×</button></span>
                ))}<button type="button" onClick={() => addMixedItem(index, "shelf")} className="h-11 rounded border border-dashed border-stone-400 px-2 text-xs font-medium text-stone-700 hover:bg-stone-100">+ Shelf</button></div>}
              </div>
            ))}
          </div>
          <div className="space-y-4 border-t border-stone-200 bg-[#fbfaf7] px-5 py-4 lg:border-l lg:border-t-0"><TowerDiagram config={config} />
            <div className="rounded-lg border border-stone-200 bg-white p-3" data-testid="tower-takeoff"><div className="flex justify-between text-sm font-semibold"><span>MasterTrac reference cart · not checkout</span><span>{preview.ok ? preview.plan.count : panelCount + fixedCount + adjustableCount + (config.corner ? 1 + cornerExtraCount + ((config.cornerShelfType ?? "fixed") === "fixed" ? 1 : 0) : 0)} sourced boards</span></div><p className="mt-1 text-xs text-stone-600">{panelCount} uprights ({config.bays.length - 1} shared center{config.corner ? ", 1 perpendicular corner" : ""}) · {fixedCount} straight fixed shelves · {adjustableCount} selected straight adjustable shelves{config.corner ? ` · ${1 + cornerExtraCount + ((config.cornerShelfType ?? "fixed") === "fixed" ? 1 : 0)} corner shelves (2 fixed when structural)` : ""}</p>
              {cornerParts && <div className="mt-2 space-y-1 border-t border-stone-200 pt-2 text-[11px] text-stone-700" data-testid="tower-corner-reference-lines">
                <p className="font-semibold text-amber-900">{config.corner === "start" ? "Left/start" : "Right/end"} · illustrated 29.5 × 29.5″ corner</p>
                <p>{((config.cornerShelfType ?? "fixed") === "fixed" ? 2 : 1 + cornerExtraCount)}× SKU {cornerParts.shelf.sku} · {cornerParts.shelf.description} · {cornerParts.shelf.finish} · {money(cornerParts.shelf.listEachUsd)} List each</p>
                {(config.cornerShelfType ?? "fixed") === "fixed" && additionalCornerParts && <p>{cornerExtraCount}× SKU {additionalCornerParts.shelf.sku} · {additionalCornerParts.shelf.description} · {additionalCornerParts.shelf.finish} · {money(additionalCornerParts.shelf.listEachUsd)} List each</p>}
                {cornerParts.joint && <p>2× SKU {cornerParts.joint.sku} · {cornerParts.joint.description} · {cornerParts.joint.finish} finish · {money(cornerParts.joint.listEachUsd)} List each · join location illustrative</p>}
                {!cornerParts.joint && <p>Adjustable shelf: no fixed-shelf H-joint priced or implied. Confirm support with installer.</p>}
              </div>}
              {cutLines.size > 0 && <div className="mt-2 space-y-1 border-t border-stone-200 pt-2" data-testid="tower-cut-skus"><p className="text-[11px] font-semibold text-amber-900">Stock shelf SKUs · field cuts</p>{Array.from(cutLines.values()).map((line) => <p key={`${line.bay}-${line.sku}`} className="text-[11px] text-stone-700">Bay {line.bay} · {line.quantity}× SKU {line.sku} · {line.stock}″ stock → {line.installed}″ installed · {line.offcut}″ offcut each · {money(line.price)} List each</p>)}</div>}
              {preview.ok && <div className="mt-2 space-y-1 border-t border-stone-200 pt-2" data-testid="tower-required-cleats"><p className="text-[11px] font-semibold text-amber-900">Required wall cleats · one between each pair of uprights</p>{towerCleatReferenceItems(preview.plan.boards).map((item, i) => <p key={`${item.sku}-${i}`} className="flex justify-between gap-2 text-[11px] text-stone-700"><span>1× SKU {item.sku} · {item.stockIn}″ stock{item.installedIn < item.stockIn ? ` → ${item.installedIn}″ installed; rebore per manual` : ""}</span><span>{money(item.listEachUsd)}</span></p>)}</div>}
              {preview.ok && towerRodHardwareTakeoff(preview.plan.boards).length > 0 && <div className="mt-2 space-y-1 border-t border-stone-200 pt-2" data-testid="tower-rod-hardware"><p className="text-[11px] font-semibold text-amber-900">Hanging poles · hardware computed from the design</p>{towerRodHardwareTakeoff(preview.plan.boards).map((item) => <div key={item.finish} className="space-y-0.5 text-[11px] text-stone-700"><p>{item.rodCount}× SKU {item.rodSku} · 8′ {item.finish} rod stock · {money(item.rodCount * item.rodListEachUsd)} List</p><p>{item.cupCount} cups needed · {item.cupPacks}× SKU {item.cupSku} · pack of {item.cupPackSize} · {money(item.cupPacks * item.cupListPackUsd)} List</p></div>)}</div>}
              {preview.ok && towerConceptStorageReferenceItems(preview.plan.boards).length > 0 && <div className="mt-2 space-y-1 border-t border-stone-200 pt-2" data-testid="tower-concept-skus"><p className="text-[11px] font-semibold text-amber-900">Illustrated storage · verified SKU references</p>{towerConceptStorageReferenceItems(preview.plan.boards).map((item) => <p key={item.sku} className="flex justify-between gap-2 text-[11px] text-stone-700"><span>{item.quantity}× {item.sku} · {item.description}</span><span>{money(item.quantity * item.listEachUsd)}</span></p>)}</div>}
              <div className="mt-2 flex justify-between border-t border-stone-200 pt-2 text-sm font-bold"><span>MasterTrac materials</span><span>{preview.ok ? money(preview.plan.listSubtotal) : "—"}</span></div><p className="mt-1 text-[11px] text-stone-600">March 1, 2022 List reference only. Cleats are sourced; screws/anchors vary by wall substrate and are not estimated. Concept geometry is not an installation guide. Not added to checkout.</p></div>
            {!preview.ok && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800" data-testid="tower-validation-error">{preview.reason}</p>}
            {commitError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-800">{commitError}</p>}
          </div>
        </div>
        <DialogFooter className="shrink-0 border-t border-stone-200 bg-white px-5 py-3 sm:justify-between"><p className="max-w-md text-[11px] leading-snug text-stone-600">SKU board sizes are sourced; drawer/shoe visuals are concepts. Verify anchoring and availability with the supplier before installation.</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="button" data-testid="place-connected-tower" onClick={submit} disabled={!preview.ok} className="bg-[#192432] text-white hover:bg-[#2c3b4e]">{editGroupId ? "Update tower" : "Place connected towers"}</Button></div></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
