import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { cabinetDrawingType, resolveDoorDrawerCounts } from "@/lib/cabinetGraphics";
import { type PlacedCabinet } from "@/lib/design";
import { planCornerGeometry } from "./PlanCanvas";
import { DoorFront, ElevationView, HardwareOverlay, normalizeElevationCabinetConfig, resolveElevationFacePresentation } from "./ElevationView";

function baseCabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cabinet",
    cabinetId: 1,
    masterCode: "B-24",
    description: "24 inch Base Cabinet",
    category: "Base",
    placement: "base",
    x: 0,
    y: 0,
    width: 24,
    height: 34.5,
    depth: 24,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

describe("mixed Cabinet Config elevation rules", () => {
  it("renders a B-18 door pull vertically at the opposite-hinge edge while keeping its drawer pull centered and horizontal", () => {
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1,
      drawers: 1,
      doorPiece: "pull",
      drawerPiece: "pull",
      accent: "#1a2744",
      hardwarePosition: "auto",
      swing: "left",
      isWall: false,
      faceWidthIn: 18,
    }));
    expect(markup.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(1);
    expect(markup).toContain('data-hardware-orientation="vertical"');
    expect(markup).toContain('data-hardware-position="right"');
    expect(markup).toContain('data-hardware-center-in="16.5"');
    expect(markup).toContain('data-hardware-edge-inset-in="1.5"');
    expect(markup.match(/data-cabinet-hardware="drawer-pull"/g)).toHaveLength(1);
    expect(markup).toContain('data-hardware-orientation="horizontal"');
  });

  it("centers paired pulls 1.5 inches from the meeting edges of two 15-inch doors", () => {
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 2,
      drawers: 0,
      doorPiece: "pull",
      drawerPiece: "none",
      accent: "#1a2744",
      hardwarePosition: "paired",
      swing: "double",
      isWall: false,
      faceWidthIn: 30,
    }));
    expect(markup.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(2);
    expect(markup).toContain('data-hardware-center-in="13.5"');
    expect(markup).toContain('data-hardware-center-in="16.5"');
    expect(markup.match(/data-hardware-edge-inset-in="1.5"/g)).toHaveLength(2);
  });

  it("normalizes legacy Center hardware on ordinary upper doors to the same 1.5-inch opening-edge frame rule", () => {
    const singleUpper = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1,
      drawers: 0,
      doorPiece: "pull",
      drawerPiece: "none",
      accent: "#1a2744",
      hardwarePosition: "center",
      swing: "left",
      isWall: true,
      faceWidthIn: 18,
    }));
    expect(singleUpper.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(1);
    expect(singleUpper).toContain('data-hardware-position="right"');
    expect(singleUpper).toContain('data-hardware-center-in="16.5"');
    expect(singleUpper).toContain('data-hardware-edge-inset-in="1.5"');

    const pairedUpper = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 2,
      drawers: 0,
      doorPiece: "pull",
      drawerPiece: "none",
      accent: "#1a2744",
      hardwarePosition: "center",
      swing: "double",
      isWall: true,
      faceWidthIn: 30,
    }));
    expect(pairedUpper.match(/data-cabinet-hardware="door-pull"/g)).toHaveLength(2);
    expect(pairedUpper).toContain('data-hardware-center-in="13.5"');
    expect(pairedUpper).toContain('data-hardware-center-in="16.5"');
    expect(pairedUpper.match(/data-hardware-edge-inset-in="1.5"/g)).toHaveLength(2);
  });

  it("raises a floor-seated wall-cabinet pull while keeping it vertical on the selected side rail", () => {
    const markup = renderToStaticMarkup(createElement(HardwareOverlay, {
      doors: 1,
      drawers: 0,
      doorPiece: "pull",
      drawerPiece: "none",
      accent: "#1a2744",
      hardwarePosition: "left",
      swing: "right",
      isWall: true,
      faceWidthIn: 18,
      raisedDoorPullOnRail: true,
    }));
    expect(markup).toContain('data-hardware-orientation="vertical"');
    expect(markup).toContain('data-hardware-position="raised-door-rail"');
    expect(markup).toContain('data-hardware-center-in="1.5"');
    expect(markup).toContain("top:13%");
  });

  it("renders WD1860 right-side-up with one tall door above two bottom drawers", () => {
    const markup = renderToStaticMarkup(
      createElement(DoorFront, {
        kind: "shaker",
        edge: "#555555",
        face: "#eeeeee",
        doors: 1,
        drawers: 2,
        isWall: true,
        cabinetWidthIn: 18,
        cabinetHeightIn: 60,
        cabinetType: "standard-door",
        masterCode: "WD1860",
      }),
    );
    expect(markup.match(/data-wd18-upper-door="true"/g)).toHaveLength(1);
    expect(markup.match(/data-wd18-bottom-drawer="true"/g)).toHaveLength(2);
    expect(markup.indexOf('data-wd18-upper-door="true"')).toBeLessThan(markup.indexOf('data-wd18-bottom-drawer="true"'));
    expect(markup).toContain("height:80%");
  });

  it("normalizes legacy WDC2430 records into the configured two-door diagonal wall-corner elevation", () => {
    const legacyWdc2430 = {
      masterCode: "WDC2430",
      description: '24" x 30" Wall Diagonal Corner Cabinet',
      category: "Wall",
      placementType: "wall",
      width: 24,
      height: 30,
      depth: 24,
      cornerType: null,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };

    expect(normalizeElevationCabinetConfig(legacyWdc2430)).toMatchObject({ cornerType: "diagonal" });
    expect(resolveElevationFacePresentation(legacyWdc2430).cabinetType).toBe("diagonal-corner");

    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets: [baseCabinet({
            masterCode: "WDC2430",
            description: legacyWdc2430.description,
            category: "Wall",
            placement: "wall",
            width: 24,
            height: 30,
            depth: 24,
            numberOfDoors: 0,
            numberOfDrawers: 0,
            cornerType: null,
          })],
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
        }),
      ),
    );

    expect(markup.match(/data-diagonal-corner-door="true"/g)).toHaveLength(2);
  });

  it("renders RHF30 as the catalog sloped wood hood front with two doors and a lower fascia", () => {
    const rhf = baseCabinet({
      uid: "rhf30",
      cabinetId: 9390060,
      masterCode: "RHF30",
      description: "Range Hood Front",
      category: "Wall",
      subCategory: "Bridge / Stacker",
      placement: "wall",
      width: 30,
      height: 23.5,
      depth: 9,
      mountBottom: 66,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    });
    expect(resolveElevationFacePresentation(rhf).cabinetType).toBe("range-hood-front");
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [rhf],
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
        doorSampleUrlFor: () => "https://example.com/door-finish.webp",
      })),
    );
    expect(markup).toContain('data-range-hood-front="true"');
    expect(markup).toContain('data-range-hood-front-doors="sloped-pair"');
    expect(markup).toContain('data-range-hood-front-lower-fascia="true"');
    expect(markup).toContain('polygon(13% 0, 87% 0, 98% 100%, 2% 100%)');
    expect(markup).not.toContain('data-cabinet-hardware="door-pull"');
  });

  it("renders the saved LS36 host elevation as one exposed 12-inch L-corner return face", () => {
    const ls36 = baseCabinet({
      uid: "ls3612",
      cabinetId: 3612,
      masterCode: "LS3612",
      description: "36 inch Lazy Susan Base Cabinet",
      placement: "base",
      x: 0,
      y: 0,
      width: 36,
      height: 34.5,
      depth: 24,
      cornerType: "lazy-susan",
      numberOfDoors: 2,
      numberOfDrawers: 0,
    });

    expect(resolveElevationFacePresentation(ls36).cabinetType).toBe("l-corner");
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [ls36],
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
      })),
    );
    expect(markup.match(/data-l-corner-return-face="true"/g)).toHaveLength(1);
  });

  it("classifies BMC30 as a microwave base and BA-24 as its configured non-corner end-angle profile", () => {
    const bmc30 = {
      masterCode: "BMC30",
      description: '30" Microwave Base Cabinet',
      category: "Base",
      subCategory: "Microwave Base Cabinet",
      numberOfDoors: 0,
      numberOfDrawers: 1,
      openingType: "top",
    };
    expect(cabinetDrawingType(bmc30)).toBe("microwave-base");
    expect(resolveDoorDrawerCounts(bmc30)).toEqual({ doors: 0, drawers: 1 });

    expect(planCornerGeometry(baseCabinet({
      masterCode: "BA-24",
      description: "Legacy base record",
      subCategory: "Standard Base",
      customProfile: "end-angle",
    }))).toMatchObject({ isEndAngle: true, isCorner: false, isTriangle: false });
  });

  it("automatically redraws saved BA-24 and BEC-24 records as textured 17-inch single angled end faces", () => {
    for (const masterCode of ["BA-24", "BEC-24"]) {
      const placed = baseCabinet({
        uid: masterCode,
        masterCode,
        description: '24" Base End Cabinet',
        subCategory: "Standard Base",
        placement: "base",
        width: 24,
        height: 34.5,
        depth: 24,
        cornerType: null,
        customProfile: null,
        numberOfDoors: 2,
        numberOfDrawers: 0,
      });
      expect(resolveElevationFacePresentation(placed).cabinetType).toBe("end-angle");
      const markup = renderToStaticMarkup(
        createElement(LanguageProvider, null, createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets: [placed],
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
          doorSampleUrlFor: () => "https://example.com/selected-texture.webp",
        })),
      );
      expect(markup).toContain('data-bec-angled-end-face="true"');
      expect(markup.match(/data-bec-angled-(?:left|right)-door="8\.45in"/g)).toHaveLength(2);
      expect(markup).toContain("selected-texture.webp");
    }
  });

  it("renders the mixed BMC30 / BA-24 / FSB-36 run with its authored specialty faces", () => {
    const selectedDoor = "https://example.com/selected-aston-green.webp";
    const cabinets = [
      baseCabinet({
        uid: "bmc30",
        masterCode: "BMC30",
        description: '30" Microwave Base Cabinet',
        subCategory: "Microwave Base Cabinet",
        numberOfDoors: 0,
        numberOfDrawers: 1,
        drawerHeight: 12,
        openingType: "top",
        x: 0,
        width: 30,
      }),
      baseCabinet({
        uid: "ba24",
        masterCode: "BA-24",
        description: '24" Base End Angle Cabinet',
        subCategory: "Base End Cabinet",
        customProfile: "end-angle",
        x: 30,
      }),
      baseCabinet({
        uid: "fsb36",
        cabinetId: 9390043,
        masterCode: "FSB-36",
        description: '36" Farm Sink Base Cabinet',
        subCategory: "Sink Base",
        numberOfDoors: 2,
        x: 54,
        width: 36,
      }),
    ];
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets,
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
          countertopMaterialId: "white-quartz",
          doorSampleUrlFor: () => selectedDoor,
          drawerSampleUrlFor: () => selectedDoor,
        }),
      ),
    );

    expect(markup).toContain('data-microwave-base-opening="true"');
    expect(markup).toContain('data-microwave-base-drawer="true"');
    expect(markup).toContain('data-bec-angled-end-face="true"');
    expect(markup).toContain('data-bec-45-angle="true"');
    expect(markup).toContain('data-bec-angled-left-door="8.45in"');
    expect(markup).toContain('data-bec-angled-right-door="8.45in"');
    expect(markup).toContain('data-farm-sink-apron="true"');
    expect(markup).toContain('data-farm-sink-mounted="countertop"');
    expect(markup).toContain(`url(${selectedDoor})`);
  });

  it("does not invent door panels when a configured appliance opening has zero doors", () => {
    const markup = renderToStaticMarkup(
      createElement(DoorFront, {
        kind: "shaker",
        edge: "#314a35",
        face: "#9ab49a",
        cabinetType: "standard-door",
        doors: 0,
        drawers: 1,
        openingType: "top",
        drawerHeight: 12,
        cabinetWidthIn: 30,
        cabinetHeightIn: 30,
      }),
    );

    expect(markup).not.toContain('data-config-opening-door="true"');
    expect(markup).toContain('data-config-opening-drawer="true"');
  });

});
