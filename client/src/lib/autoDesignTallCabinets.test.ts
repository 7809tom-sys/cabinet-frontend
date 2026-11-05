import { describe, expect, it } from "vitest";
import ovenRows from "./__fixtures__/ovenCabinetRows.json";
import realCatalog from "./__fixtures__/autoDesignRealCatalog.json";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import {
  autoDesignTallKind,
  autoDesignTallProducts,
  displayTallSku,
  groupTallProducts,
  isAutoDesignTallBox,
  planAutoDesignTallFit,
  resolveTallPick,
  tallCabinetPlacement,
} from "./autoDesignTallCabinets";

const tall = ovenRows as unknown as DesignCabinet[];
const real = realCatalog as unknown as Record<string, { base: unknown[]; wall: unknown[]; accessory: unknown[] }>;

function room(): RoomData {
  return { width: 144, depth: 120, ceilingHeight: 96, openWallPath: false } as RoomData;
}

function base(code: string, width: number, x = 0): PlacedCabinet {
  return {
    uid: code, cabinetId: 1, masterCode: code, description: code, placement: "base",
    x, y: 0, width, depth: 24, height: 34.5, rotation: 0, wallId: "top", wallOffset: x,
  } as PlacedCabinet;
}

describe("tall oven / pantry products in the auto-designer pop-up", () => {
  it("offers the real oven pantry towers, including UOC3390 as its own SKU", () => {
    const products = autoDesignTallProducts(tall);
    const uoc = products.find((product) => product.masterCode === "UOC3390");
    expect(uoc).toBeTruthy();
    expect(uoc).toMatchObject({ kind: "oven-pantry", widthIn: 33, heightIn: 90, depthIn: 24 });
    // The distributor alias stays in the stored catalog code but not in the SKU.
    expect(uoc!.catalogCode).toBe("UOC3390(O339024)");
    expect(products.some((product) => product.masterCode === "TOD3084")).toBe(true);
    expect(products.some((product) => product.masterCode === "TOS2DB3084")).toBe(true);
  });

  it("never offers a roll-out tray, valance, molding, panel, or range base as a tall box", () => {
    const products = autoDesignTallProducts(tall);
    for (const product of products) {
      expect(product.masterCode).not.toMatch(/^RB\d/);
      expect(product.masterCode).not.toMatch(/valance|va-?\d|roll|tray|filler|panel|skin/i);
    }
    // Accessory rows are not tall boxes even when a distributor files them on the
    // tall tab, and a range base is a base no matter what the pop-up is offered.
    const accessoryRows = [
      ...(real["330011"]!.accessory as DesignCabinet[]),
      ...(real["540005"]!.accessory as DesignCabinet[]),
    ];
    expect(accessoryRows.length).toBeGreaterThan(0);
    for (const row of accessoryRows) {
      const asTall = { ...row, placement: "tall" as const };
      if (/valance|roll|tray|filler|panel|skin|sample|moulding|molding/i.test(`${row.masterCode} ${row.description}`)) {
        expect(isAutoDesignTallBox(asTall)).toBe(false);
      }
    }
    const rangeBase = { ...tall[0]!, masterCode: "RB2DB24", description: '24" Two Drawer Range Base', placement: "base" as const };
    expect(isAutoDesignTallBox(rangeBase)).toBe(false);
  });

  it("classifies an oven tower, a plain pantry, and a utility tower", () => {
    expect(autoDesignTallKind({ masterCode: "UOC3390", description: "33x90 Oven Pantry Cabinet", placement: "tall", category: "Tall", subCategory: "Oven Tower" } as never)).toBe("oven-pantry");
    expect(autoDesignTallKind({ masterCode: "TP2490", description: '24" x 90" Pantry Cabinet', placement: "tall", category: "Tall", subCategory: "Pantry" } as never)).toBe("pantry");
    expect(autoDesignTallKind({ masterCode: "U1884", description: '18" x 84" Utility Cabinet', placement: "tall", category: "Tall", subCategory: "Utility" } as never)).toBe("utility");
  });

  it("groups the pop-up by kind so the list reads in a fixed order", () => {
    const groups = groupTallProducts(autoDesignTallProducts(tall));
    expect(groups[0]!.kind).toBe("oven-pantry");
    expect(groups.flatMap((group) => group.products).length).toBe(autoDesignTallProducts(tall).length);
  });
});

