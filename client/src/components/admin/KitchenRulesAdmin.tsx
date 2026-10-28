import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { KITCHEN_RULE_SEED, type KitchenRuleSeed } from "@/lib/kitchenRulesCatalog";
import {
  downloadTextFile,
  kitchenRulesToCsv,
  kitchenRulesToMarkdown,
  statusLabel,
  useKitchenRuleMutations,
  useKitchenRulesList,
  type KitchenRuleRecord,
} from "@/lib/kitchenRulesApi";

function seedAsRecord(rule: KitchenRuleSeed, index: number): KitchenRuleRecord {
  return {
    id: -(index + 1),
    ruleCode: rule.ruleCode,
    category: rule.category,
    title: rule.title,
    ruleDescription: rule.ruleDescription,
    parameters: rule.parameters,
    enforcementKind: rule.enforcementKind,
    sourceText: rule.sourceText,
    implementationStatus: rule.implementationStatus,
    enabledFlag: true,
    notesText: rule.notesText,
    readsParameters: rule.readsParameters,
    updatedByName: null,
    createdAt: null,
    updatedAt: null,
  };
}

function parametersText(parameters: Record<string, number | string>): string {
  return Object.entries(parameters).map(([key, value]) => `${key}=${value}`).join("\n");
}

function parseParameters(text: string): Record<string, number | string> | null {
  const parameters: Record<string, number | string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const splitAt = trimmed.indexOf("=");
    if (splitAt <= 0) return null;
    const key = trimmed.slice(0, splitAt).trim();
    const raw = trimmed.slice(splitAt + 1).trim();
    if (!/^[a-z0-9_]+$/.test(key) || !raw) return null;
    const numeric = Number(raw);
    parameters[key] = Number.isFinite(numeric) && String(numeric) === raw ? numeric : raw;
  }
  return parameters;
}

