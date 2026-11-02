import { describe, expect, it } from "vitest";
import catalog from "./fixtures/doorStyleSideCatalog.json";
import { resolveDoorColor, type DoorColorInput } from "./doorColorResolve";
import { readApprovals, writeApproval } from "./walzcraftDistributorMatches";
import { auditWalzcraftDoor, colorMatchPercent } from "./walzcraftDoorAudit";
import { brandDoorSurfaceHex, standardShakerDlFacePlan } from "./shakerDoorBlueprint";

const styles = catalog as DoorColorInput[];

describe("WalzCraft door audit", () => {
  it("matches Classic Cream to a WalzCraft profile and scores color without brand snapping", () => {
    const style = styles.find((item) => item.id === 330002)!;
    const audit = auditWalzcraftDoor({ ...style, supplierBrandName: "Faircrest" });
    expect(audit.exact).toBe(true);
    expect(audit.door?.id).toBe("faircrest-cc");
    expect(audit.profiles[0]?.name).toBe("S899 Tradewind");
    expect(audit.profiles[0]?.pct).toBe(35);
    expect(audit.color.pct).not.toBeNull();
    expect(audit.color.estimated).toBe(true);
    expect(audit.features.map((item) => item.label)).toEqual(["Frame width", "Edge / bevel", "Panel"]);
    expect(audit.features.every((item) => item.pct != null)).toBe(true);
    const painted = resolveDoorColor(style).appliedHex;
    expect(painted).not.toBe(brandDoorSurfaceHex(painted));
  });

  it("still audits a door that has no finish category or grain hex columns", () => {
    const sparse = { ourName: "White Shaker", supplierBrandName: "Faircrest", doorStyle: "Shaker", color: "White" };
    const audit = auditWalzcraftDoor(sparse);
    expect(audit.door?.code).toBe("WS");
    expect(audit.color.pct).not.toBeNull();
    expect("finishCategory" in sparse).toBe(false);
  });

  it("stores an admin approval without a server column", () => {
    const memory = { value: "{}", getItem: () => memory.value, setItem: (_key: string, next: string) => { memory.value = next; } };
    writeApproval("faircrest-cc", "approved", memory);
    expect(readApprovals(memory)["faircrest-cc"]).toBe("approved");
  });

  it("turns a close pair of hexes into a high color percent", () => {
    const close = colorMatchPercent("#eae5d6", "#efe8d8");
    expect(close?.pct).toBeGreaterThan(70);
    const far = colorMatchPercent("#8d8f92", "#244338");
    expect(far!.pct).toBeLessThan(close!.pct);
  });
});

describe("color groups and color changes", () => {
  it("switching color groups changes which door is painted, and a render hex change wins", () => {
    const gray = styles.find((item) => item.id === 360001)!;
    const white = styles.find((item) => item.id === 600001)!;
    expect(standardShakerDlFacePlan(gray, "base")?.dlcCrop?.solidColor).toBe("#8d8f92");
    expect(resolveDoorColor(white).appliedHex).not.toBe("#8d8f92");
    expect(resolveDoorColor(white).appliedHex).not.toBe("#244338");
    const edited = standardShakerDlFacePlan({ ...gray, renderHex: "#555553" }, "base");
    expect(edited?.dlcCrop?.solidColor).toBe("#555553");
  });
});
