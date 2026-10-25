import { describe, it, expect } from "vitest";
import {
  cabinetDrawingType,
  slugify,
  cabinetImageSlug,
  cabinetAltText,
  cabinetTypeLabel,
  resolveConfiguredFaceCounts,
  resolveDoorDrawerCounts,
  isEqualHeightTwoDrawerBase,
  isWallBlindCornerCabinet,
  threeDrawerBaseRowHeights,
  standardDoorCountForFaceWidth,
  baseSubGroup,
  resolvedVanityComboFaceLayout,
  type CabinetLike,
} from "./cabinetGraphics";

describe("vanity combo face contract", () => {
  it("resolves VDDB48 to three drawers on each side, two center doors, and a long drawer above", () => {
    expect(resolvedVanityComboFaceLayout({ masterCode: "VDDB48" })).toEqual({
      kind: "double-drawer-stack",
      sideDrawerCount: 3,
      centerDoorCount: 2,
      hasLongDrawerFront: true,
    });
  });

  it("does not map the distinct VDB48 vanity drawer base to the combo face", () => {
    expect(resolvedVanityComboFaceLayout({ masterCode: "VDB48" })).toBeNull();
  });
});

describe("wall blind-corner family", () => {
  it("recognizes every WBC height without classifying base blind corners", () => {
    expect(isWallBlindCornerCabinet({ masterCode: "WBC-27-30", description: null })).toBe(true);
    expect(isWallBlindCornerCabinet({ masterCode: "WBC-27-36", description: null })).toBe(true);
    expect(isWallBlindCornerCabinet({ masterCode: "WBC-27-42", description: null })).toBe(true);
    expect(isWallBlindCornerCabinet({ masterCode: "BBC-36", description: "Blind Corner Base" })).toBe(false);
  });
});

describe("two-drawer base family", () => {
  it.each(["2-DB18", "2-DB21", "2-DB24", "2-DB27", "2-DB30", "2-DB33", "2-DB36"])(
    "keeps %s as exactly two equal-height drawer fronts",
    (masterCode) => {
      expect(isEqualHeightTwoDrawerBase({ masterCode, numberOfDrawers: 2 })).toBe(true);
    },
  );

  it("does not change standard three-drawer or door-and-drawer bases", () => {
    expect(isEqualHeightTwoDrawerBase({ masterCode: "3-DB30", numberOfDrawers: 3 })).toBe(false);
    expect(isEqualHeightTwoDrawerBase({ masterCode: "B-30", numberOfDrawers: 1 })).toBe(false);
  });
});

describe("three-drawer base family", () => {
  it.each(["3-DB18", "3-DB21", "3-DB24", "3-DB27", "3-DB30", "3-DB33", "3-DB36"])(
    "keeps %s as one 6-inch top drawer over two equal lower drawers",
    (masterCode) => {
      expect(threeDrawerBaseRowHeights({ masterCode, numberOfDrawers: 3 }, 30)).toEqual([6, 12, 12]);
    },
  );

  it("does not apply the 3-DB rule to two-drawer, corner-drawer, or door-and-drawer cabinets", () => {
    expect(threeDrawerBaseRowHeights({ masterCode: "2-DB30", numberOfDrawers: 2 }, 30)).toBeNull();
    expect(threeDrawerBaseRowHeights({ masterCode: "CDB36", numberOfDrawers: 3 }, 30)).toBeNull();
    expect(threeDrawerBaseRowHeights({ masterCode: "B-30", numberOfDrawers: 1 }, 30)).toBeNull();
  });
});

