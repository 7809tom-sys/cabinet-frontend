import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ROOM } from "@/lib/design";
import { designerDraftActiveKey, designerDraftStorageKey } from "@/lib/affiliateContext";
import {
  DEFAULT_FRESH_LAYOUT_PRESET_ID,
  defaultFreshKitchenFootprint,
  designerWorkspaceHref,
  freshDesignDraftStorageKey,
  readFreshDesignRequest,
  skipsDesignerLeadGate,
} from "./designerFreshStart";

describe("designer workspace href", () => {
  it("opens a new floor-plan design for a door style and its distributor line", () => {
    const href = designerWorkspaceHref({ doorStyleId: 42, distributorId: 7 });
    const url = new URL(href, "https://cabinetdealz.example");
    expect(url.pathname).toBe("/design");
    expect(url.searchParams.get("new")).toBe("1");
    expect(url.searchParams.get("view")).toBe("plan");
    expect(url.searchParams.get("doorStyleId")).toBe("42");
    expect(url.searchParams.get("distributorId")).toBe("7");
  });

  it("omits a style when the header link has only a supplier line", () => {
    const href = designerWorkspaceHref({ distributorId: 9 });
    const params = new URL(href, "https://cabinetdealz.example").searchParams;
    expect(params.get("new")).toBe("1");
    expect(params.get("view")).toBe("plan");
    expect(params.get("doorStyleId")).toBeNull();
    expect(params.get("distributorId")).toBe("9");
  });

  it("stays on the app-relative /design path", () => {
    expect(designerWorkspaceHref({ doorStyleId: 1 })).toMatch(/^\/design\?/);
    expect(designerWorkspaceHref({ doorStyleId: 1 })).not.toContain("/store/");
  });
});

describe("fresh design query params", () => {
  it("reads new=1 with doorStyleId and distributorId", () => {
    expect(readFreshDesignRequest("?new=1&doorStyleId=15&distributorId=3&view=plan")).toEqual({
      fresh: true,
      doorStyleId: 15,
      distributorId: 3,
    });
  });

  it("accepts the existing style param and distributor alias on a fresh start", () => {
    expect(readFreshDesignRequest("new=1&style=8&distributor=4")).toEqual({
      fresh: true,
      doorStyleId: 8,
      distributorId: 4,
    });
  });

  it("prefers doorStyleId over style", () => {
    expect(readFreshDesignRequest("?new=1&doorStyleId=2&style=9").doorStyleId).toBe(2);
  });

  it("leaves a plain style preselect on the existing path", () => {
    expect(readFreshDesignRequest("?style=8")).toEqual({
      fresh: false,
      doorStyleId: null,
      distributorId: null,
    });
  });

  it("ignores non-positive ids", () => {
    expect(readFreshDesignRequest("?new=1&doorStyleId=0&distributorId=-3")).toEqual({
      fresh: true,
      doorStyleId: null,
      distributorId: null,
    });
  });
});

describe("fresh design session", () => {
  it("stores the new design apart from the canonical draft and the active-draft pointer", () => {
    const canonical = designerDraftStorageKey("owner", "admin@cabinetdealz.example");
    const active = designerDraftActiveKey("owner");
    const fresh = freshDesignDraftStorageKey("owner", "admin@cabinetdealz.example", 42, 7);
    expect(fresh).not.toBe(canonical);
    expect(fresh).not.toBe(active);
    expect(fresh.startsWith(`${canonical}:fresh:`)).toBe(true);
    expect(freshDesignDraftStorageKey("owner", "admin@cabinetdealz.example", 42, 7))
      .not.toBe(freshDesignDraftStorageKey("owner", "admin@cabinetdealz.example", 43, 7));
  });

  it("uses the standard kitchen rectangle and the designer's default layout preset", () => {
    expect(defaultFreshKitchenFootprint()).toEqual({
      width: DEFAULT_ROOM.width,
      depth: DEFAULT_ROOM.depth,
      ceilingHeight: DEFAULT_ROOM.ceilingHeight,
    });
    expect(DEFAULT_FRESH_LAYOUT_PRESET_ID).toBe("kitchen_l_standard");
  });
});

describe("staff lead gate", () => {
  it("lets signed-in staff, admins, and vendors skip lead capture", () => {
    for (const role of ["admin", "designer", "sales_rep", "distributor"]) {
      expect(skipsDesignerLeadGate(role)).toBe(true);
    }
  });

  it("still captures a lead for shoppers and signed-out visitors", () => {
    expect(skipsDesignerLeadGate("user")).toBe(false);
    expect(skipsDesignerLeadGate("contractor")).toBe(false);
    expect(skipsDesignerLeadGate("partner")).toBe(false);
    expect(skipsDesignerLeadGate(null)).toBe(false);
    expect(skipsDesignerLeadGate(undefined)).toBe(false);
  });
});

describe("Designer wires the fresh start without replacing the saved draft", () => {
  const source = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

  it("keeps a fresh session on its own draft key and opens the floor plan", () => {
    expect(source).toContain("freshDesignDraftStorageKey");
    expect(source).toContain("latchedFreshStart");
    expect(source).toContain("freshSessionRestoredRef");
    expect(source).toContain("if (!preserveCanonicalDraftRef.current)");
    expect(source).toContain("defaultFreshKitchenFootprint()");
    expect(source).toContain("DEFAULT_FRESH_LAYOUT_PRESET_ID");
    expect(source).toContain('setViewMode("plan")');
    expect(source).toContain("setCatalogSetupOpen(false)");
    expect(source).toContain("setLayoutStarterOpen(false)");
    expect(source).toContain("setActiveSavedDesignId(null)");
    expect(source).toContain("!latchedFreshStart.fresh");
    expect(source).toContain("sessionSellableStyleIds");
    expect(source).toContain("freshOpenedStyleUsable");
    expect(source).toContain("Door style #${freshOpenedStyleId} could not be opened.");
  });

  it("does not record a lead when a signed-in staff, admin, or vendor opens the Designer", () => {
    expect(source).toContain("if (skipsDesignerLeadGate(signedInRole)) return;");
  });
});
