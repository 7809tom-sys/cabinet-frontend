// ─── Demo distributor: "Everything you get" feature list ─────────────────────
// One entry per real Cabinet Deals feature a distributor would get. Every entry
// names the repo file it mirrors (`mirrors`, paths relative to the repo root);
// demoDistributorFeatures.test.ts checks each path exists, so nothing here can
// describe a feature the codebase does not have.
//
// Sources:
//   customers / partners — public routes in client/src/App.tsx and the pages
//                          they render
//   back office          — DISTRIBUTOR-ACCESSIBLE items in the admin permission
//                          matrix (distributor-scope ADMIN_PERMISSION_MATRIX.md)
//                          that a single distributor can use today; `matrix`
//                          holds the row numbers. Left off: internal-only tools,
//                          rows the matrix lists as still needing an own-scoped
//                          endpoint (10, 31, 35, 42, 49, 57, 58, 71) and the six
//                          rows marked for Tom's call (7, 9, 14, 77, 88, 89).
// Copy stays plain: no supplier names, no stats, no urgency.

export type DemoFeatureGroup = "customers" | "partners" | "backOffice";

export type DemoFeature = {
  id: string;
  name: string;
  text: string;
  group: DemoFeatureGroup;
  /** Where the demo shows it. Omitted when the demo only lists it. */
  demoHref?: string;
  /** Repo files this feature mirrors (relative to the repo root). */
  mirrors: string[];
  /** Admin permission matrix row numbers (back office only). */
  matrix?: number[];
  /** Big features that get their own demo section or sub-page. */
  spotlight?: boolean;
};

export const DEMO_FEATURE_GROUPS: { id: DemoFeatureGroup; title: string; text: string }[] = [
  { id: "customers", title: "For your customers", text: "What shoppers can do on your site." },
  { id: "partners", title: "For your partners", text: "Pages for the contractors and affiliates who sell your lines." },
  { id: "backOffice", title: "For your team", text: "Back-office tools for your own orders, catalog and store." },
];

const P = "client/src/pages/";
const A = "client/src/components/admin/";

