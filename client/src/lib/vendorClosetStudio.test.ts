import { describe, expect, it } from "vitest";
import {
  addStudioBay, addStudioBasketPlacement, addStudioBasketReference, addStudioConnectedCorner, addStudioCornerShelf, canStageStudioPart, changeStudioFinish, configureStudioBayCut, createStudioDesign, createStudioReviewDemo, MODE_RECOMMENDATIONS, moveStudioBasketPlacement, moveStudioCornerShelf, moveStudioItem, removeStudioBasketPlacement, removeStudioBasketReference, studioCornerShelfSku, studioTowerFootprint, updateStudioBasketPlacement,
  restoreStudioDesign, snapStudioPart, STUDIO_FINISHES, studioBayCut, studioBays, studioCollision, studioCornerShelvesForWall, studioPartReferences, studioTakeoff, studioWallOccupancy, studioWidth, switchStudioWall,
  STUDIO_BASKET_REFERENCE_OPTIONS, STUDIO_BASKET_VISUAL_DEPTH_IN, STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN, STUDIO_CORNER_SHELF_GEOMETRY_REVISION, STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG, studioBasketPlacementsForWall, studioBasketReferences, studioCornerMeasuredGap, studioCornerPlanningFootprint, studioFitCapability, studioItemHeight,
  type StudioDesign,
} from "./vendorClosetStudio";
import { CLOSET_PARTS, masterTracPublicReferenceCatalog } from "./closet";

