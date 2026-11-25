import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const board = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");
const picker = readFileSync(new URL("./CountertopQuoteInvoicePicker.tsx", import.meta.url), "utf8");
const card = readFileSync(new URL("../admin/AdminGroupedTabs.tsx", import.meta.url), "utf8");

describe("countertop slab line on the CRM quick invoice", () => {
  it("lets the admin pick a saved/won quote and sends only its id; the server builds the line", () => {
    expect(board).toContain("trpc.crm.countertopQuoteInvoiceOptions.useQuery({ dealId }");
    expect(board).toContain("countertopQuoteId: countertopLine ? countertopQuoteId : null");
    expect(board).not.toMatch(/lines: \[\.\.\.previewLines, countertopLine/);
  });

  it("gates preview, PDF and email on the shipping check", () => {
    expect(board).toContain("countertopInvoiceGate({ quoteId: countertopQuoteId");
    expect(board.match(/if \(!countertopGate\.ok\)/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(board).toContain("countertopInvoiceErrorMessage(message)");
  });

  it("offers to collect the shipping address when it is missing", () => {
    expect(picker).toContain("trpc.crm.setDealShippingAddress.useMutation");
    expect(picker).toContain('gate.reason === "missing_shipping"');
  });

  it("shows the slab invoice line, or why there is none, on the admin quote card", () => {
    expect(card).toContain("buildCountertopSlabInvoiceLine(q)");
    expect(card).toContain("No invoice line: {billing.message}");
    expect(card).toContain("countertopSlabSize(q.material).warning");
  });
});
