import { describe, expect, it } from "vitest";
import {
  DOOR_AUDIT_CAPTURE,
  applyDoorAuditFilter,
  auditDoorCameraBounds,
  doorAuditCompareSlots,
  doorAuditFlag,
  doorAuditProgressLabel,
  doorAuditRevertVersionId,
  doorAuditStartRunInput,
  doorAuditStyleLabel,
  doorAuditSubmitRenderInput,
  doorRenderingAuditAllowed,
  formatDoorAuditDelta,
  normalizeDoorAuditList,
  normalizeDoorAuditRunStatus,
  normalizeDoorAuditRuns,
  normalizeDoorAuditStartRun,
  normalizeDoorAuditVersions,
  type DoorAuditStyleRow,
  type DoorAuditVersion,
} from "./doorRenderingAudit";

function version(overrides: Partial<DoorAuditVersion> & Pick<DoorAuditVersion, "versionId" | "imageUrl">): DoorAuditVersion {
  return {
    createdAt: "2026-10-01T15:00:00.000Z",
    scores: { grain: 7, color: 7, textureSheen: 7, profileEdges: 7, overall: 7 },
    scoreStatus: "scored",
    isCurrent: false,
    isAcceptedBaseline: false,
    review: "pending",
    ...overrides,
  };
}

function row(overrides: Partial<DoorAuditStyleRow> = {}): DoorAuditStyleRow {
  const current = version({ versionId: 3, imageUrl: "/new.png", isCurrent: true, scores: { grain: 8, color: 8, textureSheen: 8, profileEdges: 8, overall: 8.4 } });
  const accepted = version({ versionId: 2, imageUrl: "/accepted.png", isAcceptedBaseline: true, review: "accepted", scores: { grain: 6, color: 6, textureSheen: 6, profileEdges: 6, overall: 6.2 } });
  return {
    styleId: 10,
    name: "Summit White",
    code: "SW",
    distributorName: "Line A",
    samplePhotoUrl: "/sample.png",
    color: "#f4f1ea",
    sourceFingerprint: "abc",
    doorProfile: {
      doorStyle: "Shaker",
      doorPanelType: null,
      railWidth: "3",
      stileWidth: "3",
      panelConstruction: "flat",
      bevelWidth: null,
      bevelDepth: null,
      insideEdgeProfile: null,
      drawerFrontType: null,
      grainDirection: "vertical",
      finishSheen: "satin",
    },
    changedSinceLastRender: false,
    current,
    accepted,
    previous: accepted,
    flag: "improved",
    ...overrides,
  };
}

describe("door rendering audit rules", () => {
  it("flags a render that gained at least one overall point", () => {
    expect(doorAuditFlag({
      current: { overall: 8.4, review: "pending", isAcceptedBaseline: false },
      acceptedOverall: 7.4,
    })).toBe("improved");
    expect(doorAuditFlag({
      current: { overall: 8.3, review: "pending", isAcceptedBaseline: false },
      acceptedOverall: 7.4,
    })).toBe("needs-review");
  });

  it("keeps an unaccepted first render in review and leaves untouched styles unaudited", () => {
    expect(doorAuditFlag({
      current: { overall: 9, review: "pending", isAcceptedBaseline: false },
      acceptedOverall: null,
    })).toBe("needs-review");
    expect(doorAuditFlag({ current: null, acceptedOverall: null })).toBe("unaudited");
    expect(doorAuditFlag({
      current: { overall: 9, review: "accepted", isAcceptedBaseline: true },
      acceptedOverall: 9,
    })).toBe("accepted");
    expect(doorAuditFlag({
      current: { overall: 4, review: "rejected", isAcceptedBaseline: false },
      acceptedOverall: 7,
    })).toBe("rejected");
  });

  it("places the sample, accepted baseline, and latest render side by side", () => {
    const slots = doorAuditCompareSlots(row());
    expect(slots.map((slot) => slot.label)).toEqual(["Sample photo", "Accepted baseline", "Latest render"]);
    expect(slots.map((slot) => slot.imageUrl)).toEqual(["/sample.png", "/accepted.png", "/new.png"]);
    expect(doorAuditRevertVersionId(row())).toBe(2);
  });

  it("shows a distinct previous version and can restore it without dropping the accepted baseline", () => {
    const previous = version({ versionId: 4, imageUrl: "/previous.png", overall: 5 } as Partial<DoorAuditVersion> & Pick<DoorAuditVersion, "versionId" | "imageUrl">);
    const slots = doorAuditCompareSlots(row({ previous }));
    expect(slots.map((slot) => slot.key)).toEqual(["sample", "accepted", "previous", "latest"]);
    expect(doorAuditRevertVersionId(row({ previous }))).toBe(4);
  });

  it("does not repeat the accepted image when it is already the latest render", () => {
    const accepted = version({ versionId: 3, imageUrl: "/new.png", isCurrent: true, isAcceptedBaseline: true, review: "accepted" });
    const previous = version({ versionId: 1, imageUrl: "/old.png" });
    const slots = doorAuditCompareSlots(row({ current: accepted, accepted, previous, flag: "accepted" }));
    expect(slots.map((slot) => slot.label)).toEqual(["Sample photo", "Previous render", "Latest render · accepted"]);
    expect(doorAuditRevertVersionId(row({ current: accepted, accepted, previous }))).toBe(1);
  });

  it("filters flagged, furthest-from-photo, and not-yet-audited styles", () => {
    const improved = row();
    const review = row({
      styleId: 11,
      name: "Harbor",
      flag: "needs-review",
      current: version({ versionId: 8, imageUrl: "/h.png", isCurrent: true, scores: { grain: 3, color: 3, textureSheen: 3, profileEdges: 3, overall: 3.2 } }),
    });
    const untouched = row({ styleId: 12, name: "Oak", flag: "unaudited", current: null, accepted: null, previous: null });
    const styles = [improved, review, untouched];
    expect(applyDoorAuditFilter(styles, "flagged", "").map((style) => style.styleId)).toEqual([10, 11]);
    expect(applyDoorAuditFilter(styles, "furthest", "").map((style) => style.styleId)).toEqual([11, 10]);
    expect(applyDoorAuditFilter(styles, "unaudited", "oak").map((style) => style.name)).toEqual(["Oak"]);
  });

  it("locks the capture size and keeps the door inside a front-on camera", () => {
    expect(DOOR_AUDIT_CAPTURE).toMatchObject({ widthPx: 720, heightPx: 1080, pixelRatio: 1, doorWidthIn: 18, doorHeightIn: 30 });
    const camera = auditDoorCameraBounds();
    const doorWidthFt = 18 / 12;
    const doorHeightFt = 30 / 12;
    expect(camera.right - camera.left).toBeGreaterThan(doorWidthFt);
    expect(camera.top - camera.bottom).toBeGreaterThan(doorHeightFt);
    expect(camera.position[0]).toBe(0);
    expect(camera.position[1]).toBe(0);
    expect(formatDoorAuditDelta(8.4, 6.2)).toBe("+2.2 vs accepted");
    expect(doorAuditProgressLabel("rendering", 2, 10, "Summit White")).toBe("Rendering Summit White · 2 of 10");
    expect(doorRenderingAuditAllowed("admin")).toBe(true);
    expect(doorRenderingAuditAllowed("designer")).toBe(false);
    expect(doorRenderingAuditAllowed("sales_rep")).toBe(false);
  });
});

