import { describe, expect, it } from "vitest";
import {
  HELPER_SIGN_OFF_COPY,
  HELPER_SIGN_ON_COPY,
  helperCanReceiveRequests,
  helperEmailTarget,
  helperNotificationOrder,
  helperQueuePosition,
  helperRequestDesignPath,
  helperRequestEmailBody,
  helperRequestEmailSubject,
  helperRequestIdFromSearch,
  helperRequestNeedsHelper,
  helperRequestSentCopy,
  helperRequestSharePath,
  helperRequestSummaryRows,
  helperRequestOwnerLabel,
  helperStatusLabel,
  helperMailerNotice,
  helperEmailSkippedCopy,
  planHelperNotification,
  type HelperQueueEntry,
  type HelperRequest,
} from "./designerHelperQueue";

function entry(patch: Partial<HelperQueueEntry> & { designerUserId: number }): HelperQueueEntry {
  return {
    designerName: `Designer ${patch.designerUserId}`,
    email: `designer${patch.designerUserId}@cabinetdealz.com`,
    available: true,
    signedOnAt: "2026-11-06T08:00:00.000Z",
    acceptedCount: 0,
    ...patch,
  };
}

function request(patch: Partial<HelperRequest> = {}): HelperRequest {
  return {
    id: 9,
    designId: 44,
    designName: "Miller kitchen",
    customerUserId: 3,
    customerName: "Dana Miller",
    customerEmail: "dana@example.com",
    customerPhone: "555-0143",
    helpNote: "Can you check the island spacing?",
    status: "open",
    shareToken: "tok-123",
    affiliateSlug: null,
    requestedAt: "2026-11-06T09:14:00.000Z",
    acceptedByUserId: null,
    acceptedByName: null,
    acceptedAt: null,
    joinedByUserId: null,
    joinedByName: null,
    joinedAt: null,
    closedAt: null,
    ...patch,
  };
}

describe("helper sign", () => {
  it("states plainly what on and off mean for the queue", () => {
    expect(HELPER_SIGN_ON_COPY).toContain("come up in front of you");
    expect(HELPER_SIGN_OFF_COPY).toContain("no customer help requests are sent to you");
  });

  it("only queues a designer whose sign is on with a recorded sign-on time", () => {
    expect(helperCanReceiveRequests({ available: true, signedOnAt: "2026-11-06T08:00:00.000Z" })).toBe(true);
    expect(helperCanReceiveRequests({ available: false, signedOnAt: "2026-11-06T08:00:00.000Z" })).toBe(false);
    expect(helperCanReceiveRequests({ available: true, signedOnAt: null })).toBe(false);
  });
});

describe("who gets notified", () => {
  it("orders the longest-waiting signed-on designer first", () => {
    const order = helperNotificationOrder([
      entry({ designerUserId: 5, signedOnAt: "2026-11-06T10:00:00.000Z" }),
      entry({ designerUserId: 2, signedOnAt: "2026-11-06T07:00:00.000Z" }),
      entry({ designerUserId: 9, available: false, signedOnAt: "2026-11-06T06:00:00.000Z" }),
    ]);
    expect(order.map((row) => row.designerUserId)).toEqual([2, 5]);
  });

  it("reports a signed-on designer's place in the queue and nothing for a signed-off one", () => {
    const entries = [
      entry({ designerUserId: 2, signedOnAt: "2026-11-06T07:00:00.000Z" }),
      entry({ designerUserId: 5, signedOnAt: "2026-11-06T10:00:00.000Z" }),
    ];
    expect(helperQueuePosition(entries, 5)).toBe(2);
    expect(helperQueuePosition([...entries, entry({ designerUserId: 7, available: false })], 7)).toBeNull();
  });

  it("emails every queued designer's address on file, in queue order", () => {
    const plan = planHelperNotification([
      entry({ designerUserId: 5, email: "rich@cabinetdealz.com", signedOnAt: "2026-11-06T10:00:00.000Z" }),
      entry({ designerUserId: 2, email: "dana-designer@cabinetdealz.com", signedOnAt: "2026-11-06T07:00:00.000Z" }),
    ]);
    expect(plan.queued).toEqual([2, 5]);
    expect(plan.emailTargets).toEqual(["dana-designer@cabinetdealz.com", "rich@cabinetdealz.com"]);
    expect(plan.missingEmail).toEqual([]);
  });

  it("keeps the in-app notice when the mailer is unset, and sends no email", () => {
    const plan = planHelperNotification([entry({ designerUserId: 4 })], { mailerConfigured: false });
    expect(plan.queued).toEqual([4]);
    expect(plan.emailTargets).toEqual([]);
  });

  it("notes a queued designer who has no address instead of inventing one", () => {
    const plan = planHelperNotification([
      entry({ designerUserId: 4, email: null }),
      entry({ designerUserId: 6, email: "   " }),
    ]);
    expect(plan.queued).toEqual([4, 6]);
    expect(plan.emailTargets).toEqual([]);
    expect(plan.missingEmail).toEqual([4, 6]);
    expect(helperEmailTarget("not-an-address")).toBeNull();
    expect(helperEmailTarget(" rich@cabinetdealz.com ")).toBe("rich@cabinetdealz.com");
  });
});

