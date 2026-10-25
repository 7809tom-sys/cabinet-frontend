import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(__dirname, "MediaPicker.tsx"), "utf8");

describe("MediaPicker viewport-safe dialog", () => {
  it("uses a bounded internal-scroll layout that remains usable on phones", () => {
    expect(source).toContain("h-[min(88dvh,44rem)]");
    expect(source).toContain("max-h-[calc(100dvh-1rem)]");
    expect(source).toContain("overflow-hidden");
    expect(source).toContain("flex-1 overflow-y-auto min-h-0");
  });

  it("keeps search, upload, image selection, and cancellation reachable on compact screens", () => {
    expect(source).toContain("flex-col gap-2 sm:flex-row");
    expect(source).toContain("grid-cols-2");
    expect(source).toContain("onClick={() => handleSelect(item.url)}");
    expect(source).toContain('onClick={() => setOpen(false)}');
  });
});
