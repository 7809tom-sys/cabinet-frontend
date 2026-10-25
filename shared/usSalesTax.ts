/**
 * US state-level sales tax reference rates (combined state + average local).
 * These are representative combined rates used for estimation purposes.
 * Actual rates may vary by county/city; Cabinet Dealz uses these for quote estimates.
 *
 * Sources: Tax Foundation 2024 state/local combined averages.
 * Rate is expressed as a decimal fraction (e.g. 0.0725 = 7.25%).
 */

export type StateTaxInfo = {
  code: string;   // 2-letter USPS abbreviation
  name: string;   // Full state name
  rate: number;   // Combined state + avg local rate (decimal)
  stateRate: number; // State-only rate
  hasLocalTax: boolean;
  notes?: string;
};

export const US_STATE_TAX_RATES: StateTaxInfo[] = [
  { code: "AL", name: "Alabama",              rate: 0.0922, stateRate: 0.04,   hasLocalTax: true },
  { code: "AK", name: "Alaska",               rate: 0.0176, stateRate: 0.00,   hasLocalTax: true,  notes: "No state tax; local only" },
  { code: "AZ", name: "Arizona",              rate: 0.0840, stateRate: 0.056,  hasLocalTax: true },
  { code: "AR", name: "Arkansas",             rate: 0.0946, stateRate: 0.065,  hasLocalTax: true },
  { code: "CA", name: "California",           rate: 0.0868, stateRate: 0.0725, hasLocalTax: true },
  { code: "CO", name: "Colorado",             rate: 0.0777, stateRate: 0.029,  hasLocalTax: true },
  { code: "CT", name: "Connecticut",          rate: 0.0635, stateRate: 0.0635, hasLocalTax: false },
  { code: "DE", name: "Delaware",             rate: 0.0000, stateRate: 0.00,   hasLocalTax: false, notes: "No sales tax" },
  { code: "FL", name: "Florida",              rate: 0.0701, stateRate: 0.06,   hasLocalTax: true },
  { code: "GA", name: "Georgia",              rate: 0.0737, stateRate: 0.04,   hasLocalTax: true },
  { code: "HI", name: "Hawaii",               rate: 0.0444, stateRate: 0.04,   hasLocalTax: true,  notes: "General Excise Tax" },
  { code: "ID", name: "Idaho",                rate: 0.0603, stateRate: 0.06,   hasLocalTax: true },
  { code: "IL", name: "Illinois",             rate: 0.0882, stateRate: 0.0625, hasLocalTax: true },
  { code: "IN", name: "Indiana",              rate: 0.0700, stateRate: 0.07,   hasLocalTax: false },
  { code: "IA", name: "Iowa",                 rate: 0.0694, stateRate: 0.06,   hasLocalTax: true },
  { code: "KS", name: "Kansas",               rate: 0.0868, stateRate: 0.065,  hasLocalTax: true },
  { code: "KY", name: "Kentucky",             rate: 0.0600, stateRate: 0.06,   hasLocalTax: false },
  { code: "LA", name: "Louisiana",            rate: 0.0956, stateRate: 0.0445, hasLocalTax: true },
  { code: "ME", name: "Maine",                rate: 0.0550, stateRate: 0.055,  hasLocalTax: false },
  { code: "MD", name: "Maryland",             rate: 0.0600, stateRate: 0.06,   hasLocalTax: false },
  { code: "MA", name: "Massachusetts",        rate: 0.0625, stateRate: 0.0625, hasLocalTax: false },
  { code: "MI", name: "Michigan",             rate: 0.0600, stateRate: 0.06,   hasLocalTax: false },
  { code: "MN", name: "Minnesota",            rate: 0.0749, stateRate: 0.06875,hasLocalTax: true },
  { code: "MS", name: "Mississippi",          rate: 0.0707, stateRate: 0.07,   hasLocalTax: true },
  { code: "MO", name: "Missouri",             rate: 0.0825, stateRate: 0.04225,hasLocalTax: true },
  { code: "MT", name: "Montana",              rate: 0.0000, stateRate: 0.00,   hasLocalTax: false, notes: "No sales tax" },
  { code: "NE", name: "Nebraska",             rate: 0.0694, stateRate: 0.055,  hasLocalTax: true },
  { code: "NV", name: "Nevada",               rate: 0.0823, stateRate: 0.0685, hasLocalTax: true },
  { code: "NH", name: "New Hampshire",        rate: 0.0000, stateRate: 0.00,   hasLocalTax: false, notes: "No sales tax" },
  { code: "NJ", name: "New Jersey",           rate: 0.0660, stateRate: 0.066,  hasLocalTax: false },
  { code: "NM", name: "New Mexico",           rate: 0.0783, stateRate: 0.05,   hasLocalTax: true },
  { code: "NY", name: "New York",             rate: 0.0852, stateRate: 0.04,   hasLocalTax: true },
  { code: "NC", name: "North Carolina",       rate: 0.0698, stateRate: 0.0475, hasLocalTax: true },
  { code: "ND", name: "North Dakota",         rate: 0.0696, stateRate: 0.05,   hasLocalTax: true },
  { code: "OH", name: "Ohio",                 rate: 0.0722, stateRate: 0.0575, hasLocalTax: true },
  { code: "OK", name: "Oklahoma",             rate: 0.0895, stateRate: 0.045,  hasLocalTax: true },
  { code: "OR", name: "Oregon",               rate: 0.0000, stateRate: 0.00,   hasLocalTax: false, notes: "No sales tax" },
  { code: "PA", name: "Pennsylvania",         rate: 0.0634, stateRate: 0.06,   hasLocalTax: true },
  { code: "RI", name: "Rhode Island",         rate: 0.0700, stateRate: 0.07,   hasLocalTax: false },
  { code: "SC", name: "South Carolina",       rate: 0.0743, stateRate: 0.06,   hasLocalTax: true },
  { code: "SD", name: "South Dakota",         rate: 0.0640, stateRate: 0.046,  hasLocalTax: true },
  { code: "TN", name: "Tennessee",            rate: 0.0955, stateRate: 0.07,   hasLocalTax: true },
  { code: "TX", name: "Texas",                rate: 0.0820, stateRate: 0.0625, hasLocalTax: true },
  { code: "UT", name: "Utah",                 rate: 0.0719, stateRate: 0.0485, hasLocalTax: true },
  { code: "VT", name: "Vermont",              rate: 0.0624, stateRate: 0.06,   hasLocalTax: true },
  { code: "VA", name: "Virginia",             rate: 0.0575, stateRate: 0.053,  hasLocalTax: true },
  { code: "WA", name: "Washington",           rate: 0.0993, stateRate: 0.065,  hasLocalTax: true },
  { code: "WV", name: "West Virginia",        rate: 0.0650, stateRate: 0.06,   hasLocalTax: true },
  { code: "WI", name: "Wisconsin",            rate: 0.0543, stateRate: 0.05,   hasLocalTax: true },
  { code: "WY", name: "Wyoming",              rate: 0.0536, stateRate: 0.04,   hasLocalTax: true },
  { code: "DC", name: "Washington D.C.",      rate: 0.0600, stateRate: 0.06,   hasLocalTax: false },
];

