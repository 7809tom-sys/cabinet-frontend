import { describe, expect, it } from "vitest";
import catalog from "@shared/fixtures/doorStyleSideCatalog.json";
import { resolveDoorColor, type DoorColorInput } from "@shared/doorColorResolve";
import { matchesColor } from "./ColorSlotButton";

const styles = catalog as Array<DoorColorInput & { ourName?: string | null }>;

describe("designer color groups", () => {
  it("switching from grey to white changes the doors in the group and the painted color", () => {
    const named = styles.filter((style) => style.ourName);
    const grey = named.filter((style) => matchesColor(style.ourName ?? "", "grey"));
    const white = named.filter((style) => matchesColor(style.ourName ?? "", "white"));
    expect(grey.some((style) => style.id === 360001)).toBe(true);
    expect(grey.some((style) => style.id === 600001)).toBe(false);
    expect(white.some((style) => style.id === 600001)).toBe(true);
    expect(white.some((style) => style.id === 360001)).toBe(false);
    const greyPaint = resolveDoorColor(grey.find((style) => style.id === 360001)!).appliedHex;
    const whitePaint = resolveDoorColor(white.find((style) => style.id === 600001)!).appliedHex;
    expect(greyPaint).toBe("#8d8f92");
    expect(whitePaint).not.toBe(greyPaint);
    expect(whitePaint).not.toBe("#244338");
  });
});