export const DEMO_FEATURES: DemoFeature[] = [
  // ── For your customers ──
  { id: "storefront", group: "customers", spotlight: true, name: "Branded storefront", text: "Your logo, colors and contact details on a store that shows only your lines.", demoHref: "/distributor-preview/storefront", mirrors: [`${P}Storefront.tsx`] },
  { id: "designer", group: "customers", spotlight: true, name: "3D kitchen designer", text: "Customers plan their kitchen in 3D and send the cabinet list straight to the cart.", demoHref: "/distributor-preview/design", mirrors: [`${P}DesignTool.tsx`] },
  { id: "auto-design", group: "customers", spotlight: true, name: "Auto Design", text: "Set up the room and Auto Design lays out a starting kitchen, ready to adjust.", demoHref: "/distributor-preview/auto-design", mirrors: ["client/src/lib/autoDesignAutoBuild.ts", "client/src/lib/autoDesignLayout.ts", "client/src/components/design/AutoDesignReviewList.tsx"] },
  { id: "easy-upload", group: "customers", spotlight: true, name: "Easy upload ordering", text: "Type a cabinet list or snap a photo of one, and it becomes a shopping list.", demoHref: "/distributor-preview/storefront#easy-upload", mirrors: [`${P}PhotoToCart.tsx`] },
  { id: "order-builder", group: "customers", name: "Order by cabinet code", text: "Pros type codes and quantities straight into an order.", mirrors: [`${P}OrderBuilder.tsx`] },
  { id: "catalog", group: "customers", name: "Full catalog by line", text: "Every base, wall, tall and specialty cabinet, grouped by door line.", demoHref: "/distributor-preview/shop", mirrors: ["client/src/components/storefront/StorefrontShop.tsx"] },
  { id: "sinks-faucets", group: "customers", name: "Sinks and faucets", text: "Sinks and faucets matched to the sink base they fit.", demoHref: "/distributor-preview/shop#sinks-faucets", mirrors: ["client/src/lib/sinkBaseSelection.ts", "client/src/lib/autoDesignFaucet.ts"] },
  { id: "door-styles", group: "customers", name: "Shop by door style", text: "Customers compare door styles and colors side by side.", mirrors: [`${P}DoorStyles.tsx`] },
  { id: "kitchen-ideas", group: "customers", name: "Kitchen ideas", text: "Finished kitchen looks to browse for inspiration.", mirrors: [`${P}KitchenDiscovery.tsx`] },
  { id: "bundles", group: "customers", name: "Kitchen packages", text: "Ready-made kitchen packages at one price.", mirrors: [`${P}BundleDeals.tsx`] },
  { id: "bathroom", group: "customers", name: "Bathroom vanities", text: "The designer also plans bathrooms with vanities.", demoHref: "/distributor-preview/design", mirrors: ["client/src/lib/bathroomTabClassification.ts"] },
  { id: "closet", group: "customers", name: "Closet designer", text: "Customers lay out a closet and order the parts.", mirrors: [`${P}VendorClosetStudio.tsx`] },
  { id: "countertops", group: "customers", name: "Countertops and surfaces", text: "Countertop and surface options to go with the cabinets.", mirrors: [`${P}Countertops.tsx`, `${P}Surfaces.tsx`] },
  { id: "hardware", group: "customers", name: "Cabinet hardware", text: "Knobs and pulls to finish the order.", mirrors: [`${P}Hardware.tsx`] },
  { id: "shower", group: "customers", name: "Shower builder", text: "A step-by-step builder for a shower.", mirrors: [`${P}BuildShower.tsx`] },
  { id: "measure", group: "customers", name: "Measure the room", text: "Customers measure their walls with a phone.", mirrors: [`${P}ARMeasure.tsx`] },
  { id: "room-layouts", group: "customers", name: "Room layout starters", text: "Common kitchen shapes to start a design from.", mirrors: [`${P}RoomLayouts.tsx`] },
  { id: "presentation", group: "customers", name: "Design presentation and share link", text: "A clean presentation and a 3D link customers can share.", mirrors: [`${P}DesignPresentation.tsx`, `${P}SharedRoom3D.tsx`] },
  { id: "plan-sheet", group: "customers", name: "Printable plan sheet", text: "A plan sheet of the design to print or send.", mirrors: [`${P}PlanSheet.tsx`] },
  { id: "designer-guide", group: "customers", name: "Designer walkthrough", text: "A short guide to using the 3D designer.", mirrors: [`${P}DesignerWalkthrough.tsx`] },
  { id: "cart-checkout", group: "customers", name: "Cart and online checkout", text: "Customers pay online and get an order confirmation.", mirrors: [`${P}Cart.tsx`, `${P}CheckoutSuccess.tsx`] },
  { id: "account", group: "customers", name: "Customer accounts", text: "Saved designs and past orders in one place.", mirrors: [`${P}Account.tsx`, `${P}StoreAccount.tsx`] },
  { id: "invoice", group: "customers", name: "Invoice and order lookup", text: "Customers open their invoice and check their order.", mirrors: [`${P}InvoicePage.tsx`] },
  { id: "bilingual", group: "customers", name: "English and Spanish", text: "Shoppers can switch the site language.", mirrors: ["client/src/contexts/LanguageContext.tsx"] },

  // ── For your partners ──
  { id: "contractors", group: "partners", spotlight: true, name: "Contractor portal", text: "Contractors get their own login for customers, designs, labor and orders.", demoHref: "/distributor-preview/contractors", mirrors: [`${P}ContractorDashboard.tsx`] },
  { id: "contractor-access", group: "partners", name: "Approve contractors", text: "Approve or decline contractors who apply on your store.", demoHref: "/distributor-preview/contractors", mirrors: [`${A}ContractorAccessAdmin.tsx`], matrix: [24] },
  { id: "affiliates", group: "partners", spotlight: true, name: "Affiliate program", text: "Partners get a branded store, their own pricing, a marketing hub and earnings.", demoHref: "/distributor-preview/affiliates", mirrors: [`${P}AffiliateDashboard.tsx`, `${P}AffiliateSetup.tsx`, `${P}AffiliateAgreementPage.tsx`] },
  { id: "pro-network", group: "partners", name: "Pro network", text: "Installers and other pros can apply to join.", mirrors: [`${P}ProNetwork.tsx`] },

  // ── For your team (back office) — permission matrix DISTRIBUTOR-ACCESSIBLE rows ──
  { id: "back-office", group: "backOffice", spotlight: true, name: "Back office dashboard", text: "Orders, leads, affiliates, labor and customer notes on one screen.", demoHref: "/distributor-preview/dashboard", mirrors: [`${P}VendorPortal.tsx`, `${P}DistributorPortal.tsx`] },
  { id: "incoming-orders", group: "backOffice", name: "Incoming orders", text: "See and fulfill orders for your lines, and confirm stock and invoice.", demoHref: "/distributor-preview/dashboard?tab=orders", mirrors: [`${A}IncomingOrdersAdmin.tsx`], matrix: [1] },
  { id: "order-detail", group: "backOffice", name: "Order detail", text: "The full detail for each order you fulfill.", demoHref: "/distributor-preview/dashboard?tab=orders", mirrors: [`${P}AdminOrderPage.tsx`], matrix: [90] },
  { id: "sales-forecast", group: "backOffice", name: "Sales forecast", text: "Demand from customers' saved designs, so you can stock ahead.", mirrors: [`${A}SalesForecastAdmin.tsx`], matrix: [3] },
  { id: "sample-orders", group: "backOffice", name: "Sample orders", text: "Send sample doors to customers who ask for them.", mirrors: [`${A}SupplierSamplesAdmin.tsx`], matrix: [4] },
  { id: "inventory", group: "backOffice", name: "Inventory", text: "Keep on-hand stock for your lines up to date.", mirrors: [`${A}VendorInventoryAdmin.tsx`], matrix: [6] },
  { id: "featured-styles", group: "backOffice", name: "Featured door styles", text: "Choose which of your door styles to feature.", mirrors: [`${A}FeaturedStylesAdmin.tsx`], matrix: [32] },
  { id: "product-images", group: "backOffice", name: "Product photos", text: "Add and replace photos of your products.", mirrors: [`${A}SkuImageManager.tsx`], matrix: [36] },
  { id: "fulfillment", group: "backOffice", name: "Fulfillment settings", text: "Order email, warehouse, pickup and lead time.", mirrors: [`${A}DistributorFulfillmentEditor.tsx`], matrix: [40] },
  { id: "catalog-import", group: "backOffice", name: "Price list upload", text: "Upload your price list to update your catalog.", mirrors: [`${A}CatalogImporterTab.tsx`], matrix: [43, 97] },
  { id: "product-details", group: "backOffice", name: "Complete product details", text: "Fill in missing details for products not yet matched.", mirrors: [`${A}PendingDistributorConnectionsAdmin.tsx`], matrix: [44] },
  { id: "onboarding", group: "backOffice", name: "Go-live checklist", text: "Track the steps to launch your store.", mirrors: [`${A}VendorOnboardingAdmin.tsx`], matrix: [45] },
  { id: "package-builder", group: "backOffice", name: "Build kitchen packages", text: "Put together packages from your own line.", mirrors: [`${A}BundleDealsAdmin.tsx`], matrix: [51] },
  { id: "analytics", group: "backOffice", name: "Store analytics", text: "Visits and sales on your store.", mirrors: [`${A}AnalyticsAdmin.tsx`], matrix: [85] },
];

