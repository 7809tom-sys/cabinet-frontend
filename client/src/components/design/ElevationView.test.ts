import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CUSTOM_CABINET_PROFILES } from "@/lib/customCabinetProfiles";
import { CustomProfileFace, DoorFront, ElevationView, isBaseEndAngleCabinet, isRefrigeratorEndPanel, refrigeratorEndPanelRenderStyle, resolveElevationFacePresentation, SingleDoorPanel, StylePanel } from "./ElevationView";

	describe("measured base and range elevations", () => {
	  it("renders selected light rail beneath a standard wall cabinet even when its 54-inch mount is saved explicitly", () => {
	    const markup = renderToStaticMarkup(
	      createElement(LanguageProvider, null, createElement(ElevationView, {
	        room: { width: 144, depth: 120, ceilingHeight: 96 },
	        cabinets: [{ uid: "wall-with-light-rail", cabinetId: 80, masterCode: "W-24-30", description: '24" Wall Cabinet', placement: "wall", x: 0, y: 0, width: 24, height: 30, depth: 12, rotation: 0, mountBottom: 54, numberOfDoors: 2, numberOfDrawers: 0 }],
	        selectedUid: null,
	        onSelect: () => undefined,
	        wall: "back",
	        lightRail: true,
	      })),
	    );

	    expect(markup).toContain('data-testid="light-rail-strip"');
	    expect(markup).toContain("bottom:210px");
	  });

	  it("renders 2-DB30 as two equal 50/50 drawer fronts across the elevation face", () => {
    const markup = renderToStaticMarkup(createElement(DoorFront, {
      kind: "shaker",
      edge: "#1a2744",
      face: "#d8d4c8",
      cabinetType: "drawer-base",
      cabinetWidthIn: 30,
      cabinetHeightIn: 30,
      doors: 0,
      drawers: 2,
      masterCode: "2-DB30",
      drawerHeight: 14.5,
      drawerLayout: JSON.stringify([{ count: 1, height: 6 }, { count: 1, height: 23 }]),
    }));

    expect(markup.match(/height:50%/g)).toHaveLength(2);
    expect(markup).toContain("top:0%;height:50%");
    expect(markup).toContain("top:50%;height:50%");
  });

	  it("keeps a 34½-inch base envelope as a 30-inch face above a 4½-inch toe kick", () => {
	    const markup = renderToStaticMarkup(
	      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{ uid: "base-345", cabinetId: 81, masterCode: "B-24", description: '24" Base Cabinet', placement: "base", x: 0, y: 0, width: 24, height: 34.5, depth: 24, rotation: 0, numberOfDoors: 2, numberOfDrawers: 0 }],
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
      })),
    );

    // At the stable four-pixel-per-inch server render scale: 30" face = 120px,
    // 4½" toe kick = 18px, and the assembled envelope = 34½" / 138px.
	    expect(markup).toContain("bottom:18px;height:120px");
		    expect(markup).toContain("height:18px");
	  });

	  it("keeps a refrigerator-owned filler on the floor through the refrigerator top with no toe-kick strip", () => {
	    const markup = renderToStaticMarkup(
	      createElement(LanguageProvider, null, createElement(ElevationView, {
	        room: { width: 144, depth: 120, ceilingHeight: 96 },
	        cabinets: [{
	          uid: "fridge-side-filler", cabinetId: 84, masterCode: "F342", description: '3" Refrigerator-side filler',
	          category: "Filler", placement: "base", x: 0, y: 0, width: 3, height: 70, depth: 30, rotation: 0,
	          mountBottom: 0, fillerMatchesFullOwnerEnvelope: true, numberOfDoors: 0, numberOfDrawers: 0,
	        }],
	        selectedUid: null, onSelect: () => undefined, wall: "back",
	      })),
	    );

		    expect(markup).toContain("bottom:0;height:280px");
		    expect(markup).not.toContain('data-testid="continuous-toe-kick-run"');
		  });

		  it("renders selected backsplash only behind a short real countertop run, never across the open wall", () => {
		    const markup = renderToStaticMarkup(
		      createElement(LanguageProvider, null, createElement(ElevationView, {
		        room: { width: 120, depth: 96, ceilingHeight: 96 },
		        cabinets: [{
		          uid: "bbc-adjacent-base", cabinetId: 86, masterCode: "B24", description: '24" Base Cabinet',
		          placement: "base", x: 0, y: 0, width: 24, height: 34.5, depth: 24, rotation: 0,
		          numberOfDoors: 1, numberOfDrawers: 1,
		        }],
		        selectedUid: null, onSelect: () => undefined, wall: "back", backsplashMaterialId: "white-subway",
		      })),
		    );

		    // The static render's 4px/in scale makes the supported 24-inch run 96px.
		    expect(markup).toMatch(/data-testid="elevation-backsplash-segment"[^>]*data-backsplash-field-coverage="supported"[^>]*left:0;width:96px/);
		  });

		  it("repairs a legacy bridge-linked refrigerator cap filler before rendering its exact over-fridge envelope", () => {
		    const markup = renderToStaticMarkup(
		      createElement(LanguageProvider, null, createElement(ElevationView, {
		        room: { width: 144, depth: 120, ceilingHeight: 96 },
		        cabinets: [
		          {
		            uid: "legacy-fridge", cabinetId: 82, masterCode: "FRIDGE-36", description: "36 inch refrigerator",
		            placement: "appliance", x: 20, y: 0, width: 36, height: 70, depth: 30, rotation: 0, mountBottom: 0,
		          },
		          {
		            uid: "legacy-refrigerator-bridge", cabinetId: 84, masterCode: "WR3612", description: "Refrigerator cabinet above",
		            placement: "wall", x: 20, y: 0, width: 36, height: 12, depth: 24, rotation: 0, mountBottom: 72,
		            refrigeratorAssemblyId: "legacy-fridge", refrigeratorAssemblyRole: "bridge",
		          },
		          {
		            uid: "legacy-cap-filler", cabinetId: 85, masterCode: "F342", description: "Filler — cut to 1/2 inch", category: "Filler", subCategory: "Filler",
		            placement: "base", x: 19.5, y: 0, width: 0.5, height: 70, depth: 24, rotation: 0, mountBottom: 0,
		            fillerForCabinetUid: "legacy-refrigerator-bridge", numberOfDoors: 0, numberOfDrawers: 0,
		          },
		        ],
		        selectedUid: null, onSelect: () => undefined, wall: "back",
		      })),
		    );

		    // Four pixels per inch at the server-rendered test scale: both the
		    // bridge and its cap filler must run from 72 to 84 inches.
		    expect(markup.match(/bottom:288px;height:48px/g)).toHaveLength(2);
		    expect(markup).not.toContain("bottom:18px;height:262px");
		  });

		  it("shows installed filler measurement and an explicit over-maximum warning", () => {
		    const markup = renderToStaticMarkup(
	      createElement(LanguageProvider, null, createElement(ElevationView, {
	        room: { width: 144, depth: 120, ceilingHeight: 96 },
	        cabinets: [{ uid: "oversized-filler", cabinetId: 83, masterCode: "FILL-3", description: "Measured filler", placement: "base", x: 0, y: 0, width: 3.5, height: 34.5, depth: 24, rotation: 0, nominalWidth: 3 }],
	        selectedUid: null, onSelect: () => undefined, wall: "back",
	      })),
	    );

	    expect(markup).toContain('data-testid="elevation-filler-overmaximum"');
	    expect(markup).toContain('role="alert"');
	    expect(markup).toContain("OVER MAX");
	  });

  it("renders a rear-control range with a 34½-inch chassis plus a distinct raised backguard", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{ uid: "range-front", cabinetId: 82, masterCode: "RANGE-30", description: '30" Freestanding Range', placement: "appliance", x: 24, y: 0, width: 30, height: 36, depth: 25, rotation: 0 }],
        selectedUid: null,
        onSelect: () => undefined,
        wall: "back",
      })),
    );

    // 47" at 4px/in: the 34½" chassis remains countertop-height while the
    // rear-control backguard is visibly separate above it.
    expect(markup).toContain("height:188px");
    expect(markup).toContain('data-range-chassis="true"');
    expect(markup).toContain('data-range-rear-backguard="true"');
    expect(markup).not.toContain('aspect-ratio:1');
  });

  it("renders a selected Black Gas Range with a black procedural face and five gas knobs", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{ uid: "range-black-gas", cabinetId: 82, masterCode: "RANGE-30", description: '30" Black Gas Range', placement: "appliance", x: 24, y: 0, width: 30, height: 36, depth: 25, rotation: 0, catalogImageUrl: "/manus-storage/30inchWideBlackGasRange-silhouette_0a25e71c.webp" }],
        selectedUid: null, onSelect: () => undefined, wall: "back",
      })),
    );
    expect(markup).toContain('data-range-finish="black"');
    expect(markup).toContain('data-range-fuel="gas"');
    expect((markup.match(/data-range-control="gas-knob"/g) ?? [])).toHaveLength(5);
  });

  it("keeps a white front-control range at countertop height with no rear backguard", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{ uid: "range-white-front", cabinetId: 82, masterCode: "RANGE-30", description: '30" White Electric Front-Control Range', placement: "appliance", x: 24, y: 0, width: 30, height: 36, depth: 25, rotation: 0 }],
        selectedUid: null, onSelect: () => undefined, wall: "back",
      })),
    );
    expect(markup).toContain('data-range-finish="white"');
    expect(markup).toContain('data-range-control-position="front"');
    expect(markup).toContain('data-range-front-control-panel="true"');
    expect(markup).not.toContain('data-range-rear-backguard="true"');
    // A 36-inch range chassis renders at 4 px/in. The countertop top aligns
    // at 36 inches, so its visual chassis height is 144 px.
    expect(markup).toContain("height:144px");
  });
});

