import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("SurfacesPickerDialog tablet layout", () => {
  it("keeps bathroom fixture controls inside the tablet dialog", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/design/SurfacesPickerDialog.tsx"), "utf8");

    expect(source).toContain("h-[min(88vh,860px)]");
    expect(source).toContain("w-[calc(100%-1rem)]");
    expect(source).toContain("sm:max-w-[min(1100px,calc(100%-2rem))]");
    expect(source).toContain('isBathroom\n            ? "flex flex-wrap gap-2 pb-1"');
    expect(source).toContain('className="flex flex-col gap-2 lg:flex-row"');
    expect(source).toContain('role="button"');
    expect(source).toContain("touch-manipulation cursor-pointer");
    expect(source).toContain("onKeyDown={(event) => {");
    expect(source).toContain("data-testid={`surface-card-${p.id}`}");
  });
});
