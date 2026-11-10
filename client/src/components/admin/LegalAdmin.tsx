import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { useDistributorLegalTerms, useSaveDistributorLegalTerm } from "@/lib/distributorLegalTermsApi";
import {
  CABINET_DEALS_DISTRIBUTOR_KEY,
  CABINET_DEALS_RETURN_SECTION,
  DISTRIBUTOR_LEGAL_SEEDS,
  LEGAL_REPO_REFERENCES,
  LEGAL_SECTION_KEYS,
  LEGAL_SECTION_LABEL,
  PASTE_DISTRIBUTOR_TERMS,
  distributorTextContainsCabinetDealsFee,
  resolveCabinetDealsReturnRules,
  resolveDistributorSection,
  splitCabinetDealsReturnRules,
  type DistributorLegalSeed,
  type LegalSectionKey,
  type ResolvedLegalSection,
} from "@/lib/distributorLegalTerms";

function draftKey(distributorKey: string, sectionKey: string): string {
  return `${distributorKey}:${sectionKey}`;
}

function formatUpdated(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function AuditLine({ section, testId }: { section: ResolvedLegalSection; testId: string }) {
  const when = formatUpdated(section.updatedAt);
  return (
    <p className="text-xs text-muted-foreground" data-testid={testId}>
      {section.edited && section.updatedByName
        ? `Last updated ${when ?? "unknown time"} by ${section.updatedByName}`
        : "No admin edit yet. Showing the captured text."}
    </p>
  );
}

function CabinetDealsRulesBlock({ text, testId }: { text: string; testId: string }) {
  const split = splitCabinetDealsReturnRules(text);
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950" data-testid={testId}>
      <p className="font-semibold">Additional Cabinet Deals return rules</p>
      <p className="mt-1 text-xs">
        These rules are Cabinet Deals' own. They are added on top of the distributor's return wording and are not part of it.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5">
        {split.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <p className="mt-3 border-t border-amber-300 pt-3" data-testid={`${testId}-fee`}>
        <span className="font-semibold">Restocking fee. </span>
        {split.restockingFee ?? "The saved Cabinet Deals rules do not include the thirty percent (30%) line."}
      </p>
    </div>
  );
}

export default function LegalAdmin() {
  const query = useDistributorLegalTerms();
  const save = useSaveDistributorLegalTerm();
  const [activeKey, setActiveKey] = useState(DISTRIBUTOR_LEGAL_SEEDS[0]?.key ?? "us-cabinet-depot");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const rows = query.data;
  const storageUnavailable = query.isError;
  const active = DISTRIBUTOR_LEGAL_SEEDS.find((seed) => seed.key === activeKey) ?? DISTRIBUTOR_LEGAL_SEEDS[0];
  const shared = resolveCabinetDealsReturnRules(rows);
  const sharedDraft = drafts[draftKey(CABINET_DEALS_DISTRIBUTOR_KEY, CABINET_DEALS_RETURN_SECTION)] ?? shared.text;

  function textFor(seed: DistributorLegalSeed, section: LegalSectionKey): string {
    const key = draftKey(seed.key, section);
    if (key in drafts) return drafts[key] ?? "";
    return resolveDistributorSection(seed, section, rows).text;
  }

  function setDraft(distributorKey: string, sectionKey: string, value: string) {
    setDrafts((current) => ({ ...current, [draftKey(distributorKey, sectionKey)]: value }));
  }

  async function persist(input: {
    distributorKey: string;
    sectionKey: string;
    bodyText: string | null;
    sourceUrl: string | null;
    capturedOn: string | null;
    label: string;
  }) {
    const key = draftKey(input.distributorKey, input.sectionKey);
    setSavingKey(key);
    try {
      await save.mutateAsync({
        distributorKey: input.distributorKey,
        sectionKey: input.sectionKey,
        bodyText: input.bodyText,
        sourceUrl: input.sourceUrl,
        capturedOn: input.capturedOn,
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      await query.refetch();
      toast.success(`${input.label} saved`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      toast.error(message);
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6" data-testid="legal-admin">
      <div>
        <h2 className="font-serif text-2xl font-bold">Legal</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Each distributor's shipping terms, return terms, and warranty are shown in that distributor's own words, with the page they came from and the day they were captured. Cabinet Deals' return rules, including the restocking fee, stay in their own block under the distributor's return terms.
        </p>
      </div>

      {query.isLoading && (
        <div className="flex justify-center py-8">
          <Spinner className="h-6 w-6" />
        </div>
      )}

      {storageUnavailable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="legal-storage-missing">
          Saved edits cannot be stored yet. The captured wording is still shown below. Run <span className="font-mono">docs/sql/0274_distributor_legal_terms.tidb.sql</span> in the TiDB editor and apply the distributor legal terms backend patch, then reload.
          {query.error ? ` ${query.error.message}` : ""}
        </p>
      )}

      <section className="space-y-3 rounded-lg border p-4" data-testid="legal-cabinet-deals-editor">
        <div>
          <h3 className="font-semibold">Cabinet Deals return rules</h3>
          <p className="text-sm text-muted-foreground">
            Shared by every distributor on this tab. The restocking fee stays on its own line. Saving here does not change a distributor's text.
          </p>
        </div>
        <Textarea
          value={sharedDraft}
          aria-label="Cabinet Deals return rules"
          onChange={(event) => setDraft(CABINET_DEALS_DISTRIBUTOR_KEY, CABINET_DEALS_RETURN_SECTION, event.target.value)}
          rows={4}
          data-testid="legal-cabinet-deals-text"
        />
        <AuditLine section={shared} testId="legal-cabinet-deals-audit" />
        <Button
          type="button"
          disabled={storageUnavailable || savingKey != null || sharedDraft === shared.text}
          onClick={() => persist({
            distributorKey: CABINET_DEALS_DISTRIBUTOR_KEY,
            sectionKey: CABINET_DEALS_RETURN_SECTION,
            bodyText: sharedDraft,
            sourceUrl: null,
            capturedOn: null,
            label: "Cabinet Deals return rules",
          })}
          data-testid="legal-cabinet-deals-save"
        >
          Save Cabinet Deals return rules
        </Button>
      </section>

      <div className="flex flex-wrap gap-2" data-testid="legal-distributor-switch">
        {DISTRIBUTOR_LEGAL_SEEDS.map((seed) => (
          <Button
            key={seed.key}
            type="button"
            size="sm"
            variant={seed.key === active?.key ? "default" : "outline"}
            onClick={() => setActiveKey(seed.key)}
            aria-pressed={seed.key === active?.key}
            data-testid={`legal-distributor-${seed.key}`}
          >
            {seed.name}
            {seed.legalName ? ` (${seed.legalName})` : ""}
          </Button>
        ))}
      </div>

      {active && (
        <div className="space-y-6" data-testid="legal-active-distributor">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-bold">
              {active.name}
              {active.legalName ? ` (${active.legalName})` : ""}
            </h3>
            {active.warrantyBadge && (
              <Badge data-testid={`legal-badge-${active.key}`}>{active.warrantyBadge}</Badge>
            )}
          </div>
          {active.warrantyBadgeDetail && (
            <p className="text-sm text-muted-foreground" data-testid={`legal-badge-detail-${active.key}`}>
              {active.warrantyBadgeDetail}
            </p>
          )}
          {active.combinedPageNote && (
            <p className="text-sm text-muted-foreground" data-testid={`legal-combined-note-${active.key}`}>
              {active.combinedPageNote}
            </p>
          )}

          {LEGAL_SECTION_KEYS.map((section) => {
            const resolved = resolveDistributorSection(active, section, rows);
            const value = textFor(active, section);
            const captures = active.sections[section];
            const key = draftKey(active.key, section);
            const feeInDistributor = section === "returns" && distributorTextContainsCabinetDealsFee(value);
            return (
              <section key={section} className="space-y-3 rounded-lg border p-4" data-testid={`legal-section-${active.key}-${section}`}>
                <h4 className="font-semibold">{LEGAL_SECTION_LABEL[section]}</h4>
                {captures.length === 0 ? (
                  <p className="text-sm text-muted-foreground" data-testid={`legal-empty-${active.key}-${section}`}>
                    No distributor wording is on file for this section.
                  </p>
                ) : (
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {captures.map((item) => (
                      <li key={item.sourceUrl}>
                        Captured {item.capturedOn} from{" "}
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          {item.sourceUrl}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <Textarea
                  value={value}
                  aria-label={`${active.name} ${LEGAL_SECTION_LABEL[section]}`}
                  placeholder={PASTE_DISTRIBUTOR_TERMS}
                  onChange={(event) => setDraft(active.key, section, event.target.value)}
                  rows={section === "warranty" ? 14 : 12}
                  className="font-mono text-xs leading-relaxed"
                  data-testid={`legal-text-${active.key}-${section}`}
                />
                <AuditLine section={resolved} testId={`legal-audit-${active.key}-${section}`} />
                {feeInDistributor && (
                  <p className="text-sm text-destructive" data-testid={`legal-fee-warning-${active.key}`}>
                    This box contains the Cabinet Deals phrase "thirty percent (30%)". That fee belongs in the Cabinet Deals block below, not in the distributor's wording.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={storageUnavailable || savingKey != null || value === resolved.text}
                    onClick={() => persist({
                      distributorKey: active.key,
                      sectionKey: section,
                      bodyText: value,
                      sourceUrl: captures.map((item) => item.sourceUrl).join(" | ") || null,
                      capturedOn: captures[0]?.capturedOn ?? null,
                      label: `${active.name} ${LEGAL_SECTION_LABEL[section]}`,
                    })}
                    data-testid={`legal-save-${active.key}-${section}`}
                  >
                    {savingKey === key ? "Saving…" : "Save"}
                  </Button>
                  {resolved.edited && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={storageUnavailable || savingKey != null}
                      onClick={() => persist({
                        distributorKey: active.key,
                        sectionKey: section,
                        bodyText: null,
                        sourceUrl: captures.map((item) => item.sourceUrl).join(" | ") || null,
                        capturedOn: captures[0]?.capturedOn ?? null,
                        label: `${active.name} ${LEGAL_SECTION_LABEL[section]}`,
                      })}
                      data-testid={`legal-restore-${active.key}-${section}`}
                    >
                      Restore captured text
                    </Button>
                  )}
                </div>
                {section === "returns" && (
                  <CabinetDealsRulesBlock text={sharedDraft} testId={`legal-cabinet-deals-${active.key}`} />
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className="space-y-2 rounded-lg border p-4" data-testid="legal-repo-references">
        <h3 className="font-semibold">Terms already in this repo</h3>
        <p className="text-sm text-muted-foreground">
          These files were checked. They are not copied into the distributor boxes, because they are Cabinet Deals pages or product notes rather than the distributor's own page.
        </p>
        <ul className="space-y-2 text-sm">
          {LEGAL_REPO_REFERENCES.map((item) => (
            <li key={item.path}>
              <span className="font-mono text-xs">{item.path}</span>
              {item.route ? (
                <>
                  {" "}
                  <a href={item.route} className="text-primary underline">{item.route}</a>
                </>
              ) : null}
              <span className="block text-muted-foreground">{item.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