describe("end-angle elevation face", () => {
  it("keeps BEC-24 classified as an end cabinet even when its saved corner type is triangle", () => {
    expect(
      isBaseEndAngleCabinet({
        masterCode: "BEC-24",
        description: '24" Base End Angle Cabinet',
        category: "Base",
        cornerType: "triangle",
        isCornerCabinet: false,
      }),
    ).toBe(true);
  });

  it("does not classify an ordinary diagonal corner as a base end-angle cabinet", () => {
    expect(
      isBaseEndAngleCabinet({
        masterCode: "DCB-36",
        description: '36" Diagonal Corner Base Cabinet',
        category: "Base",
        cornerType: "diagonal",
        isCornerCabinet: true,
      }),
    ).toBe(false);
  });

  it("preserves an explicit end-angle Config as a non-corner 45-degree end-cabinet face", () => {
    const ba24 = {
      masterCode: "BA-24",
      description: '24" Base End Angle Cabinet',
      category: "Base",
      graphicType: "end-angle",
      width: 24,
      height: 34.5,
    };

    expect(resolveElevationFacePresentation(ba24, "end-angle", null).cabinetType).toBe("end-angle");
  });

  it("redraws a stale BA-24 placement as the confirmed single 45-degree end cabinet when refreshed Config supplies base_end_return", () => {
    const stalePlacedBa = {
      masterCode: "BA-24",
      description: "BA-24",
      category: "Base",
      subCategory: "Standard Base",
      width: 24,
      height: 34.5,
    };

    expect(resolveElevationFacePresentation(stalePlacedBa, "base_end_return", null).cabinetType).toBe("end-angle");
  });

  it("renders BEC-24 as two 8.45-inch doors meeting on its 17-inch 45-degree non-corner end face", () => {
    const markup = renderToStaticMarkup(
      createElement(DoorFront, {
        kind: "shaker",
        edge: "#1a2744",
        face: "#d8d4c8",
        doors: 2,
        drawers: 0,
        cabinetType: "end-angle",
        cabinetHeightIn: 34.5,
      }),
    );

    expect(markup).toContain('data-bec-angled-end-face="true"');
    expect(markup).toContain('data-bec-45-angle="true"');
    expect(markup).toContain('data-bec-angled-left-door="8.45in"');
    expect(markup).toContain('data-bec-angled-right-door="8.45in"');
    expect(markup).toContain('data-bec-angled-center-seam="true"');
    expect(markup).toContain("clip-path:polygon(0 5%, 100% 0, 100% 100%, 0 95%)");
  });
});