describe("auto-placing a tall pick", () => {
  it("seats the box at the END of a run, not the start of the first free span", () => {
    const product = autoDesignTallProducts(tall).find((entry) => entry.masterCode === "TOD3084")!;
    const fit = planAutoDesignTallFit({ product, room: room(), placed: [], openings: [], wallIds: ["top"] });
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    // An empty 144-inch wall is one span that reaches both wall ends. A tall box
    // closes the run, so it sits against the far wall end.
    expect(fit.seat).toBe("end");
    expect(fit.alongIn).toBeCloseTo(144 - product.widthIn, 5);
    expect(fit.alongIn).toBeGreaterThanOrEqual(0);
    expect(fit.alongIn + product.widthIn).toBeLessThanOrEqual(144 + 0.001);
  });

  it("closes a run that stops short of the wall end, instead of opening a gap beside the corner", () => {
    const product = autoDesignTallProducts(tall).find((entry) => entry.masterCode === "TOD3084")!;
    // 60 inches of base sit at the wall start, leaving 84 clear inches to the far
    // wall end. The old behavior seated the tall box at 60 (span start), leaving
    // the run open past it; the tall box must instead finish the run at 114.
    const placed = [base("B60", 60, 0)];
    const fit = planAutoDesignTallFit({ product, room: room(), placed, openings: [], wallIds: ["top"] });
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    expect(fit.seat).toBe("end");
    expect(fit.alongIn).toBeCloseTo(144 - product.widthIn, 5);
    expect(fit.alongIn).toBeGreaterThanOrEqual(60);
  });

  it("seats the box at the end of an interior span when no wall end is free", () => {
    const product = autoDesignTallProducts(tall).find((entry) => entry.masterCode === "TOD3084")!;
    // Bases at both wall ends leave an interior 40-inch span between 60 and 100.
    const placed = [base("B60", 60, 0), base("B44", 44, 100)];
    const fit = planAutoDesignTallFit({ product, room: room(), placed, openings: [], wallIds: ["top"] });
    expect(fit.ok).toBe(true);
    if (!fit.ok) return;
    // The box still finishes the span rather than butting the base that opens it.
    expect(fit.alongIn).toBeCloseTo(100 - product.widthIn, 5);
  });

  it("allows several tall boxes in one build, each finishing the run in turn", () => {
    const products = autoDesignTallProducts(tall);
    const first = products.find((entry) => entry.masterCode === "TOD3084")!;
    const second = products.find((entry) => entry.masterCode === "TOS2DB3084")!;
    let placed: PlacedCabinet[] = [];
    const fits = [first, second].map((product) => {
      const fit = planAutoDesignTallFit({ product, room: room(), placed, openings: [], wallIds: ["top"], allowMultiple: true });
      if (fit.ok) {
        placed = [
          ...placed,
          { ...tallCabinetPlacement({ product, source: tall.find((row) => row.masterCode === product.masterCode)! ?? tall[0]!, wallId: fit.wallId, spot: fit.placement, alongIn: fit.alongIn, uid: `t-${product.id}`, styleId: null }) },
        ];
      }
      return fit;
    });
    const [firstFit, secondFit] = fits;
    expect(firstFit?.ok && secondFit?.ok).toBe(true);
    if (!secondFit?.ok || !firstFit?.ok) return;
    // Two boxes cannot occupy one spot: the second finishes the run the first left.
    expect(secondFit.alongIn).toBeLessThan(firstFit.alongIn);
    expect(secondFit.alongIn + second.widthIn).toBeLessThanOrEqual(firstFit.alongIn + 0.001);
  });

  it("refuses a box taller than the room's lowest ceiling and names it blocked", () => {
    const product = autoDesignTallProducts(tall).find((entry) => entry.masterCode === "UOC3390")!;
    const lowRoom = { ...room(), ceilingHeight: 84 } as RoomData;
    const fit = planAutoDesignTallFit({ product, room: lowRoom, placed: [], openings: [], wallIds: ["top"] });
    expect(fit.ok).toBe(false);
    if (fit.ok) return;
    expect(fit.code).toBe("tall-cabinet-blocked");
    expect(fit.reason).toMatch(/ceiling/i);
  });

  it("does not overlap the cabinets already seated on the wall", () => {
    const product = autoDesignTallProducts(tall).find((entry) => entry.masterCode === "TOD3084")!;
    // 140 of the 144-inch wall is taken, leaving no clear span for a 30-inch box.
    const placed = [base("B70A", 70, 0), base("B70B", 70, 70)];
    const fit = planAutoDesignTallFit({ product, room: room(), placed, openings: [], wallIds: ["top"] });
    expect(fit.ok).toBe(false);
    if (fit.ok) return;
    expect(fit.code).toBe("tall-cabinet-blocked");
    expect(fit.reason).toMatch(/span/i);
  });

  it("places the real catalog record with its own SKU and dimensions", () => {
    const source = tall.find((row) => row.masterCode === "UOC3390(O339024)")!;
    const product = autoDesignTallProducts([source])[0]!;
    const placed = tallCabinetPlacement({
      product,
      source,
      wallId: "top",
      spot: { x: 0, y: 0, rotation: 0, wallId: "top", wallOffset: 12 },
      alongIn: 12,
      uid: "tall-1",
      styleId: 330011,
    });
    expect(placed).toMatchObject({
      masterCode: "UOC3390(O339024)",
      placement: "tall",
      width: 33,
      height: 90,
      depth: 24,
      wallId: "top",
      wallOffset: 12,
      styleId: 330011,
    });
  });

  it("resolves a saved pick by id and by alias-stripped SKU", () => {
    const source = tall.find((row) => row.masterCode === "UOC3390(O339024)")!;
    expect(resolveTallPick([source], { cabinetId: source.id ?? 0, masterCode: "UOC3390" })?.masterCode).toBe("UOC3390(O339024)");
    expect(resolveTallPick([source], { cabinetId: -1, masterCode: "UOC3390" })?.masterCode).toBe("UOC3390(O339024)");
    expect(resolveTallPick([source], { cabinetId: -1, masterCode: "NOPE" })).toBeNull();
  });

  it("strips the distributor alias for display only", () => {
    expect(displayTallSku("UOC3390(O339024)")).toBe("UOC3390");
    expect(displayTallSku("TOD3084")).toBe("TOD3084");
  });
});
