import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const guideSource = readFileSync(resolve(process.cwd(), "client/src/pages/KitchenPlanningGuide.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const navSource = readFileSync(resolve(process.cwd(), "client/src/components/TopNav.tsx"), "utf8");

const requiredQuestions = [
  "Where do I start?",
  "What do I need to measure?",
  "How long does it take to design my kitchen?",
  "What is the kitchen work triangle?",
  "How much space do I need between counters or around an island?",
  "How do I handle the corners?",
  "When will I know the price?",
  "Should I do this myself or work with a designer?",
] as const;

describe("KitchenPlanningGuide", () => {
  it("keeps the public guide focused on the supplied planning questions", () => {
    expect(guideSource).toContain("Planning your kitchen: the questions everyone asks.");
    for (const question of requiredQuestions) expect(guideSource).toContain(question);
    expect(guideSource).toContain("First layouts commonly take about 10–15 minutes.");
    expect(guideSource).toContain("The numbers are common planning guidelines—not building code or a final field measurement.");
  });

  it("offers the Designer and Kitchen Packages as concrete next steps", () => {
    expect(guideSource).toContain('href="/design"');
    expect(guideSource).toContain('href="/bundles"');
    expect(guideSource).toContain("buildKitchenDiscoveryJsonLd");
    expect(guideSource).toContain('path: "/kitchen-planning"');
  });

  it("registers and exposes the guide in public navigation", () => {
    expect(appSource).toContain('const KitchenPlanningGuide = lazy(() => import("@/pages/KitchenPlanningGuide"));');
    expect(appSource).toContain('<Route path="/kitchen-planning">');
    expect(navSource).toContain('{ key: "nav_kitchen_planning", href: "/kitchen-planning" }');
  });
});
