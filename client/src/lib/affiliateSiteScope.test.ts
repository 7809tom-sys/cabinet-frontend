import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DIRECT_CUSTOMER_STORE_LABEL,
  affiliateStoreInput,
  crmBoardQueryInput,
  customerDirectoryInput,
  customerOwnerStoreLabel,
  dealCustomerInput,
  signupStoreScope,
} from "./affiliateSiteScope";

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

describe("affiliate site scope inputs", () => {
  it("selects one store, house rows, or every store", () => {
    expect(customerDirectoryInput(7, false)).toEqual({ affiliateId: 7 });
    expect(customerDirectoryInput(7, true)).toEqual({ affiliateId: 7 });
    expect(customerDirectoryInput(null, true)).toEqual({ house: true });
    expect(customerDirectoryInput(null, false)).toEqual({ adminAll: true });
  });

  it("uses adminAll only when the CRM has no store id", () => {
    expect(crmBoardQueryInput(7)).toEqual({ affiliateId: 7 });
    expect(crmBoardQueryInput(undefined)).toEqual({ adminAll: true });
    expect(crmBoardQueryInput(null)).toEqual({ adminAll: true });
  });

  it("loads a deal with no store as house, not every store", () => {
    expect(dealCustomerInput(7)).toEqual({ affiliateId: 7 });
    expect(dealCustomerInput(null)).toEqual({ house: true });
    expect(dealCustomerInput(undefined)).toEqual({ house: true });
  });

  it("omits the store id when the caller is looking at their own orders", () => {
    expect(affiliateStoreInput(7)).toEqual({ affiliateId: 7 });
    expect(affiliateStoreInput(undefined)).toBeUndefined();
    expect(affiliateStoreInput(null)).toBeUndefined();
  });

  it("reads signup scope from the store path, then the subdomain", () => {
    expect(signupStoreScope({
      pathname: "/store/ada-kitchens/signin",
      hostname: "www.cabinetdealz.com",
    })).toBe("ada-kitchens");
    expect(signupStoreScope({
      pathname: "/signin",
      hostname: "ada-kitchens.cabinetdealz.com",
    })).toBe("ada-kitchens");
    expect(signupStoreScope({
      pathname: "/signin",
      hostname: "www.cabinetdealz.com",
    })).toBeUndefined();
    expect(signupStoreScope({
      pathname: "/store/ada-kitchens/cart",
      hostname: "other-shop.cabinetdealz.com",
    })).toBe("ada-kitchens");
  });

  it("shows the store name and labels an unattributed account as Cabinet Dealz direct", () => {
    expect(customerOwnerStoreLabel({ ownerStoreName: "Ada Store" })).toBe("Ada Store");
    expect(customerOwnerStoreLabel({ ownerStoreName: "  Ada Store  " })).toBe("Ada Store");
    expect(customerOwnerStoreLabel({ ownerStoreName: DIRECT_CUSTOMER_STORE_LABEL })).toBe("Cabinet Dealz (direct)");
    expect(customerOwnerStoreLabel({ ownerAffiliateId: null })).toBe("Cabinet Dealz (direct)");
    expect(customerOwnerStoreLabel({ ownerStoreName: "", ownerAffiliateId: null })).toBe("Cabinet Dealz (direct)");
    expect(customerOwnerStoreLabel({ ownerAffiliateId: 7 })).toBeNull();
    expect(customerOwnerStoreLabel({})).toBeNull();
  });
});

