import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { designerDraftActiveKey, designerDraftStorageKey } from "./affiliateContext";
import {
  MY_DESIGNS_STORAGE_KEY,
  deleteSavedDesign,
  demoDesignerScope,
  lineForDraft,
  listSavedDesigns,
  loadSavedDesignIntoDesigner,
  openSavedDesignHref,
  readCurrentDesignerDraft,
  renameSavedDesign,
  saveCurrentDesign,
} from "./demoSavedDesigns";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
}

const draft = (styleA: number, placed = 3) => JSON.stringify({ v: 2, originScope: demoDesignerScope(), styleA, styleId: styleA, placed: Array.from({ length: placed }, (_, i) => ({ id: i })), savedAt: 1 });

describe("demo My designs (reuses the designer's local draft)", () => {
  it("saves the designer's current draft with name, date, line and cabinet count", () => {
    const s = memoryStorage();
    const scope = demoDesignerScope();
    expect(saveCurrentDesign(s, "Nothing")).toBeNull();
    s.setItem(designerDraftStorageKey(scope, null), draft(390001));
    s.setItem(designerDraftActiveKey(scope), designerDraftStorageKey(scope, null));
    const saved = saveCurrentDesign(s, "Smith kitchen", 1000)!;
    expect(saved).toMatchObject({ name: "Smith kitchen", savedAt: 1000, lineId: "white-shaker", cabinetCount: 3 });
    expect(listSavedDesigns(s)).toHaveLength(1);
    expect(JSON.parse(s.getItem(MY_DESIGNS_STORAGE_KEY)!)[0].draft).toBe(draft(390001));
  });

  it("follows the active draft key (e.g. a verified email's draft)", () => {
    const s = memoryStorage();
    const scope = demoDesignerScope();
    const emailKey = designerDraftStorageKey(scope, "pat@example.com");
    s.setItem(emailKey, draft(360001));
    s.setItem(designerDraftActiveKey(scope), emailKey);
    expect(lineForDraft(readCurrentDesignerDraft(s)!)).toBe("gray-shaker");
    expect(lineForDraft(draft(390011))).toBe("raised-panel");
    expect(lineForDraft(draft(123))).toBeNull();
  });

  it("renames and deletes", () => {
    const s = memoryStorage();
    const scope = demoDesignerScope();
    s.setItem(designerDraftStorageKey(scope, null), draft(390001));
    const a = saveCurrentDesign(s, "A", 1)!;
    const b = saveCurrentDesign(s, "B", 2)!;
    expect(listSavedDesigns(s).map((d) => d.name)).toEqual(["B", "A"]);
    renameSavedDesign(s, a.id, "Lake house");
    expect(listSavedDesigns(s).find((d) => d.id === a.id)!.name).toBe("Lake house");
    deleteSavedDesign(s, b.id);
    expect(listSavedDesigns(s).map((d) => d.id)).toEqual([a.id]);
  });

  it("reopening writes the saved draft into every draft key the designer restores from and clears crash markers", () => {
    const s = memoryStorage();
    const scope = demoDesignerScope();
    const guestKey = designerDraftStorageKey(scope, null);
    const emailKey = designerDraftStorageKey(scope, "pat@example.com");
    s.setItem(guestKey, draft(390011, 5));
    const saved = saveCurrentDesign(s, "Raised", 1)!;
    s.setItem(guestKey, draft(390001, 1));
    s.setItem(emailKey, draft(360001, 2));
    s.setItem(`${emailKey}::crashed`, draft(360001, 2));
    s.setItem(designerDraftStorageKey("other-store", null), "untouched");
    expect(loadSavedDesignIntoDesigner(s, saved.id, 99)).toBe(true);
    for (const key of [guestKey, emailKey]) expect(JSON.parse(s.getItem(key)!)).toMatchObject({ styleA: 390011, savedAt: 99 });
    expect(s.getItem(`${emailKey}::crashed`)).toBeNull();
    expect(s.getItem(designerDraftActiveKey(scope))).toBe(guestKey);
    expect(s.getItem(designerDraftStorageKey("other-store", null))).toBe("untouched");
    expect(loadSavedDesignIntoDesigner(s, "missing")).toBe(false);
    expect(openSavedDesignHref(saved)).toBe("/distributor-preview/design?line=raised-panel");
  });

  it("needs no DesignTool change: DesignTool does not know about saved designs", () => {
    const src = readFileSync(new URL("../pages/DesignTool.tsx", import.meta.url), "utf8");
    expect(src).not.toContain("demoSavedDesigns");
    // Props are still only the approved catalogFilter and hidePrices (plus the existing affiliateSlug).
    expect(src).toContain("export default function DesignTool({ hidePrices = false, ...props }: { affiliateSlug?: string; catalogFilter?: DesignCatalogFilter; hidePrices?: boolean })");
  });
});
