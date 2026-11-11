import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { buildAffiliateAgreementText } from "@shared/affiliateAgreement";
import { agreementDraftDocx, agreementDraftPdf } from "./legalDraftExport";

describe("agreement draft download", () => {
  it("puts the draft text in a docx and a pdf without sending it", async () => {
    const text = buildAffiliateAgreementText();
    const docx = await agreementDraftDocx("Affiliate Agreement", text);
    const zip = await JSZip.loadAsync(await docx.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("DRAFT");
    expect(xml).toContain("State of Florida");
    const pdf = agreementDraftPdf("Affiliate Agreement", text);
    expect(pdf.size).toBeGreaterThan(500);
    expect(pdf.type).toContain("pdf");
  });
});