describe("Shaker elevation front rendering", () => {
  it("treats refrigerator end panels as floor-running architectural skins", () => {
    expect(isRefrigeratorEndPanel({ placement: "tall", masterCode: "REPV2496", description: "Refrigerator End Panel" })).toBe(true);
    expect(isRefrigeratorEndPanel({ placement: "tall", masterCode: "B33", description: "Base Cabinet" })).toBe(false);
    expect(isRefrigeratorEndPanel({ placement: "base", masterCode: "REPV2496", description: "Refrigerator End Panel" })).toBe(false);
  });

  it("keeps refrigerator end panels behind adjacent cabinet faces without a broad shadow", () => {
    expect(refrigeratorEndPanelRenderStyle()).toEqual({
      zIndex: 1,
      boxShadow: "inset 0 0 0 1px color-mix(in srgb, #000000 18%, transparent)",
    });
  });

  it("uses the catalog-backed MW-30 front instead of a gray placeholder", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(ElevationView, {
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        cabinets: [{ uid: "mw", cabinetId: 31, masterCode: "MW-30", description: "Over-Range Microwave", placement: "appliance", x: 30, y: 0, width: 30, height: 17, depth: 15, rotation: 0, mountBottom: 54 }],
        selectedUid: null, onSelect: () => undefined, wall: "back",
      })),
    );
    expect(markup).toContain('src="/manus-storage/zline_over_range_microwave_front_4976b7ab.webp"');
    expect(markup).not.toContain('MW-30</span>');
  });

  it("gives sink bases the same 20/80 drawer and door proportion as standard bases", () => {
    const markup = renderToStaticMarkup(createElement(DoorFront, {
      kind: "shaker", edge: "#1a2744", face: "#d8d4c8", cabinetType: "sink-base", cabinetWidthIn: 36, cabinetHeightIn: 34.5, doors: 2, drawers: 1,
    }));
    expect(markup).toContain("height:20%");
    expect(markup).toContain("top:20%");
    expect(markup).toContain("top:20%;bottom:0");
  });

  it("draws measured 3-inch Shaker stiles for 12-inch and 21-inch door faces", () => {
    const common = { kind: "shaker" as const, edge: "#1a2744", face: "#d8d4c8", stroke: "#1a274499" };
    const narrow = renderToStaticMarkup(createElement(SingleDoorPanel, { ...common, faceWidthIn: 12, faceHeightIn: 30 }));
    const wide = renderToStaticMarkup(createElement(SingleDoorPanel, { ...common, faceWidthIn: 21, faceHeightIn: 30 }));

    // 3in / 12in = 25% on each side, leaving a 6in (50%) center panel.
    expect(narrow).toContain("left:25%");
    expect(narrow).toContain("right:25%");
    // 3in / 21in = 14.2857% on each side, leaving a 15in center panel.
    expect(wide).toMatch(/left:14\.2857/);
    expect(wide).toMatch(/right:14\.2857/);
  });

  it("draws the Slim Shaker family’s one-inch rails and stiles for the same cabinet face", () => {
    const markup = renderToStaticMarkup(createElement(SingleDoorPanel, {
      kind: "slim-shaker", edge: "#1a2744", face: "#d8d4c8", stroke: "#1a274499", faceWidthIn: 12, faceHeightIn: 30,
    }));

    // The elevation scale is 4px/in, so Slim Shaker's 1-inch frame becomes a
    // four-pixel recessed inset instead of the generic 3-inch Shaker profile.
    expect(markup).toContain("inset:4px");
  });

  it("draws measured 3-inch top and bottom rails on a 12-inch partial-height Shaker drawer", () => {
    const markup = renderToStaticMarkup(
      createElement(StylePanel, {
        kind: "shaker",
        edge: "#1a2744",
        face: "#d8d4c8",
        drawer: true,
        faceWidthIn: 12,
        faceHeightIn: 12,
      }),
    );

    // 3in / 12in = 25% at the top and bottom, leaving a 6in drawer panel.
    expect(markup).toContain("top:25%");
    expect(markup).toContain("bottom:25%");
  });

  it("uses the selected real door sample across the measured Shaker rails and center panel", () => {
    const sampleUrl = "https://example.com/fresh-sage-real-door.webp";
    const markup = renderToStaticMarkup(
      createElement(SingleDoorPanel, {
        kind: "shaker",
        edge: "#557155",
        face: "#8FAF8A",
        stroke: "#55715599",
        doorSampleUrl: sampleUrl,
        faceWidthIn: 12,
        faceHeightIn: 30,
      }),
    );

    // The sample textures both the frame rails and the recessed 6in center,
    // while the 3in geometry remains intact.
    expect(markup).toContain(`url(${sampleUrl})`);
    expect((markup.match(new RegExp(`url\\(${sampleUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`, "g")) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(markup).toContain("left:25%");
    expect(markup).toContain("right:25%");
  });

  it("keeps real door and drawer samples inside the measured multi-face base, wall, pantry, and specialty layouts", () => {
    const doorSample = "https://example.com/real-door.webp";
    const drawerSample = "https://example.com/real-drawer.webp";
    const fixtures = [
      { label: "base", cabinetType: "standard-door" as const, cabinetWidthIn: 24, cabinetHeightIn: 34.5, doors: 2, drawers: 1, expectsDrawerSample: true },
      { label: "wall", cabinetType: "standard-door" as const, cabinetWidthIn: 24, cabinetHeightIn: 30, doors: 2, drawers: 0, isWall: true },
      { label: "pantry", cabinetType: "pantry" as const, cabinetWidthIn: 24, cabinetHeightIn: 84, doors: 4, drawers: 0 },
      { label: "sink", cabinetType: "sink-base" as const, cabinetWidthIn: 24, cabinetHeightIn: 34.5, doors: 2, drawers: 1 },
    ];

    for (const fixture of fixtures) {
      const markup = renderToStaticMarkup(
        createElement(DoorFront, {
          kind: "shaker",
          edge: "#557155",
          face: "#8FAF8A",
          doorSampleUrl: doorSample,
          drawerSampleUrl: drawerSample,
          ...fixture,
        }),
      );

      expect(markup, fixture.label).toContain(`url(${doorSample})`);
      expect(markup, fixture.label).toContain("left:25%");
      if (fixture.expectsDrawerSample) expect(markup, fixture.label).toContain(`url(${drawerSample})`);
    }
  });

  it("renders a 3-inch square frame through every representative cabinet-family path", () => {
    const cabinetFamilies = [
      { label: "base cabinet", cabinetType: "standard-door" as const, doors: 2, drawers: 1 },
      { label: "wall cabinet", cabinetType: "standard-door" as const, doors: 2, drawers: 0, isWall: true },
      { label: "tall pantry", cabinetType: "pantry" as const, doors: 2, drawers: 0 },
      { label: "drawer base", cabinetType: "drawer-base" as const, doors: 0, drawers: 3 },
      { label: "microwave base", cabinetType: "standard-door" as const, doors: 2, drawers: 1 },
      { label: "specialty end-angle cabinet", cabinetType: "end-angle" as const, doors: 2, drawers: 1 },
    ];

    for (const fixture of cabinetFamilies) {
      const markup = renderToStaticMarkup(
        createElement(DoorFront, {
          kind: "shaker",
          edge: "#1a2744",
          face: "#d8d4c8",
          cabinetHeightIn: fixture.cabinetType === "pantry" ? 90 : 34.5,
          ...fixture,
        }),
      );

      expect(markup, fixture.label).toMatch(/left:\d+(?:\.\d+)?%/);
      expect(markup, fixture.label).not.toContain("rounded-");
    }
  });

  it("keeps 3-inch stiles on the true 12-inch pantry and sink-base door faces", () => {
    const common = { kind: "shaker" as const, edge: "#1a2744", face: "#d8d4c8", cabinetWidthIn: 24, cabinetHeightIn: 84 };
    const pantry = renderToStaticMarkup(createElement(DoorFront, { ...common, cabinetType: "pantry", doors: 4 }));
    const sink = renderToStaticMarkup(createElement(DoorFront, { ...common, cabinetType: "sink-base", doors: 2 }));

    // Both paths split a 24in cabinet into 12in physical faces.
    expect(pantry).toContain("left:25%");
    expect(sink).toContain("left:25%");
  });
});

