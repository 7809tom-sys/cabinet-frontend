import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { KITCHEN_RULE_SEED } from "@/lib/kitchenRulesCatalog";
import { RICH_QUESTIONS_CATEGORY } from "@/lib/kitchenRulesRichQuestions";
import {
  GUIDANCE_LABEL,
  customRuleSettingKey,
  kitchenRuleDiffers,
  kitchenRuleKindLabel,
  kitchenRuleLastChanged,
  kitchenRuleValueLabel,
  mergeKitchenRuleSettings,
  useKitchenRuleSettingMutations,
  useKitchenRuleSettings,
  visibleKitchenRuleSettings,
  type KitchenRuleSetting,
} from "@/lib/kitchenRuleSettingsApi";
import { KITCHEN_RULE_APPLIED_BY_LABEL, kitchenRuleDefinition } from "@/lib/kitchenRuleRegistry";
import {
  downloadTextFile,
  kitchenRulesToCsv,
  kitchenRulesToMarkdown,
  type KitchenRuleRecord,
} from "@/lib/kitchenRulesApi";
import { Lock, Pencil, Plus, RotateCcw, Undo2 } from "lucide-react";

const SETTING_PREFIX = "setting:";

/** The documented catalog, kept for the CSV/Markdown export and the Rich questions. */
function seedAsRecord(rule: (typeof KITCHEN_RULE_SEED)[number], index: number): KitchenRuleRecord {
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

/** The catalog rows, always from the built-in seed so exports work offline. */
const CATALOG: KitchenRuleRecord[] = KITCHEN_RULE_SEED.map(seedAsRecord);

/**
 * "Questions for Rich" are open questions, not settings. They stay a read-only
 * reference list: answering one is a note, and it never changes a plan.
 */
const RICH_QUESTION_ROWS = CATALOG.filter((rule) => rule.category === RICH_QUESTIONS_CATEGORY);

export default function KitchenRulesAdmin() {
  const query = useKitchenRuleSettings();
  const mutations = useKitchenRuleSettingMutations();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showDeleted, setShowDeleted] = useState(false);
  const [editing, setEditing] = useState<KitchenRuleSetting | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<KitchenRuleSetting | null>(null);
  const [richOpen, setRichOpen] = useState(false);

  const tableUnavailable = query.isError;
  const rows = useMemo(() => mergeKitchenRuleSettings(query.data), [query.data]);
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visibleKitchenRuleSettings(rows, showDeleted)
      .filter((row) => category === "all" || row.category === category)
      .filter((row) => {
        if (!needle) return true;
        return `${row.settingKey} ${row.title} ${row.description} ${row.category}`.toLowerCase().includes(needle);
      })
      .sort((left, right) => left.category.localeCompare(right.category) || left.title.localeCompare(right.title));
  }, [rows, category, search, showDeleted]);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category))).sort(),
    [rows],
  );
  const activeRows = useMemo(() => visibleKitchenRuleSettings(rows), [rows]);
  const changedCount = activeRows.filter(kitchenRuleDiffers).length;
  const deletedCount = rows.filter((row) => row.deletedAt != null).length;

  async function afterChange(message: string) {
    toast.success(message);
    await query.refetch();
  }

  return (
    <div className="space-y-4" data-testid="kitchen-rules-admin">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold">Kitchen Rules</h2>
          <p className="text-sm text-muted-foreground">
            Admin only. Every value the auto-designer reads is here, one row per rule with its own value.
            Saving a value changes the Designer; leaving it alone keeps the code default.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => downloadTextFile("kitchen-rules.csv", kitchenRulesToCsv(CATALOG), "text/csv")}>
            Download CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => downloadTextFile("kitchen-rules.md", kitchenRulesToMarkdown(CATALOG), "text/markdown")}>
            Download Markdown
          </Button>
          <Button type="button" onClick={() => setCreating(true)} disabled={tableUnavailable} data-testid="kitchen-rules-add">
            <Plus className="mr-1 h-4 w-4" /> Add rule
          </Button>
        </div>
      </div>

      {query.isLoading && <div className="flex justify-center py-8"><Spinner className="h-6 w-6" /></div>}

      {tableUnavailable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="kitchen-rules-table-missing">
          The kitchen rule settings table is not on the database yet, so this list shows the code defaults and nothing can be
          saved. Run <span className="font-mono">docs/sql/0250_kitchen_rule_settings.tidb.sql</span> in the TiDB editor, then
          reload. The Designer is unaffected: it keeps using the code defaults.
          {query.error ? ` ${query.error.message}` : ""}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile label="Rules" value={String(activeRows.length)} note={`${activeRows.filter((row) => row.locked).length} locked`} />
        <SummaryTile label="Changed from default" value={String(changedCount)} note="Saved by an admin" />
        <SummaryTile label="Deleted" value={String(deletedCount)} note="Restorable" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search rules"
          aria-label="Search kitchen rules"
          className="max-w-xs"
        />
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)} />
          Show deleted
        </label>
        <Button
          type="button"
          variant={richOpen ? "default" : "outline"}
          onClick={() => setRichOpen((open) => !open)}
          data-testid="kitchen-rules-rich-filter"
        >
          Questions for Rich ({RICH_QUESTION_ROWS.length})
        </Button>
      </div>

      {richOpen && (
        <div className="space-y-2 rounded-lg border p-3" data-testid="kitchen-rules-rich-help">
          <p className="text-sm text-muted-foreground">
            Rich: these are open questions, not designer settings. Each one records what NKBA says, what Auto-Design does
            today, and the answer. They are reference-only and never change the Designer.
          </p>
          {RICH_QUESTION_ROWS.map((rule) => (
            <div key={rule.ruleCode} className="rounded-md border px-3 py-2">
              <p className="text-sm font-medium">{rule.title}</p>
              <p className="mt-1 text-xs leading-relaxed">{rule.ruleDescription}</p>
              {rule.notesText && <p className="mt-1 text-xs text-muted-foreground">{rule.notesText}</p>}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[70rem] text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rule</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Value</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2">Kind</th>
              <th className="px-3 py-2">Last changed</th>
              <th className="px-3 py-2 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              // The setting key is unique and is the identity of the row, so two
              // rules can never share a React key or a stored value.
              <tr key={row.settingKey} className="border-t align-top" data-testid={`${SETTING_PREFIX}${row.settingKey}`}>
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    {row.locked && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Locked rule" />}
                    <div>
                      <p className="font-medium">
                        {row.title}
                        {row.deletedAt != null && <span className="ml-2 text-xs font-normal text-destructive">deleted</span>}
                        {row.enabled === false && row.deletedAt == null && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">off</span>
                        )}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{row.settingKey}</p>
                      <p className="mt-1 max-w-xl text-xs leading-relaxed">{row.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3">{row.category}</td>
                <td className="px-3 py-3 font-mono text-xs" data-testid={`${SETTING_PREFIX}${row.settingKey}-value`}>
                  {kitchenRuleValueLabel(row)}
                  {kitchenRuleDiffers(row) && <Badge variant="secondary" className="ml-2 text-[10px]">changed</Badge>}
                  {row.enabled === false && row.deletedAt == null && (
                    <div className="mt-1 text-[11px] text-muted-foreground">Off — the Designer uses the default.</div>
                  )}
                </td>
                <td className="px-3 py-3 font-mono text-xs text-muted-foreground">{row.valueType === "toggle" ? (row.defaultValue === "0" ? "Off" : "On") : row.defaultValue}</td>
                <td className="px-3 py-3 text-xs">{kitchenRuleKindLabel(row)}</td>
                <td className="px-3 py-3 text-xs">{kitchenRuleLastChanged(row)}</td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {row.deletedAt != null ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void onRestore(row)}
                        data-testid={`${SETTING_PREFIX}${row.settingKey}-restore`}
                      >
                        <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo delete
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${row.title}`}
                        title={`Edit ${row.title}`}
                        onClick={() => setEditing(row)}
                        data-testid={`${SETTING_PREFIX}${row.settingKey}-edit`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && !query.isLoading && (
        <p className="text-sm text-muted-foreground">No rule matches that search.</p>
      )}

      {editing && (
        <RuleEditor
          key={editing.settingKey}
          rule={editing}
          pending={mutations.save.isPending || mutations.reset.isPending}
          onClose={() => setEditing(null)}
          onAskDelete={() => setDeleting(editing)}
          onSave={async (input) => {
            try {
              await mutations.save.mutateAsync(input);
              setEditing(null);
              await afterChange("Kitchen rule saved");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The rule was not saved");
            }
          }}
          onReset={async () => {
            try {
              await mutations.reset.mutateAsync({ settingKey: editing.settingKey });
              setEditing(null);
              await afterChange("Rule reset to its default");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The rule was not reset");
            }
          }}
        />
      )}

      {creating && (
        <RuleCreator
          takenKeys={rows.map((row) => row.settingKey)}
          pending={mutations.create.isPending}
          onClose={() => setCreating(false)}
          onSave={async (input) => {
            try {
              await mutations.create.mutateAsync(input);
              setCreating(false);
              await afterChange("Rule added");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "The rule was not added");
            }
          }}
        />
      )}

      <AlertDialog open={deleting != null} onOpenChange={(open) => { if (!open) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `"${deleting.title}" stops applying in the auto-designer immediately, and the Designer goes back to the code default. You can undo the delete from "Show deleted".`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deleting;
                setDeleting(null);
                if (target) void onDelete(target);
              }}
            >
              Delete rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  async function onDelete(row: KitchenRuleSetting) {
    try {
      await mutations.remove.mutateAsync({ settingKey: row.settingKey });
      setEditing(null);
      await afterChange("Rule deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rule was not deleted");
    }
  }

  async function onRestore(row: KitchenRuleSetting) {
    try {
      await mutations.restore.mutateAsync({ settingKey: row.settingKey });
      await afterChange("Rule restored");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The rule was not restored");
    }
  }
}

function SummaryTile({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

type SaveInput = {
  settingKey: string;
  title: string;
  description: string;
  category: string;
  valueType: KitchenRuleSetting["valueType"];
  value: string | null;
  enabled: boolean;
};

function RuleEditor({
  rule,
  pending,
  onClose,
  onSave,
  onReset,
  onAskDelete,
}: {
  rule: KitchenRuleSetting;
  pending: boolean;
  onClose: () => void;
  onSave: (input: SaveInput) => Promise<void>;
  onReset: () => Promise<void>;
  onAskDelete: () => void;
}) {
  // Every field is created from THIS rule at mount and the dialog is keyed by
  // settingKey, so opening a second rule can never inherit the first one's text.
  const [title, setTitle] = useState(rule.title);
  const [description, setDescription] = useState(rule.description);
  const [category, setCategory] = useState(rule.category);
  const [value, setValue] = useState(rule.value ?? rule.defaultValue);
  const [enabled, setEnabled] = useState(rule.enabled);
  const definition = kitchenRuleDefinition(rule.settingKey);
  const locked = rule.locked;
  const numeric = rule.valueType === "number";
  const toggle = rule.valueType === "toggle";
  const choice = rule.valueType === "choice";

  const numericInvalid = numeric && value.trim() !== "" && !Number.isFinite(Number(value));
  const outOfRange = numeric && Number.isFinite(Number(value)) && (
    (definition?.min != null && Number(value) < definition.min)
    || (definition?.max != null && Number(value) > definition.max)
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {locked && <Lock className="h-4 w-4" aria-label="Locked rule" />}
            Edit {rule.title}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{rule.settingKey}</span>
            {definition ? ` · ${KITCHEN_RULE_APPLIED_BY_LABEL[definition.appliedBy] ?? definition.appliedBy}` : ` · ${GUIDANCE_LABEL}`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {locked && (
            <p className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-950" data-testid="kitchen-rule-locked-note">
              This is one of Tom's mandatory rules. It cannot be switched off or deleted, and the Designer always applies it.
              Its value is shown for reference only.
            </p>
          )}

          <Label>
            Name
            <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} data-testid="kitchen-rule-title" />
          </Label>

          <Label>
            Category
            <Input className="mt-1" value={category} onChange={(event) => setCategory(event.target.value)} />
          </Label>

          <Label>
            What this rule says
            <Textarea
              className="mt-1"
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              data-testid="kitchen-rule-description"
            />
          </Label>

          {toggle ? (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">On</p>
                <p className="text-xs text-muted-foreground">Off means the Designer ignores this rule and uses the default.</p>
              </div>
              <Switch
                checked={value !== "0" && value !== ""}
                onCheckedChange={(next) => setValue(next ? "1" : "0")}
                disabled={locked}
                aria-label="Rule is on"
                data-testid="kitchen-rule-toggle"
              />
            </div>
          ) : choice ? (
            <Label>
              Value
              <select
                className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                data-testid="kitchen-rule-choice"
              >
                {(definition?.options ?? [value]).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Label>
          ) : numeric ? (
            <Label>
              Value
              <div className="mt-1 flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step={definition?.step ?? "any"}
                  min={definition?.min}
                  max={definition?.max}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  data-testid="kitchen-rule-value"
                  className={numericInvalid || outOfRange ? "border-destructive" : ""}
                />
                {definition?.unit && <span className="text-sm text-muted-foreground">{definition.unit}</span>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Default {rule.defaultValue}
                {definition?.unit ? ` ${definition.unit}` : ""}
                {definition?.min != null && definition?.max != null ? ` · allowed ${definition.min} to ${definition.max}` : ""}
              </p>
              {numericInvalid && <p className="mt-1 text-xs text-destructive">Enter a number.</p>}
              {outOfRange && <p className="mt-1 text-xs text-destructive">That is outside the range this rule allows.</p>}
            </Label>
          ) : (
            <Label>
              Value
              <Textarea
                className="mt-1 font-mono text-xs"
                rows={3}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                data-testid="kitchen-rule-text"
              />
            </Label>
          )}

          {!locked && (
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Rule active</p>
                <p className="text-xs text-muted-foreground">Off stops the rule applying and returns it to the code default.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Rule is active" data-testid="kitchen-rule-enabled" />
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Last changed: {kitchenRuleLastChanged(rule)}
            {rule.isBuiltIn ? " · built-in rule" : " · added by an admin"}
          </p>
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void onReset()} disabled={pending} data-testid="kitchen-rule-reset">
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset to default
            </Button>
            {locked ? (
              <Button type="button" variant="outline" disabled title="Locked rules cannot be deleted" data-testid="kitchen-rule-delete-locked">
                <Lock className="mr-1 h-3.5 w-3.5" /> Locked
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                onClick={onAskDelete}
                disabled={pending}
                data-testid="kitchen-rule-delete"
              >
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              type="button"
              disabled={pending || numericInvalid || outOfRange || !title.trim()}
              onClick={() => void onSave({
                settingKey: rule.settingKey,
                title: title.trim(),
                description: description.trim() || title.trim(),
                category: category.trim() || rule.category,
                valueType: rule.valueType,
                value: value.trim() === "" ? null : value.trim(),
                enabled: locked ? true : enabled,
              })}
              data-testid="kitchen-rule-save"
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleCreator({
  takenKeys,
  pending,
  onClose,
  onSave,
}: {
  takenKeys: readonly string[];
  pending: boolean;
  onClose: () => void;
  onSave: (input: SaveInput) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Guidance");
  const [description, setDescription] = useState("");
  const [value, setValue] = useState("");
  const settingKey = customRuleSettingKey(title, takenKeys);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a rule</DialogTitle>
          <DialogDescription>
            A new rule is guidance: it shows on the plan review list and in the AI prompt, and moves no cabinet.
            A developer maps it to the auto-designer if it should place cabinets on its own.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label>
            Name
            <Input
              className="mt-1"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Leave 2 inches of filler at a window"
              data-testid="kitchen-rule-new-title"
            />
          </Label>
          <Label>
            Category
            <Input className="mt-1" value={category} onChange={(event) => setCategory(event.target.value)} data-testid="kitchen-rule-new-category" />
          </Label>
          <Label>
            What the rule says
            <Textarea
              className="mt-1"
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Write it the way a person on site would read it."
              data-testid="kitchen-rule-new-description"
            />
          </Label>
          <Label>
            Optional number
            <Input
              className="mt-1"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Leave blank when the rule has no number"
              data-testid="kitchen-rule-new-value"
            />
          </Label>
          <p className="text-xs text-muted-foreground">
            Stored as <span className="font-mono">{settingKey}</span> · {GUIDANCE_LABEL}
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            type="button"
            disabled={pending || !title.trim()}
            onClick={() => void onSave({
              settingKey,
              title: title.trim(),
              description: description.trim() || title.trim(),
              category: category.trim() || "Guidance",
              valueType: value.trim() ? "number" : "text",
              value: value.trim() === "" ? null : value.trim(),
              enabled: true,
            })}
            data-testid="kitchen-rule-create"
          >
            Add rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