/** Map from 2-letter state code to StateTaxInfo for O(1) lookup. */
export const STATE_TAX_MAP: Map<string, StateTaxInfo> = new Map(
  US_STATE_TAX_RATES.map((s) => [s.code, s])
);

/**
 * Look up the combined sales tax rate for a US state.
 * @param stateCode 2-letter USPS state abbreviation (case-insensitive)
 * @returns StateTaxInfo or null if not found
 */
export function getStateTaxRate(stateCode: string): StateTaxInfo | null {
  return STATE_TAX_MAP.get(stateCode.toUpperCase()) ?? null;
}

/**
 * Calculate the sales tax amount for a given subtotal and state.
 * @param subtotal Pre-tax order amount in dollars
 * @param stateCode 2-letter state code
 * @returns { taxAmount, taxRate, taxLabel } or null if state not found
 */
export function calcSalesTax(
  subtotal: number,
  stateCode: string
): { taxAmount: number; taxRate: number; taxLabel: string } | null {
  const info = getStateTaxRate(stateCode);
  if (!info) return null;
  const taxAmount = Number((subtotal * info.rate).toFixed(2));
  const pct = (info.rate * 100).toFixed(2).replace(/\.?0+$/, "");
  const taxLabel = info.rate === 0
    ? `${info.name} — No Sales Tax`
    : `${info.name} Sales Tax (${pct}%)`;
  return { taxAmount, taxRate: info.rate, taxLabel };
}
