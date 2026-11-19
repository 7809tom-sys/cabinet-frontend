// Feature flag for the Auto Design subscription + phone gate.
// Default OFF: the gate ships dark. Turn it on per environment with
// VITE_AUTO_DESIGN_SUBSCRIPTION_GATE=on (also accepts 1/true/yes) once the
// backend procedures listed in docs/auto-design-subscription-gate.md exist.
// There is no other feature-flag system in this repo; VITE_* env is the pattern.

import { resolveAutoDesignAccessConfig, type AutoDesignAccessConfig } from "@shared/autoDesignAccess";

const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);

export function parseAutoDesignGateFlag(raw: unknown): boolean {
  return typeof raw === "string" && TRUE_VALUES.has(raw.trim().toLowerCase());
}

export function autoDesignSubscriptionGateEnabled(): boolean {
  return parseAutoDesignGateFlag(import.meta.env.VITE_AUTO_DESIGN_SUBSCRIPTION_GATE);
}

/**
 * Free runs per phone and the fee are config (Tom has not settled them).
 * VITE_AUTO_DESIGN_FREE_PER_PHONE (default 1) and VITE_AUTO_DESIGN_FEE_CENTS
 * (default 999). Display only; the server must enforce the same values.
 */
export function autoDesignAccessConfig(): AutoDesignAccessConfig {
  return resolveAutoDesignAccessConfig({
    freeDesignsPerPhone: import.meta.env.VITE_AUTO_DESIGN_FREE_PER_PHONE,
    accessFeeCents: import.meta.env.VITE_AUTO_DESIGN_FEE_CENTS,
  });
}
