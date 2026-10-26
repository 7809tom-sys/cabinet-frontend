import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dialog = readFileSync(new URL("../components/design/ProDesignerDialog.tsx", import.meta.url), "utf8");
const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const appointments = readFileSync(
  new URL("../components/affiliate/AffiliateAppointmentsPanel.tsx", import.meta.url),
  "utf8",
);
const dashboard = readFileSync(new URL("./AffiliateDashboard.tsx", import.meta.url), "utf8");
const layout = readFileSync(
  new URL("../components/affiliate/AffiliateDashboardLayout.tsx", import.meta.url),
  "utf8",
);

describe("consultation affiliate scope", () => {
  it("sends the storefront slug and persisted referral code, not an affiliate id", () => {
    expect(dialog).toContain('import { readReferralCode } from "@/hooks/useReferral";');
    expect(dialog).toContain("affiliateSlug?: string | null;");
    expect(dialog).toContain("affiliateSlug: affiliateSlug ?? undefined,");
    expect(dialog).toContain("referralCode: readReferralCode() ?? undefined,");
    expect(dialog).not.toContain("affiliateId:");
    expect(designTool).toContain("designName={savedDesign?.name ?? null}\n\t        affiliateSlug={affiliateSlug}");
  });

  it("scopes the appointments query to the admin's selected store", () => {
    expect(appointments).toContain("export function AffiliateAppointmentsPanel({ affiliateId }: { affiliateId?: number })");
    expect(appointments).toContain("{ status: statusFilter, ...(affiliateId ? { affiliateId } : {}) }");
    expect(dashboard).toContain("<AffiliateAppointmentsPanel affiliateId={isAdmin ? affiliate.id : undefined} />");
  });

  it("keeps appointments limited to owners and team members with CRM or designer access", () => {
    expect(layout).toContain('(item.section === "appointments" && (canAccessCrm || canAccessDesigner))');
    expect(dashboard).toContain("const canViewAppointments = access.isOwner || access.accessCrm || access.accessDesigner;");
    expect(dashboard).toContain('(section === "appointments" && !canViewAppointments)');
  });
});
