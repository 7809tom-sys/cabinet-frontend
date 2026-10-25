export type DistributorShippingRuleMode = "live" | "fixed" | "threshold";

export type DistributorZipRate = {
  /** A complete five-digit ZIP or a leading ZIP zone such as 750. */
  zipPrefix: string;
  feeCents: number;
};

export type DistributorShippingRule = {
  mode: DistributorShippingRuleMode;
  flatFeeCents: number | null;
  freeThresholdCents: number | null;
  zipRates: DistributorZipRate[];
  exceptions: string | null;
};

export type ResolvedDistributorShippingRule = {
  fixedFeeCents: number | null;
  label: string | null;
  matchedZipPrefix: string | null;
};

const cleanZipPrefix = (value: string) => value.replace(/\D/g, "").slice(0, 5);

export function normalizeDistributorZipRates(value: unknown): DistributorZipRate[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, DistributorZipRate>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as { zipPrefix?: unknown; feeCents?: unknown };
    const zipPrefix = cleanZipPrefix(typeof candidate.zipPrefix === "string" ? candidate.zipPrefix : "");
    const feeCents = Number(candidate.feeCents);
    if (zipPrefix.length < 3 || !Number.isInteger(feeCents) || feeCents < 0) continue;
    unique.set(zipPrefix, { zipPrefix, feeCents });
  }
  return Array.from(unique.values()).sort((a, b) => b.zipPrefix.length - a.zipPrefix.length || a.zipPrefix.localeCompare(b.zipPrefix));
}

/** Resolves only the distributor's declared fixed/threshold rule; live stays live. */
export function resolveDistributorShippingRule(
  rule: DistributorShippingRule,
  destinationZip: string,
  merchandiseSubtotalCents: number,
): ResolvedDistributorShippingRule {
  if (rule.mode === "live") return { fixedFeeCents: null, label: null, matchedZipPrefix: null };

  if (
    rule.mode === "threshold" &&
    rule.freeThresholdCents != null &&
    rule.freeThresholdCents > 0 &&
    merchandiseSubtotalCents >= rule.freeThresholdCents
  ) {
    return {
      fixedFeeCents: 0,
      label: `Free freight over $${(rule.freeThresholdCents / 100).toFixed(2)}`,
      matchedZipPrefix: null,
    };
  }

  const normalizedZip = cleanZipPrefix(destinationZip);
  const match = normalizeDistributorZipRates(rule.zipRates).find((rate) => normalizedZip.startsWith(rate.zipPrefix));
  if (match) {
    return {
      fixedFeeCents: match.feeCents,
      label: `Distributor fixed freight for ZIP ${match.zipPrefix}`,
      matchedZipPrefix: match.zipPrefix,
    };
  }
  if (rule.flatFeeCents != null && rule.flatFeeCents >= 0) {
    return { fixedFeeCents: rule.flatFeeCents, label: "Distributor fixed freight", matchedZipPrefix: null };
  }
  return { fixedFeeCents: null, label: null, matchedZipPrefix: null };
}

export function shippingRuleCanQuote(rule: DistributorShippingRule): boolean {
  if (rule.mode === "live") return true;
  return normalizeDistributorZipRates(rule.zipRates).length > 0 || (rule.flatFeeCents != null && rule.flatFeeCents >= 0);
}