export function featuresInGroup(group: DemoFeatureGroup): DemoFeature[] {
  return DEMO_FEATURES.filter((f) => f.group === group);
}

export const DEMO_SPOTLIGHT_FEATURES = DEMO_FEATURES.filter((f) => f.spotlight);

/** Short sub-page content for the big features that are cheap to show. */
export const FEATURE_SPOTLIGHTS = {
  "auto-design": {
    title: "Auto Design",
    lead: "Your customer sets up the room. Auto Design lays out a complete starting kitchen with your cabinets, and they adjust it from there.",
    points: [
      "Places base and wall cabinets along each wall, including corners.",
      "Picks a sink base with a matching sink and faucet.",
      "Fills the gaps with fillers so the run fits the wall.",
      "Shows a short report of what it placed, so nothing is a surprise.",
      "Everything stays editable in the 3D designer, then goes to the cart.",
    ],
    cta: { label: "Open the designer", href: "/distributor-preview/design" },
  },
  contractors: {
    title: "Contractor portal",
    lead: "Contractors who sell your lines get their own login. You approve who joins your store.",
    points: [
      "Customers: the contractor's own customer list.",
      "Designs: kitchens they planned for each customer.",
      "Labor: their installation and labor estimates.",
      "Orders: everything they ordered through your store.",
    ],
    cta: { label: "See labor in the back office", href: "/distributor-preview/dashboard?tab=contractors" },
  },
  affiliates: {
    title: "Affiliate program",
    lead: "Dealers, remodelers and referral partners can run their own store under you, with your catalog and the same 3D designer.",
    points: [
      "Apply, brand the store with a logo and colors, set pricing, start selling.",
      "My CRM, earnings and analytics for their own customers.",
      "A marketing hub and installation tools.",
      "They can add their own contractors.",
    ],
    cta: { label: "See affiliates in the back office", href: "/distributor-preview/dashboard?tab=affiliates" },
  },
} as const;

export type FeatureSpotlightId = keyof typeof FEATURE_SPOTLIGHTS;
