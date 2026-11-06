import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import {
  KITCHEN_RULE_DEFINITIONS,
  kitchenRuleDefinition,
  type KitchenRuleSettingDefinition,
} from "@/lib/kitchenRuleRegistry";
import {
  resetKitchenRuleParameters,
  setKitchenRuleParameters,
  setKitchenRuleTextParameters,
} from "@/lib/kitchenRuleParameters";
import { resetKitchenGuidanceRules, setKitchenGuidanceRules } from "@/lib/kitchenRuleGuidance";

/** One editable rule setting as it comes back from the admin endpoint. */
export type KitchenRuleSetting = {
  settingKey: string;
  title: string;
  description: string;
  category: string;
  valueType: "number" | "toggle" | "text" | "choice";
  /** Current saved value, as text. Null when no override is stored. */
  value: string | null;
  /** The code default the Designer falls back to. */
  defaultValue: string;
  enabled: boolean;
  locked: boolean;
  isBuiltIn: boolean;
  /** Set when an admin deleted this rule. A deleted built-in can be restored. */
  deletedAt: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
  /** True when the code knows this rule and executes it. Custom rules cannot. */
  executed: boolean;
};

export type KitchenRuleSettingSave = {
  settingKey: string;
  title: string;
  description: string;
  category: string;
  valueType: KitchenRuleSetting["valueType"];
  value: string | null;
  enabled: boolean;
};

export type KitchenRuleSettingCreate = {
  settingKey: string;
  title: string;
  description: string;
  category: string;
  valueType: KitchenRuleSetting["valueType"];
  value: string | null;
  enabled: boolean;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown>;
};

type Mutation<TInput, TResult = unknown> = {
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
};

function api() {
  return trpc as unknown as {
    kitchenRules: {
      settings: { useQuery: (input?: undefined, options?: object) => QueryResult<KitchenRuleSetting[]> };
      parameters: { useQuery: (input?: undefined, options?: object) => QueryResult<{ values: Record<string, number>; text?: Record<string, string> }> };
      saveSetting: { useMutation: () => Mutation<KitchenRuleSettingSave> };
      resetSetting: { useMutation: () => Mutation<{ settingKey: string }> };
      createRule: { useMutation: () => Mutation<KitchenRuleSettingCreate> };
      deleteRule: { useMutation: () => Mutation<{ settingKey: string }> };
      restoreRule: { useMutation: () => Mutation<{ settingKey: string }> };
    };
  };
}

/** Every rule for the admin table: saved rows first, then code rules with no row yet. */
export function useKitchenRuleSettings() {
  return api().kitchenRules.settings.useQuery(undefined, { retry: false, throwOnError: false });
}

export function useKitchenRuleSettingMutations() {
  const client = api().kitchenRules;
  return {
    save: client.saveSetting.useMutation(),
    reset: client.resetSetting.useMutation(),
    create: client.createRule.useMutation(),
    remove: client.deleteRule.useMutation(),
    restore: client.restoreRule.useMutation(),
  };
}

export type KitchenRuleParameterPayload = {
  values: Record<string, number>;
  text?: Record<string, string>;
  /** Custom rules the Designer cannot execute, carried to plan review and the AI prompt. */
  guidance?: Array<{ settingKey: string; title: string; text: string; value?: string | null; category?: string | null }>;
};

/**
 * A missing kitchenRules.parameters procedure (NOT_FOUND, often inside a 207
 * batch) must not replace the code defaults or block the Designer.
 */
export function kitchenRuleSyncPlan(input: {
  data?: KitchenRuleParameterPayload | null;
  isError: boolean;
}): "apply" | "defaults" | "wait" {
  if (input.isError) return "defaults";
  if (input.data?.values) return "apply";
  return "wait";
}

