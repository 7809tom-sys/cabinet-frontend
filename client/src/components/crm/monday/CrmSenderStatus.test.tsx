// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PublicAffiliateEmailSettings } from "@shared/crmMailbox";
import { CrmSenderStatus, crmSenderState, missingDomainRecords } from "./CrmSenderStatus";

const base: PublicAffiliateEmailSettings = {
  affiliateId: 1, provider: "custom", smtpHost: "smtp.hostinger.com", smtpPort: 465, smtpUser: "rich@shop.com",
  smtpFrom: "rich@shop.com", fromName: "", replyTo: "", signatureHtml: "", enabled: true, hasPassword: true,
  lastTestedAt: null, lastTestOk: true, connected: true,
};

afterEach(cleanup);

describe("crmSenderState", () => {
  it("covers unavailable, not connected, off and connected", () => {
    expect(crmSenderState(null, true).kind).toBe("unavailable");
    expect(crmSenderState(null, false).kind).toBe("not_connected");
    expect(crmSenderState({ ...base, hasPassword: false }, false).kind).toBe("not_connected");
    expect(crmSenderState({ ...base, enabled: false, connected: false }, false).kind).toBe("off");
    expect(crmSenderState(base, false)).toMatchObject({ kind: "connected", mailbox: "rich@shop.com", test: "ok" });
    expect(crmSenderState({ ...base, lastTestOk: false, lastTestError: "535 bad login" }, false))
      .toMatchObject({ test: "failed", testError: "535 bad login" });
  });
});

describe("missingDomainRecords", () => {
  it("lists only what is missing and ignores unreliable checks", () => {
    expect(missingDomainRecords({ domain: "shop.com", spf: true, dmarc: false, dkimSelector: null, reliable: true })).toEqual(["DKIM", "DMARC"]);
    expect(missingDomainRecords({ domain: "shop.com", spf: false, dmarc: false, dkimSelector: null, reliable: false })).toEqual([]);
    expect(missingDomainRecords(null)).toEqual([]);
  });
});

describe("CrmSenderStatus", () => {
  it("shows the mailbox, and links to Email settings and Domain Setup when records are missing", () => {
    render(<CrmSenderStatus settings={base} unavailable={false} records={{ domain: "shop.com", spf: false, dmarc: false, dkimSelector: null, reliable: true }} />);
    const box = screen.getByTestId("crm-sender-status");
    expect(box.textContent).toContain("CRM emails go out from rich@shop.com");
    expect(screen.getByTestId("crm-sender-domain-warning").textContent).toContain("SPF, DKIM, DMARC");
    expect(box.querySelector('a[href="/affiliate?section=email"]')).toBeTruthy();
    expect(box.querySelector('a[href="/affiliate?section=settings"]')).toBeTruthy();
  });

  it("offers Email settings when not connected, with no Domain Setup link and no database error", () => {
    render(<CrmSenderStatus settings={null} unavailable={false} />);
    const box = screen.getByTestId("crm-sender-status");
    expect(box.textContent).toContain("not connected");
    expect(box.querySelector('a[href="/affiliate?section=email"]')).toBeTruthy();
    expect(box.querySelector('a[href="/affiliate?section=settings"]')).toBeNull();
  });

  it("explains an unavailable sender plainly", () => {
    render(<CrmSenderStatus settings={null} unavailable />);
    expect(screen.getByTestId("crm-sender-status").textContent).toContain("unavailable");
  });
});
