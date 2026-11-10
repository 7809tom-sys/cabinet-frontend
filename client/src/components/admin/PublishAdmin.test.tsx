// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const auth = vi.hoisted(() => ({ role: "admin" }));
const save = vi.hoisted(() => vi.fn());
const publishState = vi.hoisted(() => ({
  status: "missing" as "missing" | "ready" | "loading" | "error",
  errorMessage: null as string | null,
  rows: [] as Array<{
    subjectKind: "distributor" | "vendor" | "global";
    subjectId: number;
    featureKey: string;
    published: boolean;
    updatedByName: string | null;
    updatedAt: string | null;
  }>,
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: auth.role }, loading: false, error: null, isAuthenticated: true }),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    distributorAdmin: {
      adminList: {
        useQuery: () => ({
          data: [{ id: 4, code: "ACME", name: "Acme Cabinets", isActive: true }],
          isLoading: false,
          error: null,
        }),
      },
    },
    vendors: {
      list: {
        useQuery: () => ({
          data: [{ id: 8, name: "Pelican Supply", isApproved: true, sourceKey: "pelican", linkedDistributor: null }],
          isLoading: false,
          error: null,
        }),
      },
    },
  },
}));

vi.mock("@/lib/useAffiliateFeaturePublish", () => ({
  useAffiliateFeaturePublish: () => ({
    status: publishState.status,
    errorMessage: publishState.errorMessage,
    rows: publishState.rows,
    anyPublished: (featureKey: string) => publishState.rows.some((row) => row.published && row.featureKey === featureKey),
    isPublished: () => false,
  }),
  useSetAffiliateFeaturePublish: () => ({ mutate: save, isPending: false }),
}));

import PublishAdmin from "./PublishAdmin";

afterEach(() => {
  cleanup();
  auth.role = "admin";
  publishState.status = "missing";
  publishState.rows = [];
  save.mockClear();
});

describe("Publish tab", () => {
  it("lists every distributor and vendor with a Publish for affiliates switch, and says the API is missing", () => {
    render(<PublishAdmin />);
    expect(screen.getByRole("heading", { name: "Publish" })).toBeTruthy();
    expect(screen.getByText("1 distributors")).toBeTruthy();
    expect(screen.getByText("1 vendors")).toBeTruthy();
    expect(screen.getByTestId("publish-backend-missing").textContent).toContain("0269_affiliate_feature_publish");
    const row = screen.getByTestId("publish-row-distributor-4-kitchen_designer");
    expect(row.textContent).toContain("Acme Cabinets");
    expect(row.textContent).toContain("Kitchen designer");
    expect(row.textContent).toContain("Unknown");
    expect(screen.getByTestId("publish-row-vendor-8-closet_studio").textContent).toContain("Pelican Supply");
    const toggle = screen.getByRole("switch", { name: "Publish for affiliates: Acme Cabinets Kitchen designer" }) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    fireEvent.click(toggle);
    expect(save).not.toHaveBeenCalled();
  });

  it("shows the stored published state and who changed it", () => {
    publishState.status = "ready";
    publishState.rows = [{
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "bathroom_builder",
      published: true,
      updatedByName: "Tom",
      updatedAt: "2026-11-02T15:04:00.000Z",
    }];
    render(<PublishAdmin />);
    const row = screen.getByTestId("publish-row-distributor-4-bathroom_builder");
    expect(row.textContent).toContain("Published");
    expect(row.textContent).toContain("Tom");
    fireEvent.click(screen.getByRole("switch", { name: "Publish for affiliates: Acme Cabinets Bathroom builder" }));
    expect(save).toHaveBeenCalledWith({
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "bathroom_builder",
      published: false,
    });
  });

  it("puts Bathroom builder first and saves Off everywhere as a global row with published off", () => {
    publishState.status = "ready";
    render(<PublishAdmin />);
    const switches = screen.getAllByRole("switch", { name: /Off everywhere:/ });
    expect(switches[0].getAttribute("aria-label")).toBe("Off everywhere: Bathroom builder");
    expect(switches).toHaveLength(16);
    fireEvent.click(switches[0]);
    expect(save).toHaveBeenCalledWith({
      subjectKind: "global",
      subjectId: 0,
      featureKey: "bathroom_builder",
      published: false,
    });
    fireEvent.click(screen.getByRole("switch", { name: "Shut off Acme Cabinets" }));
    expect(save).toHaveBeenCalledWith({
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "all",
      published: false,
    });
    expect(screen.queryByRole("switch", { name: "Shut off Pelican Supply" })).toBeNull();
  });

  it("turns Off everywhere back off by saving published on, without removing the row", () => {
    publishState.status = "ready";
    publishState.rows = [{
      subjectKind: "global",
      subjectId: 0,
      featureKey: "bathroom_builder",
      published: false,
      updatedByName: "Tom",
      updatedAt: "2026-11-10T15:00:00.000Z",
    }];
    render(<PublishAdmin />);
    const item = screen.getByTestId("off-everywhere-bathroom_builder");
    expect(item.textContent).toContain("Tom");
    fireEvent.click(screen.getByRole("switch", { name: "Off everywhere: Bathroom builder" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({
      subjectKind: "global",
      subjectId: 0,
      featureKey: "bathroom_builder",
      published: true,
    });
  });

  it("saves Shut off for that distributor as featureKey all, and turning it back off restores by saving published on", () => {
    publishState.status = "ready";
    publishState.rows = [{
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "all",
      published: false,
      updatedByName: "Tom",
      updatedAt: "2026-11-10T15:04:00.000Z",
    }, {
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "bathroom_builder",
      published: true,
      updatedByName: "Tom",
      updatedAt: "2026-11-02T15:04:00.000Z",
    }];
    render(<PublishAdmin />);
    const shutoff = screen.getByTestId("publish-shutoff-distributor-4");
    expect(shutoff.textContent).toContain("Shut off Acme Cabinets");
    expect(shutoff.textContent).toContain("Tom");
    fireEvent.click(screen.getByRole("switch", { name: "Shut off Acme Cabinets" }));
    expect(save).toHaveBeenCalledWith({
      subjectKind: "distributor",
      subjectId: 4,
      featureKey: "all",
      published: true,
    });
    expect(screen.getByTestId("publish-row-distributor-4-bathroom_builder").textContent).toContain("Published");
  });

  it("stays closed for anyone who is not an admin", () => {
    auth.role = "sales_rep";
    render(<PublishAdmin />);
    expect(screen.getByTestId("publish-denied").textContent).toContain("platform administrators");
    expect(screen.queryByTestId("publish-admin")).toBeNull();
  });
});

describe("Publish wiring", () => {
  const tabs = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
  const admin = readFileSync(resolve(process.cwd(), "client/src/components/admin/PublishAdmin.tsx"), "utf8");
  const literature = readFileSync(resolve(process.cwd(), "client/src/components/admin/AffiliateLiteratureAdmin.tsx"), "utf8");

  it("is the Publish admin tab and does not edit the literature library", () => {
    expect(tabs).toContain('<TabsContent value="publish" className="mt-6"><AdminTabErrorBoundary tabName="Publish"><AdminTabHelp tab="publish" /><PublishAdmin /></AdminTabErrorBoundary></TabsContent>');
    expect(admin).toContain("Publish for affiliates");
    expect(admin).toContain("listAffiliateFeaturePublish");
    expect(admin).not.toContain("AffiliateLiteratureAdmin");
    expect(admin).not.toContain("libraryAdminProcedures");
    expect(literature).toContain("useAffiliateLiteratureAdmin");
  });
});
