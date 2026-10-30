import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ApprovedDoorReferenceNotice } from "./ApprovedDoorReferenceNotice";
import { DoorRenderingAuditView, type DoorRenderingAuditViewProps } from "./DoorRenderingAuditAdmin";
import { STAINLESS_DOOR_STYLE_FIXTURE } from "@/lib/approvedDoorReference";
import { doorAuditStyleLabel, normalizeDoorAuditList, type DoorAuditStyleRow, type DoorAuditVersion } from "@/lib/doorRenderingAudit";

function version(overrides: Partial<DoorAuditVersion> & Pick<DoorAuditVersion, "versionId" | "imageUrl">): DoorAuditVersion {
  return {
    createdAt: "2026-10-20T15:04:00.000Z",
    scores: { grain: 8.1, color: 7.4, textureSheen: 6.8, profileEdges: 9, overall: 8.2 },
    scoreStatus: "scored",
    isCurrent: false,
    isAcceptedBaseline: false,
    isApprovedReference: false,
    review: "pending",
    ...overrides,
  };
}

function row(): DoorAuditStyleRow {
  const accepted = version({
    versionId: 2,
    imageUrl: "/accepted.png",
    isAcceptedBaseline: true,
    review: "accepted",
    scores: { grain: 6, color: 6, textureSheen: 6, profileEdges: 6, overall: 6.4 },
  });
  return {
    styleId: 41,
    name: "Summit White",
    code: "SW-41",
    distributorName: "Line A",
    samplePhotoUrl: "/sample.png",
    drawerSampleImageUrl: null,
    color: "#f4f1ea",
    sourceFingerprint: "fp",
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
    changedSinceLastRender: true,
    current: version({ versionId: 9, imageUrl: "/latest.png", isCurrent: true }),
    accepted,
    previous: accepted,
    approvedReference: null,
    featuredFailures: [],
    sourceStatus: "no-approved-source",
    profileSource: "distributor",
    flag: "improved",
  };
}

function props(overrides: Partial<DoorRenderingAuditViewProps> = {}): DoorRenderingAuditViewProps {
  return {
    styles: [row()],
    counts: { all: 12, flagged: 2, furthest: 8, unaudited: 3 },
    isLoading: false,
    errorMessage: null,
    filter: "flagged",
    onFilter: () => undefined,
    search: "",
    onSearch: () => undefined,
    selectedIds: [41],
    onToggle: () => undefined,
    onToggleVisible: () => undefined,
    progress: { phase: "scoring", completed: 4, total: 12, detail: null, error: null },
    onContinue: null,
    onRun: () => undefined,
    onRerun: () => undefined,
    onReview: () => undefined,
    onApprove: () => undefined,
    onRevoke: () => undefined,
    onUseVersion: () => undefined,
    historyStyleId: 41,
    historyLoading: false,
    historyVersions: [
      version({ versionId: 9, imageUrl: "/latest.png", isCurrent: true }),
      version({ versionId: 2, imageUrl: "/accepted.png", isAcceptedBaseline: true, review: "accepted" }),
      version({ versionId: 1, imageUrl: "/older.png", createdAt: "2026-09-02T12:00:00.000Z", scores: { grain: 5, color: 5, textureSheen: 5, profileEdges: 5, overall: 5.1 } }),
    ],
    onToggleHistory: () => undefined,
    runs: [],
    runsOpen: false,
    onToggleRuns: () => undefined,
    onAbandon: null,
    runLimitNotice: null,
    busy: false,
    ...overrides,
  };
}

