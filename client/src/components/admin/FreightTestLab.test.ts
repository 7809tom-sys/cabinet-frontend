import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/FreightTestLab.tsx"), "utf8");
const shippingAdminSource = readFileSync(resolve(process.cwd(), "client/src/components/admin/ShippingAdmin.tsx"), "utf8");

describe("Operations Freight Test Lab UI", () => {
  it("uses a saved design instead of manual catalog-item entry", () => {
    expect(shippingAdminSource).toContain("<FreightTestLab />");
    expect(source).toContain("adminListSimulationDesigns");
    expect(source).toContain("adminSimulateSavedDesignFreight");
    expect(source).toContain("Saved design");
    expect(source).toContain("Choose a saved design");
    expect(source).not.toContain("adminSearchSimulationItems");
  });

  it("supports a configured carrier quote or pallet preview without an estimate or Plan B substitution", () => {
    expect(source).toContain('value="pallet_preview"');
    expect(source).toContain('value="saved_configuration"');
    expect(source).not.toContain('value="plan_b"');
    expect(source).toContain("never creates an order, checkout, signed customer quote, or payment");
    expect(source).toContain("never substitutes a Plan B fee, estimate, or staging connection for a carrier response");
    expect(source).toContain("resultsByMode");
    expect(source).toContain("function invalidateResults()");
    expect(source).toContain('useState<SimulationMode>("saved_configuration")');
    expect(source).toContain("Carrier shipping quote");
    expect(source).toContain("Carrier shipping quote summary");
    expect(source).toContain("Get configured carrier quote");
    expect(source).toContain("Open carrier setup");
    expect(source).toContain('/admin?tab=shipping#shipping-live-provider');
    expect(source).toContain("WWEX is temporarily busy. Retry available in ${formatCooldown(carrierCooldownRemainingMs)}; your saved credentials do not need to be replaced.");
    expect(source).toContain("Retry carrier quote in {formatCooldown(carrierCooldownRemainingMs)}");
    expect(source).toContain("WWEX retry available in {formatCooldown(carrierCooldownRemainingMs)}");
    expect(source).toContain("const [carrierRetryAt, setCarrierRetryAt] = useState<number | null>(null)");
    expect(source).toContain("if (result.mode === \"saved_configuration\") setCarrierRetryAt(result.carrierRetryAt ?? null)");
    expect(source).toContain("aria-busy={simulate.isPending}");
    expect(source).toContain("<Loader2 className=\"h-4 w-4 animate-spin\"");
    expect(source).toContain("Pallets only — no shipping cost");
    expect(source).not.toContain("orders.create");
    expect(source).not.toContain("payments.");
  });

  it("labels a WWEX sandbox result as a non-production Operations test", () => {
    expect(source).toContain("function carrierEnvironmentLabel");
    expect(source).toContain("Worldwide Express sandbox — non-production test rate");
    expect(source).toContain("Sandbox result only.");
    expect(source).toContain("not a customer-facing production quote");
    expect(source).toContain('result?.provider === "worldwideexpress" && result.providerEnvironment === "sandbox"');
  });

  it("lets an administrator enter the delivery ZIP alongside the selected saved design", () => {
    expect(source).toContain("Destination ZIP");
    expect(source).toContain("request a quote from the carrier configured in Operations");
    expect(source).toContain("Saved design:");
    expect(source).toContain("no longer match the current catalog and were not tested");
    expect(source).toContain("has no Shipping Origin ZIP. This test uses the Operations origin only");
    expect(source).toContain("Add Shipping Origin ZIP");
    expect(source).toContain("Add {group.missingOriginStyle.distributorName} Shipping Origin ZIP");
    expect(source).toContain("adminUpdateDoorStyle.useMutation");
    expect(source).toContain("Save Shipping Origin ZIP");
  });

  it("shows Business/Residential accessorials and final pallet dimensions and loaded weights", () => {
    expect(source).toContain('value="business"');
    expect(source).toContain('value="residential"');
    expect(source).toContain("Lift gate");
    expect(source).toContain("Inside delivery");
    expect(source).toContain("Limited access");
    expect(source).toContain("Loaded weight");
    expect(source).toContain("pallet.lengthIn");
    expect(source).toContain("pallet.widthIn");
    expect(source).toContain("pallet.heightIn");
    expect(source).toContain("pallet.weightLbs");
  });
});
