import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);

describe("FeaturedStylesAdmin room-scene libraries", () => {
  it("presents a six-scene library for each individual Door Style", () => {
    expect(adminSource).toContain("const MAX_SCENES_PER_STYLE = 6");
    expect(adminSource).toContain("Room Scene Library");
    expect(adminSource).toContain("Add verified matching scene");
    expect(adminSource).toContain("Room scene required");
    expect(adminSource).toContain("shared with every affiliate");
  });

  it("shows verified distributor attribution only in the authorized management component", () => {
    expect(adminSource).toContain("function SourceAttribution");
    expect(adminSource).toContain("Verified distributor:");
    expect(adminSource).toContain("never shown to public shoppers");
  });

  it("shows authorized staff whether a door-frame entry is complete, partial, or blank before saving", () => {
    expect(adminSource).toContain('frameEntryStatus === "complete"');
    expect(adminSource).toContain('"Ready for Designer"');
    expect(adminSource).toContain('"Partial frame entry"');
    expect(adminSource).toContain('"No frame measurement entered"');
    expect(adminSource).toContain("Rail and stile measurements must be positive values in inches");
  });

		it("shows the curated room-scene list whether each style has a complete Designer frame entry", () => {
		  expect(adminSource).toContain("designerFrameCompliance");
		  expect(adminSource).toContain('"featured-style-designer-noncompliant"');
		  expect(adminSource).toContain("border-red-400 bg-red-50/80");
		  expect(adminSource).toContain('"Not Designer-compliant"');
		  expect(adminSource).toContain("Designer requirement:");
		});

		it("highlights every individual featured cabinet that cannot enter the Designer", () => {
		  expect(adminSource).toContain("designerNoncompliantCabinetCount");
		  expect(adminSource).toContain('"featured-cabinet-count-designer-noncompliant"');
		  expect(adminSource).toContain('"featured-cabinet-designer-noncompliant"');
		  expect(adminSource).toContain("Not Designer-compliant:");
		  expect(adminSource).toContain("Designer cabinet requirement:");
		  expect(adminSource).toContain("Open the red cabinet-hold badge");
		});

		it("requires an exact official citation before a complete frame can render", () => {
		  expect(adminSource).toContain("Official frame source citation");
		  expect(adminSource).toContain("Source citation needed");
		  expect(adminSource).toContain("A source citation is required before a frame can render in Designer");
		  expect(adminSource).toContain("exact supplier style code");
		  expect(adminSource).toContain("sourceSpecification: sourceSpecification.trim() || null");
		});

	it("keeps the Door Style editor within the viewport while its contents scroll internally", () => {
	  expect(adminSource).toContain('h-[min(90dvh,800px)]');
	  expect(adminSource).toContain('max-h-[calc(100dvh-2rem)]');
	  expect(adminSource).toContain('overflow-hidden p-5');
	  expect(adminSource).toContain('min-h-0 flex-1 space-y-4 overflow-y-auto');
	});

		it("manages private style-specific multiple shipping origins in Featured Door Styles", () => {
		  expect(adminSource).toContain("Shipping Origin ZIPs");
	  expect(adminSource).toContain("Add ZIP");
	  expect(adminSource).toContain("Shipping origin ZIP must be exactly 5 digits");
	  expect(adminSource).toContain("Live freight uses the saved origin nearest to the delivery ZIP");
	  expect(adminSource).toContain("warehouseZips: warehouseZips.length > 0 ? warehouseZips : null");
	  expect(adminSource).toContain("(admin only)");
	  expect(adminSource).toContain("Plan B flat freight fee");
	  expect(adminSource).toContain("Used only when the live quote is unavailable");
	  expect(adminSource).toContain("live carrier quote remains Plan A");
		  expect(adminSource).toContain("flatFreightFeeCents:");
		});

		it("hydrates every saved origin ZIP supplied by the admin Door Style response", () => {
		  expect(adminSource).toContain("warehouseZips?: string[] | null");
		  expect(adminSource).toContain("setWarehouseZips(originZipList(s));");
		  expect(adminSource).toContain("warehouseZips: warehouseZips.length > 0 ? warehouseZips : null");
		});
});