describe("configured Cabinet Config elevation presentation", () => {
  const specialtyCabinet = {
    masterCode: "WRB-30",
    description: '30" Wine Rack Base Cabinet',
    category: "Base",
  };

  it("keeps a saved generic drawing as a reference while retaining custom-rule vector geometry", () => {
    expect(
      resolveElevationFacePresentation(
        specialtyCabinet,
        "wine-rack",
        "https://example.com/configured-wine-rack.webp",
      ).renderMode,
    ).toBe("vector-profile");
  });

  it("retains the rule-specific vector fallback when no generic image is configured", () => {
    const presentation = resolveElevationFacePresentation(specialtyCabinet, "wine-rack", null);
    expect(presentation.renderMode).toBe("vector-profile");
    expect(presentation.cabinetType).toBe("standard-door");
  });

  it("keeps generic images out of appliances and standard cabinet geometry", () => {
    expect(
      resolveElevationFacePresentation(specialtyCabinet, "wine-rack", "https://example.com/image.webp", true).renderMode,
    ).toBe("standard");
    expect(
      resolveElevationFacePresentation({ masterCode: "B-24", category: "Base" }, null, "https://example.com/image.webp").renderMode,
    ).toBe("standard");
  });

  it("keeps BEC angled-end catalog drawings out of the live textured elevation container", () => {
    const imageUrl = "https://example.com/bec-24-configured-drawing.webp";
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets: [{
            uid: "bec-generic",
            cabinetId: 9450022,
            masterCode: "BEC-24",
            description: '24" Base End Angle Cabinet',
            category: "Base",
            placement: "base",
            x: 0,
            y: 0,
            width: 24,
            height: 34.5,
            depth: 24,
            rotation: 0,
            customProfile: "end-angle",
            genericDrawingUrl: imageUrl,
          }],
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
        }),
      ),
    );

    expect(markup).not.toContain(`src="${imageUrl}"`);
    expect(markup).toContain('data-bec-angled-end-face="true"');
    expect(markup).toContain('data-bec-45-angle="true"');
    expect(markup).toContain('data-bec-angled-center-seam="true"');
    expect(markup).toContain("clip-path:polygon(0 5%, 100% 0, 100% 100%, 0 95%)");
    expect(markup).toContain("width:96px");
  });
});

