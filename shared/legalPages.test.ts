import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  addLegalSlot,
  editableDraftText,
  parseCsvTable,
  presentLegalSlot,
  publishLegalUpload,
  rollbackLegalSlot,
  saveLegalDraft,
  seedLegalSlots,
} from "./legalPages";
import { buildAffiliateAgreementText } from "./affiliateAgreement";
import { buildSalesRepAgreementText } from "./salesRepAgreement";

const root = resolve(import.meta.dirname, "..");

describe("legal page slots", () => {
  const seeded = seedLegalSlots("2026-11-11T00:00:00.000Z", "Migration");

  it("starts with separate slots and does not merge warranty with terms", () => {
    expect(seeded.map((slot) => slot.slug)).toEqual([
      "warranty",
      "terms",
      "affiliate-agreement",
      "privacy",
      "sales-rep-agreement",
    ]);
    expect(seeded.find((slot) => slot.slug === "terms")?.publicPath).toBe("/terms");
    expect(seeded.find((slot) => slot.slug === "privacy")?.publicPath).toBe("/privacy-policy");
    expect(seeded.find((slot) => slot.slug === "warranty")?.publicPath).toBe("/warranty");
  });

  it("keeps the existing site page until an upload, then rolls back to it", () => {
    const terms = seeded.find((slot) => slot.slug === "terms")!;
    expect(presentLegalSlot(terms).render).toBe("site-page");
    const published = publishLegalUpload(terms, { bodyText: "Replacement terms for review." }, {
      uploadedAt: "2026-11-12T00:00:00.000Z",
      uploadedBy: "Tom",
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(presentLegalSlot(published.slot).render).toBe("text");
    expect(presentLegalSlot(published.slot).bodyText).toBe("Replacement terms for review.");
    const rolled = rollbackLegalSlot(published.slot, 1);
    expect(rolled.ok).toBe(true);
    if (!rolled.ok) return;
    expect(presentLegalSlot(rolled.slot).render).toBe("site-page");
    expect(rolled.slot.versions).toHaveLength(2);
  });

  it("adds a warranty spreadsheet without changing the warranty prose", () => {
    const warranty = seeded.find((slot) => slot.slug === "warranty")!;
    const before = presentLegalSlot(warranty);
    const sheet = parseCsvTable('SKU,Warranty\n"W-1","5 year limited"\n');
    expect("error" in sheet).toBe(false);
    if ("error" in sheet) return;
    const uploaded = publishLegalUpload(warranty, { sheet }, {
      uploadedAt: "2026-11-12T00:00:00.000Z",
      uploadedBy: "Tom",
    });
    expect(uploaded.ok).toBe(true);
    if (!uploaded.ok) return;
    const after = presentLegalSlot(uploaded.slot);
    expect(after.render).toBe(before.render);
    expect(after.bodyText).toBe(before.bodyText);
    expect(after.sheet?.rows).toEqual([["W-1", "5 year limited"]]);
  });

  it("lets an admin add another slot", () => {
    const added = addLegalSlot(seeded, { title: "Delivery notes", publicPath: "/delivery-notes" }, "2026-11-12T00:00:00.000Z", "Tom");
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.slots.at(-1)?.slug).toBe("delivery-notes");
  });

  it("preloads the agreement drafts for editing and does not publish them", () => {
    const affiliate = seeded.find((slot) => slot.slug === "affiliate-agreement")!;
    const salesRep = seeded.find((slot) => slot.slug === "sales-rep-agreement")!;
    expect(affiliate.versions[0]?.source).toBe("draft");
    expect(affiliate.versions[0]?.bodyText).toBe(buildAffiliateAgreementText());
    expect(affiliate.versions[0]?.bodyText?.startsWith("DRAFT")).toBe(true);
    expect(presentLegalSlot(affiliate).render).toBe("site-page");
    expect(salesRep.versions[0]?.bodyText).toBe(buildSalesRepAgreementText());
    expect(editableDraftText(salesRep).startsWith("DRAFT")).toBe(true);
    expect(seeded.find((slot) => slot.slug === "warranty")?.versions[0]?.bodyText).toBeNull();
    expect(seeded.find((slot) => slot.slug === "terms")?.versions[0]?.bodyText).toBeNull();
    expect(seeded.find((slot) => slot.slug === "privacy")?.versions[0]?.bodyText).toBeNull();

    const saved = saveLegalDraft(affiliate, `${affiliate.versions[0]?.bodyText}\nEdited.`, {
      uploadedAt: "2026-11-12T00:00:00.000Z",
      uploadedBy: "Tom",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.slot.publishedVersion).toBe(0);
    expect(saved.slot.versions).toHaveLength(2);
    expect(presentLegalSlot(saved.slot).render).toBe("site-page");
    const published = publishLegalUpload(saved.slot, { bodyText: editableDraftText(saved.slot) }, {
      uploadedAt: "2026-11-12T01:00:00.000Z",
      uploadedBy: "Tom",
    });
    expect(published.ok).toBe(true);
    if (!published.ok) return;
    expect(presentLegalSlot(published.slot).render).toBe("text");
    expect(published.slot.versions).toHaveLength(3);
  });

  it("does not rewrite the existing Terms or warranty pages", () => {
    const terms = readFileSync(resolve(root, "client/src/pages/Terms.tsx"), "utf8");
    const returns = readFileSync(resolve(root, "client/src/pages/ReturnPolicy.tsx"), "utf8");
    expect(terms).toContain("By accessing or using the CabinetDealz website");
    expect(terms).toContain("These Terms are governed by the laws of the State of Florida.");
    expect(returns).toContain("Vendor warrants to the original consumer purchaser");
    expect(returns).toContain("This limited warranty is governed by the laws of the State of New Jersey.");
  });
});
