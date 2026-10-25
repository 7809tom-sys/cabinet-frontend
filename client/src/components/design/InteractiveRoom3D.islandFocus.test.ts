import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/design/InteractiveRoom3D.tsx"), "utf8");

describe("InteractiveRoom3D island face focus", () => {
  it("accepts a one-shot host focus request and eases the camera toward the selected Front or Back island face", () => {
    expect(source).toContain("islandFocusRequest?: { face: \"front\" | \"back\"; key: number } | null");
    expect(source).toContain("const durationMs = 420");
    expect(source).toContain('islandFocusRequest.face === "back" ? -1 : 1');
    expect(source).toContain("prefers-reduced-motion: reduce");
  });
});
