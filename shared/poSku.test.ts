import { describe, expect, it } from "vitest";
import { buildPoSku, normalizePoSku } from "./poSku";

describe("PO SKU", () => {
  it("leaves a normal distributor SKU alone", () => {
    expect(buildPoSku("USD", "SW", "3DB18")).toBe("usd-sw-3db18");
    expect(buildPoSku("dl", "ws", "b24")).toBe("dl-ws-b24");
  });

  it("collapses the repeated token in the Clark and Son order", () => {
    // The admin order page was rendering "cs-cs-cs-db18": distributor code CS,
    // style code CS, item code CS-DB18.
    expect(buildPoSku("CS", "CS", "CS-DB18")).toBe("cs-db18");
    expect(normalizePoSku("cs-cs-cs-db18")).toBe("cs-db18");
  });

  it("keeps the style code when only the distributor and item codes collide", () => {
    expect(buildPoSku("CS", "WS", "CS-DB18")).toBe("cs-ws-db18");
  });

  it("handles an item code that repeats only part of the prefix", () => {
    expect(buildPoSku("CS", "CS", "DB18")).toBe("cs-db18");
  });

  it("tolerates spaces, underscores and mixed case", () => {
    expect(buildPoSku("CS", "cs", "cs_db18")).toBe("cs-db18");
    expect(buildPoSku(" USD ", " SW ", " 3DB18 ")).toBe("usd-sw-3db18");
  });

  it("returns what it can when a part is missing", () => {
    expect(buildPoSku(null, "SW", "DB18")).toBe("sw-db18");
    expect(buildPoSku("CS", null, "DB18")).toBe("cs-db18");
    expect(buildPoSku("CS", "SW", null)).toBe("cs-sw");
    expect(buildPoSku(null, null, null)).toBe("");
  });

  it("repairs an already-stored duplicated SKU for display", () => {
    expect(normalizePoSku("cs-cs-db18")).toBe("cs-db18");
    expect(normalizePoSku("usd-sw-3db18")).toBe("usd-sw-3db18");
    expect(normalizePoSku(null)).toBe("");
  });
});
