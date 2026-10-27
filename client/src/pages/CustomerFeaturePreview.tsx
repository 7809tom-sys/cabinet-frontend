import { AssistEditingBanner } from "@/components/design/DesignActions";
import { KitchenPackageForm } from "@/components/affiliate/KitchenPackageForm";
import { MyCustomersPanel } from "@/components/affiliate/MyCustomersPanel";
import { CustomerActivityLine } from "@/components/crm/CrmBoard";
import StoreAccount from "@/pages/StoreAccount";
import { activitySummary, BROWSING_HISTORY_NOTE, type UnifiedCustomer } from "@shared/customerDirectory";

const now = new Date("2026-10-26T18:00:00.000Z");
const lastActivity = new Date(now.getTime() - 3 * 86_400_000).toISOString();

const customer: UnifiedCustomer = {
  key: "user:4",
  affiliateId: 7,
  userId: 4,
  name: "Ada Lovelace",
  email: "ada@example.com",
  phone: "5551112222",
  company: "Analytical Engines",
  sources: ["design", "quote", "storefront"],
  primarySource: "design",
  firstSeen: "2026-10-01T12:00:00.000Z",
  lastActivity,
  status: "quoted",
  dealId: 3,
  followUpAt: "2026-10-21T12:00:00.000Z",
  designCount: 1,
  quoteCount: 2,
  orderCount: 0,
  projectCount: 1,
  unfinishedDesignCount: 1,
  openQuoteCount: 1,
  totalValue: 4800,
  designs: [],
  quotes: [
    { id: 9, number: "Q-1042", status: "submitted", total: 3200, kind: "quote", seenAt: lastActivity },
    { id: 11, number: "Q-1048", status: "draft", total: 1600, kind: "quote", seenAt: lastActivity },
  ],
};

const summary = activitySummary(customer, now);

export default function CustomerFeaturePreview() {
  return (
    <div className="bg-background text-foreground">
      <section id="customer-list" className="p-4 border-b">
        <MyCustomersPanel
          affiliateId={7}
          canAssist
          previewCustomers={[customer]}
          previewDetail={{
            customer,
            storeSlug: "maple-kitchens",
            browsingNote: BROWSING_HISTORY_NOTE,
            designs: [{ id: 44, name: "Ada kitchen", thumbnailUrl: null, assistLabel: "Edited by Maple Kitchens" }],
            projects: [{ id: 6, name: "Maple job", status: "active", designIds: [44], quoteIds: [9] }],
            timeline: [{ at: lastActivity, kind: "design", title: "Saved Ada kitchen" }],
          }}
        />
      </section>
      <section id="customer-account" className="border-b">
        <StoreAccount
          slug="maple-kitchens"
          preview={{
            draftReady: true,
            profile: { pricingTier: "contractor", companyName: "Analytical Engines" },
            affiliate: { storeName: "Maple Kitchens" },
            notices: [{ id: 1, title: "Edited by Maple Kitchens", body: "A new revision is ready. Nothing was emailed.", readAt: null }],
            designs: [{ id: 44, name: "Ada kitchen", thumbnailUrl: null, assistLabel: "Edited by Maple Kitchens", recordKind: "customer" }],
            orders: [{ id: 9, requestNumber: "Q-1042", status: "submitted", totalAmount: "3200.00", kitchenDesignId: 44 }],
            projects: [{ id: 6, name: "Maple job", status: "active", clientName: "Ada Lovelace", jobSiteAddress: "12 Note Street" }],
            designLinks: [{ projectId: 6, kitchenDesignId: 44 }],
            quoteLinks: [{ projectId: 6, orderRequestId: 9 }],
            revisions: [{ kitchenDesignId: 44 }],
          }}
        />
      </section>
      <section id="crm-summary" className="p-4 border-b max-w-sm">
        <button type="button" className="w-full text-left rounded-lg border border-border bg-card p-3">
          <div className="text-sm font-semibold">Ada Lovelace</div>
          <div className="text-xs text-muted-foreground">Kitchen remodel</div>
          <CustomerActivityLine text={summary} href="/affiliate?section=customers&customer=user:4" nested />
        </button>
      </section>
      <section id="assist-editing" className="p-4 border-b max-w-xl">
        <AssistEditingBanner storeName="Maple Kitchens" />
      </section>
      <section id="kitchen-package" className="p-4 max-w-lg">
        <h2 className="text-lg font-semibold mb-3">Save as Kitchen Package</h2>
        <KitchenPackageForm
          draft={{ name: "White shaker galley", description: "A copied package from Ada's design.", layoutLabel: "120\" × 96\" galley", doorColor: "White shaker", priceOverride: "", discountAmount: "50" }}
          onChange={() => undefined}
          placedCount={8}
          roomWidth={120}
          roomDepth={96}
          autoPrice={255}
          styleName="White shaker"
          lineItems={[
            { label: "Base cabinet", code: "B24", category: "Cabinet", supplier: "Pelican", qty: 2, unitPrice: 100, lineTotal: 200, section: "cabinet" },
            { label: "Crown", code: "CR", category: "Trim", supplier: "Pelican", qty: 1, unitPrice: 40, lineTotal: 40, section: "cabinet" },
            { label: "Light rail", code: "LR", category: "Trim", supplier: "Other Mill", qty: 1, unitPrice: 15, lineTotal: 15, section: "other" },
          ]}
          onSubmit={() => undefined}
          submitLabel="Create Kitchen Package"
        />
      </section>
    </div>
  );
}
