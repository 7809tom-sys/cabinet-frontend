import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DoorRenderingAuditView, type DoorRenderingAuditViewProps } from "./DoorRenderingAuditAdmin";
import type { DoorAuditStyleRow, DoorAuditVersion } from "@/lib/doorRenderingAudit";

function version(overrides: Partial<DoorAuditVersion> & Pick<DoorAuditVersion, "versionId" | "imageUrl">): DoorAuditVersion {
  return {
    createdAt: "2026-10-20T15:04:00.000Z",
    scores: { grain: 8.1, color: 7.4, textureSheen: 6.8, profileEdges: 9, overall: 8.2 },
    scoreStatus: "scored",
    isCurrent: false,
    isAcceptedBaseline: false,
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
    busy: false,
    ...overrides,
  };
}

describe("Door Rendering Audit admin", () => {
  it("is an admin-only Products & Catalog tab", () => {
    const tabs = readFileSync(new URL("./AdminGroupedTabs.tsx", import.meta.url), "utf8");
    const admin = readFileSync(new URL("../../pages/Admin.tsx", import.meta.url), "utf8");
    const help = readFileSync(new URL("./AdminTabHelp.tsx", import.meta.url), "utf8");
    expect(tabs).toContain('{ value: "door-rendering-audit", label: "Door Rendering Audit" }');
    expect(tabs).toContain('<TabsContent value="door-rendering-audit" className="mt-6"><AdminTabHelp tab="door-rendering-audit" /><DoorRenderingAuditAdmin /></TabsContent>');
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
      "reportRenderFailure",
      "runStatus",
      "reviewRender",
      "listRuns",
      "listVersions",
      "setCurrentVersion",
    ]) {
      expect(api).toContain(name);
    }
    expect(api).toContain("adminProcedure");
    const screen = readFileSync(new URL("./DoorRenderingAuditAdmin.tsx", import.meta.url), "utf8");
    expect(screen).toContain("doorRenderingAuditAllowed");
    expect(screen).toContain('import("@/lib/doorAuditDoorRender")');
  });
});
