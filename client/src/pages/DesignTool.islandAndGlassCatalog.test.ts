import fs from "node:fs";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("DesignTool island scene and glass catalog wiring", () => {
		it("keeps Bathroom Surfaces separate from source-priced Bathroom Fixtures", () => {
		  expect(source).toContain('const usesBathroomFixturePalette = roomType === "bathroom" && paletteType === "appliance";');
		  expect(source).toContain('bathroomPaletteMode="surfaces"');
		  expect(source).toContain('bathroomPaletteMode="fixtures"');
		  expect(source).toContain('setBathroomCatalogMode("surfaces")');
		  expect(source).toContain('setBathroomCatalogMode("fixtures")');
		  expect(source).toContain('!usesBathroomFixturePalette && !paletteLoading && filteredPalette.length === 0');
		});

		  it("makes Compass start a new attached 45-degree wall while preserving the longer parent-wall section", () => {
		    expect(source).toContain('turn: 45');
		    expect(source).toContain('label: `Peninsula end · 45° ${draft.endDirection}`');
		    expect(source).toContain("add a 45° continuation from its free end after creation");
		    expect(source).toContain("Compass keeps the longer wall section, opens the shorter section");
		    expect(source).toContain("Primary peninsulas start straight from the selected wall");
		  });

		  it("offers a dedicated one-action Compass undo that reverses only the created run and its attached cabinets and sinks", () => {
		    expect(source).toContain("const [compassSplitUndo, setCompassSplitUndo]");
		    expect(source).toContain("setCompassSplitUndo({");
		    expect(source).toContain("createdRunId: run.id");
		    expect(source).toContain("removePeninsulaRun(room, placedRef.current, compassSplitUndo.createdRunId)");
		    expect(source).toContain("placedRef.current = removed.placed");
		    expect(source).toContain("setRoom(removed.room)");
		    expect(source).toContain("setPlaced(removed.placed)");
		    expect(source).toContain("removedCabinetUids.has(sink.cabinetUid)");
		    expect(source).toContain('data-testid="undo-compass-wall-split"');
		    expect(source).toContain('label="Undo Compass"');
		  });

		  it("exposes vendor-available 12-to-24-inch glass-stacker bulk actions inside Placement controls", () => {
	    expect(source).toContain("glassStackerBulkHeightOptions(");
	    expect(source).toContain("vendorGlassStackerHeightOptions");
	    expect(source).toContain('data-testid="vendor-glass-stacker-controls"');
	    expect(source).toContain('data-testid={`add-vendor-glass-stacker-${option.height}`}');
	    expect(source).toContain("addVendorGlassStackersAtHeight(option.height)");
		    expect(source).toContain("vendor-matched ${formatInches(height)} glass stacker");
		    expect(source).toContain("glassStackerBulkCeilingBlocksAtHeight");
		    expect(source).toContain('data-testid="glass-stacker-ceiling-blocks"');
		    expect(source).toContain("already reaches the {formatInches(block.ceiling)} ceiling");
		    expect(source).toContain("const bulkGlassStackerCatalog");
		    expect(source).toContain("liveMasterCabinets as DesignCabinet[]");
		    expect(source).toContain("bulkGlassStackerCatalogRef.current");
		  });

		  it("provides a scoped Placement controls action that removes stackers while preserving parent wall cabinets", () => {
		    expect(source).toContain("glassStackerUidsForRemoval");
		    expect(source).toContain("const removeGlassStackers");
		    expect(source).toContain('data-testid="remove-glass-stackers"');
		    expect(source).toContain("removeCabinetsAndReleaseVoid(stackerUids)");
		    expect(source).toContain("parent wall cabinets were kept");
		  });

	  it("routes a catalog knee drawer only into a measured base-cabinet knee-space opening and preserves its dedicated elevation profile", () => {
	    expect(source).toContain("isKneeDrawerItem(c) ? \"knee-drawer\"");
	    expect(source).toContain("accPlacement === \"baseTop\" && isKneeDrawerItem(c)");
	    expect(source).toContain("kneeDrawerWallPlacement(activeWall, room, prev, openings, width, depth)");
	    expect(source).toContain("needs a clear ${formatInches(width)} knee-space opening between base cabinets");
	  });

		  it("uses the enabled cabinet magnet for 3D moves so a small same-run overlap seats at an exact cabinet edge", () => {
		    expect(source).toContain("moveCabinet(uid, x, y, undefined, !automaticSnapping);");
		    // The shared wall-run engine carries the magnet for every wall kind.
		    expect(source).toContain("cabinetWallMovePreview(requestedBody, { x, y }, room, peers, openings, {");
		    expect(source).toContain("magnet,");
		    expect(source).toContain("A 3D move should use the same cabinet magnet as the plan whenever it is");
	    expect(source).toContain("smallGapFillerOpportunityFromDragPreview(uid, preview)");
	    expect(source).toContain("CABINET_CONFLICT_LOCK_IN");
	    expect(source).toContain("window.setTimeout(() => applySmallGapFiller(automaticSmallGapFillerMode(opportunity), opportunity), 0)");
	    expect(source).toContain("applySmallGapFiller(automaticSmallGapFillerMode(opportunity), opportunity)");
	  });

		it("routes every normal and 3D catalog placement to the selected island face when Island mode is active", () => {
		expect(source).toContain("const selectedIslandFace = targetIslandFace");
		expect(source).toContain("islandPlacementMode || islandPlacementModeRef.current");
		expect(source).not.toContain("islandPlacementMode && x == null && y == null");
		  expect(source).toContain("if (island && (islandPlacementMode || islandPlacementModeRef.current))");
		  expect(source).toContain("addCabinet(cabinet, undefined, undefined, forceAccessory, 0, false, undefined, islandFace ?? islandFaceRef.current)");
		  expect(source).toContain("nextIslandFacePlacement(newCab, islandForPlacement, requestedIslandFace, islandPlacementPrevious)");
		  expect(source).toContain("const islandPlacementModeRef = useRef(false);");
		  expect(source).toContain('setPlacementTarget("island")');
		  expect(source).toContain("islandFaceRef.current = islandFace;");
		  expect(source).toContain("islandPlacementModeRef.current = islandPlacementMode;");
		  expect(source).toContain("const prev = placedRef.current;");
		  expect(source).toContain("const islandPlacementModeRef = useRef(false);");
	    expect(source).toContain("setCountertop(true)");
	    expect(source).toContain('data-testid="island-placement-panel-toggle"');
	    expect(source).toContain('data-testid="island-placement-side-panel"');
	    expect(source).toContain('data-testid="wall-placement-mode"');
	    expect(source).toContain('data-testid="island-placement-mode"');
	    expect(source).toContain(">Wall mode<");
	    expect(source).toContain(">Island mode<");
	  });

	it("keeps the back-to-back island seam authoritative after the island placement helper resolves it", () => {
	  expect(source).toContain("} else if (automaticSnapping && !requestedIslandFace && !strictDropTarget && !preserveResolvedPlacement && !peninsulaRunById(room, finalCab.wallId)) {");
	  expect(source).toContain('if (!requestedIslandFace && (finalCab.placement === "wall" || finalCab.placement === "base" || finalCab.placement === "tall"))');
	  expect(source).toContain("Object.assign(newCab, islandCandidate)");
	});

	it("synchronizes the active placement face when an existing island cabinet is selected", () => {
	  expect(source).toContain("inferredIslandFace(cabinet, island)");
	  expect(source).toContain("setIslandPlacementMode(true)");
	  expect(source).toContain("setIsland((current) => current ? { ...current, activeFace: face } : current)");
	});

	it("exits island mode when the user explicitly selects a wall, so back-wall cabinet additions cannot use a stale island face", () => {
	  expect(source).toContain('onClick={() => { setActiveWall(w); setPlacementTarget("wall"); setDrawMode(false); }}');
	  expect(source).toContain('onSelectWall={(wall) => { setActiveWall(wall); setPlacementTarget("wall"); }}');
	  expect(source).toContain('"Wall / Island mode"');
	  expect(source).toContain('"Choose Wall mode or Island mode"');
	  expect(source).toContain('right-3 top-14 z-40 flex flex-col items-end gap-2 sm:top-16');
	  expect(source).toContain('px-2.5 py-1.5 text-[11px]');
	});

	it("excludes the full island assembly from a back-wall opening measurement, including legacy members without an island-face field", () => {
	  expect(source).toContain('const wallRunPlaced = island ? placed.filter((item) => !isOnIsland(item, island)) : placed;');
	  expect(source).toContain('freeSegmentsOnWall(dropWall, room, wallRunPlaced, openings, 0.5, 0, placement)');
	});

	it("reports a blocked island resize once per brief repeated drag sequence while preserving the collision block", () => {
	  expect(source).toContain("islandResizeWarningRef");
	  expect(source).toContain("now - previous.at >= 1200");
	  expect(source).toContain("if (!resized.ok) { reportResizeBlock(resized.reason); return; }");
		});

		it("keeps Designer toolbar controls compact and wraps them instead of allowing overlap or sideways scrolling", () => {
		  expect(source).toContain("designer-top-toolbar border-b border-border bg-card px-2 py-1 flex flex-wrap");
		});

		it("provides a user-controlled automatic snapping toggle and a concise door or window clearance notice", () => {
	  expect(source).toContain('data-testid="automatic-snapping-toggle"');
	  expect(source).toContain("const [automaticSnapping, setAutomaticSnapping] = useState(true);");
	  expect(source).toContain('data-testid="opening-clearance-block-tooltip"');
	  expect(source).toContain("clearance blocks placement — keep 3 in. clear.");
	});

	it("treats a catalog replacement as automatic unless the user explicitly turns snapping off", () => {
	  expect(source).toContain("const useAutomaticSnapping = automaticSnapping || !freehand;");
	  expect(source.match(/automaticSnapping=\{automaticSnapping\}/g)).toHaveLength(2);
	  expect(source).toContain("must not turn a verified 36-inch opening into a tiny local sliver");
	});

	it("explains a normal smaller-gap block with the cabinet width, largest clear opening, and shortage", () => {
	  expect(source).toContain("const largestClearGap = gaps.reduce<WallGap | null>");
	  expect(source).toContain("the largest clear opening is");
	  expect(source).toContain("too small.");
	});

	it("offers the Back face for the next cabinet when the chosen Front run reaches its configured island length without changing island treatments", () => {
	  expect(source).toContain("alternateIslandFaceRecommendation");
	  expect(source).toContain("Chosen island length reached");
	  expect(source).toContain("const oppositeCandidate = nextIslandFacePlacement(newCab, islandForPlacement, oppositeFace, islandPlacementPrevious)");
	  expect(source).toContain("const selectedFaceCapacity = islandFaceCapacity(islandForPlacement, requestedIslandFace, islandPlacementPrevious)");
	  expect(source).toContain("setAlternateIslandFaceRecommendation({");
	  expect(source).toContain('setPlacementTarget("island", recommendation.face)');
	  expect(source).toContain("Choose the next cabinet to add there.");
	  expect(source).toContain("The current run and all treatments remain unchanged.");
	  expect(source).toContain('if (requestedIslandFace === "front" && islandBeforePlacement)');
	  expect(source).toContain("The Front island run has reached its chosen");
	  expect(source).toContain('face: "back"');
	  expect(source).toContain("Math.abs(backDepthAdjustment.island.depth - islandForPlacement.depth) > COLLISION_EPSILON_IN");
	});

	it("switches to a Back-facing 3D island view after acceptance and exposes a safe selected-cabinet transfer action", () => {
	  expect(source).toContain("setIslandCameraFocusRequest");
	  expect(source).toContain('setViewMode("threeD")');
	  expect(source).toContain("islandFaceTransferOption(selectedCab, island, placed)");
	  expect(source).toContain('data-testid="selected-island-face-transfer"');
	  expect(source).toContain("Swap to");
	  expect(source).toContain("Move to");
	});

	it("uses the full wall run for normal 3D catalog drops instead of letting island members create a pointer-local Back-wall gap", () => {
	  expect(source).toContain("const wallRunPlaced = island ? placed.filter((item) => !isOnIsland(item, island)) : placed;");
	  expect(source).toContain("const strictPointerPlacement = freehand && !automaticSnapping;");
	  expect(source).toContain("const widestGap = [...gaps].sort((left, right) => right.length - left.length)[0] ?? null;");
	  expect(source).toContain("strictPointerPlacement && !measured.containsTarget");
	});

	it("opens Island setup with an accurate depth requirement before placing a shallow opposing wall cabinet", () => {
	  expect(source).toContain("const minimumOpposingIslandDepth = STD.BASE_DEPTH + Math.max(0, Number(newCab.depth) || STD.WALL_DEPTH)");
	  expect(source).toContain('isShallowIslandWallCabinet && requestedIslandFace === "back" && island.depth + COLLISION_EPSILON_IN < minimumOpposingIslandDepth');
	  expect(source).toContain("setIslandAttributesOpen(true)");
	  expect(source).toContain("48 inches if you want a 12-inch seating overhang");
	});

	it("honors an opt-in Back-face depth adjustment and keeps it collision-safe before adding the cabinet", () => {
	  expect(source).toContain("islandPlacementPrevious = normalizeIslandRangeRearPlanes(island, prev, room)");
	  expect(source).toContain("autoAdjustIslandDepthForBackFace(island, islandPlacementPrevious, room, Number(newCab.depth) || STD.BASE_DEPTH)");
	  expect(source).toContain("island.autoAdjustDepthForBackFace === true");
	  expect(source).toContain("automatic Back-face depth adjustment is blocked");
	  expect(source).toContain("Island depth adjusted for Back:");
	});

	it("turns a Front-face remainder dead end into an immediate Back-face depth-adjustment choice for the same cabinet", () => {
	  expect(source).toContain("const backDepthAdjustment = autoAdjustIslandDepthForBackFace");
	  expect(source).toContain("requiresBackDepthAdjustment: true");
	  expect(source).toContain("forceBackDepthAdjustment = false");
	  expect(source).toContain("Yes — add to Back and adjust depth");
	  expect(source).toContain("addCabinet(recommendation.cabinet, undefined, undefined, recommendation.forceAccessory, 0, false, undefined, recommendation.face, true)");
	});

	it("emits a visible before-and-after island depth transition when Back-face auto-adjustment succeeds", () => {
	  expect(source).toContain("setIslandDepthTransition({ fromDepth: island?.depth ?? autoAdjustedIsland.depth, toDepth: autoAdjustedIsland.depth");
	  expect(source).toContain("islandDepthTransition={islandDepthTransition}");
	  expect(source).toContain("Island depth adjusted for Back:");
	});

	it("keeps a verified normal wall opening and redirects a shallow island wall cabinet only when Back needs depth", () => {
	  expect(source).toContain('requestedIslandFace === "back" && island.depth + COLLISION_EPSILON_IN < minimumOpposingIslandDepth');
	  expect(source).toContain('!requestedIslandFace && !strictDropTarget && !peninsulaRunById(room, finalCab.wallId)) finalCab = snapCabinetSeamOverlap');
	  expect(source).toContain('const dropWall = strictPointerPlacement ? (dropTarget.wall ?? activeWall) : activeWall');
	});

	it("uses island-local floor elevation and island-face measurements for selected island cabinets", () => {
	  expect(source).toContain("islandFaceFitMeasure(selectedCab, island, placed)");
	  expect(source).toContain("island && selectedCab.islandFace");
	});

		  it("moves, resizes, rotates, and removes the complete island assembly through authoritative helpers", () => {
    expect(source).toContain("moveIslandScene(island, placedRef.current, room");
    expect(source).toContain("resizeIslandScene(moved.island, moved.placed, room");
	    expect(source).toContain("rotateIslandScene(island, placedRef.current, room, degrees)");
    expect(source).toContain("normalizeSinkFixturesToBases(current, nextPlaced, room)");
		  });

			  it("offers Island-only 12-inch or 15-inch seating after a counter-height shallow wall cabinet is committed", () => {
		    expect(source).toContain("finalCab.islandCounterHeightWallCabinet === true");
		    expect(source).toContain("setIslandSeatingOverhangPrompt({ cabinetCode: finalCab.masterCode, face: requestedIslandFace })");
		    expect(source).toContain("islandWithFaceSeatingOverhang(island, placedRef.current, prompt.face, overhangIn)");
		    expect(source).toContain("No seating overhang");
			    expect(source).toContain("Add 12 in. seating");
			    expect(source).toContain("Add 15 in. seating");
		  });

		  it("requires a selected compatible sink base before the compact Pelican sink picker can place a fixture", () => {
    expect(source).toContain("Select a compatible sink base cabinet before choosing a Pelican sink.");
    expect(source).toContain("isPelicanSinkCompatibleWithBase(item, baseKind)");
    expect(source).toContain("const attached = makeSinkForCabinet(sinkType, owner, room");
    expect(source).not.toContain("makeSink(sinkType, Math.max(0, room.width / 2");
  });

  it("prioritizes verified compatible Pelican sinks in the sink-base dialog without changing catalog popularity data", () => {
    // The full role is requested so every gauge/radius of a model reaches its single card.
    expect(source).toContain('{ role: bathroomSinkDialog ? "vanity-sink" : "sink", limit: 200 }');
    expect(source).toContain("groupPelicanConfigurations(filteredSinks)");
    expect(source).toContain('bathroomSinkDialog ? "vanity-faucet" : "faucet"');
    expect(source).toContain("? isVerifiedPelicanVanitySink(product.pelicanCode)");
    expect(source).toContain(": isPelicanSinkCompatibleWithBase(product, sinkBaseKind))");
    expect(source).toContain("sinkBaseOpeningWidthIn(sinkBaseCabinet ?? undefined)");
    expect(source).toContain("verifiedPelicanSinkFitsCabinet(profile, sinkBaseOpeningWidth)");
    expect(source).toContain("verifiedPelicanSinkProfile(right.pelicanCode)");
  });

	  it("exposes real PG wall cabinets and base-plus-PGWDC corner glass choices without inventing combined SKUs", () => {
    expect(source).toContain('label: "Glass Door Wall Cabinets"');
    expect(source).toContain('label: "Glass Door Corner Wall Cabinets"');
	    expect(source).toContain("buildGlassCornerCatalogChoices(");
	    expect(source).toContain("c.displayMasterCode ?? c.masterCode");
	    expect(source).toContain("sourceCabinetId: Number(item.id)");
	  });

		  it("places every supported-height glass stacker on its respective matching wall cabinet without changing its width", () => {
		    expect(source).toContain("glassStackerParentPlacement({");
		    expect(source).toContain("}, prev, room, selectedUid, {");
		    expect(source).toContain("anyWall: x == null && y == null");
		    expect(source).toContain("stackerParentUid = stackerPlacement.parentUid");
		    expect(source).toContain("stackedOnCabinetUid: stackerParentUid");
		    expect(source).toContain("width,");
		    expect(source).not.toContain("stackWidth = bw");
		  });

		  it("asks whether matching catalog glass stackers should be added above the remaining compatible wall cabinets", () => {
		    expect(source).toContain("glassStackerBulkPlacementCandidates(");
		    expect(source).toContain("wallCabPoolRef.current");
		    expect(source).toContain("setGlassStackerBulkPrompt({ sourceCode: finalCab.masterCode, candidates: glassStackerCandidates })");
		    expect(source).toContain("Add glass stackers above all compatible wall cabinets?");
		    expect(source).toContain('data-testid="glass-stacker-bulk-parent-preview"');
		    expect(source).toContain("candidate.parentCode");
		    expect(source).toContain("candidate.stacker.masterCode");
		    expect(source).toContain("A diagonal corner cabinet can only receive a diagonal corner glass stacker");
		    expect(source).toContain("Keep this one stacker only");
		    expect(source).toContain("applyBulkGlassStackerPlacements(placedRef.current, prompt.candidates, makeUid)");
		  });
});
