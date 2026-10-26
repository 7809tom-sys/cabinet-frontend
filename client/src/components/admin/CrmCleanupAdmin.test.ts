import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("CRM cleanup admin", () => {
  it("keeps deletion behind a read-only preview and an explicit DELETE confirm", () => {
    const tabs = source("client/src/components/admin/AdminGroupedTabs.tsx");
    const help = source("client/src/components/admin/AdminTabHelp.tsx");
    const customers = source("client/src/components/admin/CustomersAdmin.tsx");
    const screen = source("client/src/components/admin/CrmCleanupAdmin.tsx");

    const people = tabs.slice(tabs.indexOf('label: "People"'), tabs.indexOf('label: "Products & Catalog"'));
    expect(people).toContain('{ value: "customers", label: "Customers" }');
    expect(people).toContain('{ value: "crm-cleanup", label: "CRM Cleanup" }');
    expect(people.indexOf('{ value: "customers", label: "Customers" }')).toBeLessThan(
      people.indexOf('{ value: "crm-cleanup", label: "CRM Cleanup" }'),
    );
    expect(tabs).toContain('<TabsContent value="crm-cleanup" className="mt-6"><AdminTabHelp tab="crm-cleanup" /><CrmCleanupAdmin /></TabsContent>');
    expect(tabs).toContain('{ value: "stripe-invoices", label: "Stripe Invoices" }');

    expect(help).toContain("Preview does not delete anything.");

    expect(customers).toContain("This button has no keep list and can remove real customers, affiliates, and orders.");
    expect(customers).toContain("Prefer People → CRM Cleanup, which previews an editable keep list and deletes only a confirmed snapshot.");
    expect(customers).toContain("purgeMembers.mutate()");

    expect(screen).toContain("trpc.crmCleanup.preview.useMutation");
    expect(screen).toContain("trpc.crmCleanup.csv.fetch");
    expect(screen).toContain("trpc.crmCleanup.audits.useQuery");
    expect(screen).toContain("trpc.crmCleanup.backup.fetch");
    expect(screen.match(/confirm\.mutate\(/g)).toHaveLength(1);

    const confirmCall = screen.slice(screen.indexOf("confirm.mutate("), screen.indexOf("confirm.mutate(") + 220);
    expect(confirmCall).toContain("snapshotId: preview.snapshotId");
    expect(confirmCall).toContain('confirmation: "DELETE"');
    expect(confirmCall).toContain("deleteSupabaseAuth: preview.deleteSupabaseAuth");
    expect(screen).toContain('disabled={confirmText !== "DELETE" || confirm.isPending}');
    expect(screen).toContain('if (confirmText !== "DELETE")');
    expect(screen).toContain("Build read-only preview");
    expect(screen).not.toContain("crmCleanup.execute");
    expect(screen).not.toContain("crmCleanup.delete");
  });
});
