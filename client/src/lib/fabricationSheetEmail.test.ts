import { describe, expect, it } from "vitest";
import {
  fabricationEmailBlockedMessage,
  fabricationEmailEndpointMissing,
  fabricationEmailOutcome,
  usableFabricatorEmail,
} from "./fabricationSheetEmail";

describe("fabrication sheet email", () => {
  it("accepts a real fabricator address and rejects anything else", () => {
    expect(usableFabricatorEmail(" shop@stoneworks.example ")).toBe("shop@stoneworks.example");
    expect(usableFabricatorEmail("")).toBeNull();
    expect(usableFabricatorEmail(null)).toBeNull();
    expect(usableFabricatorEmail("shop@stoneworks")).toBeNull();
    expect(usableFabricatorEmail("not an email")).toBeNull();
  });

  it("reports a confirmed send only when the server said sent", () => {
    expect(fabricationEmailOutcome({ status: "sent", sentTo: "shop@stoneworks.example" }, null))
      .toEqual({ kind: "sent", sentTo: "shop@stoneworks.example" });
  });

  it("never reports success for a provider failure", () => {
    expect(fabricationEmailOutcome({ status: "failed", error: "mailbox full" }, null))
      .toEqual({ kind: "failed", error: "mailbox full", blocked: false });
  });

  it("names an undeployed endpoint instead of pretending the email was sent", () => {
    const missing = { data: { code: "NOT_FOUND" }, message: "No procedure found on path design.emailFabricationSheet" };
    expect(fabricationEmailEndpointMissing(missing)).toBe(true);
    expect(fabricationEmailOutcome(null, missing)).toEqual({ kind: "endpoint-missing" });
    // A batch NOT_FOUND is wrapped in shape.data.
    expect(fabricationEmailEndpointMissing({ shape: { data: { code: "NOT_FOUND" } } })).toBe(true);
  });

  it("treats other failures as real errors with the server text kept", () => {
    const forbidden = { data: { code: "FORBIDDEN" }, message: "You do not own this design" };
    expect(fabricationEmailEndpointMissing(forbidden)).toBe(false);
    expect(fabricationEmailOutcome(null, forbidden))
      .toEqual({ kind: "failed", error: "You do not own this design", blocked: false });
  });

  it("explains an unconfigured mailer and keeps the download path open", () => {
    expect(fabricationEmailBlockedMessage("not_configured")).toContain("Download the PDF");
    expect(fabricationEmailBlockedMessage("disabled")).toContain("Download the PDF");
    expect(fabricationEmailBlockedMessage("smtp timeout")).toBeNull();
    const outcome = fabricationEmailOutcome(null, { message: "not_configured" });
    expect(outcome.kind).toBe("failed");
    if (outcome.kind !== "failed") return;
    expect(outcome.blocked).toBe(true);
    expect(outcome.error).toContain("Download the PDF");
  });

  it("falls back to a plain failure when there is no result and no error", () => {
    expect(fabricationEmailOutcome(null, null))
      .toEqual({ kind: "failed", error: "The email could not be sent.", blocked: false });
    expect(fabricationEmailOutcome({ status: "failed", error: "  " }, null).kind).toBe("failed");
  });
});