/** Loads saved rule values for every Designer session. Failures keep the code defaults. */
export function useKitchenRuleParameterSync() {
  const query = api().kitchenRules.parameters.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
    throwOnError: false,
  });
  useEffect(() => {
    const plan = kitchenRuleSyncPlan({ data: query.data, isError: query.isError });
    if (plan === "defaults") {
      resetKitchenRuleParameters();
      resetKitchenGuidanceRules();
      return;
    }
    if (plan === "apply" && query.data) {
      setKitchenRuleParameters(query.data.values);
      setKitchenRuleTextParameters(query.data.text ?? {});
      setKitchenGuidanceRules(query.data.guidance ?? []);
    }
  }, [query.data, query.isError]);
}

/**
 * The admin table's rows. A saved row wins. A rule the code knows but that has
 * no row yet is shown with its code default, so a new rule is visible and
 * editable before the SQL is run, and never silently missing.
 */
export function mergeKitchenRuleSettings(
  saved: readonly KitchenRuleSetting[] | undefined,
  definitions: readonly KitchenRuleSettingDefinition[] = KITCHEN_RULE_DEFINITIONS,
): KitchenRuleSetting[] {
  const rows = new Map<string, KitchenRuleSetting>();
  for (const definition of definitions) {
    rows.set(definition.key, {
      settingKey: definition.key,
      title: definition.title,
      description: definition.description,
      category: definition.category,
      valueType: definition.valueType,
      value: null,
      defaultValue: String(definition.defaultValue),
      enabled: true,
      locked: definition.locked === true,
      isBuiltIn: true,
      deletedAt: null,
      updatedBy: null,
      updatedAt: null,
      executed: definition.appliedBy !== "kitchenRulesGuidance",
    });
  }
  for (const row of saved ?? []) {
    const definition = kitchenRuleDefinition(row.settingKey);
    rows.set(row.settingKey, {
      ...row,
      // A hard rule is locked whatever the row says, so a stale or hand-edited
      // row can never unlock the bridge, the faucet, or the window.
      locked: definition?.locked === true || row.locked === true,
      executed: definition ? definition.appliedBy !== "kitchenRulesGuidance" : false,
    });
  }
  return [...rows.values()];
}

/** Rows the table shows: deleted built-ins stay out until restored. */
export function visibleKitchenRuleSettings(rows: readonly KitchenRuleSetting[], showDeleted = false): KitchenRuleSetting[] {
  return rows.filter((row) => (showDeleted ? true : row.deletedAt == null));
}

/** A number is worth showing as "changed" only when it differs from the default. */
export function kitchenRuleDiffers(row: KitchenRuleSetting): boolean {
  if (row.value == null) return false;
  if (row.value.trim() === row.defaultValue.trim()) return false;
  const current = Number(row.value);
  const fallback = Number(row.defaultValue);
  if (Number.isFinite(current) && Number.isFinite(fallback)) return Math.abs(current - fallback) > 1e-9;
  return true;
}

export function kitchenRuleLastChanged(row: KitchenRuleSetting): string {
  if (!row.updatedAt) return "Never changed";
  const when = row.updatedAt;
  return row.updatedBy ? `${row.updatedBy} · ${when}` : when;
}

/** Plain sentence for the value column, so a toggle reads as on/off, not 1/0. */
export function kitchenRuleValueLabel(row: KitchenRuleSetting): string {
  const raw = row.value ?? row.defaultValue;
  if (row.valueType === "toggle") return raw === "0" || raw === "" ? "Off" : "On";
  if (raw === "") return "—";
  return raw;
}

/**
 * A custom rule the code does not execute is guidance: it shows on the plan
 * review list and in the AI prompt, and moves no cabinet. Named in the admin
 * table so it is never mistaken for an enforced rule.
 */
export const GUIDANCE_LABEL = "Guidance (shown in plan review & AI prompt)";

export function kitchenRuleKindLabel(row: KitchenRuleSetting): string {
  if (row.locked) return "Locked hard rule";
  if (!row.executed) return GUIDANCE_LABEL;
  return "Enforced by the auto-designer";
}

/** The settingKey a new custom rule gets, from what the admin typed. */
export function customRuleSettingKey(title: string, taken: readonly string[]): string {
  const base = `custom-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "rule"}`;
  if (!taken.includes(base)) return base;
  let index = 2;
  while (taken.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