const backendProfile = {
  doorStyle: "Shaker",
  doorPanelType: null,
  railWidth: "3",
  stileWidth: "3",
  centerRailWidth: null,
  panelConstruction: "flat",
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  drawerFrontType: null,
  grainDirection: "vertical",
  finishSheen: "satin",
};

const backendBrief = {
  styleId: 41,
  styleCode: "SW-41",
  ourName: "Summit White Shaker",
  aliasName: "Summit White",
  distributorId: 3,
  distributorCode: "SC",
  distributorName: "Summit Cabinets",
  brandName: "Summit",
  samplePhotoUrl: "https://cdn.example/summit.jpg",
  doorSampleVerified: true,
  color: "#f4f1ea",
  finish: "White",
  woodSpecies: "Maple",
  cornerSwatchImageUrl: null,
  profile: backendProfile,
};

describe("door rendering audit backend adapter", () => {
  it("turns a selected run into a capture queue and submit body", () => {
    expect(doorAuditStartRunInput("selected", [41])).toEqual({ scope: "selected", styleIds: [41] });
    expect(doorAuditStartRunInput("changed-only")).toEqual({ scope: "changed" });
    expect(doorAuditStartRunInput("all")).toEqual({ scope: "all" });

    const run = normalizeDoorAuditStartRun({
      runId: 15,
      status: "awaiting_renders",
      scope: "selected",
      renderingCommit: null,
      styleCap: 40,
      truncated: false,
      skippedUnchangedCount: 0,
      skippedMissingSampleCount: 0,
      missingStyleIds: [],
      styles: [backendBrief],
    });

    expect(run.runId).toBe(15);
    expect(run.status).toBe("awaiting-renders");
    expect(run.styles).toHaveLength(1);
    expect(run.styles[0]).toMatchObject({
      styleId: 41,
      name: "Summit White Shaker",
      code: "SW-41",
      distributorName: "Summit Cabinets",
      samplePhotoUrl: "https://cdn.example/summit.jpg",
      color: "#f4f1ea",
      sourceFingerprint: "",
    });
    expect(run.styles[0]?.doorProfile).toMatchObject({
      doorStyle: "Shaker",
      finishSheen: "satin",
      panelConstruction: "flat",
      railWidth: "3",
    });
    expect(run.styles[0]?.doorProfile.finishSheen).toBe("satin");
    expect(doorAuditStyleLabel(run.styles[0])).toBe("Summit White Shaker · SW-41 · Summit Cabinets");

    const submit = doorAuditSubmitRenderInput({
      runId: run.runId,
      styleId: run.styles[0]!.styleId,
      pngBase64: "a".repeat(40),
      sourceFingerprint: run.styles[0]?.sourceFingerprint,
    });
    expect(submit).toEqual({
      runId: 15,
      styleId: 41,
      imageBase64: "a".repeat(40),
      contentType: "image/png",
    });
    expect(submit).not.toHaveProperty("pngBase64");
    expect(submit).not.toHaveProperty("mode");
    expect(submit).not.toHaveProperty("sourceFingerprint");
  });

  it("reads a selected run that arrives under items and falls back to alias or style code", () => {
    const run = normalizeDoorAuditStartRun({
      runId: 8,
      status: "awaiting_renders",
      scope: "selected",
      items: [{ ...backendBrief, ourName: "  ", aliasName: "Harbor" }],
    });
    expect(run.styles[0]?.name).toBe("Harbor");
    expect(normalizeDoorAuditStartRun({
      runId: 9,
      status: "awaiting_renders",
      styles: [{ styleId: 4, styleCode: "OC-4", profile: { doorStyle: "Slab" } }],
    }).styles[0]?.name).toBe("OC-4");
  });

  it("rejects a selected response the page cannot read without a TypeError", () => {
    expect(() => normalizeDoorAuditStartRun({ status: "awaiting_renders", styles: [] })).toThrow(/run id/i);
    expect(() => normalizeDoorAuditStartRun({ runId: 1, status: "awaiting_renders" })).toThrow(/door styles/i);
    expect(() => normalizeDoorAuditStartRun({ runId: 1, status: "awaiting_renders" })).toThrow(Error);
  });

  it("maps list, run status, history, and version payloads onto the screen", () => {
    const list = normalizeDoorAuditList({
      styles: [{
        ...backendBrief,
        latestRender: {
          versionId: 9,
          renderImageUrl: "https://cdn.example/latest.png",
          createdAt: "2026-10-20T15:04:00.000Z",
          scores: { woodGrain: 8, color: 7, textureSheen: 7, profileEdges: 9, overall: 8.4 },
          isCurrentAccepted: false,
          verdict: "flagged",
        },
        acceptedRender: null,
        flagStatus: "flagged",
      }],
    });
    expect(list.styles[0]?.name).toBe("Summit White Shaker");
    expect(list.styles[0]?.current?.scores.grain).toBe(8);
    expect(list.styles[0]?.current?.scores.overall).toBe(8.4);
    expect(list.styles[0]?.current?.imageUrl).toBe("https://cdn.example/latest.png");
    expect(list.styles[0]?.flag).toBe("improved");
    expect(() => applyDoorAuditFilter(list.styles, "furthest", "")).not.toThrow();
    expect(doorAuditCompareSlots(list.styles[0]!).map((slot) => slot.imageUrl)).toContain("https://cdn.example/summit.jpg");

    const status = normalizeDoorAuditRunStatus({
      run: {
        id: 15,
        scope: "selected",
        status: "awaiting_renders",
        selectedCount: 1,
        pendingCount: 1,
        scoredCount: 0,
        failedCount: 0,
        createdAt: "2026-10-27T14:00:00.000Z",
        completedAt: null,
        errorMessage: null,
        requestedByName: "Tom",
      },
      progress: { total: 1, pending: 1, scoring: 0, scored: 0, failed: 0, flagged: 0, percent: 0 },
      results: [{
        styleId: 41,
        status: "pending_render",
        ourName: "Summit White Shaker",
        styleCode: "SW-41",
        distributorName: "Summit Cabinets",
        samplePhotoUrl: "https://cdn.example/summit.jpg",
      }],
    });
    expect(status).toMatchObject({
      runId: 15,
      mode: "selected",
      status: "awaiting-renders",
      total: 1,
      uploaded: 0,
      focusStyleId: 41,
      focusLabel: "Summit White Shaker · SW-41 · Summit Cabinets",
    });
    expect(status?.pendingStyles[0]?.doorProfile).toBeTruthy();
    expect(status?.pendingStyles[0]?.name).toBe("Summit White Shaker");

    expect(normalizeDoorAuditRuns({
      runs: [{
        id: 15,
        scope: "changed",
        status: "completed",
        selectedCount: 4,
        scoredCount: 4,
        failedCount: 0,
        flaggedCount: 1,
        createdAt: "2026-10-27T14:00:00.000Z",
        completedAt: "2026-10-27T14:05:00.000Z",
        requestedByName: "Tom",
      }],
    })[0]).toMatchObject({
      runId: 15,
      mode: "changed-only",
      status: "complete",
      total: 4,
      scored: 4,
      flagged: 1,
      startedByName: "Tom",
    });

    const versions = normalizeDoorAuditVersions({
      ourName: "Summit White Shaker",
      styleCode: "SW-41",
      distributorName: "Summit Cabinets",
      versions: [{
        versionId: 9,
        renderImageUrl: "https://cdn.example/latest.png",
        createdAt: "2026-10-27T14:04:00.000Z",
        scores: { woodGrain: 8, color: 7, textureSheen: 7, profileEdges: 9, overall: 8 },
        isCurrentAccepted: false,
        verdict: "flagged",
      }],
    });
    expect(versions[0]).toMatchObject({
      versionId: 9,
      imageUrl: "https://cdn.example/latest.png",
      scores: { grain: 8, overall: 8 },
    });
  });
});
