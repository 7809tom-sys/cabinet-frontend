// ─── Demo distributor: "My designs" (no login, this browser only) ────────────
// Reuses the designer's own local autosave, with no DesignTool change: the
// designer keeps the open plan as a JSON draft in localStorage
// (designerDraftStorageKey / designerDraftActiveKey) and restores it on load.
// "Save design" copies that draft into a named list here; "Open" writes the
// saved copy back into the draft keys, then opens /distributor-preview/design,
// where the designer restores it as usual.

import { designerDraftActiveKey, designerDraftStorageKey, resolveStoreScope } from "./affiliateContext";
import { DEMO_LINE_DOOR_STYLES } from "./demoDesignerCatalog";

export const MY_DESIGNS_STORAGE_KEY = "demo-distributor-my-designs";
export const MY_DESIGNS_ROUTE = "/distributor-preview/designs";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
type LineId = keyof typeof DEMO_LINE_DOOR_STYLES;

export type DemoSavedDesign = {
  id: string;
  name: string;
  savedAt: number;
  lineId: LineId | null;
  cabinetCount: number;
  /** The designer's own draft JSON. */
  draft: string;
};

/** The store scope the demo designer route runs under. */
export function demoDesignerScope(): string {
  return resolveStoreScope({ pathname: "/distributor-preview/design", search: "", hostname: "" });
}

function draftKeyPrefix(scope: string): string {
  return designerDraftStorageKey(scope, "x").replace(/x$/, "");
}

export function listSavedDesigns(storage: Storage): DemoSavedDesign[] {
  try {
    const parsed = JSON.parse(storage.getItem(MY_DESIGNS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as DemoSavedDesign[]).sort((a, b) => b.savedAt - a.savedAt) : [];
  } catch {
    return [];
  }
}

function writeList(storage: Storage, list: DemoSavedDesign[]): void {
  storage.setItem(MY_DESIGNS_STORAGE_KEY, JSON.stringify(list));
}

/** The designer's current autosaved draft for the demo scope, if any. */
export function readCurrentDesignerDraft(storage: Storage, scope = demoDesignerScope()): string | null {
  const active = storage.getItem(designerDraftActiveKey(scope));
  const keys = [active, designerDraftStorageKey(scope, null)].filter((k): k is string => Boolean(k));
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (raw) {
      try {
        const d = JSON.parse(raw);
        if (d && typeof d === "object" && !Array.isArray(d)) return raw;
      } catch {
        /* corrupt: skip */
      }
    }
  }
  return null;
}

export function lineForDraft(raw: string): LineId | null {
  try {
    const d = JSON.parse(raw) as { styleA?: number | null; styleId?: number | null };
    const ids = [d.styleA, d.styleId];
    for (const [lineId, style] of Object.entries(DEMO_LINE_DOOR_STYLES)) if (ids.includes(style.doorStyleId)) return lineId as LineId;
  } catch {
    /* ignore */
  }
  return null;
}

function cabinetCount(raw: string): number {
  try {
    const d = JSON.parse(raw) as { placed?: unknown[] };
    return Array.isArray(d.placed) ? d.placed.length : 0;
  } catch {
    return 0;
  }
}

export function saveCurrentDesign(storage: Storage, name: string, now = Date.now()): DemoSavedDesign | null {
  const draft = readCurrentDesignerDraft(storage);
  if (!draft) return null;
  const design: DemoSavedDesign = {
    id: `d${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || "My design",
    savedAt: now,
    lineId: lineForDraft(draft),
    cabinetCount: cabinetCount(draft),
    draft,
  };
  writeList(storage, [design, ...listSavedDesigns(storage)]);
  return design;
}

export function renameSavedDesign(storage: Storage, id: string, name: string): void {
  writeList(storage, listSavedDesigns(storage).map((d) => (d.id === id ? { ...d, name: name.trim() || d.name } : d)));
}

export function deleteSavedDesign(storage: Storage, id: string): void {
  writeList(storage, listSavedDesigns(storage).filter((d) => d.id !== id));
}

/**
 * Put a saved design back where the designer restores from: every existing
 * draft key for the demo scope (whichever identity restores first) plus the
 * guest key, newest timestamp, no crash marker. Returns false if not found.
 */
export function loadSavedDesignIntoDesigner(storage: Storage, id: string, now = Date.now()): boolean {
  const design = listSavedDesigns(storage).find((d) => d.id === id);
  if (!design) return false;
  const scope = demoDesignerScope();
  const prefix = draftKeyPrefix(scope);
  let draft = design.draft;
  try {
    draft = JSON.stringify({ ...JSON.parse(design.draft), savedAt: now });
  } catch {
    /* keep as saved */
  }
  const keys = new Set<string>([designerDraftStorageKey(scope, null)]);
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key && key.startsWith(prefix) && !key.endsWith("::crashed")) keys.add(key);
  }
  keys.forEach((key) => {
    storage.setItem(key, draft);
    storage.removeItem(`${key}::crashed`);
  });
  storage.setItem(designerDraftActiveKey(scope), designerDraftStorageKey(scope, null));
  return true;
}

export function openSavedDesignHref(design: Pick<DemoSavedDesign, "lineId">): string {
  return design.lineId ? `/distributor-preview/design?line=${design.lineId}` : "/distributor-preview/design";
}
