import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./CrmBoard.tsx", import.meta.url), "utf8");

describe("CRM invoice email button", () => {
  it("asks for the homeowner email instead of disabling the button when the lead has none", () => {
    expect(source).not.toContain("disabled={!customerEmail || !smtpReady || sendInvoiceEmail.isPending}");
    expect(source).toContain("invoiceEmailButtonDisabled({ recipient, pending: sendInvoiceEmail.isPending })");
    expect(source).toContain('aria-label={label("Homeowner email", "Correo del propietario")}');
    expect(source).toContain("to: recipient.trim()");
    expect(source).toContain("emailReadiness.useQuery({ dealId }");
    expect(source).toContain("invoiceEmailSourceLabel");
    expect(source).toContain("Enter the homeowner email to send this invoice.");
  });
});
