import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const board = readFileSync(resolve(process.cwd(), "client/src/components/crm/CrmBoard.tsx"), "utf8");
const procedures = readFileSync(resolve(process.cwd(), "client/src/lib/crmCustomerDesignProcedures.ts"), "utf8");
const shared = readFileSync(resolve(process.cwd(), "shared/crmCustomerDesigns.ts"), "utf8");

/**
 * Owner-reported bug: opening a customer in the CRM listed every saved design on
 * the account. The drawer rendered the customer directory's designs, and that
 * directory returns every design owned by the merged person.
 */
describe("CRM customer view lists only linked designs", () => {
  it("no longer renders the customer directory's designs", () => {
    expect(board).not.toContain("customerDetail.data.designs");
    expect(board).not.toContain("(customerDetail.data.designs ?? [])");
  });

  it("reads the linked-designs procedure instead", () => {
    expect(board).toContain("useCrmCustomerDesigns(deal?.id ?? null)");
    expect(board).toContain("<CustomerLinkedDesigns");
    expect(board).toContain('testId="crm-customer-linked-designs"');
  });

  it("asks the server to filter by the deal id, not just the UI", () => {
    expect(procedures).toContain("crm.customerDesigns.useQuery(");
    expect(procedures).toContain("{ dealId: dealId ?? 0 }");
    expect(procedures).toContain("enabled: dealId != null && dealId > 0");
  });

  it("drops any row the server did not prove linked", () => {
    expect(procedures).toContain("serverLinkedDesigns(query.data?.designs ?? [])");
    expect(shared).toContain("export function serverLinkedDesigns");
  });

  it("offers a way to link a design from the empty state", () => {
    expect(board).toContain("onSelect: (designId) => linkDesign.mutate({ dealId: deal!.id, designId })");
    expect(board).toContain("options: availableDesigns.map(");
    expect(board).toContain("NO_LINKED_DESIGN_COPY");
  });

  it("keeps one design list, with unlink inside it", () => {
    // The old second "Linked Designs" section is gone, so a design cannot be
    // listed twice or linked twice.
    expect(board).not.toContain("Linked Designs");
    expect(board.match(/<CustomerLinkedDesigns/g)).toHaveLength(1);
    expect(board).toContain("unlinkDesign.mutate({ dealId: deal!.id, linkId: link.linkId! })");
  });

  it("refreshes the linked list after a link or an unlink", () => {
    expect(board.match(/customerDesigns\.refetch\(\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("says so instead of looking empty when the server filter is not deployed", () => {
    expect(board).toContain("CUSTOMER_DESIGNS_UNAVAILABLE_COPY");
    expect(procedures).toContain("unavailable: Boolean(query.error) && !query.isLoading");
  });

  it("records where the link is stored", () => {
    expect(shared).toContain('"cabinet_dealz.crm_deal_designs"');
    expect(shared).toContain('"cabinet_dealz.kitchen_designs.contractorCustomerId"');
  });

  it("puts the staff quick lookup above the board", () => {
    expect(board).toContain("<CrmCustomerLookup />");
    expect(board).toContain('data-testid="crm-customer-number"');
    const lookup = readFileSync(resolve(process.cwd(), "client/src/components/crm/CrmCustomerLookup.tsx"), "utf8");
    // Matched by identifier on the server, never by browsing designs.
    expect(lookup).toContain("crmCustomerLookup");
    expect(lookup).toContain("parseCustomerIdentifier");
    expect(lookup).toContain("previewResult");
  });
});
