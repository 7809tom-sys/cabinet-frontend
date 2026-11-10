// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMPTY_HIRING_SETTINGS, toPublicDocument, toPublicPayload, type PublicPacket } from "@shared/hiringPacket";
import { HiringPacketScreen, type HiringViewer } from "./HiringPacketScreen";

const hire: HiringViewer = { userId: 42, role: "user", name: "Ada Lovelace", email: "ada@example.com" };
const admin: HiringViewer = { userId: 1, role: "admin", name: "Tom", email: "tom@cabinetdealz.com" };

function packet(overrides: Partial<PublicPacket> = {}): PublicPacket {
  const application = toPublicDocument({
    kind: "application",
    payload: toPublicPayload({
      firstName: "Ada",
      lastName: "Lovelace",
      position: "Designer",
      startDate: "2026-11-16",
      emergencyContactName: "Charles Babbage",
      ssn: "123-45-6789",
    }),
    signedAt: "2026-11-02T15:00:00.000Z",
    signedByName: "Ada Lovelace",
    reviewedAt: null,
    reviewedByName: null,
  });
  const deposit = toPublicDocument({
    kind: "direct_deposit",
    payload: toPublicPayload({ accountNumber: "0012345678", routingNumber: "021000021", bankName: "First Bank" }),
    signedAt: "2026-11-02T15:04:00.000Z",
    signedByName: "Ada Lovelace",
    reviewedAt: "2026-11-03T12:00:00.000Z",
    reviewedByName: "Tom",
  });
  const rest = (["i9_section1", "w4", "state_withholding", "policy_acknowledgment"] as const).map((kind) => toPublicDocument({
    kind,
    payload: {},
    signedAt: null,
    signedByName: null,
    reviewedAt: null,
    reviewedByName: null,
  }));
  return {
    id: 5,
    userId: 42,
    applicantName: "Ada Lovelace",
    applicantEmail: "ada@example.com",
    documents: [application, ...rest, deposit],
    ...overrides,
  };
}

afterEach(cleanup);

