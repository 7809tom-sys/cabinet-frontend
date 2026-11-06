import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * Owner-reported symptoms these checks lock down:
 *
 *  - Tom clicked Rich's design and it opened under "First Class Flooring &
 *    Cabinet Design" instead of Rich's account, and looked locked to that store.
 *  - Tom saved a NEW design ("Maple Life") while signed in and it did not
 *    appear on his login.
 *
 * Both came from the same conflation: the storefront in the URL was treated as
 * the owner. The pure rules live in `designOwnerScope` and
 * `designDraftOwnership` (unit-tested next to them); these assertions pin the
 * wiring, so a later edit cannot quietly go back to the URL.
 */
const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

const designTool = read("../pages/DesignTool.tsx");
const designActions = read("../components/design/DesignActions.tsx");
const account = read("../pages/Account.tsx");
const storeAccount = read("../pages/StoreAccount.tsx");
const crmBoard = read("../components/crm/CrmBoard.tsx");
const myCustomers = read("../components/affiliate/MyCustomersPanel.tsx");

describe("a saved design opens under its true owner", () => {
  it("the Designer sends an out-of-place design to its own store", () => {
    expect(designTool).toContain("designOpenPath({ id: savedDesign.id, affiliateSlug: ownSlug })");
    expect(designTool).toContain("if (ownScope === storeScope) return;");
    // Assisted and CRM opens stay put: the store's team is reviewing the plan.
    expect(designTool).toContain("if (assistMode || crmDealId != null) return;");
  });

  it("every account and CRM list builds its link from the design, not the page", () => {
    for (const source of [account, storeAccount, crmBoard, myCustomers]) {
      expect(source).toContain("designOpenPath(");
    }
    // The old shapes were `?load=` strings built from the viewer's store.
    expect(account).not.toContain("`/design?load=${design.id}`");
    expect(storeAccount).not.toContain("`/store/${slug}/design?load=${design.id}`");
    expect(crmBoard).not.toContain("`/store/${customerDetail.data.storeSlug}/design?load=${design.id}&assist=1`");
    expect(myCustomers).not.toContain("`/store/${slug}/design?load=${design.id}&assist=1`");
  });

  it("My Designs opens a plan saved elsewhere on its own store", () => {
    expect(designActions).toContain("const otherStore = designScope !== storeScope;");
    expect(designActions).toContain("window.location.assign(designOpenPath(d));");
    expect(designActions).toContain("Saves to {designStoreLabel(d)} - opens there");
  });
});

describe("a new save attaches to the signed-in account", () => {
  it("the Designer resolves the save scope from the person, not the URL", () => {
    expect(designTool).toContain("const saveScope = useMemo(");
    expect(designTool).toContain("newDesignSaveScope({");
    expect(designTool).toContain("viewerAffiliateId: affiliatePriceAccess.data?.affiliateId ?? null");
    expect(designTool).toContain("design: savedDesign");
  });

  it("the save confirmation names the account it landed on", () => {
    expect(designActions).toContain("saved to your ${savedStoreName} account");
    expect(designActions).toContain("storeReason");
  });

  it("keeps the two-argument save callback every other caller relies on", () => {
    expect(designActions).toContain("onSaveSuccess?.(savedName, res.id);");
    expect(designActions).not.toContain("onSaveSuccess?.(savedName, res?.id ?? 0);");
    // The save target is reported separately, not bolted onto that signature.
    expect(designActions).toContain("reportSaveTarget?.({");
    expect(designTool).toContain("reportSaveTarget={(savedTo) => {");
  });

  it("My Designs is refreshed as the account's whole list", () => {
    expect(designActions).toContain("utils.design.myDesigns.invalidate();");
    expect(designActions).not.toContain("utils.design.myDesigns.invalidate({ affiliateSlug: storeScope })");
  });
});

describe("guest work made before signing in is adopted by the account", () => {
  it("drafts are keyed by the signed-in account", () => {
    expect(designTool).toContain("draftIdentityFor({ accountId, email: verifiedEmail })");
    expect(designTool).toContain("designerDraftStorageKey(storeScope, draftIdentity)");
  });

  it("the guest plan is moved onto the account once, and only when the account has none", () => {
    expect(designTool).toContain("applyGuestDraftAdoption(localStorage, planGuestDraftAdoption(localStorage, storeScope, accountId))");
  });

  it("restore looks at the account, then its email, then guest work", () => {
    expect(designTool).toContain("draftIdentityCandidates({ accountId, email: verifiedEmail })");
    expect(designTool).toContain("firstRestorableDraft(localStorage, storeScope, candidates)");
  });
});
