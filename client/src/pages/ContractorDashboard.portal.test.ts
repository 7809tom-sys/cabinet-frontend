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
    expect(home).toContain('<InstallationEstimatesPanel audience="contractor" contractorUserId={contractorUserId} />');
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
});
