import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AdminHelperRequestCard,
  AdminHelperRequestRow,
  HelperQueueList,
  HelperRequestNoticeCard,
  HelperShareButton,
  HelperSignCard,
  HelperNoticeBadge,
} from "./designerHelperCards";
import type { HelperQueueEntry, HelperRequest } from "@shared/designerHelperQueue";

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useLocation: () => ["/admin", () => undefined],
  useSearch: () => "",
}));

function request(patch: Partial<HelperRequest> = {}): HelperRequest {
  return {
    id: 12,
    designId: 88,
    designName: "Dana's kitchen",
    customerUserId: 5,
    customerName: "Dana Miller",
    customerEmail: "dana@example.com",
    customerPhone: "770-555-0111",
    helpNote: "Should the island have a seating overhang?",
    status: "open",
    shareToken: "share-token",
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

const queue: HelperQueueEntry[] = [
  { designerUserId: 2, designerName: "Rich", email: "rich@cabinetdealz.com", available: true, signedOnAt: "2026-11-06T08:00:00.000Z", acceptedCount: 3 },
  { designerUserId: 7, designerName: "Alex", email: null, available: true, signedOnAt: "2026-11-06T09:00:00.000Z", acceptedCount: 0 },
];

describe("share button", () => {
  it("is labelled for the customer and marked for the Designer toolbar", () => {
    const html = renderToStaticMarkup(<HelperShareButton onClick={() => undefined} />);
    expect(html).toContain('data-testid="designer-helper-share-button"');
    expect(html).toContain("Share / Get a designer helper");
  });
});

describe("designer helper notification", () => {
  it("says an available designer helper is needed and links to the customer's design", () => {
    const html = renderToStaticMarkup(
      <HelperRequestNoticeCard
        request={request()}
        designPath="/design?load=88&helperRequest=12&assist=1"
        onOpen={() => undefined}
      />,
    );
    expect(html).toContain("A designer helper is needed");
    expect(html).toContain("Dana Miller");
    expect(html).toContain("Should the island have a seating overhang?");
    expect(html).toContain('href="/design?load=88&amp;helperRequest=12&amp;assist=1"');
    expect(html).toContain("Open the customer&#x27;s shared design");
  });

  it("shows a count badge a designer can click", () => {
    const one = renderToStaticMarkup(<HelperNoticeBadge count={1} onClick={() => undefined} />);
    expect(one).toContain("1 helper request");
    const many = renderToStaticMarkup(<HelperNoticeBadge count={4} href="/design?load=88" />);
    expect(many).toContain("4 helper requests");
    expect(many).toContain('href="/design?load=88"');
  });
});

describe("helper sign toggle", () => {
  it("says the customer's design will come up in front of him when the sign is on", () => {
    const html = renderToStaticMarkup(
      <HelperSignCard
        available
        signedOnAt="2026-11-06T08:00:00.000Z"
        designerName="Rich"
        email="rich@cabinetdealz.com"
        queuePosition={1}
        queuedCount={2}
        onToggle={() => undefined}
      />,
    );
    expect(html).toContain('data-helper-sign="on"');
    expect(html).toContain("come up in front of you");
    expect(html).toContain("#1 of 2");
    expect(html).toContain("rich@cabinetdealz.com");
  });

  it("says plainly that no request is sent when the sign is off", () => {
    const html = renderToStaticMarkup(
      <HelperSignCard
        available={false}
        signedOnAt={null}
        designerName="Rich"
        email="rich@cabinetdealz.com"
        queuePosition={null}
        queuedCount={0}
        onToggle={() => undefined}
      />,
    );
    expect(html).toContain('data-helper-sign="off"');
    expect(html).toContain("no customer help requests are sent to you");
    expect(html).toContain("Not queued");
  });

  it("flags a designer whose account has no email on file instead of inventing one", () => {
    const html = renderToStaticMarkup(
      <HelperSignCard
        available
        signedOnAt="2026-11-06T08:00:00.000Z"
        designerName="Alex"
        email={null}
        queuePosition={2}
        queuedCount={2}
        onToggle={() => undefined}
      />,
    );
    expect(html).toContain("None on file");
    expect(html).toContain("cannot be emailed to you");
  });

  it("lists the queue with each designer's regular email address from their account", () => {
    const html = renderToStaticMarkup(<HelperQueueList queue={queue} signedOn />);
    expect(html).toContain("Rich");
    expect(html).toContain("rich@cabinetdealz.com");
    expect(html).toContain("no email on file");
  });
});

describe("admin pop-up", () => {
  it("shows every request fact, including time, status, and who accepted", () => {
    const accepted = request({
      status: "accepted",
      acceptedByName: "Rich",
      acceptedAt: "2026-11-06T09:20:00.000Z",
    });
    const html = renderToStaticMarkup(
      <AdminHelperRequestCard request={accepted} onJoin={() => undefined} onOpenRequest={() => undefined} />,
    );
    expect(html).toContain("A customer wants a designer helper");
    expect(html).toContain("Dana Miller");
    expect(html).toContain("dana@example.com");
    expect(html).toContain("770-555-0111");
    expect(html).toContain("Dana&#x27;s kitchen");
    expect(html).toContain("Should the island have a seating overhang?");
    expect(html).toContain("Accepted by a designer");
    expect(html).toContain("Rich accepted");
    expect(html).toMatch(/Request #12/);
  });

  it("offers both open-request and join-design actions", () => {
    const html = renderToStaticMarkup(
      <AdminHelperRequestCard request={request()} onJoin={() => undefined} onOpenRequest={() => undefined} />,
    );
    expect(html).toContain('data-testid="admin-helper-request-join"');
    expect(html).toContain("Join the design");
    expect(html).toContain('data-testid="admin-helper-request-open"');
    expect(html).toContain("Open request");
  });

  it("records who joined in the request row", () => {
    const joined = request({
      status: "joined",
      acceptedByName: "Rich",
      acceptedAt: "2026-11-06T09:20:00.000Z",
      joinedByName: "Rich",
      joinedAt: "2026-11-06T09:22:00.000Z",
    });
    const html = renderToStaticMarkup(
      <AdminHelperRequestRow request={joined} onJoin={() => undefined} />,
    );
    expect(html).toContain("joined the design");
    expect(html).toContain("Join design");
  });
});
