/**
 * Screenshot harness for the designer helper queue.
 *
 * Every card here is the SHIPPED component from
 * `client/src/components/design/designerHelperCards.tsx`, fed fixture data. The
 * toolbar strip and plan behind it are static furniture so a capture looks like
 * the Designer; the cards themselves are the real ones. Loaded only by
 * `dev/helper-shot.html` during the screenshot run
 * (`e2e/designer-helper-queue-screenshots.spec.ts`).
 */
import { createRoot } from "react-dom/client";
import {
  AdminHelperRequestCard,
  HelperNoticeBadge,
  HelperQueueList,
  HelperRequestNoticeCard,
  HelperShareButton,
  HelperSignCard,
} from "@/components/design/designerHelperCards";
import type { HelperQueueEntry, HelperRequest } from "@shared/designerHelperQueue";
import "../src/index.css";

const requested: HelperRequest = {
  id: 412,
  designId: 9821,
  designName: "Miller kitchen",
  customerUserId: 3,
  customerName: "Dana Miller",
  customerEmail: "dana.miller@example.com",
  customerPhone: "(770) 555-0143",
  helpNote: "Is the island overhang right, and did I pick the correct filler beside the range?",
  status: "open",
  shareToken: "share-token-demo",
  affiliateSlug: null,
  requestedAt: "2026-11-06T09:14:00.000Z",
  acceptedByUserId: null,
  acceptedByName: null,
  acceptedAt: null,
  joinedByUserId: null,
  joinedByName: null,
  joinedAt: null,
  closedAt: null,
};

const accepted: HelperRequest = {
  ...requested,
  status: "accepted",
  acceptedByUserId: 12,
  acceptedByName: "Rich",
  acceptedAt: "2026-11-06T09:20:00.000Z",
};

const queue: HelperQueueEntry[] = [
  {
    designerUserId: 12,
    designerName: "Rich",
    email: "rich@cabinetdealz.com",
    available: true,
    signedOnAt: "2026-11-06T08:05:00.000Z",
    acceptedCount: 6,
  },
  {
    designerUserId: 19,
    designerName: "Alex Rivera",
    email: "alex.rivera@cabinetdealz.com",
    available: true,
    signedOnAt: "2026-11-06T08:40:00.000Z",
    acceptedCount: 1,
  },
];

const designPath = "/design?load=9821&helperRequest=412&assist=1";

function ToolbarStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="toolbar-strip">
      <span className="toolbar-title">Kitchen Designer</span>
      <span className="toolbar-count">8 items</span>
      <span className="fake-btn">Floor Plan</span>
      <span className="fake-btn">3D View</span>
      <span className="fake-btn">Pelican</span>
      <span className="fake-btn primary">Update design</span>
      {children}
    </div>
  );
}

function PlanBehind() {
  return (
    <div className="plan-mock">
      <div className="cab" style={{ left: 40, top: 30, width: 90, height: 34 }} />
      <div className="cab" style={{ left: 130, top: 30, width: 90, height: 34 }} />
      <div className="cab" style={{ left: 220, top: 30, width: 60, height: 34 }} />
      <div className="cab" style={{ left: 40, top: 64, width: 34, height: 90 }} />
      <div className="cab" style={{ left: 420, top: 150, width: 120, height: 60 }} />
      <p className="plan-caption">Dana Miller · Miller kitchen · 8 cabinets</p>
    </div>
  );
}

function ShareShot() {
  return (
    <div className="stack">
      <ToolbarStrip>
        <span className="fake-btn">Materials</span>
        <span className="fake-btn">Focus</span>
      </ToolbarStrip>
      <div className="row">
        <div className="col" style={{ flex: 2 }}>
          <PlanBehind />
        </div>
        {/* The right-hand pricing panel, where the customer sees the total and
            the Share / Get a designer helper action ships under it. */}
        <div className="col" style={{ flex: "0 0 270px", border: "1px solid #e2ddd2", borderRadius: 8, background: "#fff", padding: 12 }}>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 6px" }}>Current selections</p>
          <p style={{ fontSize: 12, margin: "0 0 2px" }}>Shaker White · 8 cabinets</p>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Island: no island</p>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "14px 0 8px" }}>
            <span style={{ fontSize: 13, color: "#475569" }}>Estimated total</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: "#1a2744" }}>$4,182.40</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 8 }}>
            <span className="fake-btn primary" style={{ justifyContent: "center" }}>Cart</span>
            <span className="fake-btn" style={{ justifyContent: "center" }}>Surfaces</span>
            <span className="fake-btn" style={{ justifyContent: "center" }}>Sink</span>
            <span className="fake-btn" style={{ justifyContent: "center" }}>Designer</span>
          </div>
          <HelperShareButton onClick={() => undefined} />
        </div>
      </div>
    </div>
  );
}

function NoticeShot() {
  return (
    <div className="stack">
      <div className="header-mock">
        <span className="header-logo">Cabinet<em>Dealz</em></span>
        <span className="fake-btn">Shop by Style</span>
        <span className="fake-btn">All Cabinets</span>
        <HelperNoticeBadge count={2} href={designPath} />
      </div>
      <div className="stack">
        <HelperRequestNoticeCard request={requested} designPath={designPath} onOpen={() => undefined} />
        <HelperRequestNoticeCard request={accepted} designPath={designPath} onOpen={() => undefined} />
      </div>
      <HelperSignCard
        available
        signedOnAt="2026-11-06T08:05:00.000Z"
        designerName="Rich"
        email="rich@cabinetdealz.com"
        queuePosition={1}
        queuedCount={2}
        onToggle={() => undefined}
      />
      <HelperQueueList queue={queue} signedOn />
    </div>
  );
}

function AdminShot() {
  return (
    <div className="stack" style={{ maxWidth: 460 }}>
      <AdminHelperRequestCard request={requested} onJoin={() => undefined} onOpenRequest={() => undefined} />
      <AdminHelperRequestCard request={accepted} onJoin={() => undefined} onOpenRequest={() => undefined} />
    </div>
  );
}

const SHOTS: Record<string, { title: string; render: () => React.ReactNode }> = {
  share: { title: "Customer · Share / Get a designer helper", render: () => <ShareShot /> },
  notice: { title: "Designer · helper notice, badge and Helper sign", render: () => <NoticeShot /> },
  admin: { title: "Admin · designer helper pop-up", render: () => <AdminShot /> },
};

const params = new URLSearchParams(window.location.search);
const shotKey = (params.get("shot") ?? "share").trim();
const shot = SHOTS[shotKey] ?? SHOTS.share!;

document.getElementById("stage-label")!.textContent = shot.title;
createRoot(document.getElementById("stage")!).render(shot.render());

// The spec waits for this before capturing, so a slow font or image cannot
// produce a half-painted screenshot.
requestAnimationFrame(() => requestAnimationFrame(() => {
  (window as unknown as { __helperShot?: string }).__helperShot = shotKey;
}));
