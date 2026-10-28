/**
 * Numeric kitchen-rule parameters. Code defaults apply until an admin saves
 * a different value. Disabled rules are omitted by the parameter endpoint,
 * so they fall back to these defaults too.
 */
export const KITCHEN_RULE_PARAMETER_DEFAULTS = {
  jog_max_in: 3,
  range_fridge_min_cabinet_in: 15,
  filler_gap_max_in: 6,
  wall_bottom_in: 54,
  bridge_hung_bottom_in: 72,
  bridge_hung_height_in: 24,
  bridge_open_bottom_in: 66,
  bridge_open_height_in: 30,
  run_top_in: 96,
  hood_bottom_in: 66,
  baking_zone_min_in: 36,
  heavy_cook_landing_in: 15,
  small_cabinet_below_in: 15,
  u_shape_corner_count: 2,
  sink_dishwasher_max_gap_in: 36,
  dishwasher_corner_clear_in: 21,
  dishwasher_corner_min_in: 2,
  sink_landing_long_in: 24,
  sink_landing_short_in: 18,
  fridge_landing_in: 15,
  fridge_hinge_clear_in: 2.5,
  blind_open_leg_in: 27,
  sink_base_default_in: 36,
} as const;

export type KitchenRuleParameterKey = keyof typeof KITCHEN_RULE_PARAMETER_DEFAULTS;

let overrides: Partial<Record<KitchenRuleParameterKey, number>> = {};

export function setKitchenRuleParameters(values: Record<string, number> | null | undefined): void {
  const next: Partial<Record<KitchenRuleParameterKey, number>> = {};
  if (values) {
    for (const key of Object.keys(KITCHEN_RULE_PARAMETER_DEFAULTS) as KitchenRuleParameterKey[]) {
      const value = values[key];
      if (typeof value === "number" && Number.isFinite(value)) next[key] = value;
    }
  }
  overrides = next;
}

export function resetKitchenRuleParameters(): void {
  overrides = {};
}

export function kitchenRuleNumber(key: KitchenRuleParameterKey): number {
  const value = overrides[key];
  return typeof value === "number" && Number.isFinite(value) ? value : KITCHEN_RULE_PARAMETER_DEFAULTS[key];
}

export function kitchenRuleParameterSnapshot(): Record<KitchenRuleParameterKey, number> {
  const snapshot = { ...KITCHEN_RULE_PARAMETER_DEFAULTS };
  for (const key of Object.keys(snapshot) as KitchenRuleParameterKey[]) {
    snapshot[key] = kitchenRuleNumber(key);
  }
  return snapshot;
}