describe("cabinetDrawingType", () => {

  it("renders the verified PLYEB42 plywood edge-banded board as a flat panel, not a tall cabinet", () => {
    expect(cabinetDrawingType({
      masterCode: "PLYEB42",
      description: "Designer Natural 42 in. Plywood Edge-Banded Board — 42 in. W × 96 in. H",
      category: "Panels",
      subCategory: "Plywood Edge-Banded Board",
      width: 42,
      height: 96,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    })).toBe("panel");
  });

  it("classifies RHF30 and RHF36 as catalog range hood fronts rather than appliance hoods or rectangular wall boxes", () => {
    for (const [masterCode, width, depth] of [["RHF30", 30, 9], ["RHF36", 36, 12]] as const) {
      const cabinet = {
        masterCode,
        description: "Range Hood Front",
        category: "Wall",
        subCategory: "Bridge / Stacker",
        width,
        height: 23.5,
        depth,
        numberOfDoors: 0,
        numberOfDrawers: 0,
      } satisfies CabinetLike;
      expect(cabinetDrawingType(cabinet)).toBe("range-hood-front");
      expect(cabinetTypeLabel(cabinet)).toBe("Range Hood Front");
      expect(cabinetAltText(cabinet)).toContain("shallow sloped two-door range hood front");
    }
  });

	  it("labels every AW height as an angled wall end cabinet rather than a diagonal corner", () => {
	    for (const masterCode of ["AW1230", "AW1236", "AW1242"]) {
	      const cabinet = {
	        masterCode,
	        description: `12\" Angled Wall End Cabinet`,
	        category: "Wall",
	        subCategory: "Wall End Cabinet",
	        graphicType: "wall_angle",
	        width: 12,
	        numberOfDoors: 1,
	      };
	      expect(cabinetDrawingType(cabinet)).toBe("wall-end-angle");
	      expect(cabinetTypeLabel(cabinet)).toBe("Angled Wall End Cabinet");
	      expect(cabinetAltText(cabinet)).toContain("angled wall end cabinet with one diagonal door");
	      expect(cabinetAltText(cabinet)).not.toContain("diagonal corner cabinet");
	    }
	  });

	  it("keeps vendor-prefixed DCW stacker cabinets as diagonal corner fronts", () => {
	    expect(cabinetDrawingType({
	      masterCode: "SW-DCW2412-GD",
	      description: '24" x 12" Diagonal Corner Wall Glass Door Cabinet',
	      category: "Wall",
	      subCategory: "Glass Door Wall",
	      width: "24",
	      numberOfDoors: 1,
	      numberOfDrawers: 0,
	    })).toBe("diagonal-corner");
	  });

  it("keeps explicit Cabinet Config zeroes instead of restoring generic door or drawer faces", () => {
    expect(resolveConfiguredFaceCounts({
      numberOfDoors: 0,
      numberOfDrawers: 1,
      hasConfiguredOpening: true,
      inferredDoors: 2,
      inferredDrawers: 3,
    })).toEqual({ doors: 0, drawers: 1 });
    expect(resolveConfiguredFaceCounts({
      numberOfDoors: null,
      numberOfDrawers: null,
      hasConfiguredOpening: false,
      inferredDoors: 2,
      inferredDrawers: 3,
    })).toEqual({ doors: 2, drawers: 3 });
  });

  it("honors authored microwave/open faces while BEC24 keeps its two-door end face", () => {
    expect(resolveDoorDrawerCounts({
      masterCode: "BMC-30",
      description: '30" Microwave Base Cabinet',
      subCategory: "Microwave Base Cabinet",
      numberOfDoors: 0,
      numberOfDrawers: 1,
      openingType: "top",
    })).toEqual({ doors: 0, drawers: 1 });
    expect(resolveDoorDrawerCounts({
      masterCode: "OPEN-24",
      description: '24" Open Shelf Base Cabinet',
      numberOfDoors: 0,
      numberOfDrawers: 0,
      facePattern: "open",
    })).toEqual({ doors: 0, drawers: 0 });
    expect(resolveDoorDrawerCounts({
      masterCode: "BEC-24",
      description: '24" Base End Cabinet — 45° Angled End, 1 Door',
      numberOfDoors: 1,
      numberOfDrawers: 0,
      graphicType: "end-angle",
    })).toEqual({ doors: 2, drawers: 0 });
  });

  it("classifies an all-drawer base as drawer-base", () => {
    const cab: CabinetLike = {
      masterCode: "DB-12-3",
      description: '12" Three Drawer Base Cabinet',
      category: "Base",
      subCategory: "Drawer Base",
      width: "12",
      numberOfDoors: 0,
      numberOfDrawers: 3,
    };
    expect(cabinetDrawingType(cab)).toBe("drawer-base");
  });

  it("classifies a sink base as sink-base", () => {
    const cab: CabinetLike = {
      masterCode: "SB-36",
      description: '36" Sink Base Cabinet',
      category: "Base",
      subCategory: "Sink Base",
      width: "36",
      numberOfDoors: 2,
    };
    expect(cabinetDrawingType(cab)).toBe("sink-base");
  });

  it("classifies a standard door base as standard-door", () => {
    const cab: CabinetLike = {
      masterCode: "B-18",
      description: '18" Base Cabinet',
      category: "Base",
      subCategory: "Base",
      width: "18",
      numberOfDoors: 1,
      numberOfDrawers: 1,
    };
    expect(cabinetDrawingType(cab)).toBe("standard-door");
  });

  it("uses the RS suffix to preserve or remove the base utility drawer exactly as coded", () => {
    const fullHeight = {
      masterCode: "B18FH2RS",
      description: '18" × 34.5" × 24" Full-Height Base Cabinet — No Drawer, 2 Roll-Out Shelves',
      category: "Base",
      subCategory: "Full Height",
      width: 18,
      numberOfDoors: 1,
      // A stale import must not put a top drawer back into this full-height unit.
      numberOfDrawers: 1,
    };
    expect(resolveDoorDrawerCounts(fullHeight)).toEqual({ doors: 1, drawers: 0 });
    expect(cabinetAltText(fullHeight)).toContain("no drawer and 2 roll-out shelves");

    const regularBase = {
      masterCode: "B121RS",
      description: '12" × 34.5" × 24" Base Cabinet — 1 Drawer, 1 Roll-Out Shelf',
      category: "Base",
      width: 12,
      numberOfDoors: 1,
      numberOfDrawers: 0,
    };
    expect(resolveDoorDrawerCounts(regularBase)).toEqual({ doors: 1, drawers: 1 });
    expect(cabinetAltText(regularBase)).toContain("1 drawer and 1 roll-out shelf");
  });

  it("uses the same accessible drawer-base drawing for either ADA code position", () => {
    const commonAdaDrawerFacts = {
      description: '15" × 32.5" × 24" ADA Three-Drawer Base Cabinet',
      category: "ADA",
      subCategory: "ADA Base",
      width: 15,
      height: 32.5,
      depth: 24,
      numberOfDoors: 0,
      numberOfDrawers: 3,
    };
    for (const masterCode of ["ADA-3DB15", "3DB15ADA"]) {
      const cabinet = { masterCode, ...commonAdaDrawerFacts };
      expect(cabinetDrawingType(cabinet)).toBe("drawer-base");
      expect(resolveDoorDrawerCounts(cabinet)).toEqual({ doors: 0, drawers: 3 });
      expect(baseSubGroup(cabinet)).toBe("specialty");
    }

    for (const masterCode of ["ADA-B12", "B12ADA"]) {
      const cabinet = {
        masterCode,
        description: '12" × 32.5" × 24" ADA Accessible Base Cabinet — 1 Door, 1 Drawer, 1 Shelf',
        category: "ADA",
        subCategory: "ADA Base",
        width: 12,
        height: 32.5,
        depth: 24,
        numberOfDoors: 1,
        numberOfDrawers: 1,
      };
      expect(cabinetDrawingType(cabinet)).toBe("ada");
      expect(resolveDoorDrawerCounts(cabinet)).toEqual({ doors: 1, drawers: 1 });
    }
  });

  it("classifies a glass wall cabinet as glass-door", () => {
    const cab: CabinetLike = {
      masterCode: "W-30-GD",
      description: '30" Wall Cabinet with Glass Door',
      category: "Wall",
      width: "30",
      numberOfDoors: 2,
    };
    expect(cabinetDrawingType(cab)).toBe("glass-door");
  });

  it("classifies a diagonal corner wall as diagonal-corner", () => {
    const cab: CabinetLike = {
      masterCode: "DCW-24-30",
      description: "Diagonal Corner Wall Cabinet",
      category: "Wall",
      width: "24",
      isCornerCabinet: true,
    };
    expect(cabinetDrawingType(cab)).toBe("diagonal-corner");
  });

  it("names BEC24 as a square double-door end cabinet, even with stale angled Config", () => {
    const cab: CabinetLike = {
      masterCode: "BEC24",
      description: '24" W x 34-1/2" H x 24" D Base End Cabinet — Quarter-Octagon Shape, 2 Doors',
      category: "Base",
      subCategory: "Base End Cabinet",
      width: "24",
      height: "34.5",
      depth: "24",
      numberOfDoors: 2,
      isCornerCabinet: false,
      graphicType: "base-end-quarter-octagon",
    };
    expect(cabinetDrawingType(cab)).toBe("standard-door");
    expect(cabinetTypeLabel(cab)).toBe("Square Double-Door Base End Cabinet");
    expect(cabinetAltText(cab)).toContain("two doors on one flat front");
    expect(resolveDoorDrawerCounts(cab)).toEqual({ doors: 2, drawers: 0 });
    expect(baseSubGroup(cab)).toBe("specialty");
  });

  it("honors Cabinet Config corner types for otherwise neutral cabinet records", () => {
    const base = { masterCode: "CUSTOM-36", description: '36" Configured Base Cabinet', category: "Base" };
    expect(cabinetDrawingType({ ...base, cornerType: "diagonal" })).toBe("diagonal-corner");
    expect(cabinetDrawingType({ ...base, cornerType: "blind-corner" })).toBe("blind-corner");
    expect(cabinetDrawingType({ ...base, cornerType: "lazy-susan" })).toBe("l-corner");
  });

  it("keeps both BEC24 spellings square, preserving unrelated BA-24 angled geometry", () => {
    for (const masterCode of ["BEC-24", "BEC24"]) {
      const cabinet = {
        masterCode,
        description: '24" Base End Cabinet — 45° Angled End, 1 Door',
        category: "Base",
        subCategory: "Base End Cabinet",
        width: 24,
        height: 34.5,
        depth: 24,
        numberOfDoors: 1,
        numberOfDrawers: 0,
        isCornerCabinet: false,
        graphicType: "end-angle",
      };
      expect(cabinetDrawingType(cabinet)).toBe("standard-door");
      expect(cabinetTypeLabel(cabinet)).toBe("Square Double-Door Base End Cabinet");
      expect(resolveDoorDrawerCounts(cabinet)).toEqual({ doors: 2, drawers: 0 });
    }
    expect(cabinetDrawingType({ masterCode: "BA-24", description: "Base End Cabinet", graphicType: "end-angle" })).toBe("end-angle");
  });

  it("ignores legacy BEC end-return metadata without changing BA-24 or AW", () => {
    expect(cabinetDrawingType({
      masterCode: "BEC-24",
      description: '24" Base End Cabinet — 45° Angled End, 1 Door',
      category: "Base",
      subCategory: "Base End Cabinet",
      width: 24,
      height: 34.5,
      depth: 24,
      numberOfDoors: 1,
      numberOfDrawers: 0,
      graphicType: "base_end_return",
    })).toBe("standard-door");
  });

  it("uses the user-created Base End Cabinet subcategory as an authoritative end-return signal", () => {
    expect(cabinetDrawingType({
      masterCode: "CUSTOM-END-24",
      description: '24" Base Cabinet',
      category: "Base",
      subCategory: "Base End Cabinet",
    })).toBe("end-angle");
  });

  it("classifies an appliance garage before generic wall logic", () => {
    const cab: CabinetLike = {
      masterCode: "AG-24",
      description: '24" Appliance Garage with Tambour Door',
      category: "Wall",
      width: "24",
    };
    expect(cabinetDrawingType(cab)).toBe("appliance-garage");
  });

  it("classifies Chrome Tray and plate-rack codes as their own reusable structural art", () => {
    expect(cabinetDrawingType({
      masterCode: "CHROME TRAY 33",
      description: "Chrome Tray Insert for ERB33 Easy-Reach Corner Cabinet",
      category: "Accessory",
      subCategory: "Lazy Susan Insert",
    })).toBe("lazy-susan-tray");

    expect(cabinetDrawingType({
      masterCode: "PR3015",
      description: '30" × 15" × 12" Wall Plate Rack Cabinet',
      category: "Wall",
      subCategory: "Bridge / Stacker",
      width: 30,
      height: 15,
      depth: 12,
    })).toBe("face-pattern");
  });

  it("classifies WMS3018 as an open wall microwave cabinet kit rather than a door cabinet", () => {
    const wms = {
      masterCode: "WMS3018",
      description: '30" × 18" × 12" Wall Microwave Cabinet Kit with 26½" × ¾" × 17" Shelf Insert',
      category: "Wall",
      subCategory: "Microwave Wall",
      width: 30,
      height: 18,
      depth: 12,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } satisfies CabinetLike;
    expect(cabinetDrawingType(wms)).toBe("wall-microwave-kit");
    expect(cabinetTypeLabel(wms)).toBe("Wall Microwave Cabinet Kit");
    expect(cabinetAltText(wms)).toContain("open wall microwave cabinet kit with shelf insert");
  });

  it("keeps the separately sold WMSSHELF insert distinct from the WMS3018 cabinet kit", () => {
    const shelf = {
      masterCode: "WMSSHELF",
      description: '26½" × ¾" × 17" Wall Microwave Cabinet Shelf Insert',
      category: "Accessory",
      subCategory: "Shelf Insert",
      width: 26.5,
      height: 0.75,
      depth: 17,
      numberOfDoors: 0,
      numberOfDrawers: 0,
    } satisfies CabinetLike;
    expect(cabinetDrawingType(shelf)).toBe("shelf-insert");
    expect(cabinetTypeLabel(shelf)).toBe("Microwave Cabinet Shelf Insert");
    expect(cabinetAltText(shelf)).toContain("individual shelf insert for a wall microwave cabinet kit");
  });

  it("classifies crown molding as accessory-strip", () => {
    const cab: CabinetLike = {
      masterCode: "CM-96",
      description: "96in Crown Molding",
      category: "Accessory",
      subCategory: "Molding",
    };
    expect(cabinetDrawingType(cab)).toBe("accessory-strip");
  });

  it("classifies an ADA unit as ada", () => {
    const cab: CabinetLike = {
      masterCode: "ADA-B-30",
      description: '30" ADA Base Cabinet',
      category: "ADA",
      width: "30",
      numberOfDoors: 2,
    };
    expect(cabinetDrawingType(cab)).toBe("ada");
  });

  it("classifies a vanity unit as vanity", () => {
    const cab: CabinetLike = {
      masterCode: "VAN-36",
      description: '36" Vanity Cabinet',
      category: "Vanity",
      width: "36",
      numberOfDoors: 2,
    };
    expect(cabinetDrawingType(cab)).toBe("vanity");
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Drawer Base 12")).toBe("drawer-base-12");
  });
  it("drops inch marks and collapses repeats", () => {
    expect(slugify('12"  Three  Drawer')).toBe("12-three-drawer");
  });
  it("trims leading/trailing hyphens", () => {
    expect(slugify("--Hello--")).toBe("hello");
  });
});

