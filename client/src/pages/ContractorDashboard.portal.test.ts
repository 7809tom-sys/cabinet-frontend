import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ContractorDashboard.tsx"), "utf8");
const estimates = readFileSync(resolve(process.cwd(), "client/src/components/affiliate/InstallationEstimatesPanel.tsx"), "utf8");
const crm = readFileSync(resolve(process.cwd(), "client/src/components/crm/CrmBoard.tsx"), "utf8");
const portal = readFileSync(resolve(process.cwd(), "client/src/lib/contractorPortalProcedures.ts"), "utf8");

describe("approved contractor portal", () => {
  it("keeps pending applicants on the approval message", () => {
    const applicant = dashboard.slice(dashboard.indexOf('view.mode === "applicant"'), dashboard.indexOf("function ContractorHome"));
    expect(applicant).toContain("until your affiliate or CabinetDealz approves it.");
    expect(applicant).toContain("Contractor tools stay closed until your affiliate or CabinetDealz approves this request. Your account remains a customer in the meantime.");
    expect(applicant).not.toContain("InstallationEstimatesPanel");
    expect(applicant).not.toContain("<CrmBoard");
    expect(dashboard.indexOf("<InstallationEstimatesPanel")).toBeGreaterThan(dashboard.indexOf("function ContractorHome"));
  });

  it("gives approved contractors their own CRM, saved designs, and labor estimates", () => {
    const home = dashboard.slice(dashboard.indexOf("function ContractorHome"));
    expect(home).toContain("Customers / CRM");
    expect(home).toContain("Saved designs");
    expect(home).toContain("Labor estimates");
    expect(home).toContain("contractorPortal.customers.list.useQuery(portalScope");
    expect(home).toContain("contractorPortal.designs.list.useQuery(portalScope");
    expect(home).toContain("contractorPortal.customers.create.useMutation");
    expect(home).toContain("contractorPortal.designs.assign.useMutation");
    expect(home).toContain("contractorPortalScope(contractorUserId)");
    expect(home).toContain('<CrmBoard lang="en" contractorUserId={contractorUserId} />');
    expect(home).toContain('audience="contractor" contractorUserId={contractorUserId} readOnly={staffPreview}');
    expect(home).toContain("This estimate is your installation and labor invoice. CabinetDealz materials are invoiced separately.");
    expect(portal).toContain("optional contractorUserId");
    expect(portal).toContain("Cast until AppRouter includes it");
  });

  it("lets any admin role view one contractor and does not invent login-as", () => {
    expect(dashboard).toContain('view.mode === "admin-contractor"');
    expect(dashboard).toContain("contractorUserId={view.contractorUserId}");
    expect(dashboard).not.toContain("Log in as");
    expect(dashboard).not.toContain("impersonat");
    expect(crm).toContain("crmBoardScope({ contractorUserId, affiliateId, masterAffiliateId })");
    expect(crm).toContain("trpc.crm.board.useQuery");
    expect(estimates).toContain("installationEstimates.list.useQuery(scope)");
    expect(estimates).toContain("installationEstimates.kitchenPlans.useQuery(scope)");
    expect(estimates).toContain("installationEstimates.kitchenCostDefaults.useQuery(scope)");
    expect(estimates).toContain("installationEstimates.create.useMutation");
    expect(estimates).toContain("installationEstimates.saveKitchenCostDefaults.useMutation");
    expect(estimates).toContain("updateStatus.mutate({ id: estimate.id, ...scope, status: \"shared\" })");
    expect(estimates).toContain("installationEstimates.updateStatus.useMutation");
  });

  it("shows staff a read-only contractor portal instead of the other-portal page", () => {
    expect(dashboard).toContain('view.mode === "staff-preview"');
    expect(dashboard).toContain("staffPreviewRole={view.role}");
    expect(dashboard).toContain("staffPreviewBannerText(staffPreviewRole)");
    expect(dashboard).toContain("staffDashboardPath(staffPreviewRole)");
    expect(dashboard).toContain("Back to your dashboard");
    expect(dashboard).toContain('data-testid="contractor-staff-preview-banner"');
    expect(dashboard).toContain("if (preview || staffPreview) return");
    expect(dashboard).toContain("staffPreviewQueryRows(staffPreview, customersQuery.data, customersQuery.error)");
    expect(dashboard).toContain("staffPreviewQueryRows(staffPreview, designsQuery.data, designsQuery.error)");
    expect(dashboard).toContain('staffPreviewEmptyCopy("customers")');
    expect(dashboard).toContain('staffPreviewEmptyCopy("designs")');
    expect(dashboard).toContain('staffPreviewEmptyCopy("crm")');
    expect(dashboard).toContain('staffPreviewEmptyCopy("orders")');
    expect(dashboard).toContain("Customers / CRM");
    expect(dashboard).toContain("Saved designs");
    expect(dashboard).toContain("Labor estimates");
    expect(dashboard).toContain("Orders");
    expect(dashboard).not.toContain("Log in as");
    expect(estimates).toContain('const readOnly = "audience" in props && props.readOnly === true');
    expect(estimates).toContain("if (readOnly) return;");
    expect(estimates).toContain('staffPreviewEmptyCopy("labor")');
    expect(estimates).toContain("if (readOnly) return; updateStatus.mutate");
    const home = dashboard.slice(dashboard.indexOf("function ContractorHome"));
    const crmBranch = home.slice(home.indexOf("<h2 className=\"text-xl font-bold\">CRM</h2>"));
    expect(crmBranch).toContain("staffPreview ?");
    expect(crmBranch.indexOf("staffPreviewEmptyCopy(\"crm\")")).toBeLessThan(crmBranch.indexOf("<CrmBoard"));
  });
});
