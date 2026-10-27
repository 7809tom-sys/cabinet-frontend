import { describe, expect, it } from "vitest";
import {
  DOOR_AUDIT_CAPTURE,
  applyDoorAuditFilter,
  auditDoorCameraBounds,
  doorAuditCompareSlots,
  doorAuditFlag,
  doorAuditProgressLabel,
  doorAuditRevertVersionId,
  doorRenderingAuditAllowed,
  formatDoorAuditDelta,
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
