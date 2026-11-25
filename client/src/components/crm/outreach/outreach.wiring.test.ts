import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const board = readFileSync(new URL("../CrmBoard.tsx", import.meta.url), "utf8");
const importDialog = readFileSync(new URL("./CustomerListImportAdminDialog.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("./OutreachPanel.tsx", import.meta.url), "utf8");

describe("admin CRM import + outreach wiring", () => {
  it("shows the admin import and the Outreach view only in the admin master CRM", () => {
    expect(board).toContain("{isMasterView && <CustomerListImportAdminDialog />}");
    expect(board).toContain('isMasterView ? (["board", "table", "email", "outreach", "distributors", "cabinetShops"] as const) : (["board", "table", "email"] as const)');
    expect(board).toContain('crmView === "outreach" && isMasterView ? (');
    // The Outreach pill (with its explainer) still switches to the Outreach view.
    expect(board).toContain("<OutreachViewButton key={view} active={crmView === view} onSelect={() => setCrmView(view)} />");
  });

  it("adds a master-only Distributors view that narrows the stage board to distributor prospects", () => {
    expect(board).toContain('const distributorsViewOpen = crmView === "distributors" && (data as any)?.isMasterView === true;');
    expect(board).toContain("const viewDeals = distributorsViewOpen ? distributorDeals : cabinetShopsViewOpen ? cabinetShopStateDeals : mondayDeals;");
    expect(board).toContain("`Distributors (${distributorDeals.length})`");
  });

  it("relabels the New column as Distributor only while the Distributors view is open", () => {
    expect(board).toContain('DISTRIBUTORS_VIEW_STAGE_LABELS: Partial<Record<CrmStage, string>> = { new: "Distributor" }');
    expect(board).toContain("distributorsViewOpen\n    ? DISTRIBUTORS_VIEW_STAGE_LABELS\n    : cabinetShopsViewOpen ? CABINET_SHOPS_VIEW_STAGE_LABELS : undefined");
    expect(board).toContain("stageLabels={stageLabelOverrides}");
    expect(board).toContain("stageLabelOverrides?.[stage] ?? CRM_STAGE_LABELS[stage][lang]");
  });

  it("adds a master-only Cabinet Shops view with a state filter and its own New column label", () => {
    expect(board).toContain('const cabinetShopsViewOpen = crmView === "cabinetShops" && (data as any)?.isMasterView === true;');
    expect(board).toContain("`Cabinet Shops (${cabinetShopDeals.length})`");
    expect(board).toContain('CABINET_SHOPS_VIEW_STAGE_LABELS: Partial<Record<CrmStage, string>> = { new: "Cabinet shop" }');
    expect(board).toContain('aria-label="Filter cabinet shops by state"');
  });

  it("keeps the existing affiliate customer-list import untouched", () => {
    expect(board).toContain("<CustomerListImportDialog lang={lang} affiliateId={affiliateId} />");
    expect(board).toContain("trpc.crm.importCustomerList.useMutation");
  });

  it("imports in batches and reports imported / duplicates / skipped", () => {
    expect(importDialog).toContain("chunkRows(plan.valid)");
    expect(importDialog).toContain("trpc.crmOutreach.importBatch.useMutation");
    expect(importDialog).toMatch(/imported ·/);
    expect(importDialog).toMatch(/duplicates \(/);
    expect(importDialog).toMatch(/skipped \(no valid email\)/);
  });

  it("never names a supplier in the admin outreach copy", () => {
    for (const source of [importDialog, panel]) {
      expect(source).not.toMatch(/US Cabinet Depot|USCD|Pelican/i);
    }
  });
});