describe("customer-facing copy", () => {
  it("says how many designers were notified and whether email went out", () => {
    const one = planHelperNotification([entry({ designerUserId: 4 })]);
    expect(helperRequestSentCopy(one, true)).toContain("1 designer");
    expect(helperRequestSentCopy(one, true)).toContain("1 email");
    const none = planHelperNotification([entry({ designerUserId: 4, email: null })]);
    expect(helperRequestSentCopy(none, true)).toContain("None of them has an email address on file");
    expect(helperRequestSentCopy(planHelperNotification([]), true)).toContain("No designer has their Helper sign on");
  });

  it("states mailer state plainly rather than suggesting mail went out", () => {
    expect(helperMailerNotice(false)).toContain("Email is not configured");
    expect(helperMailerNotice(true)).toContain("address on file");
    expect(helperEmailSkippedCopy("no-mailer")).toContain("mailer is not configured");
    expect(helperEmailSkippedCopy("no-address")).toContain("no address on file");
  });
});

describe("request facts", () => {
  it("labels each status in plain words", () => {
    expect(helperStatusLabel("open")).toBe("Waiting for a designer");
    expect(helperStatusLabel("joined")).toBe("Designer in the design");
    expect(helperRequestNeedsHelper(request())).toBe(true);
    expect(helperRequestNeedsHelper(request({ status: "accepted" }))).toBe(false);
  });

  it("records who accepted and who joined, with times", () => {
    const accepted = request({
      status: "joined",
      acceptedByName: "Rich",
      acceptedAt: "2026-11-06T09:20:00.000Z",
      joinedByName: "Rich",
      joinedAt: "2026-11-06T09:22:00.000Z",
    });
    const label = helperRequestOwnerLabel(accepted);
    expect(label).toContain("Rich accepted");
    expect(label).toContain("joined the design");
    expect(helperRequestOwnerLabel(request())).toBe("Not accepted yet");
  });

  it("opens the customer's own saved design in assisted mode from a request", () => {
    expect(helperRequestDesignPath({ designId: 44, requestId: 9 })).toBe("/design?load=44&helperRequest=9&assist=1");
    expect(helperRequestDesignPath({ designId: 44, requestId: 9, affiliateSlug: "acme" }))
      .toBe("/design?load=44&helperRequest=9&assist=1&affiliate=acme");
    expect(helperRequestIdFromSearch("?load=44&helperRequest=9&assist=1")).toBe(9);
    expect(helperRequestIdFromSearch("?helperRequest=abc")).toBeNull();
    expect(helperRequestSharePath({ shareToken: "a.b" })).toBe("/design/session/a.b");
  });

  it("puts every field the admin pop-up needs into one list", () => {
    const rows = helperRequestSummaryRows(request());
    const labels = rows.map((row) => row.label);
    expect(labels).toEqual(["Customer", "Contact", "Design", "What they need", "Requested", "Status", "Who has it"]);
    expect(rows.find((row) => row.label === "Customer")?.value).toBe("Dana Miller");
    expect(rows.find((row) => row.label === "Contact")?.value).toContain("dana@example.com");
    expect(rows.find((row) => row.label === "Design")?.value).toBe("Miller kitchen");
    expect(rows.find((row) => row.label === "What they need")?.value).toContain("island spacing");
  });

  it("falls back to real values when the customer left a field blank", () => {
    const rows = helperRequestSummaryRows(request({ customerName: null, customerEmail: null, customerPhone: null, helpNote: null, designName: null }));
    expect(rows.find((row) => row.label === "Customer")?.value).toBe("Customer name not given");
    expect(rows.find((row) => row.label === "Contact")?.value).toContain("No email or phone");
    expect(rows.find((row) => row.label === "Design")?.value).toBe("Design #44");
    expect(rows.find((row) => row.label === "What they need")?.value).toContain("wants a designer's opinion");
  });
});

describe("helper email", () => {
  it("names the customer, the design, the note, and one link", () => {
    const subject = helperRequestEmailSubject(request());
    expect(subject).toContain("Designer helper needed");
    expect(subject).toContain("Dana Miller");
    expect(subject).toContain("Miller kitchen");

    const body = helperRequestEmailBody({
      request: request(),
      helperName: "Rich",
      designPath: "/design?load=44&helperRequest=9&assist=1",
    });
    expect(body).toContain("Hi Rich,");
    expect(body).toContain("Dana Miller");
    expect(body).toContain("island spacing");
    expect(body).toContain("/design?load=44&helperRequest=9&assist=1");
    expect(body).toContain("Helper sign is on");
    expect(body).not.toContain("http://");
  });
});