describe("cabinetImageSlug", () => {
  it("combines description and master code", () => {
    const cab: CabinetLike = {
      masterCode: "DB-12-3",
      description: '12" Three Drawer Base Cabinet',
    };
    expect(cabinetImageSlug(cab)).toBe("12-three-drawer-base-cabinet-db-12-3");
  });
  it("falls back to code when description missing", () => {
    const cab: CabinetLike = { masterCode: "X-9" };
    expect(cabinetImageSlug(cab)).toBe("x-9");
  });
});

describe("cabinetAltText", () => {
  it("includes name, code, and a type-specific detail", () => {
    const cab: CabinetLike = {
      masterCode: "DB-12-3",
      description: '12" Three Drawer Base Cabinet',
      category: "Base",
      subCategory: "Drawer Base",
      width: "12",
      numberOfDrawers: 3,
      numberOfDoors: 0,
    };
    const alt = cabinetAltText(cab);
    expect(alt).toContain("DB-12-3");
    expect(alt).toContain("3-drawer base cabinet");
  });

  it("describes sink base front", () => {
    const cab: CabinetLike = {
      masterCode: "SB-36",
      description: '36" Sink Base',
      category: "Base",
      subCategory: "Sink Base",
      width: "36",
      numberOfDoors: 2,
    };
    expect(cabinetAltText(cab)).toContain("sink base cabinet");
  });

  it("labels a lazy-Susan corner base by its mechanism, not 'blind corner'", () => {
    const cab: CabinetLike = {
      masterCode: "LSB36",
      description: '36" Base Easy Reach with Lazy Susan Cabinet',
      category: "Base",
      subCategory: "ADA Lazy Susan Base",
      width: "36",
      isCornerCabinet: true,
    };
    const alt = cabinetAltText(cab);
    expect(alt).toContain("LSB36");
    expect(alt).toContain("lazy-Susan corner base cabinet");
    expect(alt).toContain("diagonal front");
    expect(alt).not.toContain("blind corner cabinet");
  });

  it("labels an easy-reach corner base distinctly", () => {
    const cab: CabinetLike = {
      masterCode: "ERB-33",
      description: '33" Base Easy Reach Cabinet',
      category: "Base",
      subCategory: "Easy Reach Corner Base",
      width: "33",
      isCornerCabinet: true,
    };
    expect(cabinetAltText(cab)).toContain("easy-reach corner base cabinet");
  });
});