describe("affiliate site scope wiring", () => {
  it("passes the open store into the affiliate desk panels", () => {
    const dashboard = source("client/src/pages/AffiliateDashboard.tsx");
    expect(dashboard).toContain('<MyCustomersPanel affiliateId={null} house initialCustomerKey={params.get("customer")} canAssist />');
    expect(dashboard).toContain("<SampleOrderDesk mode=\"affiliate\" affiliateId={affiliate.id} />");
    expect(dashboard).toContain("<OrderTrackingPanel heading=\"Order status\" affiliateId={affiliate.id} />");
    expect(dashboard).toContain("<AddContractorPanel affiliateId={affiliate.id} />");
    expect(dashboard).toContain("<MyCustomersPanel affiliateId={affiliate.id} initialCustomerKey={params.get(\"customer\")} canAssist={access.accessDesigner} />");
  });

  it("keeps account and contractor order lists on the orders that person placed", () => {
    const panel = source("client/src/components/orders/OrderTrackingPanel.tsx");
    expect(panel).toContain("affiliateStoreInput(affiliateId)");
    expect(panel).toContain("trpc.orderTracking.list.useQuery");
    const account = source("client/src/pages/Account.tsx");
    const contractor = source("client/src/pages/ContractorDashboard.tsx");
    expect(account).toContain("<OrderTrackingPanel previewOrders={preview ? SAMPLE_TRACKED_ORDERS : null} />");
    expect(account).not.toContain("affiliateId");
    expect(contractor).toContain("<OrderTrackingPanel previewOrders={preview ? SAMPLE_TRACKED_ORDERS : null} heading=\"Your orders\" />");
    expect(contractor).not.toContain("affiliateId=");
  });

  it("sends adminAll from the admin CRM and house for a deal with no store", () => {
    const board = source("client/src/components/crm/CrmBoard.tsx");
    expect(board).toContain("const scopedAffiliateId = affiliateId ?? masterAffiliateId");
    expect(board).toContain("const boardInput = crmBoardQueryInput(scopedAffiliateId)");
    expect(board).toContain("...crmBoardQueryInput(scopedAffiliateId)");
    expect(board).toContain("<ImportLeadsDialog lang={lang} affiliateId={scopedAffiliateId} />");
    expect(board).toContain("trpc.crm.importableLeads.useQuery");
    expect(board).toContain("dealCustomerInput(deal?.affiliateId)");
    expect(board).not.toContain("{ affiliateId: deal?.affiliateId ?? null");
    expect(board).toContain('importLead.mutate({ type: "order_request", id: r.id, ...leadScope })');
    expect(board).toContain('importLead.mutate({ type: "pro_application", id: a.id, ...leadScope })');
  });

  it("scopes the customer directory, sample desk, and contractor desk by store", () => {
    const customers = source("client/src/components/affiliate/MyCustomersPanel.tsx");
    expect(customers).toContain("customerDirectoryInput(affiliateId, house)");
    expect(customers).toContain("const scope = customerDirectoryInput(affiliateId, house)");
    expect(customers).toContain("setStatus.mutate({ ...scope, customerKey: customer.key, status: event.target.value as CustomerStatus })");
    expect(customers).toContain("openDeal.mutate({ ...scope, customerKey: customer.key })");
    const samples = source("client/src/components/samples/SampleOrderDesk.tsx");
    expect(samples).toContain("affiliateStoreInput(affiliateId)");
    expect(samples).toContain("trpc.vendorSamples.myOrders.useQuery");
    const contractors = source("client/src/components/affiliate/AddContractorPanel.tsx");
    expect(contractors).toContain("affiliateStoreInput(affiliateId)");
    expect(contractors).toContain("myAffiliateRequests.useQuery");
    expect(contractors).toContain("submitForContractor");
  });

  it("puts the store slug on email signup and leaves Google sign-in unchanged", () => {
    const signIn = source("client/src/pages/SignIn.tsx");
    expect(signIn).toContain("storeScope: signupStoreScope()");
    const oauth = signIn.slice(signIn.indexOf("signInWithOAuth"), signIn.indexOf("handleLogin"));
    expect(oauth).toContain('provider: "google"');
    expect(oauth).toContain("options: { redirectTo: authRedirectUrl() }");
    expect(oauth).not.toContain("storeScope");
  });

  it("shows the owning store on the admin customer directory", () => {
    const admin = source("client/src/components/admin/CustomersAdmin.tsx");
    expect(admin).toContain("customerOwnerStoreLabel");
    expect(admin).toContain("<OwnerStoreLine row={u} />");
  });
});
