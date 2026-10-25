import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./ApprovedVendorsAdmin.tsx", import.meta.url), "utf8");

describe("Approved vendor PDF resources", () => {
  it("provides separate catalog and spec-book boxes with validated PDF uploads", () => {
    expect(source).toContain('label="PDF catalog"');
    expect(source).toContain('label="PDF spec book"');
    expect(source).toContain('accept="application/pdf"');
    expect(source).toContain("PDF files must be between 1 byte and 12 MB.");
    expect(source).toContain("trpc.vendors.uploadResourcePdf.useMutation");
  });

  it("retains links in the editor and exposes saved resources on the vendor scorecard", () => {
    expect(source).toContain("catalogPdfUrl: form.catalogPdfUrl.trim() || null");
    expect(source).toContain("specBookPdfUrl: form.specBookPdfUrl.trim() || null");
    expect(source).toContain("Catalog PDF");
    expect(source).toContain("Spec book");
    expect(source).toContain("Open or download PDF catalog");
    expect(source).toContain("Open or download PDF spec book");
    expect(source).toContain("<Download className=");
  });

  it("offers either direct email sign-up or a private setup link for every approved vendor", () => {
    expect(source).toContain("Contact email (optional direct supplier login)");
    expect(source).toContain('data-testid="approved-vendor-login-help"');
    expect(source).toContain("Setup login");
    expect(source).toContain("private one-time link");
    expect(source).toContain("to give this approved vendor portal access now");
  });

  it("shows every approved vendor as login-ready without requiring a catalog source line", () => {
    expect(source).toContain("Portal login");
    expect(source).toContain("Supplier login ready");
    expect(source).toContain("Copy Setup login to onboard this vendor");
    expect(source).toContain("It is not required for an approved vendor to have its own editable supplier profile.");
    expect(source).toContain("Select active supplier line");
  });

  it("lets administrators preview every approved vendor and send a setup invitation through Cabinet Dealz email settings", () => {
    expect(source).toContain("Email Supplier Portal invitation");
    expect(source).toContain("trpc.vendors.emailPortalInvite.useMutation");
    expect(source).toContain("Email invite");
    expect(source).toContain("Admin → Email Settings");
    expect(source).toContain("/vendor?vendor=${v.id}");
    expect(source).toContain("Preview ${v.name} Supplier Portal");
  });

  it("shows and maintains separate configured Framed and Frameless catalog lines under one supplier", () => {
    expect(source).toContain("linkedDistributors?: Array");
    expect(source).toContain('aria-label={`${v.name} linked catalog lines`}');
    expect(source).toContain("linkedDistributors.map");
    expect(source).toContain("Additional catalog lines for this supplier (optional)");
    expect(source).toContain("Their SKUs, pricing, availability, and orders remain separate.");
    expect(source).toContain('if (line.code === "USCD") return `Framed — ${line.name}`');
    expect(source).toContain('if (line.code === "AEF") return `Frameless — ${line.name}`');
  });
});