describe("cabinetDrawingType — real cabinet families never become accessory strips", () => {
  it("does not classify a Base cabinet described with 'Adjustable Shelf' as accessory", () => {
    const cab: CabinetLike = {
      masterCode: "B-24",
      description: '24" Double Door Single Drawer Base Cabinet with Adjustable Shelf',
      category: "Base",
      subCategory: "Single Door Base",
      width: "24",
      numberOfDoors: 2,
      numberOfDrawers: 1,
    };
    expect(cabinetDrawingType(cab)).toBe("standard-door");
    expect(cabinetAltText(cab)).not.toContain("accessory / trim");
  });

  it("B-18 'Single Door Single Drawer Base ... with Adjustable Shelf' classifies as a real cabinet when category is carried (placed-cabinet regression)", () => {
    // Regression: a PlacedCabinet built from the palette now carries `category`,
    // so the selected-cabinet preview no longer mislabels a normal base box as
    // "accessory / trim" just because its description mentions "Shelf".
    const placed: CabinetLike = {
      masterCode: "B-18",
      description: '18" Single Door Single Drawer Base Cabinet with Adjustable Shelf',
      category: "Base",
      subCategory: "Single Door Base",
      width: "18",
      numberOfDoors: 1,
      numberOfDrawers: 1,
    };
    expect(cabinetDrawingType(placed)).toBe("standard-door");
    expect(cabinetAltText(placed)).not.toContain("accessory / trim");
    expect(cabinetAltText(placed)).toContain("1-door cabinet");
  });

  it("keeps the exact B-18 standard base as one drawer over one door even when stale saved counts say two drawers", () => {
    expect(resolveDoorDrawerCounts({
      masterCode: "B-18",
      description: "Base Cabinet",
      placementType: "base",
      width: 18,
      numberOfDoors: 0,
      numberOfDrawers: 2,
      graphicType: "standard_base",
    })).toEqual({ doors: 1, drawers: 1 });
  });

  it("does not classify a Wall cabinet mentioning 'panel' as accessory", () => {
    const cab: CabinetLike = {
      masterCode: "W-30-30",
      description: '30" Double Door Wall Cabinet with Raised Panel Doors',
      category: "Wall",
      subCategory: "Double Door Wall",
      width: "30",
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    expect(cabinetDrawingType(cab)).toBe("standard-door");
  });

  it("still classifies a true Accessory filler as accessory-strip", () => {
    const cab: CabinetLike = {
      masterCode: "BF-3",
      description: '3" Base Filler',
      category: "Accessory",
      subCategory: "Trim & Molding",
      width: "3",
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    expect(cabinetDrawingType(cab)).toBe("accessory-strip");
  });
});

describe("door-count agreement: label + drawing follow the description, not a wrong subCategory", () => {
  it("uses one standard door at 21 inches and two equal standard doors above 21 inches", () => {
    expect(standardDoorCountForFaceWidth(21)).toBe(1);
    expect(standardDoorCountForFaceWidth(21.01)).toBe(2);
    expect(resolveDoorDrawerCounts({ masterCode: "W-21", description: '21" Wall Cabinet', width: 21 })).toEqual({ doors: 1, drawers: 0 });
    expect(resolveDoorDrawerCounts({ masterCode: "W-22", description: '22" Wall Cabinet', width: 22 })).toEqual({ doors: 2, drawers: 0 });
  });

  // Reported bug: a single-door wall whose subCategory is mislabeled
  // "Double Door Wall". The drawing, the resolved count, and the visible
  // tag must all agree on ONE door.
  it("single-door wall mislabeled 'Double Door Wall' resolves to 1 door + 'Single Door Wall'", () => {
    const cab: CabinetLike = {
      masterCode: "W-12-30",
      description: '12" Single Door Wall Cabinet',
      category: "Wall",
      subCategory: "Double Door Wall", // <- wrong catalog tag
      width: "12",
      numberOfDoors: 2, // <- wrong numeric field too
      numberOfDrawers: 0,
    };
    expect(resolveDoorDrawerCounts(cab).doors).toBe(1);
    expect(cabinetTypeLabel(cab)).toBe("Single Door Wall");
  });

  it("true double-door wall resolves to 2 doors + 'Double Door Wall'", () => {
    const cab: CabinetLike = {
      masterCode: "W-30-30",
      description: '30" Double Door Wall Cabinet',
      category: "Wall",
      subCategory: "Double Door Wall",
      width: "30",
      numberOfDoors: 2,
      numberOfDrawers: 0,
    };
    expect(resolveDoorDrawerCounts(cab).doors).toBe(2);
    expect(cabinetTypeLabel(cab)).toBe("Double Door Wall");
  });

  it("label tracks the same door count the drawing uses (no description hint -> width fallback)", () => {
    const cab: CabinetLike = {
      masterCode: "W-18-30",
      description: '18" Wall Cabinet', // no door word -> width<24 => 1 door
      category: "Wall",
      subCategory: "Double Door Wall",
      width: "18",
      numberOfDoors: 0,
      numberOfDrawers: 0,
    };
    const { doors } = resolveDoorDrawerCounts(cab);
    expect(doors).toBe(1);
    expect(cabinetTypeLabel(cab)).toBe("Single Door Wall");
  });
});

describe("baseSubGroup (designer Base tab ordering)", () => {
  it("classifies a plain door base as base", () => {
    expect(
      baseSubGroup({
        masterCode: "B-24",
        description: '24" Two Door Base Cabinet',
        category: "Base",
        numberOfDoors: 2,
        numberOfDrawers: 1,
      }),
    ).toBe("base");
  });

  it("classifies a full-height base in the dedicated Full Height section", () => {
    expect(
      baseSubGroup({
        masterCode: "B-30FH",
        description: '30" Full Height Base Cabinet',
        category: "Base",
        numberOfDoors: 2,
        numberOfDrawers: 0,
      }),
    ).toBe("full-height");
  });

  it("classifies an all-drawer base as drawer", () => {
    expect(
      baseSubGroup({
        masterCode: "DB-12-3",
        description: '12" Three Drawer Base Cabinet',
        category: "Base",
        subCategory: "Drawer Base",
        numberOfDoors: 0,
        numberOfDrawers: 3,
      }),
    ).toBe("drawer");
  });

  it("classifies a sink base as sink", () => {
    expect(
      baseSubGroup({
        masterCode: "SB-36",
        description: '36" Sink Base Cabinet',
        category: "Base",
        subCategory: "Sink Base",
        numberOfDoors: 2,
      }),
    ).toBe("sink");
  });

  it("classifies a farmhouse sink base as sink", () => {
    expect(
      baseSubGroup({
        masterCode: "FSB-36",
        description: '36" Farmhouse Sink Base',
        category: "Base",
      }),
    ).toBe("sink");
  });

  it("classifies a blind/lazy-susan corner base as specialty", () => {
    expect(
      baseSubGroup({
        masterCode: "BBC-42",
        description: '42" Blind Corner Base Cabinet',
        category: "Base",
        isCornerCabinet: true,
      }),
    ).toBe("specialty");
  });

  it("classifies a microwave base as specialty", () => {
    expect(
      baseSubGroup({
        masterCode: "BMW-30",
        description: '30" Base Microwave Cabinet',
        category: "Base",
      }),
    ).toBe("specialty");
  });

  it("classifies a spice pull-out base as specialty", () => {
    expect(
      baseSubGroup({
        masterCode: "SPB-9",
        description: '9" Spice Pull-Out Base',
        category: "Base",
      }),
    ).toBe("specialty");
  });

  // Regression: a standard door base whose DESCRIPTION contains the substring
  // "...Single Drawer Base Cabinet" must NOT be mistaken for a drawer base. These
  // are the regular bases (B-12..B-42) that were wrongly hidden under the Drawer
  // Bases group instead of the Base Cabinets group.
  it("classifies a door + single drawer base as base (not drawer)", () => {
    expect(
      baseSubGroup({
        masterCode: "B-24",
        description: '24" Double Door Single Drawer Base Cabinet with Adjustable Shelf',
        category: "Base",
        subCategory: "Single Door Base",
        numberOfDoors: 2,
        numberOfDrawers: 1,
      }),
    ).toBe("base");
  });

  // Regression: some rows are mis-tagged subCategory="Drawer Base" but are really
  // single-door full-height bases (BFH-12/15/18). They must live only in the
  // dedicated Full Height section.
  it("classifies a single-door BFH base mis-tagged as Drawer Base as full height", () => {
    expect(
      baseSubGroup({
        masterCode: "BFH-12",
        description: '12" Full Height Single Door Base Cabinet',
        category: "Base",
        subCategory: "Drawer Base",
        numberOfDoors: 1,
        numberOfDrawers: 0,
      }),
    ).toBe("full-height");
  });

  it("recognizes compact and distributor full-height base code families", () => {
    for (const masterCode of ["B12FH", "B15FHD", "B18FHTD", "B18FH1RS", "B21FH2RS", "B36FH3RS", "B18FHTCPO", "TFHB-21", "HB-24"]) {
      expect(
        baseSubGroup({
          masterCode,
          description: 'Full Height Base Cabinet',
          category: "Base",
          numberOfDoors: 1,
          numberOfDrawers: 0,
        }),
      ).toBe("full-height");
    }
  });

  it("keeps a full-height vanity sink cabinet in Sink Bases", () => {
    expect(
      baseSubGroup({
        masterCode: "BFH-30",
        description: '30" Full Height Door Vanity Sink Cabinet',
        category: "Base",
      }),
    ).toBe("sink");
  });

  it("sink wins over drawer when a sink base also has drawers", () => {
    expect(
      baseSubGroup({
        masterCode: "SB-36-D",
        description: '36" Sink Base with Drawers',
        category: "Base",
        numberOfDoors: 0,
        numberOfDrawers: 2,
      }),
    ).toBe("sink");
  });
});