describe("configured corner elevation rendering", () => {
  const common = { kind: "shaker" as const, edge: "#1a2744", face: "#d8d4c8" };

  it("keeps selected real samples inside the measured end-return and corner specialty faces", () => {
    const doorSample = "https://example.com/real-corner-door.webp";
    const drawerSample = "https://example.com/real-corner-drawer.webp";
    const fixtures = [
      { label: "end return", cabinetType: "end-return" as const, doors: 2, drawers: 0, marker: 'data-bec-end-return-face="true"' },
      { label: "blind", cabinetType: "blind-corner" as const, doors: 1, drawers: 0, marker: "repeating-linear-gradient(135deg" },
      { label: "diagonal", cabinetType: "diagonal-corner" as const, doors: 2, drawers: 0, marker: "linear-gradient(225deg" },
      { label: "L corner", cabinetType: "l-corner" as const, doors: 1, drawers: 0, marker: "width:6%" },
      { label: "corner drawer", cabinetType: "corner-drawer-base" as const, doors: 0, drawers: 3, marker: "width:8%" },
    ];

    for (const fixture of fixtures) {
      const markup = renderToStaticMarkup(createElement(DoorFront, {
        ...common,
        ...fixture,
        cabinetWidthIn: 24,
        cabinetHeightIn: 34.5,
        doorSampleUrl: doorSample,
        drawerSampleUrl: drawerSample,
      }));
      expect(markup, fixture.label).toContain(fixture.marker);
      expect(markup, fixture.label).toContain(`url(${fixture.drawers > 0 ? drawerSample : doorSample})`);
    }
  });

  it("preserves explicit specialty face splits when realistic samples are enabled", () => {
    const doorSample = "https://example.com/split-door.webp";
    const drawerSample = "https://example.com/split-drawer.webp";
    const endReturn = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "end-return", doors: 2, cabinetWidthIn: 24, cabinetHeightIn: 34.5, doorSampleUrl: doorSample,
    }));
    const diagonal = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "diagonal-corner", doors: 2, cabinetWidthIn: 36, cabinetHeightIn: 34.5, doorSampleUrl: doorSample,
    }));
    const blind = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "blind-corner", doors: 1, cabinetWidthIn: 24, cabinetHeightIn: 34.5, doorSampleUrl: doorSample,
    }));
    const lCorner = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "l-corner", doors: 1, cabinetWidthIn: 24, cabinetHeightIn: 34.5, doorSampleUrl: doorSample,
    }));
    const cornerDrawer = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "corner-drawer-base", doors: 0, drawers: 3, cabinetWidthIn: 36, cabinetHeightIn: 34.5, drawerSampleUrl: drawerSample,
    }));
    const oven = renderToStaticMarkup(createElement(DoorFront, {
      ...common, cabinetType: "oven-tall", doors: 2, drawers: 1, cabinetWidthIn: 24, cabinetHeightIn: 90,
      openingType: "middle", doorHeight: 30, drawerHeight: 6, doorSampleUrl: doorSample, drawerSampleUrl: drawerSample,
    }));

    expect(endReturn).toContain("width:49%");
    expect(endReturn).toContain("width:43%");
    expect(diagonal).toContain("width:33%");
    expect(diagonal).toContain("left:15%");
    expect(blind).toContain("left:40%;width:60%");
    expect(lCorner).toContain("top-[3%] bottom-[3%] left-[3%] right-[3%]");
    expect(cornerDrawer).toContain("left:8%;right:0");
    expect(cornerDrawer).toContain("height:33.333333333333336%");
    expect(oven).toContain(`url(${doorSample})`);
    expect(oven).toContain(`url(${drawerSample})`);
    expect(oven).toContain("height:33.33333333333333%");
  });

  it("renders diagonal corners with a 45-degree face, configured shelves, and square Shaker doors", () => {
    const markup = renderToStaticMarkup(
      createElement(DoorFront, {
        ...common,
        cabinetType: "diagonal-corner",
        doors: 2,
        shelfCount: 2,
      }),
    );

    expect(markup).toContain("linear-gradient(135deg");
    expect(markup).toContain("linear-gradient(225deg");
    expect(markup).toContain("left-[14%] right-[14%] h-px");
    expect(markup).toMatch(/left:37\.8787/);
    expect(markup).not.toContain("rounded-");
  });

  it("keeps blind and L-corner elevations distinct from the diagonal face", () => {
    const blind = renderToStaticMarkup(
      createElement(DoorFront, { ...common, cabinetType: "blind-corner", doors: 1, blindOnLeft: true }),
    );
    const lazySusan = renderToStaticMarkup(
      createElement(DoorFront, { ...common, cabinetType: "l-corner", doors: 1 }),
    );

    expect(blind).toContain("repeating-linear-gradient(135deg");
    // 60% visible door on a 24in cabinet = 14.4in; 3in stile = 20.8333%.
    expect(blind).toMatch(/left:20\.8333/);
    expect(lazySusan).toContain("width:6%");
    // 94% of a 24in face = 22.56in; 3in stile = 13.2979%.
    expect(lazySusan).toMatch(/left:13\.2978/);
    expect(blind).not.toContain("linear-gradient(225deg");
    expect(lazySusan).not.toContain("linear-gradient(225deg");
  });

  it("renders WBC-27-42's three-inch integrated filler immediately left of its visible door", () => {
    const wbc = renderToStaticMarkup(
      createElement(DoorFront, {
        ...common,
        cabinetType: "blind-corner",
        doors: 1,
        blindOnLeft: true,
        cabinetWidthIn: 27,
        cabinetHeightIn: 42,
        masterCode: "WBC-27-42",
      }),
    );
    expect(wbc).toContain('data-wbc-integrated-filler="left-of-door"');
    expect(wbc).toContain("width:11.11111111111111%");
    expect(wbc).toContain("left:40%;width:60%");
    expect(wbc.indexOf('data-wbc-integrated-filler="left-of-door"')).toBeLessThan(wbc.indexOf("left:40%;width:60%"));

    const bbc = renderToStaticMarkup(
      createElement(DoorFront, { ...common, cabinetType: "blind-corner", doors: 1, blindOnLeft: true, masterCode: "BBC-36" }),
    );
    expect(bbc).not.toContain("data-wbc-integrated-filler");
  });
});

