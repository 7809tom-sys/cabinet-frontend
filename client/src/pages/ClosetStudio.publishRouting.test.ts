import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const app = source("../App.tsx");
const designer = source("./DesignTool.tsx");
const nav = source("../components/TopNav.tsx");
const home = source("./Home.tsx");
const studio = source("./VendorClosetStudio.tsx");

describe("public Closet Studio replacement boundary", () => {
  it("provides one canonical Closet route while leaving the kitchen Designer and old studio preview alias intact", () => {
    expect(app).toContain('<Route path="/closet">');
    expect(app).toContain('<Route path="/design">');
    expect(app).toContain('<Route path="/vendor/closet-studio">');
    expect(app).toContain('<VendorClosetStudio />');
  });

  it("routes new Closet starts to Studio but retains existing MasterTrac saved layouts in the Designer", () => {
    const chooser = designer.slice(designer.indexOf("{ROOM_TYPES.map((rt) => ("), designer.indexOf('data-testid="mastertrac-palette-header"'));
    expect(chooser).toContain('rt.value === "closet" && !affiliateSlug && !placedRef.current.some((item) => isClosetPart(item.masterCode))');
    expect(chooser).toContain('window.location.assign("/closet")');
    expect(chooser).toContain('setRoomType(rt.value)');
    expect(designer).toContain('data-testid="open-closet-studio-from-legacy"');
    expect(designer).toContain('!affiliateSlug && <><a href="/closet"');
    expect(designer).toContain("Existing Closet plans remain editable here");
    expect(designer).toContain('data-testid="open-mastertrac-tower-planner"');
  });

  it("advertises the canonical route on Home, desktop More and the phone menu without changing kitchen navigation", () => {
    expect(home).toContain('<Link href="/closet">');
    expect(home).toContain("Plan a Closet");
    expect(nav).toContain('{ key: "nav_closet_studio", href: "/closet" }');
    expect(nav).toContain('{ key: "nav_design_tool", href: "/design" }');
    expect(nav).toContain('const ALL_LINKS: NavLink[] = [...PRIMARY_LINKS, ...MORE_LINKS]');
  });

  it("offers a labeled Kitchen Designer return from both Studio screens without removing the room-choice back action", () => {
    expect((studio.match(/data-testid="closet-to-kitchen"/g) ?? [])).toHaveLength(2);
    expect((studio.match(/href="\/design"/g) ?? [])).toHaveLength(2);
    expect(studio).toContain("Kitchen Designer");
    expect(studio).toContain('aria-label="Back to room choice"');
    expect(studio).toContain('if (!isReviewDemo) localStorage.setItem(STORAGE_KEY, JSON.stringify(design))');
  });

  it("keeps source-priced reference outside checkout and sample mode outside personal local drafts", () => {
    expect(studio).toContain('if (!isReviewDemo) localStorage.setItem(STORAGE_KEY, JSON.stringify(design))');
    expect(studio).toContain('Historical reference only—<strong>not checkout pricing</strong>.');
    expect(studio).toContain('href="/closet" className="shrink-0 underline underline-offset-2"');
    expect(studio).not.toContain("Invoice (dealer)");
  });
});