export default function KitchenRulesAdmin() {
  const list = useKitchenRulesList();
  const mutations = useKitchenRuleMutations();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<KitchenRuleRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const usingSeed = list.isError || !list.data;
  const rules = useMemo(() => {
    if (list.data && list.data.length) return list.data;
    return KITCHEN_RULE_SEED.map(seedAsRecord);
  }, [list.data]);
  const categories = useMemo(() => Array.from(new Set(rules.map((rule) => rule.category))).sort(), [rules]);
  const visible = rules.filter((rule) => {
    if (category !== "all" && rule.category !== category) return false;
    const hay = `${rule.ruleCode} ${rule.title} ${rule.ruleDescription} ${rule.sourceText}`.toLowerCase();
    return hay.includes(search.trim().toLowerCase());
  });

  const exportName = "kitchen-rules";
  const printable = () => {
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) {
      toast.error("The browser blocked the print window.");
      return;
    }
    popup.document.write(`<pre style="font: 14px/1.4 sans-serif; white-space: pre-wrap">${kitchenRulesToMarkdown(rules).replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]!))}</pre>`);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  return (
    <div className="space-y-4" data-testid="kitchen-rules-admin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Kitchen Rules</h2>
          <p className="text-sm text-muted-foreground">Admin only. Saved numbers drive Designer placement. A new free-text rule stays reference-only until a developer implements it.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => downloadTextFile(`${exportName}.csv`, kitchenRulesToCsv(rules), "text/csv")}>Download CSV</Button>
          <Button type="button" variant="outline" onClick={() => downloadTextFile(`${exportName}.md`, kitchenRulesToMarkdown(rules), "text/markdown")}>Download Markdown</Button>
          <Button type="button" variant="outline" onClick={printable}>Print / PDF</Button>
          <Button type="button" onClick={() => setCreating(true)} disabled={usingSeed}>Add rule</Button>
        </div>
      </div>
      {list.isLoading && <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>}
      {usingSeed && !list.isLoading && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="kitchen-rules-seed-fallback">
          The kitchen rules table is not available yet, so this list is the built-in catalog. Run docs/sql/0233_kitchen_rules.tidb.sql in the TiDB editor, then reload. Edits stay off until that table exists.
          {list.error ? ` ${list.error.message}` : ""}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rules" aria-label="Search kitchen rules" className="max-w-xs" />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Parameters</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">Last edited</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((rule) => (
              <tr key={rule.ruleCode} className="border-t align-top">
                <td className="px-3 py-3">
                  <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setEditing(rule)} disabled={usingSeed || rule.id < 0}>
                    {rule.title}
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">{rule.ruleCode}{rule.enabledFlag ? "" : " · disabled"}</p>
                  <p className="mt-1 max-w-xl text-xs leading-relaxed">{rule.ruleDescription}</p>
                </td>
                <td className="px-3 py-3">{rule.category}</td>
                <td className="px-3 py-3"><Badge variant="outline">{rule.enforcementKind}</Badge></td>
                <td className="px-3 py-3">{statusLabel(rule.implementationStatus)}</td>
                <td className="px-3 py-3 font-mono text-xs">{parametersText(rule.parameters) || "—"}</td>
                <td className="px-3 py-3">{rule.sourceText}</td>
                <td className="px-3 py-3 text-xs">{rule.updatedByName ?? "—"}{rule.updatedAt ? ` · ${rule.updatedAt}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && <RuleEditor rule={editing} pending={mutations.update.isPending} onClose={() => setEditing(null)} onSave={async (input) => {
        try {
          await mutations.update.mutateAsync(input);
          toast.success("Kitchen rule saved");
          setEditing(null);
          await list.refetch();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "The rule was not saved");
        }
      }} />}
      {creating && <RuleCreator pending={mutations.create.isPending} onClose={() => setCreating(false)} onSave={async (input) => {
        try {
          await mutations.create.mutateAsync(input);
          toast.success("Reference rule added");
          setCreating(false);
          await list.refetch();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "The rule was not added");
        }
      }} />}
    </div>
  );
}

function RuleEditor({ rule, pending, onClose, onSave }: {
  rule: KitchenRuleRecord;
  pending: boolean;
  onClose: () => void;
  onSave: (input: { id: number; title: string; category: string; ruleDescription: string; parameters: Record<string, number | string>; enforcementKind: KitchenRuleRecord["enforcementKind"]; sourceText: string; enabledFlag: boolean; notesText: string | null }) => Promise<void>;
}) {
  const [title, setTitle] = useState(rule.title);
  const [category, setCategory] = useState(rule.category);
  const [description, setDescription] = useState(rule.ruleDescription);
  const [parameters, setParameters] = useState(parametersText(rule.parameters));
  const [kind, setKind] = useState(rule.enforcementKind);
  const [source, setSource] = useState(rule.sourceText);
  const [enabled, setEnabled] = useState(rule.enabledFlag);
  const [notes, setNotes] = useState(rule.notesText ?? "");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit {rule.ruleCode}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>Title<Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} /></Label>
          <Label>Category<Input className="mt-1" value={category} onChange={(event) => setCategory(event.target.value)} /></Label>
          <Label>Description<Textarea className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} /></Label>
          <Label>Parameters, one key=number per line<Textarea className="mt-1 font-mono" value={parameters} onChange={(event) => setParameters(event.target.value)} /></Label>
          <Label>Type
            <select className="mt-1 h-9 w-full rounded-md border bg-background px-2" value={kind} onChange={(event) => setKind(event.target.value as KitchenRuleRecord["enforcementKind"])}>
              <option value="auto">auto</option>
              <option value="suggest">suggest</option>
              <option value="review">review</option>
              <option value="reference">reference</option>
            </select>
          </Label>
          <Label>Source<Input className="mt-1" value={source} onChange={(event) => setSource(event.target.value)} /></Label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
          <Label>Notes<Textarea className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} /></Label>
          <p className="text-xs text-muted-foreground">Status: {statusLabel(rule.implementationStatus)}. {rule.readsParameters ? "Saving a number here changes Designer behavior." : "This rule is reference-only until a developer implements it."}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => {
            const parsed = parseParameters(parameters);
            if (!parsed) { toast.error("Parameters must look like jog_max_in=3"); return; }
            void onSave({ id: rule.id, title, category, ruleDescription: description, parameters: parsed, enforcementKind: kind, sourceText: source, enabledFlag: enabled, notesText: notes.trim() || null });
          }}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleCreator({ pending, onClose, onSave }: {
  pending: boolean;
  onClose: () => void;
  onSave: (input: { ruleCode: string; title: string; category: string; ruleDescription: string; parameters: Record<string, number | string>; enforcementKind: "reference"; sourceText: string; notesText: string | null; enabledFlag: boolean }) => Promise<void>;
}) {
  const [ruleCode, setRuleCode] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Admin");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("Admin");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add a reference rule</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">New rules are reference-only. They show on this page and in exports. They do not change the Designer until a developer implements them.</p>
          <Label>Code<Input className="mt-1" value={ruleCode} onChange={(event) => setRuleCode(event.target.value)} placeholder="owner-new-rule" /></Label>
          <Label>Title<Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} /></Label>
          <Label>Category<Input className="mt-1" value={category} onChange={(event) => setCategory(event.target.value)} /></Label>
          <Label>Description<Textarea className="mt-1" value={description} onChange={(event) => setDescription(event.target.value)} /></Label>
          <Label>Source<Input className="mt-1" value={source} onChange={(event) => setSource(event.target.value)} /></Label>
          <Label>Notes<Textarea className="mt-1" value={notes} onChange={(event) => setNotes(event.target.value)} /></Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={pending} onClick={() => void onSave({
            ruleCode: ruleCode.trim().toLowerCase(),
            title: title.trim(),
            category: category.trim(),
            ruleDescription: description.trim(),
            parameters: {},
            enforcementKind: "reference",
            sourceText: source.trim() || "Admin",
            notesText: notes.trim() || null,
            enabledFlag: true,
          })}>Add reference rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