describe("Door Rendering Audit admin", () => {
  it("is an admin-only Products & Catalog tab", () => {
    const tabs = readFileSync(new URL("./AdminGroupedTabs.tsx", import.meta.url), "utf8");
    const nav = readFileSync(new URL("./catalogAdminTabs.ts", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../../pages/Admin.tsx", import.meta.url), "utf8");
    const help = readFileSync(new URL("./AdminTabHelp.tsx", import.meta.url), "utf8");
    expect(nav).toContain('{ value: "door-rendering-audit", label: "Door Rendering Audit", editors: ["DoorRenderingAuditAdmin"], help: "door-rendering-audit", boundary: "Door Rendering Audit" }');
    expect(tabs).toContain('<TabsContent value="door-rendering-audit" className="mt-6"><AdminTabErrorBoundary tabName="Door Rendering Audit"><AdminTabHelp tab="door-rendering-audit" /><DoorRenderingAuditAdmin /></AdminTabErrorBoundary></TabsContent>');
    expect(help).toContain('"door-rendering-audit"');
    const salesRep = admin.indexOf("if (isSalesRep)");
    const designer = admin.indexOf("if (isDesigner)");
    const grouped = admin.indexOf("<AdminGroupedTabs");
    expect(salesRep).toBeGreaterThan(-1);
    expect(designer).toBeGreaterThan(salesRep);
    expect(grouped).toBeGreaterThan(designer);
    expect(admin.slice(0, grouped)).not.toContain("door-rendering-audit");
    expect(admin.slice(0, grouped)).not.toContain("DoorRenderingAudit");
  });

  it("keeps Run disabled while an earlier run is still open and offers abandon and continue", () => {
    const markup = renderToStaticMarkup(<DoorRenderingAuditView {...props({
      progress: { phase: "awaiting-renders", completed: 0, total: 40, detail: "Summit White", error: null },
      canStartRuns: false,
      onContinue: () => undefined,
      onAbandon: () => undefined,
    })} />);
    expect(markup).toContain("Continue upload");
    expect(markup).toContain("data-testid=\"door-audit-abandon\"");
    expect(markup).toContain("Waiting for door renders");
    expect(markup).toMatch(/disabled[^>]*>Run all/);
  });

  it("shows the sample, accepted baseline, and latest render with revert and version restore", () => {
    const markup = renderToStaticMarkup(<DoorRenderingAuditView {...props()} />);
    expect(markup).toContain("Door Rendering Audit");
    expect(markup).toContain("Sample photo");
    expect(markup).toContain("Accepted baseline");
    expect(markup).toContain("Latest render");
    expect(markup).toContain("/sample.png");
    expect(markup).toContain("/accepted.png");
    expect(markup).toContain("/latest.png");
    expect(markup).toContain("Revert to previous");
    expect(markup).toContain("Use this version");
    expect(markup).toContain("Grain");
    expect(markup).toContain("Texture / sheen");
    expect(markup).toContain("Profile / edges");
    expect(markup).toContain("Improved");
    expect(markup).toContain("Scoring renders · 4 of 12");
    expect(markup).toContain("data-testid=\"door-audit-comparison\"");
    expect(markup).toContain("data-testid=\"door-audit-revert\"");
    expect(markup).toContain("data-testid=\"door-audit-version-history\"");
  });

  it("keeps the backend procedure names the admin screen calls", () => {
    const api = readFileSync(new URL("./doorRenderingAuditApi.ts", import.meta.url), "utf8");
    for (const name of [
      "listStyles",
      "startRun",
      "submitRender",
      "runStatus",
      "decideRender",
      "revertToVersion",
      "runHistory",
      "styleVersions",
      "abandonRun",
      "approveRender",
      "revokeApproval",
      "doorAuditStartRunInput",
      "normalizeDoorAuditStartRun",
      "doorAuditSubmitRenderInput",
      "normalizeDoorAuditList",
    ]) {
      expect(api).toContain(name);
    }
    expect(api).toContain("adminProcedure");
    expect(api).toContain("scope");
    expect(api).toContain("imageBase64");
    const screen = readFileSync(new URL("./DoorRenderingAuditAdmin.tsx", import.meta.url), "utf8");
    expect(screen).toContain("doorRenderingAuditAllowed");
    expect(screen).toContain("doorAuditStyleLabel");
    expect(screen).toContain('import("@/lib/doorAuditDoorRender")');
    expect(screen).toContain("doorAuditOpenRunId");
    expect(screen).toContain("listRuns.useQuery({ limit: 20 })");
    expect(screen).not.toContain("reportRenderFailure");
  });

  it("shows the catalog door name, code, and supplier from the backend style shape", () => {
    const list = normalizeDoorAuditList({
      counts: { total: 1, returned: 1, flagged: 1, noBaseline: 0, missingSample: 0 },
      styles: [{
        styleId: 41,
        styleCode: "SW-41",
        ourName: "Summit White Shaker",
        aliasName: "Summit White",
        distributorName: "Summit Cabinets",
        brandName: "Summit",
        samplePhotoUrl: "https://cdn.example/summit.jpg",
        color: "#f4f1ea",
        profile: {
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
        latestRender: {
          versionId: 9,
          renderImageUrl: "https://cdn.example/latest.png",
          createdAt: "2026-10-20T15:04:00.000Z",
          scores: { woodGrain: 8, color: 7, textureSheen: 7, profileEdges: 9, overall: 8.4 },
          isCurrentAccepted: false,
          verdict: "flagged",
        },
        acceptedRender: {
          versionId: 2,
          renderImageUrl: "https://cdn.example/accepted.png",
          createdAt: "2026-09-02T12:00:00.000Z",
          scores: { woodGrain: 6, color: 6, textureSheen: 6, profileEdges: 6, overall: 6.4 },
          isCurrentAccepted: true,
        },
        flagStatus: "flagged",
      }],
    });
    const identity = doorAuditStyleLabel(list.styles[0]);
    const markup = renderToStaticMarkup(<DoorRenderingAuditView {...props({
      styles: list.styles,
      counts: list.counts,
      historyStyleId: 41,
      progress: { phase: "rendering", completed: 0, total: 1, detail: identity, error: null },
    })} />);
    expect(list.styles[0]?.name).toBe("Summit White Shaker");
    expect(list.styles[0]?.code).toBe("SW-41");
    expect(list.styles[0]?.distributorName).toBe("Summit Cabinets");
    expect(list.styles[0]?.doorProfile.doorStyle).toBe("Shaker");
    expect(markup).toContain("Summit White Shaker");
    expect(markup).toContain("SW-41");
    expect(markup).toContain("Summit Cabinets");
    expect(markup).toContain("data-testid=\"door-audit-style-name\"");
    expect(markup).toContain("data-testid=\"door-audit-style-label\"");
    expect(markup).toContain("data-testid=\"door-audit-version-history-label\"");
    expect(markup).toContain(`Rendering ${identity} · 0 of 1`);
    expect(markup).toContain("https://cdn.example/summit.jpg");
    expect(markup).toContain("No approved source");
  });

  it("shows abandon, a run that continues past 40 styles, and the Stainless featured-image failure", () => {
    const stainless = STAINLESS_DOOR_STYLE_FIXTURE;
    const markup = renderToStaticMarkup(
      <>
        <DoorRenderingAuditView
          {...props({
            progress: { phase: "rendering", completed: 40, total: 86, detail: "Summit White", error: null },
            onAbandon: () => undefined,
            runLimitNotice: "This run queued 40 of 86 styles. Abandon it and start again if the server is still stopping early. Saved renders are kept.",
          })}
        />
        <ApprovedDoorReferenceNotice
          approvedReferenceImageUrl={stainless.approvedReferenceImageUrl}
          doorSampleImageUrl={stainless.doorSampleImageUrl}
          drawerSampleImageUrl={stainless.drawerSampleImageUrl}
        />
      </>,
    );
    expect(markup).toContain("data-testid=\"door-audit-abandon\"");
    expect(markup).toContain("Abandon run");
    expect(markup).toContain("Rendering Summit White · 40 of 86");
    expect(markup).toContain("40 of 86");
    expect(markup).toContain("Approved reference");
    expect(markup).toContain("match approved source");
    expect(markup).toContain("Door:");
    expect(markup).toContain("Drawer:");
    expect(markup).toContain("data-testid=\"featured-mismatch-door\"");
    expect(markup).toContain("data-testid=\"featured-mismatch-drawer\"");
  });
});
