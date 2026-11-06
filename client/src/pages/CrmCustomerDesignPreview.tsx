import { CustomerLinkedDesigns } from "@/components/crm/CustomerLinkedDesigns";
import { NO_LINKED_DESIGN_COPY, selectCustomerDesigns } from "@shared/crmCustomerDesigns";

/**
 * Dev-only view of the CRM customer design block, on sample data shaped like the
 * real CRM response. It exists so the two states Tom reported can be seen and
 * screenshotted without a signed-in CRM:
 *
 *  - Customer 5192: six designs saved on the account, exactly one linked to the
 *    deal. The block must list one.
 *  - A customer with nothing linked: the block must say so and offer a link.
 *
 * The filter that produces the one design is shared/selectCustomerDesigns, the
 * same rule the server applies. Nothing here calls the API.
 */
const DEAL_ID = 5192;

// Saved on the account (kitchen_designs rows for the contact).
const savedOnAccount = [
  { designId: 4401, name: "Rivera kitchen — final", updatedAt: "2026-11-04T15:20:00Z" },
  { designId: 4402, name: "Rivera kitchen — option B", updatedAt: "2026-11-03T11:05:00Z" },
  { designId: 4403, name: "Rivera pantry", updatedAt: "2026-11-02T09:40:00Z" },
  { designId: 4404, name: "Rivera laundry", updatedAt: "2026-10-30T16:10:00Z" },
  { designId: 4405, name: "Osprey bath (different customer)", updatedAt: "2026-10-28T10:00:00Z" },
  { designId: 4406, name: "Untitled plan", updatedAt: "2026-10-26T08:15:00Z" },
];

// What the server reads from cabinet_dealz.crm_deal_designs for each design.
const storedLinks = [
  { designId: 4401, dealIds: [DEAL_ID] },
  { designId: 4405, dealIds: [6001] },
];

const linked = selectCustomerDesigns(
  savedOnAccount.map((design) => ({
    ...design,
    dealIds: storedLinks.find((link) => link.designId === design.designId)?.dealIds ?? [],
    contractorCustomerId: null,
  })),
  { dealId: DEAL_ID, contractorCustomerId: null },
);

export default function CrmCustomerDesignPreview() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-[#c9a227]">Cabinet Dealz</p>
        <h1 className="text-2xl font-semibold text-[#1a2b4a]">CRM customer — saved designs</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Sample data shaped like the real CRM response. Only designs with a stored link to the
          customer are listed; a design saved on the account is not enough.
        </p>
      </header>

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="preview-linked">
          <h2 className="text-sm font-semibold text-[#1a2b4a]">Customer 5192 — Riley Rivera</h2>
          <p className="mb-3 text-xs text-slate-500">
            {savedOnAccount.length} designs saved on this account · {linked.length} linked to deal {DEAL_ID}
          </p>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">This customer&apos;s saved designs</p>
            <CustomerLinkedDesigns
              designs={linked.map((entry) => ({
                id: entry.designId,
                name: entry.name,
                linkKind: entry.linkKind,
                href: `/design?load=${entry.designId}&preview=3d&crmDeal=${DEAL_ID}`,
              }))}
              showLinkSource
              attach={{
                label: "Link a saved design",
                options: savedOnAccount
                  .filter((design) => !linked.some((entry) => entry.designId === design.designId))
                  .map((design) => ({ id: design.designId, name: design.name })),
                onSelect: () => undefined,
              }}
              actions={() => <span className="text-xs text-primary underline">Save as Kitchen Package</span>}
              testId="preview-linked-designs"
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid="preview-empty">
          <h2 className="text-sm font-semibold text-[#1a2b4a]">Customer 5192 — before any link</h2>
          <p className="mb-3 text-xs text-slate-500">
            {savedOnAccount.length} designs saved on this account · 0 linked to deal {DEAL_ID}
          </p>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">This customer&apos;s saved designs</p>
            <CustomerLinkedDesigns
              designs={[]}
              emptyCopy={NO_LINKED_DESIGN_COPY}
              attach={{
                label: "Link a saved design",
                options: savedOnAccount.map((design) => ({ id: design.designId, name: design.name })),
                onSelect: () => undefined,
              }}
              testId="preview-empty-designs"
            />
          </div>
        </section>
      </div>

      <section className="mt-4 max-w-4xl rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-[#1a2b4a]">Not listed, on purpose</h2>
        <p className="mb-2 text-xs text-slate-500">
          These designs are saved on the same account and used to appear for this customer. They have no
          stored link, so the customer view omits them.
        </p>
        <ul className="space-y-1 text-sm text-slate-600">
          {savedOnAccount
            .filter((design) => !linked.some((entry) => entry.designId === design.designId))
            .map((design) => (
              <li key={design.designId} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span>{design.name}</span>
                <span className="text-xs text-slate-400">#{design.designId}</span>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}
