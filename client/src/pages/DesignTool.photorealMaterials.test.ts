import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveSwatch } from "@/components/DoorStyleSwatch";
import { designerApprovedFaceUrl, designerFacePlan } from "@/lib/designerFacePlan";

const designToolSource = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const facePlanSource = readFileSync(new URL("../lib/designerFacePlan.ts", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
const surfacesPickerSource = readFileSync(new URL("../components/design/SurfacesPickerDialog.tsx", import.meta.url), "utf8");

describe("Designer programmed photoreal material wiring", () => {
  it("uses Administration imagery as the cabinet source and the uploaded sample as the face", () => {
    expect(designToolSource).toContain("return designerFacePlan(s, \"base\");");
    expect(designToolSource).not.toContain("RUSTIC_HICKORY_GRAIN_URL");
    expect(designToolSource).not.toContain("rustic hickory|forest rust");
    expect(designToolSource).not.toContain("rustic_hickory_vertical_grain");
    expect(facePlanSource).toContain("function designerFacePlan(");
    expect(facePlanSource).toContain("export function designerApprovedFaceUrl(");
    expect(facePlanSource).toContain("const doorUrl = preferredDoorReferenceUrl(style);");
    expect(facePlanSource).toContain("const drawerReference = preferredDrawerReferenceUrl(style);");
    expect(facePlanSource).not.toContain("rustic_hickory");
    expect(facePlanSource).not.toContain("RUSTIC_HICKORY");
    expect(designToolSource).toContain("catalogDoorSampleUrl={active3DDoorSampleUrl}");
    expect(designToolSource).toContain("photoUrl={paletteFinishSwatch}");
  });

  it("treats an uploaded sample as the approved face and does not invent a grain texture", () => {
    const forestRust = {
      ourName: "Forest Rust",
      aliasName: "Ashford",
      styleCode: "RH",
      distributorId: 210001,
      approvedReferenceImageUrl: null,
      doorSampleImageUrl: "/uploads/forest-rust-door.jpg",
      drawerSampleImageUrl: "/uploads/forest-rust-drawer.jpg",
      thumbnailImageUrl: "/uploads/forest-rust-thumb.jpg",
    };
    expect(designerApprovedFaceUrl(forestRust)).toBe("/uploads/forest-rust-door.jpg");
    const withSample = designerFacePlan(forestRust, "base");
    expect(withSample?.doorUrl).toBe("/uploads/forest-rust-door.jpg");
    expect(withSample?.drawerUrl).toBe("/uploads/forest-rust-drawer.jpg");
    expect(JSON.stringify(withSample)).not.toContain("rustic_hickory");

    const thumbnailOnly = {
      ...forestRust,
      doorSampleImageUrl: "  ",
      drawerSampleImageUrl: null,
      thumbnailImageUrl: "/uploads/forest-rust-thumb.jpg",
    };
    expect(designerApprovedFaceUrl(thumbnailOnly)).toBe("/uploads/forest-rust-thumb.jpg");
    expect(designerFacePlan(thumbnailOnly, "wall")?.doorUrl).toBe("/uploads/forest-rust-thumb.jpg");

    const noSample = {
      ourName: "Rustic Hickory",
      aliasName: "Forest Rust",
      approvedReferenceImageUrl: " ",
      doorSampleImageUrl: "",
      thumbnailImageUrl: null,
    };
    expect(designerApprovedFaceUrl(noSample)).toBeNull();
    const empty = designerFacePlan(noSample, "base");
    expect(empty?.doorUrl).toBeNull();
    expect(empty?.drawerUrl).toBeNull();
    expect(JSON.stringify(empty)).not.toContain("rustic_hickory");
    expect(JSON.stringify(empty)).not.toContain("/textures/");

    const alreadyApproved = {
      ourName: "Forest Rust",
      approvedReferenceImageUrl: "/approved/forest-rust.png",
      doorSampleImageUrl: "/uploads/forest-rust-door.jpg",
      drawerSampleImageUrl: "/uploads/forest-rust-drawer.jpg",
    };
    const approvedPlan = designerFacePlan(alreadyApproved, "base");
    expect(designerApprovedFaceUrl(alreadyApproved)).toBe("/approved/forest-rust.png");
    expect(approvedPlan?.doorUrl).toBe("/approved/forest-rust.png");
    expect(approvedPlan?.drawerUrl).toBe("/approved/forest-rust.png");

    const dlWithSample = {
      distributorId: 450001,
      ourName: "Cyber Grey",
      styleCode: "DL-CG",
      approvedReferenceImageUrl: null,
      doorSampleImageUrl: "/uploads/cyber-grey-door.jpg",
      thumbnailImageUrl: null,
    };
    expect(designerFacePlan(dlWithSample, "base")?.dlcCrop?.slug).toBe("cyber-grey");
  });

  it("paints a Forest Rust swatch rust and leaves forest green green", () => {
    expect(resolveSwatch({ ourName: "Forest Rust" }).face.toLowerCase()).toBe("#b5603a");
    expect(resolveSwatch({ ourName: "Sage Rust", color: "sage" }).face.toLowerCase()).toBe("#b5603a");
    expect(resolveSwatch({ ourName: "forest green" }).face.toLowerCase()).toBe("#56685b");
    expect(resolveSwatch({ ourName: "Rustic Hickory" }).face.toLowerCase()).toBe("#a07850");
    expect(resolveSwatch({ ourName: "Forest Rust", swColor: "#112233" }).face.toLowerCase()).toBe("#112233");
    expect(resolveSwatch({ ourName: "Forest Rust", color: "#abc" }).face.toLowerCase()).toBe("#aabbcc");
  });

	  it("keeps all staged catalog imagery out of 3D texture props while providing verified Astoria, Bahia, and Acorn flooring maps", () => {
	    expect(designToolSource).toContain("return [...prev.filter((surface) => surfaceRole(surface) !== \"flooring\"), item];");
	    expect(designToolSource).toContain("const activeFloor = [...prev].reverse().find((surface) => surfaceRole(surface) === \"flooring\");");
	    expect(designToolSource).toContain("? [...selectedSurfaces].reverse().find((surface) => surfaceRole(surface) === \"flooring\")?.id === item.id");
	    expect(designToolSource).toContain("normalizeFinalMaterialSelections");
	    expect(designToolSource).toContain("const restoredSurfaces = normalizeInstalledMaterialSelections(d.selectedSurfaces as SelectedSurface[]);");
	    expect(designToolSource).toContain("const surfaces = normalizeInstalledMaterialSelections(Array.isArray(d.selectedSurfaces) ? d.selectedSurfaces : []);");
	    expect(designToolSource).toContain("return [...prev.filter((surface) => surfaceRole(surface) !== \"backsplash\"), { ...item, threeDActive: true }];");
	    expect(designToolSource).not.toContain("Preserve every selected tile in the quote");
	    expect(designToolSource).toContain('? perimeterCountertopSurface');
	    expect(designToolSource).toContain("const activeFlooringSurface = useMemo(");
	    expect(designToolSource).toContain("const activeBacksplashSurface = useMemo(");
	    expect(designToolSource).toContain("activeThreeDSurface(selectedSurfaces.filter((surface) => surfaceRole(surface) === \"backsplash\"))");
	    expect(designToolSource).toContain("role === \"flooring\" ? activeFlooringSurface : activeBacksplashSurface");
	    expect(designToolSource).toContain("key={`active-surfaces-${threeDSurfaceProductIds.flooring ?? \"none\"}");
	    expect(designToolSource).toContain("threeDSurfaceProductIds.backsplash");
	    expect(designToolSource).toContain("82: \"/manus-storage/bahia_12mil_7x48_staggered_floor_551c6d5b.webp\"");
	    expect(designToolSource).toContain("40: \"/manus-storage/acorn_20mil_7_5x48_staggered_floor_3dbd212f.webp\"");
	    expect(designToolSource).toContain("54: \"/manus-storage/astoria_22mil_9x60_staggered_floor_cd0a1cf7.webp\"");
	    expect(designToolSource).not.toContain("?? selected.imageUrl");
    expect(designToolSource).toContain('key={`active-surfaces-${threeDSurfaceProductIds.flooring ?? "none"}-${threeDSurfaceTextureUrls.flooring ?? "pending"}-${backsplashEnabled ? threeDSurfaceProductIds.backsplash ?? "none" : "off"}-${backsplashEnabled ? threeDSurfaceTextureUrls.backsplash ?? "pending" : "off"}`}');
    expect(designToolSource).toContain('key={`active-surfaces-full-${threeDSurfaceProductIds.flooring ?? "none"}-${threeDSurfaceTextureUrls.flooring ?? "pending"}-${backsplashEnabled ? threeDSurfaceProductIds.backsplash ?? "none" : "off"}-${backsplashEnabled ? threeDSurfaceTextureUrls.backsplash ?? "pending" : "off"}`}');
	    expect(designToolSource).toContain("Catalog product cards can be staged-room or retail photographs");
    expect(designToolSource).toContain("catalogCountertopImageUrl={threeDSurfaceTextureUrls.countertop}");
    expect(designToolSource).toContain("catalogFlooringImageUrl={threeDSurfaceTextureUrls.flooring}");
    expect(designToolSource).toContain("catalogFlooringCategory={threeDFlooringProductMetadata?.category}");
    expect(designToolSource).toContain("catalogFlooringSubCategory={threeDFlooringProductMetadata?.subCategory}");
	    expect(designToolSource).toContain("catalogFlooringSize={threeDFlooringProductMetadata?.size}");
    expect(designToolSource).toContain("catalogBacksplashImageUrl={backsplashEnabled ? threeDSurfaceTextureUrls.backsplash : null}");
	    expect(rendererSource).toContain('threeDProductMaterialSource("backsplash", catalogBacksplashName, catalogBacksplashImageUrl, {');
	    expect(rendererSource).toContain("productId: catalogBacksplashProductId");
	    expect(designToolSource).toContain("const threeDSurfaceProductIds = useMemo(() =>");
	    expect(designToolSource).toContain("catalogCountertopProductId={threeDSurfaceProductIds.countertop}");
	    expect(designToolSource).toContain("catalogIslandCountertopProductId={threeDIslandCountertop.productId}");
	    expect(designToolSource).toContain("catalogIslandCountertopImageUrl={threeDIslandCountertop.imageUrl}");
	    expect(designToolSource).toContain("catalogIslandCountertopColor={threeDIslandCountertop.color}");
    expect(designToolSource).toContain("catalogFlooringProductId={threeDSurfaceProductIds.flooring}");
    expect(designToolSource).toContain("catalogBacksplashProductId={backsplashEnabled ? threeDSurfaceProductIds.backsplash : null}");
	    expect(designToolSource).toContain("activeThreeDBacksplashId={activeBacksplashSurface?.id ?? null}");
	    expect(designToolSource).toContain("onSetActiveThreeDBacksplash={setActiveBacksplashSurface}");
	    expect(designToolSource).toContain("const removeFlooring = useCallback(() => {");
	    expect(designToolSource).toContain('surfaceRole(surface) !== "flooring"');
	    expect(designToolSource).toContain('data-testid="remove-flooring-control"');
	    expect(designToolSource).toContain("Flooring removed from this design");
	    expect(surfacesPickerSource).toContain('data-testid={`surface-use-in-3d-${p.id}`}');
	    expect(surfacesPickerSource).toContain('"Use in 3D wall"');
	    expect(designToolSource).toContain("savedDesignId={currentSavedDesignId ?? null}");
	    expect(designToolSource).toContain("selectedSurfaceIdsForMaterialRefresh");
	    expect(designToolSource).toContain("trpc.surfaces.designerByIds.useQuery");
	    expect(designToolSource).toContain("refreshVerifiedSurfaceSelections(current, verifiedSelectedSurfaceRecords)");
	    expect(designToolSource).toContain("isSuccess: verifiedSelectedSurfacesLoaded");
	    expect(designToolSource).not.toContain("nextMaterialImageUrl = product.materialImageUrl?.trim() || surface.materialImageUrl || null");
	    expect(designToolSource).toContain("Older saved designs and the opt-in Surfaces hand-off persisted the product");
	    expect(designToolSource).toContain("onToggle={(item) => {");
    expect(designToolSource).toContain('if (role === "flooring" || role === "backsplash" || role === "countertop" || role === "sink" || role === "faucet")');
    expect(designToolSource).toContain("addRecommendedSurface(item, role);");
	    expect(rendererSource).toContain('materialOnlyNoGeometryChange: true');
	    expect(rendererSource).toContain("catalogIslandCountertopImageUrl ?? catalogCountertopImageUrl");
	    expect(rendererSource).toContain("catalogIslandCountertopColor ?? materialDefaults.countertop");
    expect(rendererSource).toContain('authoritativeWebsiteProductImage: !source.proceduralFallback');
    expect(rendererSource).toContain('representativePreview: source.proceduralFallback');
    expect(rendererSource).toContain('usesAuthoritativeProductImage: Boolean(floorSource && !floorSource.proceduralFallback)');
    expect(rendererSource).toContain('curatedSurfaceKey: source.key');
    expect(rendererSource).toContain('worldSlabMapped: Boolean(mappedCountertopTexture?.userData?.worldSlabMapped)');
    expect(rendererSource).toContain('source.flooringPatternKind === "plank"');
    expect(rendererSource).toContain("normalizedThreeDPlankImage(");
    expect(rendererSource).toContain("threeDBacksplashSegments(placed, openings, backsplashRoom, backsplashHeightMode, countertopBacksplashHeightIn)");
    expect(rendererSource).toContain("addThreeDBacksplash(catalogRoot, backsplashSegments, backsplashRoom, backsplashTexture)");
    expect(rendererSource).toContain('backsplashRenderedOnMeasuredSurfaces: backsplashSegments.length');
    expect(rendererSource).toContain('countertopUpstandRenderedOnSupportedSurfaces: countertopUpstandSegments.length');
    expect(rendererSource).toContain('measuredBacksplash: true');
  });

  it("tiles the selected backsplash product image and sends that image with the room scene", () => {
    expect(designToolSource).toContain("selectedBacksplashTextureUrl");
    expect(designToolSource).toContain('if (role === "backsplash") return selectedBacksplashTextureUrl(selected).url;');
    expect(designToolSource).toContain("catalogBacksplashReferenceUrl={backsplashEnabled ? threeDSurfaceTextureUrls.backsplash : null}");
    expect(designToolSource).toContain("catalogBacksplashSize={backsplashEnabled ? activeBacksplashSurface?.size ?? null : null}");
    expect(designToolSource).toContain("backsplashImageUrl: selectedBacksplashTextureUrl(backsplashSurf).url || undefined");
    expect(designToolSource).toContain("backsplashImageUrl={backsplashEnabled ? threeDSurfaceTextureUrls.backsplash : null}");
    expect(rendererSource).toContain('data-testid="backsplash-texture-warning"');
    expect(rendererSource).toContain("textureUnavailable");
    expect(rendererSource).toContain("BACKSPLASH_ROOM_SCENE_FIDELITY");
    expect(rendererSource).toContain("resolveDesignerMaterialUrl");
  });

  it("keeps the corrected photographic exposure below neutral after the washed-out mobile regression", () => {
    expect(rendererSource).toContain("renderer.toneMappingExposure = studioLights.exposure");
    expect(rendererSource).toContain("new THREE.HemisphereLight(studioLights.hemisphere.sky, studioLights.hemisphere.ground, studioLights.hemisphere.intensity)");
    expect(rendererSource).toContain("new THREE.DirectionalLight(studioLights.key.color, studioLights.key.intensity)");
    expect(rendererSource).toContain("new THREE.DirectionalLight(studioLights.fill.color, studioLights.fill.intensity)");
    expect(rendererSource).not.toContain("renderer.toneMappingExposure = 0.68");
    expect(rendererSource).not.toContain("renderer.toneMappingExposure = 0.84");
    expect(rendererSource).toContain('new THREE.PointLight("#ffdca6", 2.8');
  });

  it("records the Administration room scene without falsely representing it as an input to the exact 3D capture", () => {
	    expect(designToolSource).toContain("catalogRoomSceneUrl={active3DRoomSceneReferenceUrl}");
	    expect(rendererSource).toContain('renderedAsBackdropOrGeometry: false');
	    expect(rendererSource).toContain('purpose: "material-and-lighting-reference-only"');
	    expect(rendererSource).toContain('data-testid="photo-quality-selected-door-input"');
	    expect(rendererSource).toContain('data-testid="photo-quality-room-scene-not-applied"');
	    expect(rendererSource).toContain("This exact 3D preview does not use it to change lighting, cabinet materials, camera, or any kitchen object.");
	    expect(rendererSource).toContain("threeDPhotoRenderDoorReferenceStatus");
    expect(rendererSource).toContain("threeDExactPlanGeometryLock");
  });

  it("records supplied swatches or automatic locked-plan references for every material", () => {
    expect(rendererSource).toContain("materialManifest");
    expect(rendererSource).toContain("missingMaterialInputs");
    expect(rendererSource).toContain("geminiHardwareReference(hardwareStyleId");
    expect(rendererSource).toContain('reference.referenceSource === "locked-designer-jpeg"');
    expect(rendererSource).toContain("materialManifest.push(geminiMaterialReference(entry))");
    expect(rendererSource).not.toContain("else missingMaterialInputs.push(entry.label)");
    expect(rendererSource).toContain("missing swatches render automatically from the locked 3D view");
    expect(rendererSource).toContain('data-testid="gemini-automatic-predictions"');
    expect(rendererSource).toContain('cabinet.placement === "appliance" || isRefrigerator(cabinet) || isRangeOrOven(cabinet.masterCode)) continue');
  });

  it("keeps malformed-provenance safeguards without blocking missing swatches", () => {
    const referenceSource = readFileSync(new URL("../lib/geminiMaterialReference.ts", import.meta.url), "utf8");
    const manifestSource = readFileSync(new URL("../../../shared/geminiMaterialManifest.ts", import.meta.url), "utf8");
    expect(referenceSource).toContain("serializeGeminiMaterialManifestForWire");
    expect(manifestSource).toContain("GEMINI_MATERIAL_MANIFEST_PROVENANCE_MAX = 160");
    expect(rendererSource).toContain("geminiManifestValidationReason");
    expect(rendererSource).toContain("geminiWireMaterialManifest");
    expect(rendererSource).toContain("setGeminiImageTestError(geminiManifestValidationReason)");
    expect(rendererSource).toContain("disabled={Boolean(geminiManifestValidationReason) || startGeminiImageTestMutation.isPending || geminiCooldownActive}");
    expect(rendererSource).toContain("!geminiManifestValidationReason && geminiImageTestJobQuery.data?.status === \"completed\"");
    expect(rendererSource).toContain("!geminiManifestValidationReason && savedGeminiImageTestQuery.data");
    expect(rendererSource).toContain("materialManifestWireVersion: GEMINI_MATERIAL_MANIFEST_WIRE_VERSION");
  });
});