describe("job board hire view", () => {
  it("shows the hire their own packet, statuses, and masked numbers only", () => {
    const mine = packet();
    mine.documents = mine.documents.map((document) => document.kind === "application"
      ? { ...document, status: "in_progress" as const, signedAt: null, signedByName: null }
      : document);
    const onSave = vi.fn();
    render(
      <HiringPacketScreen
        viewer={hire}
        settings={{ ...EMPTY_HIRING_SETTINGS, stateCode: null }}
        summaries={[
          { id: 5, userId: 42, applicantName: "Ada Lovelace", applicantEmail: "ada@example.com", progress: { total: 6, signedOrReviewed: 1, byStatus: { not_started: 4, in_progress: 1, signed: 0, reviewed: 1 } } },
          { id: 6, userId: 7, applicantName: "Other Person", applicantEmail: "other@example.com", progress: { total: 6, signedOrReviewed: 0, byStatus: { not_started: 6, in_progress: 0, signed: 0, reviewed: 0 } } },
        ]}
        packet={mine}
        onSelectPacket={vi.fn()}
        onSave={onSave}
        onSign={vi.fn()}
        onReview={vi.fn()}
        onUpload={vi.fn()}
        onOpenFile={vi.fn()}
        onConfigure={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hiring-packet")).toBeTruthy();
    expect(screen.queryByTestId("hiring-admin-list")).toBeNull();
    expect(screen.queryByText("Other Person")).toBeNull();
    expect(screen.getByTestId("status-application").textContent).toBe("In progress");
    expect(screen.getByTestId("status-direct_deposit").textContent).toBe("Reviewed");
    expect(screen.getByTestId("status-w4").textContent).toBe("Not started");
    expect(screen.getByTestId("packet-progress").textContent).toBe("1 of 6 signed");
    expect(document.body.textContent).not.toContain("123-45-6789");
    expect(document.body.textContent).not.toContain("123456789");
    expect(document.body.textContent).not.toContain("0012345678");
    expect(document.body.textContent).not.toContain("021000021");

    fireEvent.change(screen.getByLabelText("Position"), { target: { value: "Showroom lead" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSave).toHaveBeenCalledWith("application", expect.objectContaining({ position: "Showroom lead" }));
    expect(JSON.stringify(onSave.mock.calls)).not.toContain("123456789");

    fireEvent.click(screen.getByRole("button", { name: /State withholding/ }));
    expect(screen.getByTestId("state-unset").textContent).toMatch(/has not chosen the state/);
  });

  it("names the withholding certificate from the configured state", () => {
    render(
      <HiringPacketScreen
        viewer={hire}
        settings={{ ...EMPTY_HIRING_SETTINGS, stateCode: "NY", handbookTitle: "Shop handbook", handbookVersion: "2026.1", handbookBody: "Wear closed-toe shoes." }}
        summaries={[]}
        packet={packet()}
        onSelectPacket={vi.fn()}
        onSave={vi.fn()}
        onSign={vi.fn()}
        onReview={vi.fn()}
        onUpload={vi.fn()}
        onOpenFile={vi.fn()}
        onConfigure={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /State withholding/ }));
    expect(screen.getByRole("heading", { name: "New York employee's withholding certificate" })).toBeTruthy();
    expect(screen.queryByText(/California employee's/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Form W-4/ }));
    expect(screen.getByText(/\$2,200/)).toBeTruthy();
    expect(screen.getByText(/\$500/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Form I-9/ }));
    expect(screen.getByText("Last Name (Family Name)")).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/List A — one document/));
    expect(screen.getByText("U.S. Passport or U.S. Passport Card")).toBeTruthy();
  });
});

describe("job board admin review", () => {
  it("shows each document's signature date and reviewer, with numbers masked", () => {
    const onReview = vi.fn();
    const onOpenFile = vi.fn();
    const withFile = packet();
    withFile.documents = withFile.documents.map((document) => document.kind === "i9_section1"
      ? { ...document, status: "signed", signedAt: "2026-11-02T18:00:00.000Z", signedByName: "Ada Lovelace", files: [{ id: 9, documentKind: "i9_section1", slot: "list_a", filename: "passport.pdf", mimeType: "application/pdf" }] }
      : document);
    render(
      <HiringPacketScreen
        viewer={admin}
        settings={{ ...EMPTY_HIRING_SETTINGS, stateCode: "NY" }}
        summaries={[
          { id: 5, userId: 42, applicantName: "Ada Lovelace", applicantEmail: "ada@example.com", progress: { total: 6, signedOrReviewed: 2, byStatus: { not_started: 4, in_progress: 0, signed: 1, reviewed: 1 } } },
          { id: 6, userId: 7, applicantName: "Other Person", applicantEmail: "other@example.com", progress: { total: 6, signedOrReviewed: 0, byStatus: { not_started: 6, in_progress: 0, signed: 0, reviewed: 0 } } },
        ]}
        packet={null}
        onSelectPacket={vi.fn()}
        onSave={vi.fn()}
        onSign={vi.fn()}
        onReview={onReview}
        onUpload={vi.fn()}
        onOpenFile={onOpenFile}
        onConfigure={vi.fn()}
      />,
    );
    expect(screen.getByText("Other Person")).toBeTruthy();
    expect(screen.getByTestId("withholding-state")).toBeTruthy();
  });

  it("reviews one hire without a public file link", () => {
    const onReview = vi.fn();
    const onOpenFile = vi.fn();
    const reviewed = packet();
    reviewed.documents = reviewed.documents.map((document) => document.kind === "i9_section1"
      ? {
        ...document,
        status: "signed" as const,
        signedAt: "2026-11-02T18:00:00.000Z",
        signedByName: "Ada Lovelace",
        payload: { ssnLast4: "6789" },
        files: [{ id: 9, documentKind: "i9_section1" as const, slot: "list_a", filename: "passport.pdf", mimeType: "application/pdf" }],
      }
      : document);
    render(
      <HiringPacketScreen
        viewer={admin}
        settings={{ ...EMPTY_HIRING_SETTINGS, stateCode: "NY" }}
        summaries={[]}
        packet={reviewed}
        onSelectPacket={vi.fn()}
        onSave={vi.fn()}
        onSign={vi.fn()}
        onReview={onReview}
        onUpload={vi.fn()}
        onOpenFile={onOpenFile}
        onConfigure={vi.fn()}
      />,
    );
    expect(screen.getByTestId("hiring-review")).toBeTruthy();
    expect(screen.getByTestId("signed-application").textContent).toBe("Signed 2026-11-02 by Ada Lovelace");
    expect(screen.getByTestId("reviewed-direct_deposit").textContent).toBe("Reviewed 2026-11-03 by Tom");
    expect(screen.getByTestId("ssn-i9_section1").textContent).toBe("SSN •••-••-6789");
    expect(screen.getByTestId("account-direct_deposit").textContent).toBe("Account ••••5678");
    expect(document.body.innerHTML).not.toContain("/manus-storage/");
    expect(document.body.innerHTML).not.toContain("site-media");
    fireEvent.click(screen.getByRole("button", { name: "Open passport.pdf" }));
    expect(onOpenFile).toHaveBeenCalledWith(9);
    fireEvent.click(screen.getAllByRole("button", { name: "Mark reviewed" })[0]!);
    expect(onReview).toHaveBeenCalled();
  });
});

describe("job board placement", () => {
  it("adds the Job Board tab on the admin People group and lets a hire open only that tab", () => {
    const tabs = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const people = tabs.slice(tabs.indexOf('label: "People"'), tabs.indexOf('label: "Products & Catalog"'));
    expect(people).toContain('{ value: "job-board", label: "Job Board" }');
    expect(tabs).toContain('<TabsContent value="job-board"');
    expect(tabs).toContain("<JobBoard />");
    expect(admin).toContain('requestedTab === JOB_BOARD_TAB.value');
    expect(admin.indexOf('requestedTab === JOB_BOARD_TAB.value')).toBeLessThan(admin.indexOf("const isDesigner"));
    expect(admin).toContain("<JobBoard />");
  });
});
