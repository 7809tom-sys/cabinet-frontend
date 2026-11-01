import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("storefront first-load split", () => {
  it("keeps the designer geometry engine off the home page import graph", () => {
    const home = read("client/src/pages/Home.tsx");
    const photos = read("client/src/lib/doorFamilyPhotos.ts");
    const swatch = read("client/src/components/DoorStyleSwatch.tsx");
    expect(home).not.toContain('from "@/lib/design"');
    expect(photos).toContain('from "@/lib/doorPanelKind"');
    expect(photos).not.toContain('from "@/lib/design"');
    expect(swatch).toContain('from "@/lib/doorPanelKind"');
    expect(swatch).not.toContain('from "@/lib/design"');
    expect(read("client/src/lib/design.ts")).toContain('export { doorPanelKind, type DoorPanelKind } from "./doorPanelKind"');
  });

  it("loads markdown highlighting only when a chat reply renders", () => {
    const chat = read("client/src/components/AIChatBox.tsx");
    expect(chat).toContain('lazy(() => import("streamdown")');
    expect(chat).not.toContain('import { Streamdown } from "streamdown"');
    expect(chat).toContain("<Suspense");
  });

  it("splits heavy vendor libraries out of the entry chunk", () => {
    const vite = read("vite.config.ts");
    expect(vite).toContain("manualChunks");
    expect(vite).toContain("vendor-three");
    expect(vite).toContain("vendor-map");
    expect(vite).not.toContain("vendor-charts");
  });
});
