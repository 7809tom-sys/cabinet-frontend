/**
 * Numeric and text rule values the auto-designer reads.
 *
 * Two layers, always in this order:
 *
 *   1. the admin override, one entry per unique setting key, loaded from
 *      `kitchenRules.settings` for the session;
 *   2. the code default in `kitchenRuleRegistry.ts`.
 *
 * A missing, disabled, or deleted override falls back to the code default, so
 * nothing changes on a plan until an admin saves a different value.
 *
 * A rule Tom made mandatory is `locked`. Its stored value is accepted but never
 * read: `kitchenRuleNumber` answers with the code default so the bridge above
 * the range, the faucet at the sink, and a window that never moves cannot be
 * switched off from a screen.
 */
import {
  KITCHEN_RULE_PARAMETER_DEFAULTS,
  KITCHEN_RULE_TEXT_DEFAULTS,
  kitchenRuleDefinition,
  kitchenRuleIsLocked,
  type KitchenRuleNumericKey,
  type KitchenRuleTextKey,
} from "./kitchenRuleRegistry";

export { KITCHEN_RULE_PARAMETER_DEFAULTS };

export type KitchenRuleParameterKey = KitchenRuleNumericKey;

/** Numeric overrides, keyed by the unique setting key. Never shared between rules. */
let overrides: Partial<Record<string, number>> = {};
/** Text overrides (a choice, a preference order, a SKU map), keyed the same way. */
let textOverrides: Record<string, string> = {};

/** Numeric or text value for one setting key, or undefined when nothing is stored. */
export function kitchenRuleOverrideValue(key: string): number | string | undefined {
  if (kitchenRuleIsLocked(key)) return undefined;
  const numeric = overrides[key];
  if (typeof numeric === "number" && Number.isFinite(numeric)) return numeric;
  return textOverrides[key];
}

/** True when an admin saved a value that differs from the code default. */
export function kitchenRuleIsOverridden(key: string): boolean {
  return kitchenRuleOverrideValue(key) !== undefined;
}

/** A text rule, such as the corner preference order or the sink base map. */
export function kitchenRuleText(key: string, fallback?: string): string {
  if (!kitchenRuleIsLocked(key)) {
    const value = textOverrides[key]?.trim();
    if (value) return value;
  }
  if (fallback != null) return fallback;
  const definition = kitchenRuleDefinition(key);
  if (definition && typeof definition.defaultValue === "string") return definition.defaultValue;
  const known = KITCHEN_RULE_TEXT_DEFAULTS[key as KitchenRuleTextKey];
  return typeof known === "string" ? known : "";
}

/** A choice rule, clamped to the values the definition allows. */
export function kitchenRuleChoice<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  const value = kitchenRuleText(key, fallback) as T;
  return allowed.includes(value) ? value : fallback;
}

/** A toggle rule as a boolean. A stored 0 is off; anything else is on. */
export function kitchenRuleEnabled(key: KitchenRuleNumericKey): boolean {
  return kitchenRuleNumber(key) !== 0;
}

export function setKitchenRuleTextParameters(values: Record<string, string> | null | undefined): void {
  textOverrides = {};
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.trim()) textOverrides[key] = value.trim();
  }
}

/**
 * Applies the saved overrides. Only a key the Designer actually knows is kept,
 * so a stray or renamed row can never change a plan, and a rule whose override
 * row is disabled or deleted simply is not in the map and falls back.
 */
export function setKitchenRuleParameters(values: Record<string, number> | null | undefined): void {
  const next: Partial<Record<string, number>> = {};
  if (values) {
    for (const [key, value] of Object.entries(values)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!kitchenRuleDefinition(key)) continue;
      next[key] = value;
    }
  }
  overrides = next;
}

export function resetKitchenRuleParameters(): void {
  overrides = {};
  textOverrides = {};
}

export function kitchenRuleNumber(key: KitchenRuleNumericKey): number {
  const fallback = KITCHEN_RULE_PARAMETER_DEFAULTS[key];
  if (kitchenRuleIsLocked(key)) return fallback;
  const value = overrides[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Every numeric rule as the Designer currently reads it. */
export function kitchenRuleParameterSnapshot(): Record<KitchenRuleNumericKey, number> {
  const snapshot = { ...KITCHEN_RULE_PARAMETER_DEFAULTS };
  for (const key of Object.keys(snapshot) as KitchenRuleNumericKey[]) {
    snapshot[key] = kitchenRuleNumber(key);
  }
  return snapshot;
}

/** One rule's current value, for the admin table: the override, or the default. */
export function kitchenRuleEffectiveValue(key: string): number | string {
  const override = kitchenRuleOverrideValue(key);
  if (override !== undefined) return override;
  const definition = kitchenRuleDefinition(key);
  if (definition) return definition.defaultValue;
  return KITCHEN_RULE_PARAMETER_DEFAULTS[key as KitchenRuleNumericKey] ?? "";
}

/** Text form of a rule value, as the admin input shows it. */
export function kitchenRuleValueText(value: number | string | null | undefined): string {
  if (value == null) return "";
  return typeof value === "number" ? String(value) : value;
}
