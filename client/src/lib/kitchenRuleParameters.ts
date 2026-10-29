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
  /** 1 automatically swaps an out-of-stock SBxx for the mapped base. 0 leaves it. */
  sink_base_substitute: 1,
  /** 1 asks before replacing a configured out-of-stock SKU. 0 skips the prompt. */
  stock_prompt_enabled: 1,
  /** Master switch for the broad exposed-side engine. Off: that engine does not run.
   *  Frameless and Hickory lines still get the narrow auto panels. */
  exposed_panels_enabled: 0,
  panel_thickness_in: 0.75,
  panel_end_wall_enabled: 1,
  panel_dw_enabled: 1,
  panel_fridge_enabled: 1,
  panel_island_enabled: 1,
  panel_window_enabled: 1,
  panel_open_enabled: 1,
  panel_wall_end_enabled: 1,
  panel_tall_enabled: 1,
  window_cabinet_height_in: 30,
  window_filler_max_in: 3,
  /** 1 also panels framed wall cabinets beside a window. 0 is filler only. */
  window_framed_panel: 0,
} as const;

export type KitchenRuleParameterKey = keyof typeof KITCHEN_RULE_PARAMETER_DEFAULTS;

let overrides: Partial<Record<KitchenRuleParameterKey, number>> = {};
let textOverrides: Record<string, string> = {};

export function kitchenRuleText(key: string, fallback: string): string {
  const value = textOverrides[key]?.trim();
  return value ? value : fallback;
}

export function setKitchenRuleTextParameters(values: Record<string, string> | null | undefined): void {
  textOverrides = {};
  if (!values) return;
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" && value.trim()) textOverrides[key] = value.trim();
  }
}

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
  textOverrides = {};
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