describe("isolated vendor Closet Studio", () => {
  it("keeps each wall's towers and parts independent while preserving all walls, one shared corner identity, and legacy drafts", () => {
    const back = createStudioDesign();
    expect(studioBays(back, "back")).toHaveLength(1);
    expect(studioWallOccupancy(back).back).toMatchObject({ filled: true, usedSpanIn: 25.5, bayCount: 1 });
    expect(studioWallOccupancy(back).left).toMatchObject({ filled: false, usedSpanIn: 0, bayCount: 0 });

    const emptyLeft = switchStudioWall(back, "left");
    expect(emptyLeft.wall).toBe("left");
    expect(studioBays(emptyLeft)).toEqual([]);
    const addedLeft = addStudioBay(emptyLeft, 18);
    expect(addedLeft.ok).toBe(true);
    if (!addedLeft.ok) return;
    const leftShelf = snapStudioPart(addedLeft.design, 0, "shelf", 46, "left-shelf");
    expect(leftShelf.ok).toBe(true);
    if (!leftShelf.ok) return;

    const backAgain = switchStudioWall(leftShelf.design, "back");
    expect(studioBays(backAgain)).toHaveLength(1);
    expect(studioBays(backAgain)[0]?.items).toMatchObject([{ id: "shelf-1", wallId: "back" }]);
    const leftAgain = switchStudioWall(backAgain, "left");
    expect(studioBays(leftAgain)[0]?.items).toMatchObject([{ id: "left-shelf", wallId: "left" }]);
    expect(studioWallOccupancy(leftAgain)).toMatchObject({ back: { usedSpanIn: 25.5 }, left: { usedSpanIn: 19.5 }, right: { filled: false } });

    const corner = addStudioCornerShelf(backAgain, "back-right", "fixed", 36, "corner-shared");
    expect(corner.ok).toBe(true);
    if (!corner.ok) return;
    const rightView = switchStudioWall(corner.design, "right");
    expect(studioCornerShelvesForWall(rightView, "right").map((shelf) => shelf.id)).toEqual(["corner-shared"]);
    expect(studioCornerShelvesForWall(rightView, "back").map((shelf) => shelf.id)).toEqual(["corner-shared"]);
    expect(studioTakeoff(rightView).lines.find((line) => line.sku === "432556")?.qty).toBe(1);
    expect(studioTakeoff(rightView).lines.filter((line) => line.section === "panel").reduce((sum, line) => sum + line.qty, 0)).toBe(4);
    expect(restoreStudioDesign(JSON.stringify(rightView))).toEqual(rightView);

    const legacy = { version: 1, mode: "closet", mount: "floor", finish: "Glacier White", wall: "left", wallWidthIn: 120, roomDepthIn: 96, bays: [{ id: "legacy-bay", widthIn: 24, items: [{ id: "legacy-shelf", kind: "shelf", bottomIn: 38 }] }] };
    const migrated = restoreStudioDesign(JSON.stringify(legacy));
    expect(migrated?.version).toBe(2);
    expect(studioBays(migrated!, "left")[0]?.items[0]).toMatchObject({ id: "legacy-shelf", wallId: "left" });
    expect(studioBays(migrated!, "back")).toEqual([]);
  });

  it("adds only a source-SKU-linked 29.5-inch visual-planning curved corner envelope at a free two-wall corner", () => {
    const base = createStudioDesign();
    expect(STUDIO_CORNER_SHELF_NOMINAL_FOOTPRINT_IN).toBe(29.5);
    const fixed = addStudioCornerShelf(base, "back-right", "fixed", 36, "corner-fixed");
    expect(fixed.ok).toBe(true);
    if (!fixed.ok) return;
    const shelf = fixed.design.cornerShelves?.[0];
    expect(shelf).toMatchObject({ id: "corner-fixed", sku: "432556", finish: "Glacier White", mount: "fixed", profile: "curved-illustrative", cornerId: "back-right", wallIds: ["back", "right"], elevationIn: 36, nominalFootprintIn: 29.5, geometryRevision: STUDIO_CORNER_SHELF_GEOMETRY_REVISION });
    expect(studioCornerPlanningFootprint(fixed.design, shelf!)).toEqual({ xMin: 90.5, xMax: 120, zMin: 0, zMax: 29.5 });
    expect(studioCornerMeasuredGap(fixed.design, shelf!).towerGapIn).toBeGreaterThan(0);

    const bill = studioTakeoff(fixed.design);
    expect(bill.lines.some((line) => line.sku === "432556" && /2026 planning envelope.*reference only/i.test(line.label))).toBe(true);
    expect(bill.lines.some((line) => /H-Joint/i.test(line.label))).toBe(false);
    expect(bill.missing.some((line) => /29\.5.*planning envelope.*29¼/i.test(line))).toBe(true);
    expect(restoreStudioDesign(JSON.stringify(fixed.design))).toEqual(fixed.design);

    const overlap = addStudioCornerShelf(fixed.design, "back-right", "adjustable", 36, "corner-overlap");
    expect(overlap).toMatchObject({ ok: false });
    const raised = addStudioCornerShelf(fixed.design, "back-right", "adjustable", 40, "corner-adjustable");
    expect(raised.ok).toBe(true);
    if (!raised.ok) return;
    expect(raised.design.cornerShelves).toHaveLength(2);
    expect(moveStudioCornerShelf(raised.design, "corner-adjustable", 36).ok).toBe(false);
    expect(addStudioCornerShelf(base, "back-left", "fixed", 36, "tower-intersection")).toMatchObject({ ok: false });
    expect(addStudioCornerShelf({ ...base, mount: "hanging" }, "back-right", "fixed", 36, "hanging-corner")).toMatchObject({ ok: false });
  });

  it("starts a visual 29.5-inch pie corner atomically, aligns both incident tower runs to its conservative envelope, and retains the selected-finish source SKU", () => {
    const base: StudioDesign = { ...createStudioDesign(), finish: "Spiced Mahogany" };
    expect(studioCornerShelfSku("Spiced Mahogany", "adjustable")).toBe("432787");

    const connected = addStudioConnectedCorner(base, "back-right", "adjustable", 36, "connected-pie");
    expect(connected.ok).toBe(true);
    if (!connected.ok) return;

    expect(connected.shelf).toMatchObject({
      id: "connected-pie", sku: "432787", finish: "Spiced Mahogany", mount: "adjustable",
      cornerId: "back-right", nominalFootprintIn: 29.5, towerConnection: "visualAligned",
    });
    expect(studioBays(connected.design, "back")).toHaveLength(1);
    expect(studioBays(connected.design, "right")).toHaveLength(1);
    expect(studioCornerPlanningFootprint(connected.design, connected.shelf)).toEqual({ xMin: 90.5, xMax: 120, zMin: 0, zMax: 29.5 });
    expect(studioTowerFootprint(connected.design, "back")).toMatchObject({ xMin: 65, xMax: 90.5, zMin: 0, zMax: 14.5 });
    expect(studioTowerFootprint(connected.design, "right")).toMatchObject({ xMin: 105.5, xMax: 120, zMin: 29.5, zMax: 55 });
    expect(studioCornerMeasuredGap(connected.design, connected.shelf).towerGapIn).toBe(0);
    expect(studioCornerMeasuredGap(switchStudioWall(connected.design, "right"), connected.shelf).towerGapIn).toBe(0);
    expect(studioTakeoff(connected.design).lines.find((line) => line.sku === "432787")?.qty).toBe(1);
    expect(studioTakeoff(connected.design).missing.some((line) => /visual tower alignment.*not.*connection/i.test(line))).toBe(true);
    expect(restoreStudioDesign(JSON.stringify(connected.design))).toEqual(connected.design);

    const tooSmall: StudioDesign = { ...base, wallWidthIn: 48, roomDepthIn: 48 };
    const rejected = addStudioConnectedCorner(tooSmall, "back-right", "fixed", 36, "too-small-corner");
    expect(rejected).toMatchObject({ ok: false });
    expect(tooSmall.cornerShelves ?? []).toEqual([]);
    expect(studioBays(tooSmall, "right")).toEqual([]);
  });

  it("replaces a placed corner pie shelf with the matching sourced finish SKU when the Studio finish changes", () => {
    const corner = addStudioCornerShelf(createStudioDesign(), "back-right", "fixed", 36, "finish-pie");
    expect(corner.ok).toBe(true);
    if (!corner.ok) return;

    const changed = changeStudioFinish(corner.design, "Spiced Mahogany");
    expect(changed.ok).toBe(true);
    if (!changed.ok) return;
    expect(changed.design).toMatchObject({ finish: "Spiced Mahogany", cornerShelves: [{ id: "finish-pie", finish: "Spiced Mahogany", sku: "432786" }] });
    expect(studioTakeoff(changed.design).lines.some((line) => line.sku === "432556")).toBe(false);
    expect(studioTakeoff(changed.design).lines.find((line) => line.sku === "432786")?.qty).toBe(1);
    expect(restoreStudioDesign(JSON.stringify(changed.design))).toEqual(changed.design);
  });

  it("retains each historical basket as a source-only reference without inventing a fit, rail, motion, material line, or 2026 SKU substitution", () => {
    expect(STUDIO_BASKET_REFERENCE_OPTIONS).toHaveLength(9);
    expect(STUDIO_BASKET_REFERENCE_OPTIONS.find((option) => option.sku === "432902")).toMatchObject({ nominalHeightIn: 17, nominalWidthIn: 24, finish: "Chrome" });
    expect(studioFitCapability("432902")).toMatchObject({ family: "basket", status: "visualPlanning" });
    expect(studioFitCapability("446812")).toBeUndefined();

    const added = addStudioBasketReference(createStudioDesign(), "432902", "basket-17x24");
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.reference).toMatchObject({ id: "basket-17x24", sku: "432902", nominalHeightIn: 17, nominalWidthIn: 24, capability: "referenceOnly", sourceRevision: "floor-579554-p13-historical-reference-v1" });
    expect(studioBasketReferences(added.design)).toHaveLength(1);
    expect(studioTakeoff(added.design).lines.some((line) => line.sku === "432902")).toBe(false);
    expect(studioTakeoff(added.design).missing.some((line) => /432902.*not placed.*outer envelope.*extension travel/i.test(line))).toBe(true);
    expect(restoreStudioDesign(JSON.stringify(added.design))).toEqual(added.design);
    expect(addStudioBasketReference(createStudioDesign(), "446812").ok).toBe(false);
    expect(removeStudioBasketReference(added.design, "basket-17x24").basketReferences).toEqual([]);
  });

  it("places historical baskets as wall-owned visual planning envelopes without treating them as rails, slides, or a cuttable assembly", () => {
    const base = createStudioDesign();
    expect(STUDIO_BASKET_VISUAL_DEPTH_IN).toBe(14.5);
    const basket = addStudioBasketPlacement(base, 0, "432901", 42, "basket-back-11x24");
    expect(basket.ok).toBe(true);
    if (!basket.ok) return;
    expect(basket.placement).toMatchObject({ id: "basket-back-11x24", sku: "432901", finish: "Chrome", nominalHeightIn: 11, nominalWidthIn: 24, nominalDepthIn: 14.5, bottomIn: 42, wallId: "back", bayId: "bay-1", capability: "visualPlanning" });
    expect(studioBasketPlacementsForWall(basket.design, "back")).toHaveLength(1);
    expect(studioBasketPlacementsForWall(basket.design, "left")).toEqual([]);
    expect(studioTakeoff(basket.design).lines.find((line) => line.sku === "432901")).toMatchObject({ qty: 1, section: "accessory" });
    expect(studioTakeoff(basket.design).missing.some((line) => /432901.*visual planning only.*rail.*clearance/i.test(line))).toBe(true);

    expect(addStudioBasketPlacement(base, 0, "432905", 42, "too-wide-17x30")).toMatchObject({ ok: false });
    expect(addStudioBasketPlacement(basket.design, 0, "432900", 46, "intersecting-basket")).toMatchObject({ ok: false });
    expect(studioCollision(basket.design, 0, { id: "basket-shelf", kind: "shelf", bottomIn: 48 })).toMatch(/intersects/i);
    const resized = updateStudioBasketPlacement(basket.design, "basket-back-11x24", "432900");
    expect(resized).toMatchObject({ ok: true, placement: { sku: "432900", nominalHeightIn: 6, nominalWidthIn: 24 } });
    const left = switchStudioWall(basket.design, "left");
    const leftTower = addStudioBay(left, 24);
    expect(leftTower.ok).toBe(true);
    if (!leftTower.ok) return;
    const leftBasket = addStudioBasketPlacement(leftTower.design, 0, "432901", 42, "basket-left-11x24");
    expect(leftBasket.ok).toBe(true);
    if (!leftBasket.ok) return;
    const backAgain = switchStudioWall(leftBasket.design, "back");
    expect(studioBasketPlacementsForWall(backAgain, "back").map((placement) => placement.id)).toEqual(["basket-back-11x24"]);
    expect(studioBasketPlacementsForWall(backAgain, "left").map((placement) => placement.id)).toEqual(["basket-left-11x24"]);
    expect(studioTakeoff(backAgain).lines.find((line) => line.sku === "432901")?.qty).toBe(2);
    expect(moveStudioBasketPlacement(backAgain, "basket-back-11x24", 38).ok).toBe(false);
    expect(removeStudioBasketPlacement(backAgain, "basket-back-11x24").basketPlacements).toHaveLength(1);
    expect(restoreStudioDesign(JSON.stringify(backAgain))).toEqual(backAgain);
  });

  it("keeps every public MasterTrac source record discoverable as a non-placeable List reference without private workbook fields", () => {
    const references = masterTracPublicReferenceCatalog();
    expect(references).toHaveLength(CLOSET_PARTS.length);
    expect(references.find((part) => part.sku === "432556")).toMatchObject({ description: "Fixed Corner Shelf", finish: "Glacier White" });
    expect(references.find((part) => part.sku === "432602")).toMatchObject({ description: "24\" Hamper Shaker Door", finish: "Glacier White" });
    expect(references.every((part) => "sourceRow" in part === false && "invoiceUsd" in part === false && "wholesaleUsd" in part === false)).toBe(true);
  });

  it("starts with one bay, sourced panels, two fixed shelves and cleat first, outside checkout", () => {
    const design = createStudioDesign();
    expect(design.bays).toHaveLength(1);
    expect(studioWidth(design)).toBe(25.5);
    const bill = studioTakeoff(design);
    expect(bill.lines[0].section).toBe("cleat");
    expect(bill.lines.filter((line) => line.section === "panel").map((line) => line.sku)).toEqual(["432136", "432525"]);
    expect(bill.lines.some((line) => line.sku === "432529" && line.qty === 2)).toBe(true);
    expect(bill.lines.some((line) => line.sku === "432535" && line.qty === 1)).toBe(true);
    expect(bill.lines.every((line) => CLOSET_PARTS.some((part) => part.sku === line.sku && part.listEachUsd >= 0))).toBe(true);
    expect(bill.missing.some((line) => line.includes("fasteners"))).toBe(true);
  });

  it("adds a neighboring tower and prices exactly one shared center upright, not two end panels", () => {
    const first = createStudioDesign();
    const result = addStudioBay(first);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(studioWidth(result.design)).toBe(50.25);
    const panels = studioTakeoff(result.design).lines.filter((line) => line.section === "panel");
    expect(panels.map((line) => line.sku)).toEqual(["432136", "432519", "432525"]);
    expect(panels.reduce((sum, line) => sum + line.qty, 0)).toBe(3);
    expect(studioTakeoff(result.design).lines.find((line) => line.sku === "432608")?.qty).toBe(2);
    expect(first.bays).toHaveLength(1);
  });

  it("snaps a sourced shoe and rod into the target bay and tallies two cups per rod by pack", () => {
    let design = createStudioDesign();
    const neighbor = addStudioBay(design);
    if (!neighbor.ok) throw new Error(neighbor.reason);
    design = neighbor.design;
    const shoe = snapStudioPart(design, 1, "shoe", 40, "shoe-1");
    expect(shoe.ok).toBe(true);
    if (!shoe.ok) return;
    expect(shoe.design.bays[0].items).toEqual(design.bays[0].items);
    const rod = snapStudioPart(shoe.design, 1, "rod", 64, "rod-1");
    expect(rod.ok).toBe(true);
    if (!rod.ok) return;
    const bill = studioTakeoff(rod.design);
    expect(bill.lines.some((line) => /Shoe Shelf/.test(line.label))).toBe(true);
    expect(bill.lines.find((line) => /Rod Cup/.test(line.label))?.packNote).toContain("2 cups required");
    expect(restoreStudioDesign(JSON.stringify(rod.design))).toEqual(rod.design);
  });

  it("uses the owner-approved 45-degree shoe presentation while reserving its full visual rise from nearby parts", () => {
    expect(STUDIO_ILLUSTRATIVE_SHOE_PITCH_DEG).toBe(45);
    expect(studioItemHeight("shoe")).toBeGreaterThan(9);
    const initial = createStudioDesign();
    const base: StudioDesign = { ...initial, bays: [{ ...initial.bays[0], items: [] }] };
    const shoe = snapStudioPart(base, 0, "shoe", 30, "shoe-45");
    expect(shoe.ok).toBe(true);
    if (!shoe.ok) return;
    expect(studioCollision(shoe.design, 0, { id: "nearby-shelf", kind: "shelf", bottomIn: 36 })).toMatch(/intersects/i);
    expect(studioCollision(shoe.design, 0, { id: "nearby-drawer", kind: "drawer", bottomIn: 35 })).toMatch(/intersects/i);
    expect(studioCollision(shoe.design, 0, { id: "nearby-shoe", kind: "shoe", bottomIn: 40 })).toMatch(/intersects/i);
    expect(studioCollision(base, 0, { id: "ceiling-shoe", kind: "shoe", bottomIn: 76 })).toMatch(/must fit/i);
    expect(restoreStudioDesign(JSON.stringify(shoe.design))).toEqual(shoe.design);

    const bill = studioTakeoff(shoe.design);
    const sourceParts = studioPartReferences(shoe.design, 0, "shoe") ?? [];
    expect(sourceParts).not.toHaveLength(0);
    expect(sourceParts.every((part) => bill.lines.some((line) => line.sku === part.sku && line.unitUsd === (part.packQty > 1 ? part.listPackUsd : part.listEachUsd)))).toBe(true);
    expect(bill.missing.some((line) => /45° pitch.*verify supplier fit/i.test(line))).toBe(true);
  });

  it("rejects overlapping slides and unsupported baskets without silently altering the design", () => {
    const first = createStudioDesign();
    const collision = studioCollision(first, 0, { id: "new", kind: "drawer", bottomIn: 38 });
    expect(collision).toContain("intersects");
    const failed = moveStudioItem(first, 0, "shelf-1", 6);
    expect(failed.ok).toBe(false);
    expect(first.bays[0].items[0].bottomIn).toBe(38);
    expect(canStageStudioPart(first, 0, "drawer")).toBeNull();
    expect(restoreStudioDesign(JSON.stringify({ ...first, bays: [{ ...first.bays[0], items: [{ id: "basket", kind: "basket", bottomIn: 30 }] }] }))).toBeNull();
  });

  it("hanging start lists the sourced cleat before real 80-inch hanging panels and flags unknown anchors", () => {
    const hanging: StudioDesign = { ...createStudioDesign(), mount: "hanging" };
    const bill = studioTakeoff(hanging);
    expect(bill.lines[0].sku).toBe("432608");
    expect(bill.lines.filter((line) => line.section === "panel").map((line) => line.sku)).toEqual(["432135", "432524"]);
    expect(bill.missing.some((line) => line.includes("Hanging-panel installation"))).toBe(true);
  });

  it("changes recommendations by mode without making any sourced SKU artificially exclusive", () => {
    const pantry = { ...createStudioDesign(), mode: "pantry" as const };
    expect(MODE_RECOMMENDATIONS.pantry[0]).toBe("shelf");
    expect(snapStudioPart(pantry, 0, "rod", 65, "pantry-rod").ok).toBe(true);
    expect(MODE_RECOMMENDATIONS.mudroom).toContain("shoe");
  });

  it("resolves all offered finish, bay-width and mount combinations to public structural SKUs", () => {
    for (const finish of STUDIO_FINISHES) for (const mount of ["floor", "hanging"] as const) for (const widthIn of [18, 24, 30] as const) {
      const base = createStudioDesign();
      const design: StudioDesign = { ...base, finish, mount, bays: [{ id: "source-check", widthIn, items: [] }] };
      const bill = studioTakeoff(design);
      expect(bill.lines.filter((line) => line.section === "panel").reduce((sum, line) => sum + line.qty, 0)).toBe(2);
      expect(bill.lines.filter((line) => line.section === "shelf").reduce((sum, line) => sum + line.qty, 0)).toBe(2);
      expect(bill.lines.filter((line) => line.section === "cleat").reduce((sum, line) => sum + line.qty, 0)).toBe(1);
      expect(bill.missing.filter((line) => line.includes("SKU or exact assembly"))).toEqual([]);
    }
  });

  it("opens the exact mixed sample with a finish-matched MasterTrac slab front and the real drawer box", () => {
    const demo = createStudioReviewDemo();
    expect(demo.finish).toBe("Spiced Mahogany");
    expect(demo.bays).toHaveLength(2);
    expect(demo.bays[1].items.map((item) => item.kind)).toEqual(["shoe", "rod", "drawer"]);
    const lines = studioTakeoff(demo).lines;
    expect(lines.find((line) => line.sku === "432798")?.label).toContain("Small Slab Drawer Front · Spiced Mahogany");
    expect(lines.find((line) => line.sku === "432385")?.label).toContain("Small Drawer w/SC slides · Hard Maple");
    expect(lines.some((line) => line.section === "panel" && line.qty > 1)).toBe(false);
  });

  it("keeps the purchased fixed and adjustable 24-inch shelf SKUs and full dated List when a 22.5-inch bay is field-cut", () => {
    const fitted = configureStudioBayCut(createStudioDesign(), 0, 24, 22.5);
    expect(fitted.ok).toBe(true);
    if (!fitted.ok) return;

    expect(fitted.design.bays[0]).toMatchObject({ stockWidthIn: 24, widthIn: 22.5 });
    expect(studioBayCut(fitted.design.bays[0])).toEqual({ stockWidthIn: 24, installedWidthIn: 22.5, offcutIn: 1.5 });
    expect(studioPartReferences(fitted.design, 0, "shelf")?.[0].sku).toBe("432535");
    expect(studioPartReferences(fitted.design, 0, "fixedShelf")?.[0].sku).toBe("432529");

    const bill = studioTakeoff(fitted.design);
    expect(bill.lines.find((line) => line.sku === "432529")).toMatchObject({ qty: 2, installedWidthIn: 22.5, stockWidthIn: 24, offcutIn: 1.5 });
    expect(bill.lines.find((line) => line.sku === "432535")).toMatchObject({ qty: 1, installedWidthIn: 22.5, stockWidthIn: 24, offcutIn: 1.5 });
    expect(bill.lines.find((line) => line.sku === "432529")?.label).toContain("cut from 24″ stock");
    expect(bill.lines.find((line) => line.sku === "432529")?.packNote).toContain("planning difference");
    expect(restoreStudioDesign(JSON.stringify(fitted.design))).toEqual(fitted.design);
  });

  it("offers cut-to-fit only where every selected finish and 18/24/30 stock width resolves to real fixed and adjustable shelves", () => {
    for (const finish of STUDIO_FINISHES) for (const stockWidthIn of [18, 24, 30] as const) {
      const initial: StudioDesign = { ...createStudioDesign(), finish, bays: [{ id: `cut-${finish}-${stockWidthIn}`, widthIn: 24, items: [] }] };
      const fitted = configureStudioBayCut(initial, 0, stockWidthIn, stockWidthIn - 0.5);
      expect(fitted.ok).toBe(true);
      if (!fitted.ok) continue;
      expect(studioPartReferences(fitted.design, 0, "fixedShelf")?.[0].widthIn).toBe(stockWidthIn);
      expect(studioPartReferences(fitted.design, 0, "shelf")?.[0].widthIn).toBe(stockWidthIn);
    }
  });

  it("rejects unsupported stock, under-planning-width cuts, and cuts in bays that hold unverified drawer or shoe fit", () => {
    const base = createStudioDesign();
    expect(configureStudioBayCut(base, 0, 24, 24.25).ok).toBe(false);
    expect(configureStudioBayCut(base, 0, 24, 11.75).ok).toBe(false);
    expect(configureStudioBayCut(base, 0, 23 as 18 | 24 | 30, 22.5).ok).toBe(false);
    expect(configureStudioBayCut({ ...base, mount: "hanging" }, 0, 24, 22.5).ok).toBe(false);

    const drawer = snapStudioPart(base, 0, "drawer", 20, "drawer-cut-block");
    expect(drawer.ok).toBe(true);
    if (!drawer.ok) return;
    const rejected = configureStudioBayCut(drawer.design, 0, 24, 22.5);
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.reason).toMatch(/drawer|fit/i);
  });
});
