import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { setKitchenRuleParameters } from "@/lib/kitchenRuleParameters";

export type KitchenRuleRecord = {
  id: number;
  ruleCode: string;
  category: string;
  title: string;
  ruleDescription: string;
  parameters: Record<string, number>;
  enforcementKind: "auto" | "suggest" | "review" | "reference";
  sourceText: string;
  implementationStatus: "implemented" | "pending" | "reference";
  enabledFlag: boolean;
  notesText: string | null;
  readsParameters: boolean;
  updatedByName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type KitchenRuleUpdate = {
  id: number;
  title?: string;
  category: string;
  ruleDescription: string;
  parameters: Record<string, number>;
  enforcementKind?: KitchenRuleRecord["enforcementKind"];
  sourceText?: string;
  enabledFlag: boolean;
  notesText: string | null;
};

export type KitchenRuleCreate = {
  ruleCode: string;
  title: string;
  category: string;
  ruleDescription: string;
  parameters: Record<string, number>;
  enforcementKind: KitchenRuleRecord["enforcementKind"];
  sourceText: string;
  notesText: string | null;
  enabledFlag: boolean;
};

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  isError: boolean;
  error: { message: string } | null;
  refetch: () => Promise<unknown>;
};

type Mutation<TInput> = {
  mutateAsync: (input: TInput) => Promise<unknown>;
  isPending: boolean;
};

function api() {
  return trpc as unknown as {
    kitchenRules: {
      list: { useQuery: (input?: undefined, options?: object) => QueryResult<KitchenRuleRecord[]> };
      parameters: { useQuery: (input?: undefined, options?: object) => QueryResult<{ values: Record<string, number> }> };
      create: { useMutation: () => Mutation<KitchenRuleCreate> };
      update: { useMutation: () => Mutation<KitchenRuleUpdate> };
    };
  };
}

export function useKitchenRulesList() {
  return api().kitchenRules.list.useQuery(undefined, { retry: false });
}

export function useKitchenRuleMutations() {
  return {
    create: api().kitchenRules.create.useMutation(),
    update: api().kitchenRules.update.useMutation(),
  };
}

/** Loads saved numeric parameters for every Designer session. Failures keep the code defaults. */
export function useKitchenRuleParameterSync() {
  const query = api().kitchenRules.parameters.useQuery(undefined, { retry: false, staleTime: 60_000 });
  useEffect(() => {
    if (query.data?.values) setKitchenRuleParameters(query.data.values);
  }, [query.data]);
}

export function kitchenRulesToCsv(rules: readonly KitchenRuleRecord[]): string {
  const header = ["ruleCode", "category", "title", "enforcementKind", "implementationStatus", "enabledFlag", "sourceText", "parameters", "ruleDescription", "notesText", "updatedByName", "updatedAt"];
  const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const rule of rules) {
    lines.push([
      rule.ruleCode,
      rule.category,
      rule.title,
      rule.enforcementKind,
      rule.implementationStatus,
      rule.enabledFlag ? "yes" : "no",
      rule.sourceText,
      JSON.stringify(rule.parameters),
      rule.ruleDescription,
      rule.notesText ?? "",
      rule.updatedByName ?? "",
      rule.updatedAt ?? "",
    ].map(cell).join(","));
  }
  return lines.join("\n");
}

export function kitchenRulesToMarkdown(rules: readonly KitchenRuleRecord[]): string {
  const lines = ["# Kitchen Rules", "", `Exported ${new Date().toISOString()}`, ""];
  for (const rule of rules) {
    const params = Object.entries(rule.parameters).map(([key, value]) => `${key}=${value}`).join(", ") || "none";
    lines.push(`## ${rule.title}`);
    lines.push("");
    lines.push(`- Code: \`${rule.ruleCode}\``);
    lines.push(`- Category: ${rule.category}`);
    lines.push(`- Type: ${rule.enforcementKind}`);
    lines.push(`- Status: ${statusLabel(rule.implementationStatus)}`);
    lines.push(`- Enabled: ${rule.enabledFlag ? "yes" : "no"}`);
    lines.push(`- Source: ${rule.sourceText}`);
    lines.push(`- Parameters: ${params}`);
    lines.push(`- Last edited: ${rule.updatedByName ?? "not edited"} ${rule.updatedAt ?? ""}`.trim());
    lines.push("");
    lines.push(rule.ruleDescription);
    if (rule.notesText) {
      lines.push("");
      lines.push(`Notes: ${rule.notesText}`);
    }
    if (rule.implementationStatus === "reference" && !rule.readsParameters) {
      lines.push("");
      lines.push("Reference only until a developer implements it.");
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function statusLabel(status: KitchenRuleRecord["implementationStatus"]): string {
  if (status === "implemented") return "Implemented in code";
  if (status === "pending") return "Pending in another PR";
  return "Reference only";
}

export function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
