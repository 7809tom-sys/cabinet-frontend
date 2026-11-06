import { useState } from "react";
import { CrmCustomerLookup } from "@/components/crm/CrmCustomerLookup";
import type { CustomerLookupResult } from "@/lib/crmCustomerLookupProcedures";

/**
 * Dev-only view of the staff quick lookup, on sample data shaped like the real
 * `crm.customerLookup` response:
 *
 *  5192 — one linked design  → opens it directly
 *  6001 — three linked designs → pick from those three only
 *  7002 — no linked design → says so
 *  8888 — not in this CRM scope → says so
 *
 * Everything is answered locally; nothing calls the API. The identifier rules
 * and the outcome rules are the shared modules the server uses.
 */
const DESIGN = (id: number, name: string) => ({
  id,
  name,
  thumbnailUrl: null,
  assistLabel: null,
  updatedAt: "2026-11-04T15:20:00Z",
  linkKind: "deal" as const,
  linkId: id,
  designUrl: `/design?load=${id}&preview=3d&crmDeal=${id === 4401 ? 5192 : 6001}`,
});

function answer(dealId: number): CustomerLookupResult | null {
  if (dealId === 5192) {
    const designs = [DESIGN(4401, "Rivera kitchen — final")];
    return {
      ok: true,
      identifier: "5192",
      dealId,
      customerName: "Riley Rivera",
      contactEmail: "riley@example.com",
      affiliateId: 7,
      designs,
      outcome: "one",
      openUrl: designs[0]!.designUrl,
    };
  }
  if (dealId === 6001) {
    return {
      ok: true,
      identifier: "6001",
      dealId,
      customerName: "Dana Ortiz",
      contactEmail: "dana@example.com",
      affiliateId: 7,
      designs: [
        DESIGN(5501, "Ortiz kitchen"),
        DESIGN(5502, "Ortiz primary bath"),
        DESIGN(5503, "Ortiz laundry"),
      ],
      outcome: "several",
      openUrl: null,
    };
  }
  if (dealId === 7002) {
    return {
      ok: true,
      identifier: "7002",
      dealId,
      customerName: "Sam Whitfield",
      contactEmail: null,
      affiliateId: 7,
      designs: [],
      outcome: "none",
      openUrl: null,
    };
  }
  return { ok: false, reason: "not-found", identifier: String(dealId), dealId };
}

export default function CrmCustomerLookupPreview() {
  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <header className="mb-5">
        <p className="text-xs uppercase tracking-wide text-[#c9a227]">Cabinet Dealz</p>
        <h1 className="text-2xl font-semibold text-[#1a2b4a]">CRM — find a customer</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          The bar sits above the CRM board. Staff type the customer number from the deal card and
          either land in that customer&apos;s plan or see only their linked designs to pick from.
        </p>
      </header>

      <div className="grid max-w-4xl gap-4 md:grid-cols-2">
        <PreviewPanel testId="lookup-one" title="One linked design — opens it" />
        <PreviewPanel testId="lookup-several" title="Several — pick from theirs" />
        <PreviewPanel testId="lookup-none" title="None linked — says so" />
        <PreviewPanel testId="lookup-miss" title="Not in this CRM scope" />
      </div>

      <p className="mt-4 max-w-4xl text-xs text-slate-500">
        Sample data. In the CRM the same bar matches the typed identifier on the customer row in the
        caller&apos;s own scope; it never lists every design and never guesses from ownership.
      </p>
    </main>
  );
}

/** Shows where the lookup went instead of navigating, so the screenshot proves it. */
function PreviewPanel({ testId, title }: { testId: string; title: string }) {
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4" data-testid={testId}>
      <h2 className="mb-2 text-sm font-semibold text-[#1a2b4a]">{title}</h2>
      <CrmCustomerLookup previewResult={answer} onOpen={setOpened} />
      <p className="mt-2 text-[11px] text-slate-500" data-testid={`${testId}-opened`}>
        {opened ? `Designer opened: ${opened}` : "No design opened."}
      </p>
    </section>
  );
}
