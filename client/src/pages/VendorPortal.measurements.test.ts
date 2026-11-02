import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const portalSource = readFileSync(new URL("./VendorPortal.tsx", import.meta.url), "utf8");
const reviewSource = readFileSync(new URL("../components/admin/FeaturedStylesAdmin.tsx", import.meta.url), "utf8");

describe("vendor sample-door measurement workflow", () => {
  it("records a vendor measurement using the supplied sheet fields and requires CabinetDealz verification", () => {
    expect(portalSource).toContain("Sample-door measurements");
    expect(portalSource).toContain("CabinetDealz measures the sample once");
    expect(portalSource).toContain("function VendorDoorMeasurementDialog");
    expect(portalSource).toContain("Sample-door measurement submission");
    expect(portalSource).toContain("topRailWidth");
    expect(portalSource).toContain("bottomRailWidth");
    expect(portalSource).toContain("leftStileWidth");
    expect(portalSource).toContain("rightStileWidth");
    expect(portalSource).toContain("drawerConstruction");
    expect(portalSource).toContain("CabinetDealz measures the physical sample door and approves it");
    expect(portalSource).toContain("trpc.distributorPortal.submitDoorMeasurement.useMutation");
  });

  it("allows a vendor to explicitly select every same-profile style, including the measured source style", () => {
    expect(portalSource).toContain("Apply this same measured profile to checked door styles");
    expect(portalSource).toContain("appliesToStyleIds");
    expect(portalSource).toContain("disabled={candidate.id === style.id}");
    expect(portalSource).toContain("appliesToStyleIds.length");
  });

  it("removes direct vendor control of Designer frame measurements", () => {
    const editor = portalSource.slice(portalSource.indexOf("function VendorFeaturedStyleEditor"), portalSource.indexOf("function VendorFeaturedStylesPage"));
    expect(editor).toContain("Designer geometry is controlled by a submitted physical sample door");
    expect(editor).not.toContain("railWidth: rail");
    expect(editor).not.toContain("sourceSpecification: sourceSpecification.trim()");
  });

  it("replaces the amber admin review panel with a per-style Vendor update badge that keeps the physical-sample approval flow", () => {
    const badge = readFileSync(new URL("../components/admin/VendorMeasurementUpdate.tsx", import.meta.url), "utf8");
    expect(reviewSource).not.toContain("Physical sample-door measurement review");
    expect(reviewSource).toContain("<VendorUpdateBadge style={style} />");
    expect(badge).toContain("listDoorMeasurementSubmissions.useQuery({ status: \"pending\"");
    expect(badge).toContain("reviewDoorMeasurementSubmission.useMutation");
    expect(badge).toContain("CabinetDealz measured the physical sample door.");
    expect(badge).toContain("Team-measured rail (in)");
    expect(badge).toContain("Team-measured stile (in)");
    expect(badge).toContain("Approve for Designer");
    expect(badge).toContain("!physicalSampleMeasured || !rail || !stile");
  });
});
