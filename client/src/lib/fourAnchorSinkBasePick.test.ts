import { describe, expect, it } from "vitest";
import catalogFixture from "./__fixtures__/fourAnchorRealCatalog.json";
import { pickFourAnchorSinkBase } from "./fourAnchorAutoBuild";
import type { DesignCabinet } from "./design";

type Fixture = Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;
const REAL = catalogFixture as unknown as Fixture;
const baseRows = (style: string) => REAL[style]!.base as DesignCabinet[];
const STYLES = [{ id: "330011", name: "framed" }, { id: "540005", name: "frameless" }] as const;

describe.each(STYLES)("Four-anchor sink base default ($name line)", ({ id }) => {
  it("defaults to the regular sink base, never the farmhouse apron-front base", () => {
    const pool = baseRows(id);
    const picked = pickFourAnchorSinkBase(pool, 36, "regular");
    expect(picked?.masterCode).toBe("SB36");
    expect(picked?.description).not.toMatch(/farm/i);
  });
  it("does not depend on the order the catalog happens to list the rows", () => {
    const reversed = [...baseRows(id)].reverse();
    expect(pickFourAnchorSinkBase(reversed, 36, "regular")?.masterCode).toBe("SB36");
    expect(pickFourAnchorSinkBase(reversed, 33, "regular")?.masterCode).toBe("SB33");
  });
  it("still builds the farmhouse base when the admin explicitly asks for it", () => {
    expect(pickFourAnchorSinkBase(baseRows(id), 36, "farmhouse")?.masterCode).toBe("FSB36");
  });
  it("never picks a vanity or corner sink base for the kitchen sink", () => {
    for (const width of [24, 27, 30, 33, 36, 42] as const) {
      const picked = pickFourAnchorSinkBase(baseRows(id), width, "regular");
      if (picked) expect(`${picked.masterCode} ${picked.description} ${picked.subCategory}`).not.toMatch(/vanity|corner|^V/i);
    }
  });
});

describe("Four-anchor sink base default: plain SB wins over the full-height variant", () => {
  it("picks SB30 over SB30FH and FSB30 on the frameless line", () => {
    expect(pickFourAnchorSinkBase(baseRows("540005"), 30, "regular")?.masterCode).toBe("SB30");
  });
  it("falls back to the full-height sink base only when no plain SB of that width exists", () => {
    const withoutPlain = baseRows("540005").filter((row) => row.masterCode !== "SB30");
    expect(pickFourAnchorSinkBase(withoutPlain, 30, "regular")?.masterCode).toBe("SB30FH");
  });
  it("returns null rather than substituting a farmhouse base for a regular request", () => {
    const farmOnly = baseRows("540005").filter((row) => !/^SB30/.test(row.masterCode));
    expect(farmOnly.some((row) => row.masterCode === "FSB30")).toBe(true);
    expect(pickFourAnchorSinkBase(farmOnly, 30, "regular")).toBeNull();
  });
});
