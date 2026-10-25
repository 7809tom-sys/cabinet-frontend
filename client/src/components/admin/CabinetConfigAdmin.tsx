import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { CabinetConfigHistoryPanel } from "./CabinetConfigHistoryPanel";
import { CabinetAvailabilityPanel } from "./CabinetAvailabilityPanel";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Settings2, CheckCircle2, Upload, ImageIcon, Sparkles, Pencil, Trash2, Plus, AlertTriangle, Globe, Building2, GripVertical, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { DoorDrawerDiagram } from "@/components/design/DoorDrawerDiagram";
import MediaLibraryAdmin from "@/components/admin/MediaLibraryAdmin";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { CabinetVerificationControl } from "@/components/admin/CabinetVerificationControl";
import { requiresImageReplacementScope } from "@/lib/cabinetImageReplacement";

// ─── Spec Drawing Picker ─────────────────────────────────────────────────────
function SpecDrawingPicker({
  currentUrl,
  onPick,
  disabled,
}: {
  currentUrl: string | null;
  onPick: (url: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 text-xs shrink-0 gap-1"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <ImageIcon className="h-3.5 w-3.5" />
        Media
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Media Library — Cabinet Drawings</DialogTitle>
          </DialogHeader>
          <MediaLibraryAdmin
            onPick={(url) => { onPick(url); setOpen(false); }}
            selectedUrl={currentUrl ?? undefined}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STANDARD_DEPTHS = ["9", "12", "15", "18", "21", "24", "27", "30", "33", "36"];
const DOOR_OPTIONS = [null, 0, 1, 2, 3, 4] as const;
const DRAWER_OPTIONS = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
const SHELF_OPTIONS = [null, 0, 1, 2, 3, 4, 5, 6] as const;
const PAGE_SIZE = 50;

// Detect blind corner cabinets by code prefix or description (mirrors design.ts)
function isBlindCornerCode(masterCode: string | null, description?: string | null): boolean {
  const code = (masterCode || "").toUpperCase();
  if (/^(BBC|WBC|BBL|BBR|WBL|WBR)/.test(code)) return true;
  if (/-BLIND|BLIND/.test(code)) return true;
  return /blind\s*corner/.test((description || "").toLowerCase());
}

type CabinetRow = {
  id: number;
  masterCode: string | null;
  description: string | null;
  category: string | null;
  subCategory: string | null;
  width: string | null;
  height: string | null;
  depth: string | null;
  numberOfDoors: number | null;
  numberOfDrawers: number | null;
  numberOfFixedShelves: number | null;
  numberOfAdjShelves: number | null;
  altSku1: string | null;
  altSku2: string | null;
  altSku3: string | null;
  showInCatalog: boolean | null;
  showInDesigner: boolean | null;
  showIn2020: boolean | null;
  isActive: boolean | null;
  isNotCabinet: boolean | null;
  catalogImageUrl: string | null;
  weight: string | null;
  physicalWidth: string | null;
  pkgLength: string | null;
  pkgWidth: string | null;
  pkgHeight: string | null;
  pkgWeight: string | null;
  // Blind corner pull spec
  minPull: string | null;
  maxPull: string | null;
  openingWidth: string | null;
  openingHeight: string | null;
  // Appliance opening
  openingType: string | null;
  doorHeight: string | null;
  drawerHeight: string | null;
  // Corner cabinet type
  cornerType: string | null;
  // Corner measurement fields
  shelfRadius: string | null;
  shelfCount: number | null;
  cabinetSquare: string | null;
  faceWidth: string | null;
  legWidth: string | null;
  // Timestamps
  configuredAt: Date | null;
  // Verified status
  configVerified: boolean;
  configVerifiedAt: Date | null;
  // Door orientation
  doorOrientation: string | null;
  // Doors per row (side-by-side count)
  doorsPerRow: number | null;
  // Drawer layout JSON
  drawerLayout: string | null;
  // Panel fields
  grainDirection: string | null;
  isDecorativeDoor: boolean | null;
  // Visual layout spec (JSON)
  layoutSpec: string | null;
  // Spec book line drawing + notes
  specImageUrl: string | null;
  specNotes: string | null;
};

// ─── Layout Spec Types ────────────────────────────────────────────────────────
export type LayoutSection = {
  type: 'drawer' | 'door' | 'shelf';
  count: number;   // how many side-by-side
  height: number;  // height of this row in inches
};

export type LayoutSpec = {
  baseType: 'toe-kick' | 'pedestal';
  pedestalHeight?: number; // height of pedestal feet in inches (default 6)
  sections: LayoutSection[]; // ordered top-to-bottom in array, rendered bottom-up
  vanity?: {
    drawerSide: 'left' | 'right';
    drawerCount: number;
    drawerBankRatio: number;
  };
};

// ─── Dim Input ────────────────────────────────────────────────────────────────
function DimInput({
  label,
  value,
  onChange,
  unit = '"',
  disabled,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  unit?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          className="pr-6 h-8 text-sm"
          placeholder="—"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          disabled={disabled}
          inputMode="decimal"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          {unit}
        </span>
      </div>
    </div>
  );
}

// ─── Drawer Layout Editor ─────────────────────────────────────────────────────
interface DrawerRow {
  count: number;
  height?: number;
}

export function DrawerLayoutEditor({
  value,
  onChange,
  totalDrawers,
  disabled,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  totalDrawers: number;
  disabled?: boolean;
}) {
  const rows: DrawerRow[] = useMemo(() => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
    return [];
  }, [value]);

  const setRows = (newRows: DrawerRow[]) => {
    if (newRows.length === 0) {
      onChange(null);
    } else {
      onChange(JSON.stringify(newRows));
    }
  };

  const addRow = () => {
    setRows([...rows, { count: 1 }]);
  };

  const removeRow = (idx: number) => {
    setRows(rows.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: "count" | "height", val: number | undefined) => {
    const updated = rows.map((r, i) => {
      if (i !== idx) return r;
      if (field === "count") return { ...r, count: val ?? 1 };
      if (field === "height") {
        if (val === undefined) {
          const { height: _, ...rest } = r;
          return rest;
        }
        return { ...r, height: val };
      }
      return r;
    });
    setRows(updated);
  };

  const assignedDrawers = rows.reduce((sum, r) => sum + r.count, 0);

  // Quick-set: generate a simple uniform layout from a drawers-per-row count
  const quickSetPerRow = (perRow: number) => {
    if (perRow <= 0) { onChange(null); return; }
    // Build rows: each row has `perRow` drawers side-by-side
    const numRows = Math.ceil(totalDrawers / perRow);
    const newRows: DrawerRow[] = [];
    let remaining = totalDrawers;
    for (let i = 0; i < numRows; i++) {
      const count = Math.min(perRow, remaining);
      newRows.push({ count });
      remaining -= count;
    }
    onChange(JSON.stringify(newRows));
  };

  // Detect current quick-set value from rows (uniform layout)
  const currentQuickSet: string = (() => {
    if (rows.length === 0) return "__stacked__";
    const allSame = rows.every((r) => r.count === rows[0].count);
    if (allSame && rows.length === Math.ceil(totalDrawers / rows[0].count)) {
      return String(rows[0].count);
    }
    return "__custom__";
  })();

  return (
    <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 space-y-3">
      {/* Quick-set side-by-side selector */}
      {totalDrawers >= 2 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Drawers Per Row (Side-by-Side)</Label>
          <Select
            value={currentQuickSet}
            onValueChange={(v) => {
              if (v === "__stacked__") { onChange(null); }
              else if (v !== "__custom__") { quickSetPerRow(parseInt(v)); }
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__stacked__">All stacked (full-width, one above another)</SelectItem>
              {Array.from({ length: Math.min(totalDrawers, 6) }, (_, i) => i + 1).slice(1).map((n) => (
                <SelectItem key={n} value={String(n)}>{n} drawers side by side per row</SelectItem>
              ))}
              {currentQuickSet === "__custom__" && (
                <SelectItem value="__custom__">Custom layout (use row editor below)</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Drawer Layout (per row)</Label>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="text-xs text-primary hover:underline disabled:opacity-50"
        >
          + Add Row
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          No custom layout — all {totalDrawers} drawer(s) will be full-width stacked. Click "+ Add Row" to define rows.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-12 shrink-0">Row {idx + 1}</span>
              <Input
                type="number"
                min={1}
                max={6}
                value={row.count}
                onChange={(e) => updateRow(idx, "count", parseInt(e.target.value) || 1)}
                disabled={disabled}
                className="w-16 h-8 text-xs"
                placeholder="#"
              />
              <span className="text-[11px] text-muted-foreground">side by side</span>
              <Input
                type="number"
                min={1}
                max={20}
                step={0.25}
                value={row.height ?? ""}
                onChange={(e) => updateRow(idx, "height", e.target.value ? parseFloat(e.target.value) : undefined)}
                disabled={disabled}
                className="w-16 h-8 text-xs"
                placeholder="auto"
              />
              <span className="text-[11px] text-muted-foreground">″ tall</span>
              <button
                type="button"
                onClick={() => removeRow(idx)}
                disabled={disabled}
                className="text-xs text-destructive hover:underline disabled:opacity-50 ml-auto"
              >
                ×
              </button>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground">
            {assignedDrawers} of {totalDrawers} drawers assigned to rows.
            {assignedDrawers !== totalDrawers && (
              <span className="text-amber-500 ml-1">
                (mismatch — total should equal {totalDrawers})
              </span>
            )}
            {" "}Heights left blank will split equally.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Layout Spec Builder ─────────────────────────────────────────────────────

/** Generate a sensible default LayoutSpec from existing cabinet config fields.
 *
 * Industry standard rule:
 *   - Top drawer is ALWAYS 6" (fixed, uniform across all base cabinets)
 *   - Remaining drawers (if any) split the remaining drawer zone equally
 *   - Door zone fills whatever height is left below the drawer(s)
 */
export function defaultLayoutSpec(cab: {
  category?: string | null;
  numberOfDoors?: number | null;
  numberOfDrawers?: number | null;
  height?: string | null;
  drawerHeight?: string | null;
  doorHeight?: string | null;
}): LayoutSpec {
  const category = (cab.category || '').toLowerCase();
  const isWall = category.includes('wall');
  const isTall = category.includes('tall') || category.includes('pantry') || category.includes('utility');
  const doors = cab.numberOfDoors ?? 0;
  const drawers = cab.numberOfDrawers ?? 0;
  const totalH = cab.height ? parseFloat(cab.height) : (isWall ? 30 : isTall ? 84 : 34.5);
  const baseH = isWall || isTall ? 0 : 3.5; // toe kick height
  const faceH = totalH - baseH;

  // Industry standard: top drawer is always 6" fixed
  const TOP_DRAWER_HEIGHT = 6;

  const sections: LayoutSection[] = [];

  if (doors === 0 && drawers > 0) {
    // All-drawer cabinet: top drawer = 6", remaining drawers split rest equally
    sections.push({ type: 'drawer', count: 1, height: TOP_DRAWER_HEIGHT });
    if (drawers > 1) {
      const remainH = faceH - TOP_DRAWER_HEIGHT;
      const lowerH = Math.round((remainH / (drawers - 1)) * 4) / 4;
      for (let i = 1; i < drawers; i++) {
        sections.push({ type: 'drawer', count: 1, height: lowerH });
      }
    }
  } else if (doors > 0 && drawers === 0) {
    // Door-only cabinet
    const dh = cab.doorHeight ? parseFloat(cab.doorHeight) : faceH;
    const count = Math.min(doors, 2);
    sections.push({ type: 'door', count, height: Math.round(dh * 4) / 4 });
  } else if (doors > 0 && drawers > 0) {
    // Mixed: top drawer(s) fixed at 6" each, door zone fills the rest
    // Top section = all drawers stacked (each 6" per drawer row)
    const totalDrawerH = TOP_DRAWER_HEIGHT * drawers;
    const doorH = faceH - totalDrawerH;
    const doorCount = Math.min(doors, 2);
    // In the sections array: index 0 = top of cabinet
    // Each drawer gets its own row at 6"
    for (let i = 0; i < drawers; i++) {
      sections.push({ type: 'drawer', count: 1, height: TOP_DRAWER_HEIGHT });
    }
    // Door zone below all drawers
    sections.push({ type: 'door', count: doorCount, height: Math.round(Math.max(doorH, 8) * 4) / 4 });
  } else {
    // Fallback: one door section
    sections.push({ type: 'door', count: 1, height: Math.round(faceH * 4) / 4 });
  }

  return {
    baseType: 'toe-kick',
    sections,
  };
}

export function LayoutSpecBuilder({
  value,
  onChange,
  disabled,
  cabinet,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
  cabinet: {
    category?: string | null;
    numberOfDoors?: number | null;
    numberOfDrawers?: number | null;
    height?: string | null;
    drawerHeight?: string | null;
    doorHeight?: string | null;
  };
}) {
  const spec: LayoutSpec = useMemo(() => {
    if (!value) return { baseType: 'toe-kick', sections: [] };
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
        return parsed as LayoutSpec;
      }
    } catch {}
    return { baseType: 'toe-kick', sections: [] };
  }, [value]);

  const setSpec = (next: LayoutSpec) => {
    onChange(JSON.stringify(next));
  };

  const initFromConfig = () => {
    setSpec(defaultLayoutSpec(cabinet));
  };

  const clearSpec = () => {
    onChange(null);
  };

  const updateBaseType = (bt: 'toe-kick' | 'pedestal') => {
    setSpec({ ...spec, baseType: bt });
  };

  const updatePedestalHeight = (h: number) => {
    setSpec({ ...spec, pedestalHeight: h });
  };

  const addSection = (type: LayoutSection['type']) => {
    const defaultHeights: Record<LayoutSection['type'], number> = {
      drawer: 6,
      door: 24,
      shelf: 12,
    };
    const newSection: LayoutSection = { type, count: 1, height: defaultHeights[type] };
    setSpec({ ...spec, sections: [...spec.sections, newSection] });
  };

  const removeSection = (idx: number) => {
    setSpec({ ...spec, sections: spec.sections.filter((_, i) => i !== idx) });
  };

  const updateSection = (idx: number, field: keyof LayoutSection, val: unknown) => {
    const updated = spec.sections.map((s, i) =>
      i !== idx ? s : { ...s, [field]: val }
    );
    setSpec({ ...spec, sections: updated });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= spec.sections.length) return;
    const arr = [...spec.sections];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setSpec({ ...spec, sections: arr });
  };

  const sectionTypeLabel: Record<LayoutSection['type'], string> = {
    drawer: 'Drawer Row',
    door: 'Door Row',
    shelf: 'Open Shelf',
  };

  const sectionTypeColor: Record<LayoutSection['type'], string> = {
    drawer: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700',
    door: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
    shelf: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
  };

  const totalHeight = spec.sections.reduce((sum, s) => sum + (s.height || 0), 0);
  const hasSpec = spec.sections.length > 0;
  const isVanity = (cabinet.category ?? '').toLowerCase().includes('vanity');
  const setVanityLayout = (drawerSide: 'left' | 'right') => {
    const drawerCount = Math.max(1, cabinet.numberOfDrawers ?? 3);
    setSpec({
      ...spec,
      sections: [],
      vanity: { drawerSide, drawerCount, drawerBankRatio: 0.4 },
    });
  };
  const clearVanityLayout = () => {
    const { vanity: _vanity, ...withoutVanity } = spec;
    setSpec(withoutVanity);
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 dark:bg-primary/10 px-4 py-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary shrink-0" />
        <p className="text-sm font-semibold text-primary">Visual Layout Spec</p>
        {hasSpec && (
          <span className="ml-auto text-[11px] text-muted-foreground">
            {totalHeight}" total
          </span>
        )}
      </div>

      {isVanity && (
        <div className="rounded-md border border-violet-300/70 bg-violet-50/60 p-3 space-y-2 dark:bg-violet-950/20">
          <div>
            <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">Vanity cabinet builder</p>
            <p className="text-[11px] text-muted-foreground">Set one tall door bay plus a vertically stacked drawer bank on the left or right.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(['left', 'right'] as const).map((side) => (
              <button
                key={side}
                type="button"
                disabled={disabled}
                onClick={() => setVanityLayout(side)}
                className={cn(
                  'rounded border px-2 py-2 text-xs font-medium transition-colors',
                  spec.vanity?.drawerSide === side
                    ? 'border-violet-600 bg-violet-600 text-white'
                    : 'border-violet-200 bg-background text-violet-800 hover:border-violet-500 dark:text-violet-200',
                )}
              >
                Drawers {side} · door {side === 'left' ? 'right' : 'left'}
              </button>
            ))}
          </div>
          {spec.vanity && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{spec.vanity.drawerCount} drawer{spec.vanity.drawerCount === 1 ? '' : 's'} in a {Math.round(spec.vanity.drawerBankRatio * 100)}% {spec.vanity.drawerSide} bank.</span>
              <button type="button" disabled={disabled} onClick={clearVanityLayout} className="ml-auto text-destructive hover:underline">Use standard layout</button>
            </div>
          )}
        </div>
      )}

      {/* Init / Clear buttons when no spec */}
      {!hasSpec && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">
            No layout spec defined. The elevation renderer will use the legacy auto-detect logic.
            Click below to define an exact spec.
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            disabled={disabled}
            onClick={initFromConfig}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Initialize from current config
          </Button>
        </div>
      )}

      {hasSpec && (
        <>
          {/* Base Type */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">Base Type</Label>
            <div className="flex gap-2">
              {(['toe-kick', 'pedestal'] as const).map((bt) => (
                <button
                  key={bt}
                  type="button"
                  disabled={disabled}
                  onClick={() => updateBaseType(bt)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors',
                    spec.baseType === bt
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                  )}
                >
                  {bt === 'toe-kick' ? '▬ Toe Kick (3.5")' : '▲ Pedestal Feet'}
                </button>
              ))}
            </div>
            {spec.baseType === 'pedestal' && (
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground shrink-0">Feet height:</Label>
                <Input
                  type="number"
                  min={2}
                  max={12}
                  step={0.5}
                  value={spec.pedestalHeight ?? 6}
                  onChange={(e) => updatePedestalHeight(parseFloat(e.target.value) || 6)}
                  disabled={disabled}
                  className="w-20 h-7 text-xs"
                />
                <span className="text-xs text-muted-foreground">inches</span>
              </div>
            )}
          </div>

          {/* Sections */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Sections{' '}
              <span className="text-[10px] font-normal">(list order = top→bottom; cabinet renders bottom→top)</span>
            </Label>

            {/* Visual preview bar */}
            <div
              className="rounded border border-border bg-background overflow-hidden flex flex-col-reverse"
              style={{ height: Math.max(80, Math.min(totalHeight * 2.5, 200)) + 'px' }}
            >
              {spec.sections.map((s, idx) => {
                const pct = totalHeight > 0 ? (s.height / totalHeight) * 100 : (100 / spec.sections.length);
                return (
                  <div
                    key={idx}
                    className={cn('border-t border-border/50 flex items-center justify-center overflow-hidden', sectionTypeColor[s.type])}
                    style={{ height: pct + '%' }}
                  >
                    <span className="text-[9px] font-medium opacity-70 px-1 text-center leading-tight">
                      {s.count > 1 ? `${s.count}× ` : ''}{sectionTypeLabel[s.type]} · {s.height}"
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Section rows */}
            <div className="space-y-1.5">
              {spec.sections.map((section, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1.5',
                    sectionTypeColor[section.type]
                  )}
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  {/* Type */}
                  <select
                    value={section.type}
                    onChange={(e) => updateSection(idx, 'type', e.target.value as LayoutSection['type'])}
                    disabled={disabled}
                    className="h-7 rounded border border-input bg-background px-1.5 text-xs font-medium"
                  >
                    <option value="door">Door Row</option>
                    <option value="drawer">Drawer Row</option>
                    <option value="shelf">Open Shelf</option>
                  </select>
                  {/* Count across */}
                  <select
                    value={section.count}
                    onChange={(e) => updateSection(idx, 'count', parseInt(e.target.value))}
                    disabled={disabled}
                    className="h-7 rounded border border-input bg-background px-1.5 text-xs w-20"
                    title="Count across"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} across</option>
                    ))}
                  </select>
                  {/* Height */}
                  <div className="flex items-center gap-0.5">
                    <Input
                      type="number"
                      min={1}
                      max={60}
                      step={0.25}
                      value={section.height}
                      onChange={(e) => updateSection(idx, 'height', parseFloat(e.target.value) || 1)}
                      disabled={disabled}
                      className="w-16 h-7 text-xs"
                      placeholder="ht"
                    />
                    <span className="text-[10px] text-muted-foreground">"</span>
                  </div>
                  {/* Move up/down */}
                  <div className="flex flex-col ml-auto">
                    <button
                      type="button"
                      onClick={() => moveSection(idx, -1)}
                      disabled={disabled || idx === 0}
                      className="h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Move up (toward top of cabinet)"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(idx, 1)}
                      disabled={disabled || idx === spec.sections.length - 1}
                      className="h-4 w-5 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                      title="Move down (toward bottom of cabinet)"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </div>
                  {/* Delete */}
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    disabled={disabled}
                    className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-30"
                    title="Remove section"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add section buttons */}
            <div className="flex gap-1.5 flex-wrap pt-1">
              <span className="text-[11px] text-muted-foreground self-center">Add:</span>
              {(['door', 'drawer', 'shelf'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => addSection(type)}
                  className={cn(
                    'flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors hover:opacity-80',
                    type === 'door' && 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300',
                    type === 'drawer' && 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
                    type === 'shelf' && 'border-green-300 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300',
                  )}
                >
                  <Plus className="h-3 w-3" />
                  {type === 'door' ? 'Door Row' : type === 'drawer' ? 'Drawer Row' : 'Open Shelf'}
                </button>
              ))}
              <button
                type="button"
                disabled={disabled}
                onClick={clearSpec}
                className="ml-auto flex items-center gap-1 rounded border border-destructive/30 bg-destructive/5 text-destructive px-2 py-1 text-[11px] font-medium hover:opacity-80"
              >
                <Trash2 className="h-3 w-3" />
                Clear spec
              </button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            First section in list = top of cabinet. Last section = just above the base. Elevation renders bottom→top.
          </p>
        </>
      )}
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditModal({
  row,
  open,
  onClose,
  onSaved,
}: {
  row: CabinetRow;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<CabinetRow>) => void;
}) {
  const [draft, setDraft] = useState<Partial<CabinetRow>>({});
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<"3d" | "2d">("3d");
  const [newAliasCode, setNewAliasCode] = useState("");
  const [measurementSource, setMeasurementSource] = useState<string | null>(null);
  // Image replacement confirmation dialog state
  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);
  const [imageConfirmOpen, setImageConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  // Fetch distributors that have this cabinet active (published + available SKUs)
  const { data: distributorsForCabinet } = trpc.cabinets.getDistributorsForCabinet.useQuery({
    cabinetId: row.id,
  });

  // Fetch categories from DB — single source of truth
  const { data: dbCategories } = trpc.cabinetCategories.list.useQuery();
  const FALLBACK_CATS = ["Base","Wall","Tall","Vanity","ADA","Corner","Accessory","Specialty","Filler"];
  const categoryOptions: string[] = dbCategories && dbCategories.length > 0
    ? dbCategories.map((c) => c.name)
    : FALLBACK_CATS;

  const merged: CabinetRow = { ...row, ...draft };

  const set = (field: keyof CabinetRow, value: unknown) =>
    setDraft((d) => ({ ...d, [field]: value }));

  // Sub-category options depend on the currently selected category
  const subCategoryOptions: string[] = useMemo(() => {
    const currentCategory = merged.category ?? null;
    if (!dbCategories || dbCategories.length === 0) {
      const fallback: Record<string, string[]> = {
        Base: ["Sink Base","Drawer Base","Corner Base","Blind Corner","Lazy Susan","Oven Base","Range Base"],
        Wall: ["Microwave","Open Shelf","Glass Door"],
        Tall: ["Pantry","Utility","Refrigerator"],
        Filler: ["Filler Panel","Decorative End Panel","Scribe Moulding"],
        Accessory: ["Roll-Out Tray","Trim & Molding"],
      };
      return currentCategory ? (fallback[currentCategory] ?? []) : [];
    }
    const cat = dbCategories.find((c) => c.name === currentCategory);
    return cat ? cat.subCategories.map((s) => s.name) : [];
  }, [dbCategories, merged.category]);

  const updateMutation = trpc.cabinets.adminUpdateCabinet.useMutation({
    onSuccess: () => {
      utils.cabinets.adminListCabinetConfig.invalidate();
      toast.success("Saved");
      onSaved(draft);
      setDraft({});
      onClose();
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  // ── Save scope: per-distributor rule (immediate) or master change request (pending approval)
  const [scopeOpen, setScopeOpen] = useState(false);
  const [scopeDistributorIds, setScopeDistributorIds] = useState<number[]>([]);
  const { data: existingDistributorRules } = trpc.cabinetOverrides.configForCabinet.useQuery(
    { cabinetId: row.id },
    { enabled: scopeOpen },
  );
  const setDistributorConfigMutation = trpc.cabinetOverrides.setConfig.useMutation({
    onSuccess: (result) => {
      utils.cabinetOverrides.configForCabinet.invalidate({ cabinetId: row.id });
      utils.design.placeableCabinets.invalidate();
      toast.success(
        `Rule saved for ${result.distributorIds.length} distributor${result.distributorIds.length === 1 ? "" : "s"} only. Master unchanged.`,
      );
      setScopeOpen(false);
      setDraft({});
      onClose();
    },
    onError: (e) => toast.error(`Distributor save failed: ${e.message}`),
  });
  const removeDistributorMutation = trpc.cabinets.adminRemoveCabinetDistributor.useMutation({
    onSuccess: (result) => {
      utils.cabinets.getDistributorsForCabinet.invalidate({ cabinetId: row.id });
      utils.cabinets.adminListCabinetConfig.invalidate();
      toast.success(`${result.distributorName} was removed from ${result.masterCode}. ${result.disabledSkuCount} active SKU${result.disabledSkuCount === 1 ? "" : "s"} hidden.`);
    },
    onError: (error) => toast.error(`Could not remove distributor: ${error.message}`),
  });

  const uploadMutation = trpc.cabinets.adminUploadCatalogImage.useMutation({
    onSuccess: (data) => {
      setUploading(false);
      // If there's already an image, show the confirmation dialog
      if (merged.catalogImageUrl) {
        setPendingImageUrl(data.url);
        setImageConfirmOpen(true);
      } else {
        // No existing image — just set it globally (first upload)
        set("catalogImageUrl", data.url);
        toast.success("Image uploaded");
      }
    },
    onError: (e) => { setUploading(false); toast.error(`Upload failed: ${e.message}`); },
  });

  // Mutation to save image at a specific scope (global or per-distributor)
  const setImageMutation = trpc.cabinetOverrides.setImage.useMutation({
    onSuccess: (res) => {
      if (res.scope === "global") {
        set("catalogImageUrl", pendingImageUrl);
        toast.success("Image replaced for all distributors");
      } else {
        toast.success("Image saved for this distributor only");
      }
      setPendingImageUrl(null);
      setImageConfirmOpen(false);
      utils.cabinets.adminListCabinetConfig.invalidate();
    },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  const generateMutation = trpc.cabinets.adminGenerateCatalogImage.useMutation({
    onSuccess: (data) => {
      set("catalogImageUrl", data.url);
      setGenerating(false);
      toast.success("AI image generated");
    },
    onError: (e) => { setGenerating(false); toast.error(`Generation failed: ${e.message}`); },
  });

  const estimateMutation = trpc.cabinets.adminEstimateMeasurements.useMutation({
    onSuccess: (data) => {
      if (data.weight) set("weight", data.weight);
      if (data.pkgLength) set("pkgLength", data.pkgLength);
      if (data.pkgWidth) set("pkgWidth", data.pkgWidth);
      if (data.pkgHeight) set("pkgHeight", data.pkgHeight);
      if (data.pkgWeight) set("pkgWeight", data.pkgWeight);
      const label = data.sourceLabel ?? "Filled in";
      setMeasurementSource(label);
      const sourceType = data.source;
      if (sourceType === "master_sheet" || sourceType === "distributor_override" || sourceType === "alias_sibling") {
        toast.success(label);
      } else {
        toast.info(label);
      }
    },
    onError: (e) => toast.error(`Fill failed: ${e.message}`),
  });

  // Master SKU Aliases for this cabinet
  const masterCode = row.masterCode ?? "";
  const { data: skuAliases, isLoading: aliasesLoading } = trpc.masterSku.getAliasesForCabinet.useQuery(
    { masterCode },
    { enabled: !!masterCode }
  );
  const addAliasMutation = trpc.masterSku.addAliasForCabinet.useMutation({
    onSuccess: (result) => {
      utils.masterSku.getAliasesForCabinet.invalidate({ masterCode });
      setNewAliasCode("");
      if (result.conflict) {
        toast.warning("Alias added but marked as conflict — it was previously mapped to a different master code.");
      } else {
        toast.success("Alias added");
      }
    },
    onError: (e: { message: string }) => toast.error(`Failed: ${e.message}`),
  });
  const deleteAliasMutation = trpc.masterSku.deleteAlias.useMutation({
    onSuccess: () => {
      utils.masterSku.getAliasesForCabinet.invalidate({ masterCode });
      toast.success("Alias removed");
    },
    onError: (e: { message: string }) => toast.error(`Failed: ${e.message}`),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      uploadMutation.mutate({
        filename: file.name,
        dataBase64: reader.result as string,
        contentType: file.type || "image/jpeg",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Helper: convert empty strings to null for decimal DB columns
  const strOrNull = (v: string | null | undefined): string | null => (v && v.trim() ? v.trim() : null);
  const buildMasterPayload = () => {
    const requestedMasterCode = (merged.masterCode ?? "").trim().toUpperCase();
    return {
      id: row.id,
      masterCode: requestedMasterCode === (row.masterCode ?? "").trim().toUpperCase() ? undefined : requestedMasterCode,
      description: merged.description ?? undefined,
      depth: strOrNull(merged.depth),
      width: strOrNull(merged.width),
      height: strOrNull(merged.height),
      weight: strOrNull(merged.weight),
      physicalWidth: strOrNull(merged.physicalWidth),
      pkgLength: strOrNull(merged.pkgLength),
      pkgWidth: strOrNull(merged.pkgWidth),
      pkgHeight: strOrNull(merged.pkgHeight),
      pkgWeight: strOrNull(merged.pkgWeight),
      numberOfDoors: merged.numberOfDoors ?? null,
      numberOfDrawers: merged.numberOfDrawers ?? null,
      numberOfFixedShelves: merged.numberOfFixedShelves ?? null,
      numberOfAdjShelves: merged.numberOfAdjShelves ?? null,
      altSku1: merged.altSku1 ?? null,
      altSku2: merged.altSku2 ?? null,
      altSku3: merged.altSku3 ?? null,
      showInCatalog: merged.showInCatalog ?? undefined,
      showInDesigner: merged.showInDesigner ?? undefined,
      showIn2020: merged.showIn2020 ?? undefined,
      isActive: merged.isActive ?? undefined,
      isNotCabinet: merged.isNotCabinet ?? undefined,
      catalogImageUrl: merged.catalogImageUrl ?? null,
      minPull: merged.minPull != null ? parseFloat(merged.minPull) : null,
      maxPull: merged.maxPull != null ? parseFloat(merged.maxPull) : null,
      openingWidth: merged.openingWidth != null ? parseFloat(merged.openingWidth) : null,
      openingHeight: merged.openingHeight != null ? parseFloat(merged.openingHeight) : null,
      openingType: (merged.openingType as "top" | "middle" | "bottom" | null | undefined) ?? null,
      doorHeight: merged.doorHeight != null ? parseFloat(merged.doorHeight) : null,
      drawerHeight: merged.drawerHeight != null ? parseFloat(merged.drawerHeight) : null,
      cornerType: (merged.cornerType as "lazy-susan" | "blind-corner" | "diagonal" | "pie-cut" | "l-shape" | "triangle" | null | undefined) ?? null,
      shelfRadius: merged.shelfRadius != null ? parseFloat(merged.shelfRadius) : null,
      shelfCount: merged.shelfCount ?? null,
      cabinetSquare: merged.cabinetSquare != null ? parseFloat(merged.cabinetSquare) : null,
      faceWidth: merged.faceWidth != null ? parseFloat(merged.faceWidth) : null,
      legWidth: merged.legWidth != null ? parseFloat(merged.legWidth) : null,
      category: merged.category ?? undefined,
      subCategory: merged.subCategory ?? null,
      configVerified: merged.configVerified ?? undefined,
      doorOrientation: (merged.doorOrientation as "side-by-side" | "stacked" | null | undefined) ?? null,
      doorsPerRow: merged.doorsPerRow ?? null,
      drawerLayout: merged.drawerLayout ?? null,
      grainDirection: (merged.grainDirection as "vertical" | "horizontal" | null | undefined) ?? null,
      isDecorativeDoor: merged.isDecorativeDoor ?? undefined,
      layoutSpec: merged.layoutSpec ?? null,
      specImageUrl: merged.specImageUrl ?? null,
      specNotes: merged.specNotes ?? null,
    };
  };
  /** Configuration-only fields (no master code, visibility, alt SKUs or prices). */
  const buildConfigRule = () => {
    const full = buildMasterPayload() as Record<string, unknown>;
    const keys = [
      "description","category","subCategory","width","height","depth","physicalWidth","weight",
      "pkgLength","pkgWidth","pkgHeight","pkgWeight","numberOfDoors","numberOfDrawers","numberOfFixedShelves",
      "numberOfAdjShelves","minPull","maxPull","openingWidth","openingHeight","openingType","doorHeight","drawerHeight",
      "cornerType","shelfRadius","shelfCount","cabinetSquare","faceWidth","legWidth","doorOrientation","doorsPerRow",
      "drawerLayout","grainDirection","isDecorativeDoor","layoutSpec","specImageUrl","specNotes",
    ] as const;
    const rule: Record<string, unknown> = {};
    for (const key of keys) {
      // Only fields the admin actually touched in this session
      if (!(key in draft)) continue;
      const value = full[key];
      if (value === undefined) continue;
      rule[key] = value;
    }
    return rule;
  };
  const configTouched = Object.keys(buildConfigRule()).length > 0;
  const nonConfigTouched = Object.keys(draft).some((k) =>
    ["masterCode","altSku1","altSku2","altSku3","showInCatalog","showInDesigner","showIn2020","isActive","isNotCabinet","catalogImageUrl","configVerified"].includes(k),
  );
  const handleSave = () => {
    if (Object.keys(draft).length === 0) { onClose(); return; }
    const requestedMasterCode = (merged.masterCode ?? "").trim().toUpperCase();
    if (!requestedMasterCode) {
      toast.error("A master code is required. Add an alias instead if this is an alternate code.");
      return;
    }
    if (!configTouched && nonConfigTouched) {
      // Housekeeping-only edits (visibility, alt SKUs, image, verification, code rename)
      // are not cabinet rules; they still save directly to the master row.
      updateMutation.mutate(buildMasterPayload());
      return;
    }
    setScopeDistributorIds([]);
    setScopeOpen(true);
  };
  const handleSaveForDistributors = () => {
    if (scopeDistributorIds.length === 0) {
      toast.error("Tick at least one distributor, or request a master change.");
      return;
    }
    if (nonConfigTouched) {
      // Non-rule housekeeping still goes to the master row (it has no per-distributor form).
      const full = buildMasterPayload() as Record<string, unknown>;
      const housekeeping: Record<string, unknown> = { id: row.id };
      for (const k of ["masterCode","altSku1","altSku2","altSku3","showInCatalog","showInDesigner","showIn2020","isActive","isNotCabinet","catalogImageUrl","configVerified"]) {
        if (k in draft) housekeeping[k] = full[k];
      }
      updateMutation.mutate(housekeeping as never);
    }
    setDistributorConfigMutation.mutate({
      cabinetId: row.id,
      distributorIds: scopeDistributorIds,
      config: buildConfigRule() as never,
    });
  };

  const busy = uploading || generating || updateMutation.isPending || estimateMutation.isPending || removeDistributorMutation.isPending || setDistributorConfigMutation.isPending;
  const depthVal = merged.depth ? String(parseFloat(merged.depth)) : "";
  const isStandardDepth = STANDARD_DEPTHS.includes(depthVal);

  return (<>
    <Dialog open={open} onOpenChange={(v) => { if (!v && !busy) { setDraft({}); onClose(); } }}>
      <DialogContent className="!flex h-[min(88dvh,52rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col overflow-hidden p-4 sm:h-[min(88dvh,52rem)] sm:w-[min(32rem,calc(100vw-2rem))] sm:max-w-none sm:p-6">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings2 className="h-4 w-4 text-primary shrink-0" />
            <span className="font-mono font-bold text-primary">{row.masterCode}</span>
          </DialogTitle>
          {row.category && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {row.category}{row.subCategory ? ` › ${row.subCategory}` : ""}
            </p>
          )}
        </DialogHeader>

        <Tabs defaultValue="details" className="flex min-h-0 w-full flex-1 flex-col">
          <TabsList className="mb-3 grid w-full shrink-0 grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="aliases">Aliases</TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" className="mt-0 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Master Code</Label>
              <Input
                className="font-mono text-sm uppercase"
                maxLength={64}
                placeholder="e.g. W1215GD"
                value={merged.masterCode ?? ""}
                onChange={(e) => set("masterCode", e.target.value.toUpperCase())}
                disabled={busy}
              />
              <p className="text-[11px] text-muted-foreground">Changing the master code preserves the prior code as a searchable legacy alias.</p>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Description</Label>
              <Textarea
                className="text-sm resize-none"
                rows={3}
                placeholder="Enter cabinet description…"
                value={merged.description ?? ""}
                onChange={(e) => set("description", e.target.value || null)}
                disabled={busy}
              />
            </div>

            {/* Category & Sub-Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Category</Label>
                <Select
                  value={merged.category ?? "__none__"}
                  onValueChange={(v) => set("category", v === "__none__" ? null : v)}
                  disabled={busy}
                >
                  <SelectTrigger className={cn("w-full", !merged.category && "text-muted-foreground")}>
                    <SelectValue placeholder="— not set —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— not set —</SelectItem>
                    {categoryOptions.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sub-Category</Label>
                <Select
                  value={merged.subCategory ?? "__none__"}
                  onValueChange={(v) => set("subCategory", v === "__none__" ? null : v)}
                  disabled={busy}
                >
                  <SelectTrigger className={cn("w-full", !merged.subCategory && "text-muted-foreground")}>
                    <SelectValue placeholder="— none —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— none —</SelectItem>
                    {subCategoryOptions.map((sub) => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                    {subCategoryOptions.length === 0 && merged.subCategory && (
                      <SelectItem value={merged.subCategory}>{merged.subCategory}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Distributors that carry this cabinet */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Active on Distributors</Label>
              <div className="rounded-lg border border-border bg-muted/20 p-3">
                {distributorsForCabinet && distributorsForCabinet.length > 0 ? (
                  <div className="space-y-2">
                    {distributorsForCabinet.map((dist) => (
                      <div key={dist.id} className="flex items-center justify-between gap-3 rounded-md bg-background px-2.5 py-2 text-sm text-foreground">
                        <span className="min-w-0 truncate">{dist.name}</span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 shrink-0 border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={busy}
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove this distributor from the cabinet?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove <strong>{dist.name}</strong> from <strong className="font-mono">{merged.masterCode}</strong> by disabling its active SKU records and removing the eligibility link. It does not delete the distributor, cabinet, price history, or inactive SKU history. A later verified import can reconnect the product.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => removeDistributorMutation.mutate({ cabinetId: row.id, distributorId: dist.id })}
                              >
                                Remove from cabinet
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not active on any distributors yet</p>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Use Remove only when this distributor does not sell this cabinet. The distributor and its historical SKU records remain intact.</p>
            </div>

            {/* Not a cabinet */}
            <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3 bg-muted/30">
              <div>
                <p className="text-sm font-medium">Not a Cabinet</p>
                <p className="text-xs text-muted-foreground">Trim, panel, moulding, or accessory</p>
              </div>
              <Switch
                checked={merged.isNotCabinet === true}
                onCheckedChange={(v) => set("isNotCabinet", v)}
                disabled={busy}
              />
            </div>

            {!merged.isNotCabinet && (
              <>
                {/* Depth */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Standard Depth</Label>
                  <Select
                    value={depthVal || "__none__"}
                    onValueChange={(v) => set("depth", v === "__none__" ? null : v)}
                    disabled={busy}
                  >
                    <SelectTrigger className={cn("w-full", !depthVal && "text-muted-foreground")}>
                      <SelectValue placeholder="— not set —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— not set —</SelectItem>
                      {STANDARD_DEPTHS.map((d) => (
                        <SelectItem key={d} value={d}>{d}"</SelectItem>
                      ))}
                      {depthVal && !isStandardDepth && (
                        <SelectItem value={depthVal}>{depthVal}" (custom)</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Doors / Drawers */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Number of Doors</Label>
                    <Select
                      value={merged.numberOfDoors === null ? "__none__" : String(merged.numberOfDoors)}
                      onValueChange={(v) => set("numberOfDoors", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", merged.numberOfDoors === null && "text-muted-foreground")}>
                        <SelectValue placeholder="— not set —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {(DOOR_OPTIONS as ReadonlyArray<number | null>).filter((o): o is number => o !== null).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Number of Drawers</Label>
                    <Select
                      value={merged.numberOfDrawers === null ? "__none__" : String(merged.numberOfDrawers)}
                      onValueChange={(v) => set("numberOfDrawers", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", merged.numberOfDrawers === null && "text-muted-foreground")}>
                        <SelectValue placeholder="— not set —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {(DRAWER_OPTIONS as ReadonlyArray<number | null>).filter((o): o is number => o !== null).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Door Orientation */}
                {(merged.numberOfDoors ?? 0) >= 2 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Door Orientation</Label>
                    <Select
                      value={merged.doorOrientation ?? "__none__"}
                      onValueChange={(v) => set("doorOrientation", v === "__none__" ? null : v)}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", !merged.doorOrientation && "text-muted-foreground")}>
                        <SelectValue placeholder="— default (side by side) —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— default (side by side) —</SelectItem>
                        <SelectItem value="side-by-side">Side by Side (left/right)</SelectItem>
                        <SelectItem value="stacked">Stacked (top/bottom)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">For pantries or tall cabinets with 2+ doors arranged vertically, choose "Stacked".</p>
                  </div>
                )}
                {/* Doors Per Row (side-by-side count) */}
                {(merged.numberOfDoors ?? 0) >= 2 && (merged.doorOrientation !== "stacked") && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Doors Per Row (Side-by-Side)</Label>
                    <Select
                      value={merged.doorsPerRow != null ? String(merged.doorsPerRow) : "__auto__"}
                      onValueChange={(v) => set("doorsPerRow", v === "__auto__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", merged.doorsPerRow == null && "text-muted-foreground")}>
                        <SelectValue placeholder="— auto (all side by side) —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__auto__">— auto (all side by side) —</SelectItem>
                        <SelectItem value="1">1 door per row (stacked rows)</SelectItem>
                        <SelectItem value="2">2 doors side by side</SelectItem>
                        <SelectItem value="3">3 doors side by side</SelectItem>
                        <SelectItem value="4">4 doors side by side</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">Controls how many doors appear side-by-side in each row. Auto = all {merged.numberOfDoors} doors in one row.</p>
                  </div>
                )}

                {/* Corner Type */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Corner Cabinet Type</Label>
                  <Select
                    value={merged.cornerType ?? "__none__"}
                    onValueChange={(v) => set("cornerType", v === "__none__" ? null : v)}
                    disabled={busy}
                  >
                    <SelectTrigger className={cn("w-full", !merged.cornerType && "text-muted-foreground")}>
                      <SelectValue placeholder="— standard (not a corner) —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— standard (not a corner) —</SelectItem>
                      <SelectItem value="lazy-susan">Lazy Susan (LS)</SelectItem>
                      <SelectItem value="blind-corner">Blind Corner (BBC / WBC)</SelectItem>
                      <SelectItem value="diagonal">Diagonal Corner (DC / WDC)</SelectItem>
                      <SelectItem value="base-end-corner">Base End Corner (BEC)</SelectItem>
                      <SelectItem value="triangle">Triangle Corner (WTC / BTC)</SelectItem>
                      <SelectItem value="pie-cut">Pie-Cut Lazy Susan</SelectItem>
                      <SelectItem value="l-shape">L-Shape Corner</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Controls how this cabinet is rendered in the design tool plan view and elevation.</p>
                </div>

                {/* Appliance Opening */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Appliance Opening</Label>
                  <Select
                    value={merged.openingType ?? "__none__"}
                    onValueChange={(v) => set("openingType", v === "__none__" ? null : v)}
                    disabled={busy}
                  >
                    <SelectTrigger className={cn("w-full", !merged.openingType && "text-muted-foreground")}>
                      <SelectValue placeholder="— none —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— none —</SelectItem>
                      <SelectItem value="top">Top (doors above opening)</SelectItem>
                      <SelectItem value="middle">Middle (doors above, drawers below)</SelectItem>
                      <SelectItem value="bottom">Bottom (opening above drawers)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Set for oven, microwave, or appliance cabinets that have a cutout opening.</p>
                </div>

                {/* Door Height (shown when opening type is set) */}
                {merged.openingType && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Door Height (inches)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="e.g. 18.5"
                      value={merged.doorHeight ?? ""}
                      onChange={(e) => set("doorHeight", e.target.value || null)}
                      disabled={busy}
                      className="w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">Height of the door panels. The opening size is calculated from total height minus door/drawer heights.</p>
                  </div>
                )}

                {/* Drawer Height (shown when drawers > 0) */}
                {(merged.numberOfDrawers ?? 0) > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Drawer Height (inches)</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      placeholder="e.g. 6"
                      value={merged.drawerHeight ?? ""}
                      onChange={(e) => set("drawerHeight", e.target.value || null)}
                      disabled={busy}
                      className="w-full"
                    />
                    <p className="text-[11px] text-muted-foreground">Height of each drawer front in inches.</p>
                  </div>
                )}

                {/* Drawer Layout (row-based grid) */}
                {(merged.numberOfDrawers ?? 0) >= 2 && (
                  <DrawerLayoutEditor
                    value={merged.drawerLayout}
                    onChange={(v) => set("drawerLayout", v)}
                    totalDrawers={merged.numberOfDrawers ?? 0}
                    disabled={busy}
                  />
                )}

                {/* Panel Config: Grain Direction + Decorative Door */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Grain Direction (panels only)</Label>
                    <select
                      value={merged.grainDirection ?? ""}
                      onChange={(e) => set("grainDirection", e.target.value || null)}
                      disabled={busy}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="">None / Not a panel</option>
                      <option value="vertical">Vertical (up/down)</option>
                      <option value="horizontal">Horizontal (left/right)</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">Set grain direction for skin/end/plywood panels. Leave blank for cabinets.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="isDecorativeDoor"
                      checked={!!merged.isDecorativeDoor}
                      onChange={(e) => set("isDecorativeDoor", e.target.checked)}
                      disabled={busy}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="isDecorativeDoor" className="text-sm">Decorative Door Panel</Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Check if this panel uses the door style image (decorative end panels, island backs).</p>
                </div>

                {/* Door / Drawer Layout Preview — live preview of the door+drawer arrangement */}
                {(merged.numberOfDoors !== null || merged.numberOfDrawers !== null || merged.openingType || merged.grainDirection || merged.isDecorativeDoor) && (
                  <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Layout Preview</p>
                    <div className="flex justify-center">
                      <DoorDrawerDiagram
                        cabinet={{
                          masterCode: merged.masterCode,
                          description: merged.description,
                          category: merged.category,
                          subCategory: merged.subCategory,
                          width: merged.width,
                          height: merged.height,
                          numberOfDoors: merged.numberOfDoors,
                          numberOfDrawers: merged.numberOfDrawers,
                          openingType: merged.openingType,
                          doorHeight: merged.doorHeight,
                          drawerHeight: merged.drawerHeight,
                          doorOrientation: merged.doorOrientation,
                          drawerLayout: merged.drawerLayout,
                          grainDirection: merged.grainDirection,
                          isDecorativeDoor: merged.isDecorativeDoor,
                        }}
                        width={160}
                      />
                    </div>
                  </div>
                )}
                {/* Visual Layout Spec Builder */}
                <LayoutSpecBuilder
                  value={merged.layoutSpec ?? null}
                  onChange={(v) => set('layoutSpec', v)}
                  disabled={busy}
                  cabinet={{
                    category: merged.category,
                    numberOfDoors: merged.numberOfDoors,
                    numberOfDrawers: merged.numberOfDrawers,
                    height: merged.height,
                    drawerHeight: merged.drawerHeight,
                    doorHeight: merged.doorHeight,
                  }}
                />

                {/* Blind Corner Pull Spec — auto-shown for BBC/WBC/BLIND codes */}
                {isBlindCornerCode(merged.masterCode, merged.description) && (
                  <div className="rounded-lg border border-amber-500/40 bg-amber-50/10 dark:bg-amber-900/10 px-4 py-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                      <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">Blind Corner Pull Spec</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The pull range controls how far this cabinet slides out from the corner. The designer enforces these limits when placing the cabinet.
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <DimInput
                        label="Min Pull"
                        value={merged.minPull}
                        onChange={(v) => set("minPull", v)}
                        unit='"'
                        disabled={busy}
                      />
                      <DimInput
                        label="Max Pull"
                        value={merged.maxPull}
                        onChange={(v) => set("maxPull", v)}
                        unit='"'
                        disabled={busy}
                      />
                      <DimInput
                        label="Opening Width"
                        value={merged.openingWidth}
                        onChange={(v) => set("openingWidth", v)}
                        unit='"'
                        disabled={busy}
                      />
                      <DimInput
                        label="Opening Height"
                        value={merged.openingHeight}
                        onChange={(v) => set("openingHeight", v)}
                        unit='"'
                        disabled={busy}
                      />
                    </div>
                    {(!merged.minPull || !merged.maxPull) && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        Min and Max Pull are required — the designer defaults to 3–6" until set.
                      </p>
                    )}
                  </div>
                )}

                {/* Fixed / Adj Shelves */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Fixed Shelves</Label>
                    <Select
                      value={merged.numberOfFixedShelves === null ? "__none__" : String(merged.numberOfFixedShelves)}
                      onValueChange={(v) => set("numberOfFixedShelves", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", merged.numberOfFixedShelves === null && "text-muted-foreground")}>
                        <SelectValue placeholder="— not set —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {(SHELF_OPTIONS as ReadonlyArray<number | null>).filter((o): o is number => o !== null).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Adjustable Shelves</Label>
                    <Select
                      value={merged.numberOfAdjShelves === null ? "__none__" : String(merged.numberOfAdjShelves)}
                      onValueChange={(v) => set("numberOfAdjShelves", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className={cn("w-full", merged.numberOfAdjShelves === null && "text-muted-foreground")}>
                        <SelectValue placeholder="— not set —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {(SHELF_OPTIONS as ReadonlyArray<number | null>).filter((o): o is number => o !== null).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n === 0 ? "None" : n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {/* Visibility / Permissions */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Visibility & Permissions</Label>
              <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                {([
                  { field: "showInCatalog" as const, label: "Show in Catalog", desc: "Visible on the public storefront" },
                  { field: "showInDesigner" as const, label: "Show in Designer", desc: "Available in the 3D Designer" },
                  { field: "showIn2020" as const, label: "Show in 2020", desc: "Exported to 2020 Design catalog" },
                  { field: "isActive" as const, label: "Active", desc: "Cabinet is active in the system" },
                ] as const).map(({ field, label, desc }) => (
                  <div key={field} className="flex items-center justify-between px-4 py-3 bg-background">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={merged[field] !== false}
                      onCheckedChange={(v) => set(field, v)}
                      disabled={busy}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* ── Config Verified ── */}
            <CabinetVerificationControl
              checked={merged.configVerified === true}
              onCheckedChange={(v) => set("configVerified", v)}
              disabled={busy}
              verifiedDescription={
                merged.configVerifiedAt
                  ? `Verified on ${new Date(merged.configVerifiedAt).toLocaleDateString()}`
                  : "You've reviewed all fields and confirmed everything is correct"
              }
              pendingDescription="Check this when you've reviewed all fields and everything is correct"
            />

            {/* Catalog Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm font-medium">Catalog Image</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Replace image
                </Button>
              </div>
              <MediaPicker
                value={merged.catalogImageUrl ?? ""}
                onChange={(url) => {
                  const nextUrl = url || null;
                  const existingUrl = merged.catalogImageUrl ?? row.catalogImageUrl ?? null;
                  if (requiresImageReplacementScope(existingUrl, nextUrl)) {
                    setPendingImageUrl(nextUrl);
                    setImageConfirmOpen(true);
                    return;
                  }
                  set("catalogImageUrl", nextUrl);
                }}
                placeholder="/manus-storage/... or https://..."
              />
              <div className="flex gap-2 items-center mt-1">
                <div className="flex rounded border border-border overflow-hidden">
                  {(["3d", "2d"] as const).map((m) => (
                    <button
                      key={m}
                      className={cn(
                        "px-2 py-1 text-xs font-medium transition-colors",
                        m === "2d" && "border-l border-border",
                        viewMode === m
                          ? "bg-amber-500 text-white"
                          : "bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                      onClick={() => setViewMode(m)}
                      disabled={busy}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-1.5 border-amber-400/60 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  disabled={busy}
                  onClick={() => { setGenerating(true); generateMutation.mutate({ id: row.id, viewMode }); }}
                >
                  {generating ? <Spinner className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {generating ? "Generating…" : "AI Generate"}
                </Button>
              </div>
            </div>
            {/* ── Spec Book Drawing & Notes ── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Spec Book Drawing</Label>
              <MediaPicker
                value={merged.specImageUrl ?? ""}
                onChange={(url) => set("specImageUrl", url || null)}
                placeholder="/manus-storage/spec_drawing.png"
              />
            </div>

            {/* ── Spec Notes ── */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Spec Notes</Label>
              <Textarea
                className="text-xs min-h-[80px] resize-y"
                placeholder="Spec notes from the Capital spec book (dimensions, construction details, etc.)"
                value={merged.specNotes ?? ""}
                onChange={(e) => set("specNotes", e.target.value || null)}
                disabled={busy}
              />
              <p className="text-[10px] text-muted-foreground">Shown on the public cabinet detail page. Auto-populated from the spec book — edit to customize for this cabinet.</p>
            </div>

          </TabsContent>

          {/* ── Measurements tab ── */}
          <TabsContent value="measurements" className="mt-0 min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">
                  Assembled cabinet dimensions and package/shipping dimensions. All values in inches unless noted.
                </p>
                {measurementSource && (
                  <p className="text-xs mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                    <span className="text-green-600 dark:text-green-400">{measurementSource}</span>
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 shrink-0"
                disabled={busy}
                onClick={() => {
                  setMeasurementSource(null);
                  estimateMutation.mutate({
                    id: row.id,
                    width: merged.width,
                    height: merged.height,
                    depth: merged.depth,
                  });
                }}
              >
                {estimateMutation.isPending ? (
                  <Spinner className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {estimateMutation.isPending ? "Filling…" : "Smart Fill"}
              </Button>
            </div>

            {/* Assembled dims */}
            <div>
              <p className="text-sm font-semibold mb-2">Assembled Dimensions</p>
              <div className="grid grid-cols-3 gap-3">
                <DimInput label="Width" value={merged.width} onChange={(v) => set("width", v)} disabled={busy} />
                <DimInput label="Height" value={merged.height} onChange={(v) => set("height", v)} disabled={busy} />
                <DimInput label="Depth" value={merged.depth} onChange={(v) => set("depth", v)} disabled={busy} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <DimInput label="Physical Width (door open)" value={merged.physicalWidth} onChange={(v) => set("physicalWidth", v)} disabled={busy} />
                <DimInput label="Weight" value={merged.weight} onChange={(v) => set("weight", v)} unit="lbs" disabled={busy} />
              </div>
            </div>

            {/* Package dims */}
            <div>
              <p className="text-sm font-semibold mb-2">Package / Shipping Dimensions</p>
              <div className="grid grid-cols-3 gap-3">
                <DimInput label="Pkg Length" value={merged.pkgLength} onChange={(v) => set("pkgLength", v)} disabled={busy} />
                <DimInput label="Pkg Width" value={merged.pkgWidth} onChange={(v) => set("pkgWidth", v)} disabled={busy} />
                <DimInput label="Pkg Height" value={merged.pkgHeight} onChange={(v) => set("pkgHeight", v)} disabled={busy} />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <DimInput label="Pkg Weight" value={merged.pkgWeight} onChange={(v) => set("pkgWeight", v)} unit="lbs" disabled={busy} />
              </div>
            </div>

            {/* Auto-fill hint when all weight/pkg fields are empty */}
            {!merged.weight && !merged.pkgLength && !merged.pkgWeight && !estimateMutation.isPending && !measurementSource && (
              <p className="text-xs text-muted-foreground italic">
                No weight or package data yet. Click "Smart Fill" to pull from the master sheet or estimate via AI.
              </p>
            )}

            {/* ── Corner Cabinet Measurements (conditional) ── */}
            {merged.cornerType === "lazy-susan" && (
              <div className="rounded-lg border border-blue-500/40 bg-blue-50/10 dark:bg-blue-900/10 px-4 py-3 space-y-3">
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">Lazy Susan Measurements</p>
                <p className="text-xs text-muted-foreground">
                  The cabinet square is the overall footprint. Shelf radius controls the rotating shelf size.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <DimInput
                    label="Cabinet Square"
                    value={merged.cabinetSquare}
                    onChange={(v) => set("cabinetSquare", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <DimInput
                    label="Shelf Radius"
                    value={merged.shelfRadius}
                    onChange={(v) => set("shelfRadius", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Shelf Count</Label>
                    <Select
                      value={merged.shelfCount != null ? String(merged.shelfCount) : "__none__"}
                      onValueChange={(v) => set("shelfCount", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {merged.cornerType === "diagonal" && (
              <div className="rounded-lg border border-purple-500/40 bg-purple-50/10 dark:bg-purple-900/10 px-4 py-3 space-y-3">
                <p className="text-sm font-semibold text-purple-600 dark:text-purple-400">Diagonal Corner Measurements</p>
                <p className="text-xs text-muted-foreground">
                  Face width is the angled door opening. Leg width is the depth of each side leg. Cabinet square is the overall footprint.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <DimInput
                    label="Cabinet Square"
                    value={merged.cabinetSquare}
                    onChange={(v) => set("cabinetSquare", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <DimInput
                    label="Face Width"
                    value={merged.faceWidth}
                    onChange={(v) => set("faceWidth", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <DimInput
                    label="Leg Width"
                    value={merged.legWidth}
                    onChange={(v) => set("legWidth", v)}
                    unit='"'
                    disabled={busy}
                  />
                </div>
              </div>
            )}

            {merged.cornerType === "pie-cut" && (
              <div className="rounded-lg border border-green-500/40 bg-green-50/10 dark:bg-green-900/10 px-4 py-3 space-y-3">
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">Pie-Cut Lazy Susan Measurements</p>
                <p className="text-xs text-muted-foreground">
                  Same as Lazy Susan but with pie-cut (kidney-shaped) shelves. Cabinet square is the overall footprint.
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <DimInput
                    label="Cabinet Square"
                    value={merged.cabinetSquare}
                    onChange={(v) => set("cabinetSquare", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <DimInput
                    label="Shelf Radius"
                    value={merged.shelfRadius}
                    onChange={(v) => set("shelfRadius", v)}
                    unit='"'
                    disabled={busy}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-muted-foreground">Shelf Count</Label>
                    <Select
                      value={merged.shelfCount != null ? String(merged.shelfCount) : "__none__"}
                      onValueChange={(v) => set("shelfCount", v === "__none__" ? null : parseInt(v))}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not set —</SelectItem>
                        {[1, 2, 3, 4].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ── Aliases tab ── */}
          <TabsContent value="aliases" className="mt-0 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 [scrollbar-gutter:stable]">
            <p className="text-xs text-muted-foreground">
              Master SKU alias codes that redirect to{" "}
              <span className="font-mono font-semibold">{row.masterCode}</span>. When any of these codes appear in an order or catalog lookup, they resolve to this cabinet.
            </p>

            {/* Add new alias */}
            <div className="flex gap-2">
              <Input
                className="h-9 text-sm font-mono flex-1"
                placeholder="e.g. VS-24 or DCW2415GD"
                value={newAliasCode}
                onChange={(e) => setNewAliasCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newAliasCode.trim()) {
                    addAliasMutation.mutate({ aliasCode: newAliasCode.trim(), masterCode });
                  }
                }}
                disabled={addAliasMutation.isPending || !masterCode}
              />
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => {
                  if (newAliasCode.trim()) {
                    addAliasMutation.mutate({ aliasCode: newAliasCode.trim(), masterCode });
                  }
                }}
                disabled={!newAliasCode.trim() || addAliasMutation.isPending || !masterCode}
              >
                {addAliasMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                Add
              </Button>
            </div>

            {/* Alias list */}
            {aliasesLoading ? (
              <div className="flex items-center justify-center py-6">
                <Spinner className="h-5 w-5 text-muted-foreground" />
              </div>
            ) : !skuAliases || skuAliases.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                No alias codes yet. Add one above.
              </div>
            ) : (
              <div className="space-y-1.5">
                {skuAliases.map((alias) => (
                  <div
                    key={alias.id}
                    className={cn(
                      "flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm",
                      alias.conflictStatus === "conflict"
                        ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-semibold truncate">{alias.aliasCode}</span>
                      <span className="text-muted-foreground shrink-0">→</span>
                      <span className="font-mono text-xs text-muted-foreground truncate">{alias.masterCode}</span>
                      {alias.conflictStatus === "conflict" && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 gap-1 shrink-0">
                          <AlertTriangle className="h-3 w-3" />
                          Conflict
                        </Badge>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                          disabled={deleteAliasMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove alias?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove the mapping{" "}
                            <strong className="font-mono">{alias.aliasCode}</strong> →{" "}
                            <strong className="font-mono">{alias.masterCode}</strong>. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteAliasMutation.mutate({ id: alias.id })}
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}

            {!masterCode && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                This cabinet has no master code set. Add a master code in the Details tab before managing aliases.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-2 shrink-0 flex-row justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={() => { setDraft({}); onClose(); }} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={busy} className="min-w-20">
            {updateMutation.isPending ? <Spinner className="h-4 w-4" /> : "Save"}
          </Button>
        </DialogFooter>

        <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={handleFile} />
        <Dialog open={scopeOpen} onOpenChange={(open) => { if (!open) setScopeOpen(false); }}>
          <DialogContent className="max-w-lg" data-testid="cabinet-config-save-scope">
            <DialogHeader>
              <DialogTitle>Who gets this rule for {row.masterCode}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Pick each distributor this configuration applies to. Only the lines you tick change; every
                other distributor and the shared master keep their current values.
              </p>
              <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-2">
                {distributorsForCabinet && distributorsForCabinet.length > 0 ? (
                  distributorsForCabinet.map((dist) => {
                    const checked = scopeDistributorIds.includes(dist.id);
                    const hasRule = existingDistributorRules?.some((r) => r.distributorId === dist.id);
                    return (
                      <label key={dist.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-muted/60">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            setScopeDistributorIds((ids) => (v ? Array.from(new Set([...ids, dist.id])) : ids.filter((id) => id !== dist.id)))
                          }
                          aria-label={`Apply rule to ${dist.name}`}
                        />
                        <span className="min-w-0 flex-1 truncate">{dist.name}</span>
                        {hasRule && <Badge variant="outline" className="text-[10px]">has own rule</Badge>}
                      </label>
                    );
                  })
                ) : (
                  <p className="px-1.5 py-1 text-xs text-muted-foreground">No distributor carries this cabinet yet.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <Button type="button" size="sm" variant="ghost" onClick={() => setScopeDistributorIds([])}>
                  Clear
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Each distributor is chosen one at a time. The shared master is never changed from here.
              </p>
            </div>
            <DialogFooter className="flex-row flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setScopeOpen(false)} disabled={busy}>
                Back
              </Button>
              <Button
                onClick={handleSaveForDistributors}
                disabled={busy || scopeDistributorIds.length === 0}
                data-testid="cabinet-config-save-distributors"
              >
                {setDistributorConfigMutation.isPending ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  `Save for ${scopeDistributorIds.length || ""} selected distributor${scopeDistributorIds.length === 1 ? "" : "s"}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>

    {/* ── Image Replacement Confirmation Dialog ── */}
    <Dialog open={imageConfirmOpen} onOpenChange={(v) => { if (!v) { setPendingImageUrl(null); setImageConfirmOpen(false); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace Cabinet Image</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            A catalog image already exists for <span className="font-semibold text-foreground">{row.masterCode}</span>. How should the new image be applied?
          </p>

          {/* Side-by-side: New image + Designer rendering */}
          <div className="grid grid-cols-2 gap-4">
            {/* New uploaded image */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground text-center">New Catalog Image</p>
              <div className="h-32 rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                {pendingImageUrl ? (
                  <img src={pendingImageUrl} alt="new" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
            </div>
            {/* Designer rendering */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground text-center">Designer Rendering</p>
              <div className="h-32 rounded-lg border border-border bg-muted/20 flex items-center justify-center overflow-hidden">
                <DoorDrawerDiagram
                  cabinet={{
                    masterCode: merged.masterCode,
                    description: merged.description,
                    category: merged.category,
                    subCategory: merged.subCategory,
                    width: merged.width,
                    height: merged.height,
                    numberOfDoors: merged.numberOfDoors,
                    numberOfDrawers: merged.numberOfDrawers,
                    openingType: merged.openingType,
                    doorHeight: merged.doorHeight,
                    drawerHeight: merged.drawerHeight,
                    doorOrientation: merged.doorOrientation,
                  }}
                  width={120}
                />
              </div>
            </div>
          </div>

          {/* Scope selection buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="rounded-lg border-2 border-primary bg-primary/5 p-3 text-left transition-all hover:bg-primary/10"
              disabled={setImageMutation.isPending}
              onClick={() => {
                if (!pendingImageUrl) return;
                setImageMutation.mutate({
                  cabinetId: row.id,
                  distributorId: 210001, // Ashford as default
                  imageUrl: pendingImageUrl,
                  scope: "global",
                });
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">All lines</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Replace the master image across every distributor line
              </p>
            </button>
            <button
              type="button"
              className="rounded-lg border-2 border-border p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/30"
              disabled={setImageMutation.isPending}
              onClick={() => {
                if (!pendingImageUrl) return;
                // Save as distributor-specific override (Ashford = 210001 source of truth)
                setImageMutation.mutate({
                  cabinetId: row.id,
                  distributorId: 210001,
                  imageUrl: pendingImageUrl,
                  scope: "line",
                });
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">This line only</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Save as a distributor-specific override (does not change other lines)
              </p>
            </button>
          </div>

          {setImageMutation.isPending && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Saving…
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { setPendingImageUrl(null); setImageConfirmOpen(false); }} disabled={setImageMutation.isPending}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>);
}

// ─── Main component ───────────────────────────────────────────────────────────
// ─── Apply Specs to All button ──────────────────────────────────────────────
function ApplySpecsButton({ onDone }: { onDone: () => void }) {
  const [force, setForce] = React.useState(false);
  const applyMutation = trpc.cabinets.adminApplySpecsToAll.useMutation({
    onSuccess: (data) => {
      toast.success(`Spec drawings applied to ${data.updated} cabinet${data.updated !== 1 ? 's' : ''}.`);
      onDone();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Apply Spec Drawings to All Cabinets</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Assigns the generic line drawing and spec notes from the Capital spec book to every cabinet that matches its family pattern.
          By default, only cabinets without a drawing are updated.
        </p>
        <div className="flex items-center gap-2 mt-2">
          <Switch id="force-overwrite" checked={force} onCheckedChange={setForce} disabled={applyMutation.isPending} />
          <Label htmlFor="force-overwrite" className="text-xs cursor-pointer">Overwrite existing drawings</Label>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />}
            Apply to All
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Spec Drawings to All Cabinets?</AlertDialogTitle>
            <AlertDialogDescription>
              This will update spec drawings and notes for all cabinets matching their family pattern
              {force ? ', overwriting any existing values' : ' (skipping cabinets that already have a drawing)'}.
              This cannot be undone automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => applyMutation.mutate({ force })}>Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function CabinetConfigAdmin() {
  const initialCabinetId = useMemo(() => {
    const value = Number(new URLSearchParams(window.location.search).get("cabinetId"));
    return Number.isInteger(value) && value > 0 ? value : undefined;
  }, []);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [distributorFilter, setDistributorFilter] = useState<number | undefined>(undefined);
  const [unconfiguredOnly, setUnconfiguredOnly] = useState(false);
  const [hideRetired, setHideRetired] = useState(false);
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [statusSort, setStatusSort] = useState<"default" | "active-first" | "inactive-first">("default");
  const [page, setPage] = useState(0);
  const [editRow, setEditRow] = useState<CabinetRow | null>(null);
  const [targetCabinetId, setTargetCabinetId] = useState<number | undefined>(initialCabinetId);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeDirection, setMergeDirection] = useState<"keep-first" | "keep-second">("keep-first");

  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.cabinets.adminListCabinetConfig.useQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    category: category || undefined,
    distributorId: distributorFilter,
    hideRetired,
    unconfiguredOnly,
    verifiedFilter,
    statusSort,
    cabinetId: targetCabinetId,
  });
  const { data: distributorOptions } = trpc.distributors.list.useQuery();

  const { data: dbCatsList } = trpc.cabinetCategories.list.useQuery();
  const categories = dbCatsList && dbCatsList.length > 0
    ? dbCatsList.map((c) => c.name)
    : ["Base","Wall","Tall","Corner","Drawer","Specialty","Vanity","Pantry","Island","Filler","Molding","Accessory"];

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  useEffect(() => {
    if (!targetCabinetId || rows.length !== 1) return;
    setEditRow(rows[0] as CabinetRow);
    setTargetCabinetId(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete("cabinetId");
    window.history.replaceState({}, "", url.toString());
  }, [rows, targetCabinetId]);

  const configuredCount = rows.filter(
    (r) =>
      r.depth != null ||
      r.numberOfDoors != null ||
      r.numberOfDrawers != null ||
      r.numberOfFixedShelves != null ||
      r.numberOfAdjShelves != null
  ).length;

  const handleSaved = useCallback(
    (updated: Partial<CabinetRow>) => {
      setEditRow((prev) => prev ? { ...prev, ...updated } : null);
      utils.cabinets.adminListCabinetConfig.invalidate();
    },
    [utils]
  );

  const mergeMutation = trpc.cabinets.mergeCabinets.useMutation({
    onSuccess: (result: any) => {
      setSelected(new Set());
      setMergeDialogOpen(false);
      utils.cabinets.adminListCabinetConfig.invalidate();
      toast.success(`${result.aliasCode} is now an alias of ${result.masterCode}`);
      // Auto-open edit screen for the master cabinet
      const masterCabinet = selectedRows.find(r => 
        (mergeDirection === "keep-first" && r.id === selectedRows[0].id) ||
        (mergeDirection === "keep-second" && r.id === selectedRows[1].id)
      );
      if (masterCabinet) {
        setTimeout(() => setEditRow(masterCabinet as CabinetRow), 300);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to merge cabinets");
    },
  });

  const selectedArray = Array.from(selected);
  const canMerge = selectedArray.length === 2;
  const selectedRows = canMerge ? rows.filter(r => selectedArray.includes(r.id)) : [];

  const handleMerge = () => {
    if (selectedRows.length !== 2) return;
    const [first, second] = selectedRows;
    const masterCabinetId = mergeDirection === "keep-first" ? first.id : second.id;
    const aliasCabinetId = mergeDirection === "keep-first" ? second.id : first.id;
    mergeMutation.mutate({ masterCabinetId, aliasCabinetId });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Settings2 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Cabinet Configuration</h2>
        <Badge variant="secondary" className="ml-1">{total} cabinets</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Set the standard depth, door count, drawer count, shelf counts, and catalog image for each generic cabinet.
        These values appear in the public Specifications card and drive catalog illustrations.
        <strong className="text-foreground"> Tap any row to edit.</strong>
      </p>

      {/* Apply Specs to All */}
      <ApplySpecsButton onDone={() => utils.cabinets.adminListCabinetConfig.invalidate()} />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search master code, alias, SKU, or description…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { setSearch(searchInput); setPage(0); }
            }}
          />
        </div>
        <Select value={category || "__all__"} onValueChange={(v) => { setCategory(v === "__all__" ? "" : v); setPage(0); }}>
          <SelectTrigger className="h-8 text-sm w-44"><SelectValue placeholder="All categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={distributorFilter ? String(distributorFilter) : "__all__"} onValueChange={(v) => { setDistributorFilter(v === "__all__" ? undefined : Number(v)); setPage(0); }}>
          <SelectTrigger className="h-8 text-sm w-48" data-testid="cabinet-config-distributor-filter"><SelectValue placeholder="All distributors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All distributors</SelectItem>
            {(distributorOptions ?? []).map((d: { id: number; name: string }) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Switch
            id="unconfigured-only"
            checked={unconfiguredOnly}
            onCheckedChange={(v) => { setUnconfiguredOnly(v); setPage(0); }}
          />
          <Label htmlFor="unconfigured-only" className="text-sm cursor-pointer">Unconfigured only</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch id="hide-retired" checked={hideRetired} onCheckedChange={(v) => { setHideRetired(v); setPage(0); }} />
          <Label htmlFor="hide-retired" className="text-sm cursor-pointer">Hide retired duplicates</Label>
        </div>
        <Select value={verifiedFilter} onValueChange={(v) => { setVerifiedFilter(v as "all" | "verified" | "unverified"); setPage(0); }}>
          <SelectTrigger className="h-8 text-sm w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All (verified)</SelectItem>
            <SelectItem value="verified">✅ Verified only</SelectItem>
            <SelectItem value="unverified">❌ Unverified only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusSort} onValueChange={(v) => { setStatusSort(v as "default" | "active-first" | "inactive-first"); setPage(0); }}>
          <SelectTrigger className="h-8 text-sm w-40" data-testid="cabinet-config-status-sort" aria-label="Sort cabinets by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Status: Default</SelectItem>
            <SelectItem value="active-first">Status: Active first</SelectItem>
            <SelectItem value="inactive-first">Status: Inactive first</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8" onClick={() => { setSearch(searchInput); setPage(0); }}>
          Search
        </Button>
      </div>
      <p className="-mt-1 text-[11px] text-muted-foreground" data-testid="cabinet-config-count">{isLoading ? "Loading cabinets…" : `${total.toLocaleString()} cabinets match${distributorFilter ? " this distributor" : ""}${category ? ` in ${category}` : ""}${search ? ` for “${search}”` : ""}.`} Search supports master codes, saved aliases, alternative and vendor SKUs, and any partial words from the cabinet description.</p>

      {/* Merge button */}
      {canMerge && (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setMergeDialogOpen(true)}
            disabled={mergeMutation.isPending}
            className="gap-1.5"
          >
            {mergeMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            Merge {selectedArray.length} Items
          </Button>
        </div>
      )}

      {/* Configuration history (last 5 days, per-field, revertable) */}
      <CabinetAvailabilityPanel />
      <CabinetConfigHistoryPanel />

      {/* Progress summary */}
      {!unconfiguredOnly && rows.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <span>{configuredCount} of {rows.length} shown have at least one field configured</span>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">No cabinets found.</div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-8">
                  <Checkbox
                    checked={selected.size === rows.length && rows.length > 0}
                    onCheckedChange={(checked) => {
                      if (checked) setSelected(new Set(rows.map(r => r.id)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-24">Preview</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-28">Code</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Description</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-20 hidden sm:table-cell">W×H</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-32 hidden md:table-cell">Config</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-24">Status</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs w-24">Last Saved</th>
                <th className="text-center px-3 py-2 font-medium text-muted-foreground text-xs w-12">
                  <Pencil className="h-3.5 w-3.5 mx-auto" />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isConfigured =
                  row.depth != null ||
                  row.numberOfDoors != null ||
                  row.numberOfDrawers != null ||
                  row.numberOfFixedShelves != null ||
                  row.numberOfAdjShelves != null;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b border-border last:border-0 transition-colors group",
                      i % 2 === 0 ? "bg-background" : "bg-muted/20",
                      selected.has(row.id) ? "bg-primary/10" : "hover:bg-primary/5 active:bg-primary/10"
                    )}
                  >
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(row.id)}
                        onCheckedChange={(checked) => {
                          const newSelected = new Set(selected);
                          if (checked) newSelected.add(row.id);
                          else newSelected.delete(row.id);
                          setSelected(newSelected);
                        }}
                      />
                    </td>
                    <td className="px-3 py-2.5 cursor-pointer" onClick={() => setEditRow(row as CabinetRow)}>
                      <div className="flex items-center gap-1">
                        {/* Catalog image thumbnail */}
                        <div className="w-10 h-10 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                          {row.catalogImageUrl ? (
                            <img src={row.catalogImageUrl} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
                          )}
                        </div>
                        {/* Designer rendering thumbnail */}
                        <div className="w-10 h-10 rounded border border-border bg-white flex items-center justify-center overflow-hidden shrink-0">
                          <DoorDrawerDiagram
                            cabinet={{
                              masterCode: row.masterCode,
                              description: row.description,
                              category: row.category,
                              subCategory: row.subCategory,
                              width: row.width ? parseFloat(row.width) : null,
                              height: row.height ? parseFloat(row.height) : null,
                              depth: row.depth ? parseFloat(row.depth) : null,
                              numberOfDoors: row.numberOfDoors,
                              numberOfDrawers: row.numberOfDrawers,
                              openingType: row.openingType,
                              doorHeight: row.doorHeight ? parseFloat(row.doorHeight) : null,
                              drawerHeight: row.drawerHeight ? parseFloat(row.drawerHeight) : null,
                            }}
                            width={38}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono text-xs font-semibold text-primary">{row.masterCode}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs text-foreground line-clamp-1">{row.description}</span>
                      {row.category && (
                        <span className="text-[10px] text-muted-foreground block">{row.category}{row.subCategory ? ` › ${row.subCategory}` : ""}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">
                      {row.width ? `${parseFloat(row.width)}"` : "—"}×{row.height ? `${parseFloat(row.height)}"` : "—"}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {isConfigured ? (
                        <div className="flex flex-wrap gap-1">
                          {row.depth && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.depth}"D</Badge>}
                          {row.numberOfDoors != null && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.numberOfDoors}dr</Badge>}
                          {row.numberOfDrawers != null && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{row.numberOfDrawers}dw</Badge>}
                          {(row.numberOfFixedShelves != null || row.numberOfAdjShelves != null) && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {row.numberOfFixedShelves ?? "?"}f/{row.numberOfAdjShelves ?? "?"}a sh
                            </Badge>
                          )}
                          {row.catalogImageUrl && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-green-600 border-green-300">img</Badge>}
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">not configured</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.isActive === false ? (
                        <Badge variant="outline" className="border-red-300 bg-red-50 text-[10px] text-red-700">Inactive</Badge>
                      ) : row.isActive === true ? (
                        <Badge variant="outline" className="border-green-300 bg-green-50 text-[10px] text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Unknown</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {row.configVerified ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        ) : row.configuredAt ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-medium">
                            ✅ Saved
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors mx-auto" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Page {page + 1} of {totalPages} ({total} total)</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editRow && (
        <EditModal
          row={editRow}
          open={!!editRow}
          onClose={() => setEditRow(null)}
          onSaved={handleSaved}
        />
      )}

      {/* Merge Dialog - Simplified for mobile */}
      <Dialog open={mergeDialogOpen} onOpenChange={setMergeDialogOpen}>
        <DialogContent className="max-w-sm p-4">
          <DialogHeader>
            <DialogTitle className="text-lg">Which is Master?</DialogTitle>
          </DialogHeader>
          {selectedRows.length === 2 && (
            <div className="space-y-2">
              <button
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all",
                  mergeDirection === "keep-first"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                )}
                onClick={() => setMergeDirection("keep-first")}
              >
                <div className="font-mono font-bold text-base">{selectedRows[0].masterCode}</div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">{selectedRows[0].description}</div>
              </button>
              <button
                className={cn(
                  "w-full p-4 rounded-lg border-2 text-left transition-all",
                  mergeDirection === "keep-second"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300"
                )}
                onClick={() => setMergeDirection("keep-second")}
              >
                <div className="font-mono font-bold text-base">{selectedRows[1].masterCode}</div>
                <div className="text-sm text-gray-600 mt-1 line-clamp-2">{selectedRows[1].description}</div>
              </button>
            </div>
          )}
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button variant="outline" onClick={() => setMergeDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleMerge} disabled={mergeMutation.isPending} className="w-full sm:w-auto">
              {mergeMutation.isPending ? <Spinner className="h-4 w-4 mr-2" /> : null}
              Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CabinetConfigAdmin;
