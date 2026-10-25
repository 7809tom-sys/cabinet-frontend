import { describe, expect, it } from "vitest";
import { SITE_STRINGS } from "./site";

// The site-wide EN/ES dictionary must stay in lockstep: every English key needs
// a Spanish counterpart (and vice versa) so the UI never falls back to a raw key
// or an English string while in Spanish.
describe("SITE_STRINGS", () => {
  const enKeys = Object.keys(SITE_STRINGS.en).sort();
  const esKeys = Object.keys(SITE_STRINGS.es).sort();

  it("has matching key sets in en and es", () => {
    expect(esKeys).toEqual(enKeys);
  });

  it("has no empty values in either language", () => {
    for (const [k, v] of Object.entries(SITE_STRINGS.en)) {
      expect(v, `en.${k}`).toBeTruthy();
    }
    for (const [k, v] of Object.entries(SITE_STRINGS.es)) {
      expect(v, `es.${k}`).toBeTruthy();
    }
  });

  it("does not leave Spanish strings identical to English for translatable copy", () => {
    // A few tokens are intentionally identical across languages (brand, acronyms).
    const allowedIdentical = new Set([
      "nav_crm",
      "cart_subtotal",
      "home_cat_base_t", // "Base" is the same word in ES
      "home_cat_ada_t", // "ADA" is a proper acronym
      "ds_color", // "Color" is the same word in ES
      "pkd_th_sku", // "SKU" is a universal acronym
      "ct_material", // "Material" is the same word in ES
      "dt_cq_material", // "Material" is the same word in ES
      "pay_cvc", // "CVC" is a universal acronym
      "dt_rs_field_eq", // pure number/unit format string
      "ob_manual_hint_c", // just ")." punctuation
      "dt_pd_phone_ph", // phone number placeholder, format-only
      "dt_bs_color_1", // "Color 1" reads the same in ES
      "dt_bs_color_2", // "Color 2" reads the same in ES
      "dt_bs_incl", // "incl." abbreviation kept short, same in ES
      "dt_tab_base", // "Base" is the same word in ES
      "fam_f_base", // "Base" is the same word in ES
      "fam_f_ada", // "ADA" is a proper acronym
      "fam_color", // "Color:" reads the same in ES
      "seo_cabinet_t", // pure "{name}" token — the cabinet's own name, no copy
      "dt_wall_cab_suggest_no", // "No" is the same word in ES
    ]);
    const identical = enKeys.filter(
      (k) =>
        !allowedIdentical.has(k) &&
        SITE_STRINGS.en[k as keyof typeof SITE_STRINGS.en] ===
          SITE_STRINGS.es[k as keyof typeof SITE_STRINGS.es]
    );
    expect(identical).toEqual([]);
  });
});
