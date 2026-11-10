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
    subjectKind: "distributor" | "vendor";
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