describe("non-standard Cabinet Config drawing contract", () => {
  const customFaceProps = { face: "#d8d4c8", edge: "#1a2744", kind: "shaker" as const, fixedShelves: 2, adjustableShelves: 1 };
  const configuredCabinet = { masterCode: "CUSTOM-30", description: '30" Configured Specialty Cabinet', category: "Specialty" };

  it("renders each saved custom profile through its dedicated 2D geometry", () => {
    const renderProfile = (profile: string) => renderToStaticMarkup(createElement(CustomProfileFace, { ...customFaceProps, profile }));

    expect(renderProfile("wine-rack")).toContain("<svg");
    expect(renderProfile("open-shelf-side-door")).toContain("w-[62%]");
    expect(renderProfile("open-shelf-side-door")).toMatch(/left:32\.8947/);
    expect(renderProfile("curved-open-shelf")).toContain("border-top-right-radius:42% 16%");
    expect(renderProfile("pullout-tower")).toContain("w-[3px]");
    expect(renderProfile("knee-drawer")).toContain("h-[21%]");
    expect(renderProfile("hood-wall-chimney")).toContain("clip-path:polygon(28% 0,72% 0,88% 65%,100% 100%,0 100%,12% 65%)");
    expect(renderProfile("wall_angle")).toContain('data-cabinet-profile="angled-wall"');
  });

  it("uses the selected real samples on custom side-door and knee-drawer faces", () => {
    const doorSample = "https://example.com/real-specialty-door.webp";
    const drawerSample = "https://example.com/real-specialty-drawer.webp";
    const sideDoor = renderToStaticMarkup(createElement(CustomProfileFace, {
      ...customFaceProps,
      profile: "open-shelf-side-door",
      doorSampleUrl: doorSample,
      faceWidthIn: 24,
      faceHeightIn: 34.5,
    }));
    const kneeDrawer = renderToStaticMarkup(createElement(CustomProfileFace, {
      ...customFaceProps,
      profile: "knee-drawer",
      drawerSampleUrl: drawerSample,
    }));

    expect(sideDoor).toContain(`url(${doorSample})`);
    expect(sideDoor).toContain("left:32.8947");
    expect(kneeDrawer).toContain(`url(${drawerSample})`);
    expect(kneeDrawer).toContain("h-[21%]");
  });

  it("uses the configured opening dimensions with the saved door and drawer layout", () => {
    const markup = renderToStaticMarkup(
      createElement(DoorFront, {
        kind: "shaker",
        edge: "#1a2744",
        face: "#d8d4c8",
        cabinetType: "oven-tall",
        cabinetHeightIn: 90,
        doors: 2,
        drawers: 1,
        openingType: "middle",
        doorHeight: 30,
        drawerHeight: 6,
      }),
    );

    expect(markup).toContain('alt="Single oven"');
    expect(markup).toContain("left:12.5%");
  });

  it("inherits physical Shaker face widths across oven-tall top, bottom, and middle opening paths", () => {
    for (const openingType of ["top", "bottom", "middle"] as const) {
      const markup = renderToStaticMarkup(
        createElement(DoorFront, {
          kind: "shaker",
          edge: "#1a2744",
          face: "#d8d4c8",
          cabinetType: "oven-tall",
          cabinetWidthIn: 24,
          cabinetHeightIn: 90,
          doors: 2,
          drawers: 1,
          openingType,
          doorHeight: 30,
          drawerHeight: 6,
        }),
      );

      // Each 12in upper door keeps two 3in stiles, leaving a 6in center panel.
      expect(markup, openingType).toContain("left:25%");
    }
  });

  it("keeps every saved Custom Cabinet Rule profile specification-derived when a reference image is present", () => {
    const imageUrl = "https://example.com/configured-profile.webp";
    const nonStandardProfiles = CUSTOM_CABINET_PROFILES.filter((profile) => profile.id !== "standard");

    expect(nonStandardProfiles.map((profile) => profile.id)).toEqual([
      "wall_angle",
      "end-angle",
      "generic-image",
      "open-shelf-side-door",
      "curved-open-shelf",
      "wine-rack",
      "pullout-tower",
      "knee-drawer",
      "hood-wall-chimney",
      "hood-insert",
    ]);

    for (const profile of nonStandardProfiles) {
      expect(
        resolveElevationFacePresentation(configuredCabinet, profile.id, imageUrl).renderMode,
        profile.id,
      ).toBe("vector-profile");
    }
  });

  it("provides a distinct vector shape for every profile that has one", () => {
    const vectorMarkers = {
      "open-shelf-side-door": "w-[62%]",
      "wall_angle": 'data-cabinet-profile="angled-wall"',
      "curved-open-shelf": "border-top-right-radius:42% 16%",
      "wine-rack": "<svg",
      "pullout-tower": "w-[3px]",
      "knee-drawer": "h-[21%]",
      "hood-wall-chimney": "clip-path:polygon(28% 0,72% 0,88% 65%,100% 100%,0 100%,12% 65%)",
      "hood-insert": "width:84%;height:34%",
    } as const;

    for (const [profile, marker] of Object.entries(vectorMarkers)) {
      const markup = renderToStaticMarkup(createElement(CustomProfileFace, { ...customFaceProps, profile }));
      expect(markup, profile).toContain(marker);
      expect(resolveElevationFacePresentation(configuredCabinet, profile, null).renderMode, profile).toBe("vector-profile");
    }
  });

  it("does not render a configured generic image as the actual elevation geometry", () => {
    const imageUrl = "https://example.com/generic-rule.webp";
    const markup = renderToStaticMarkup(
      createElement(
        LanguageProvider,
        null,
        createElement(ElevationView, {
          room: { width: 144, depth: 120, ceilingHeight: 96 },
          cabinets: [{
            uid: "generic-rule",
            cabinetId: 701,
            masterCode: "CUSTOM-24",
            description: '24" Custom Base Cabinet',
            category: "Base",
            placement: "base",
            x: 0,
            y: 0,
            width: 24,
            height: 34.5,
            depth: 24,
            rotation: 0,
            customProfile: "generic-image",
            genericDrawingUrl: imageUrl,
          }],
          selectedUid: null,
          onSelect: () => undefined,
          wall: "back",
        }),
      ),
    );

    expect(markup).not.toContain(`src="${imageUrl}"`);
    expect(markup).toContain("width:96px");
    expect(markup).not.toContain("clip-path:polygon(0 0");
  });
});
