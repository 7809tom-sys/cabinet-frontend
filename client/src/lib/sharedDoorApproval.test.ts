import { describe, expect, it } from "vitest";
import { approvalSummary, approveDoorInput, normalizeSharedApprovals } from "./sharedDoorApproval";

describe("shared door approval", () => {
  it("says where a door was approved, from any of the three places", () => {
    expect(approvalSummary({ source: "designer" })).toBe("Approved in the Designer");
    expect(approvalSummary({ source: "audit" })).toBe("Approved in the Door Rendering Audit");
    expect(approvalSummary({ source: "featured" })).toBe("Approved in Featured Styles");
    expect(approvalSummary(null)).toBe("Not approved");
  });

  it("reads one approval per style and ignores malformed rows", () => {
    const map = normalizeSharedApprovals({ approvals: [
      { styleId: 4, versionId: 9, source: "featured", approvedDoorImageUrl: " /door.png ", renderHex: "#ffffff" },
      { styleId: 0, versionId: 1 },
      null,
      { styleId: 5, versionId: 2, source: "mystery" },
    ] });
    expect(map.size).toBe(2);
    expect(map.get(4)).toMatchObject({ source: "featured", approvedDoorImageUrl: "/door.png", versionId: 9 });
    expect(map.get(5)?.source).toBe("audit");
  });

  it("builds the Designer request with the locked capture and a valid hex only", () => {
    expect(approveDoorInput({ styleId: 3, source: "designer", imageBase64: "AAAA", renderHex: "#EDEDED", note: " ok " }))
      .toEqual({ styleId: 3, source: "designer", imageBase64: "AAAA", contentType: "image/png", renderHex: "#EDEDED", note: "ok" });
    expect(approveDoorInput({ styleId: 3, source: "designer", imageBase64: "AAAA", renderHex: "nope" }))
      .toEqual({ styleId: 3, source: "designer", imageBase64: "AAAA", contentType: "image/png" });
  });

  it("builds the Featured Styles request from the door and drawer photos", () => {
    expect(approveDoorInput({ styleId: 3, source: "featured", doorImageUrl: " /d.png ", drawerImageUrl: " " }))
      .toEqual({ styleId: 3, source: "featured", doorImageUrl: "/d.png" });
  });
});
