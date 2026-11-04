/**
 * AI door-description comparison — door editor only.
 *
 * Three columns, one per model. Each column is a tailored prompt the operator
 * copies, a paste-back field for that model's answer, and a mini door preview
 * drawn from that answer. The previews update as text is pasted, and one can be
 * chosen official; the other two are kept as reference.
 *
 * Nothing runs automatically. There are no AI calls: this is a paste-back
 * workflow, and the prompts are copied by the operator into whichever model they
 * use. The component only parses text the operator pasted.
 */
import { useMemo, useState } from "react";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AI_DOOR_MODELS,
  AI_DOOR_MODEL_LABELS,
  AI_DOOR_PROMPTS,
  chooseOfficialAiDescription,
  parseAiDoorComparison,
  type AiDoorModel,
  type AiDoorOfficialRecord,
} from "@shared/aiDoorDescription";
import {
  readAiDoorComparison,
  saveAiDoorComparison,
  chooseOfficialAiDoorDescription,
  type StoredAiDoorComparison,
} from "@shared/aiDoorDescriptionStore";
import { aiDoorPreviewEntryLabel, aiDoorPreviewGeometry, previewFaceHex } from "@/lib/aiDoorPreview";

export type AiDoorCompareStyle = {
  id: number;
  doorStyle?: string | null;
  color?: string | null;
  renderHex?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  panelConstruction?: "raised" | "flat" | "slab" | "glass" | null;
};

export type AiDoorDescriptionCompareProps = {
  style: AiDoorCompareStyle;
  /** Door photo the operator is describing. Only used for the reference strip. */
  sampleUrl?: string | null;
  /**
   * Called when the operator chooses an official description. The door editor
   * saves the winner through its existing profile storage.
   */
  onChooseOfficial?: (record: AiDoorOfficialRecord) => void;
};

type CopyState = Partial<Record<AiDoorModel, "idle" | "copied" | "failed">>;

function DoorPreview({ params, colorSeed }: {
  params: ReturnType<typeof parseAiDoorComparison>[AiDoorModel]["params"];
  colorSeed: AiDoorCompareStyle;
}) {
  const geometry = aiDoorPreviewGeometry(params);
  const face = previewFaceHex(colorSeed);
  const edge = `color-mix(in srgb, ${face} 78%, black)` as string;
  const panel = `color-mix(in srgb, ${face} 92%, black)` as string;
  return (
    <svg
      viewBox="0 0 100 200"
      role="img"
      aria-label="Door preview from this description"
      className="h-40 w-full rounded-md border bg-muted/20"
      data-testid="ai-door-preview-svg"
      data-entry={params.entryId ?? "none"}
      data-family={params.family}
      data-raised={geometry.raisedCenter ? "true" : "false"}
      data-grain={geometry.grain ? "true" : "false"}
    >
      <rect x="1" y="1" width="98" height="198" rx="2" fill={face} stroke={edge} strokeWidth="1" />
      {geometry.grain && (
        <g opacity="0.16">
          {[0.16, 0.31, 0.46, 0.6, 0.74, 0.88].map((x, index) => (
            <line
              key={x}
              x1={100 * x}
              y1={3}
              x2={100 * x + (index % 2 === 0 ? 1.2 : -1.2)}
              y2={197}
              stroke={edge}
              strokeWidth="0.7"
            />
          ))}
        </g>
      )}
      {!geometry.slab && (
        <rect
          x={geometry.opening.x}
          y={geometry.opening.y}
          width={geometry.opening.width}
          height={geometry.opening.height}
          rx="1.5"
          fill={panel}
          stroke={edge}
          strokeWidth="1.2"
        />
      )}
      {geometry.raisedCenter && (
        <>
          <rect
            x={geometry.raisedCenter.x}
            y={geometry.raisedCenter.y}
            width={geometry.raisedCenter.width}
            height={geometry.raisedCenter.height}
            rx="1.5"
            fill={face}
            stroke={edge}
            strokeWidth="1"
          />
          <rect
            x={geometry.raisedCenter.x + 1.5}
            y={geometry.raisedCenter.y + 1.5}
            width={Math.max(1, geometry.raisedCenter.width - 3)}
            height={Math.max(1, geometry.raisedCenter.height - 3)}
            rx="1"
            fill="none"
            stroke={edge}
            strokeWidth="0.5"
            opacity="0.5"
          />
        </>
      )}
    </svg>
  );
}

/**
 * The comparison panel.
 *
 * Mounting this component is the "request" — no parsing, no preview work, and no
 * storage read happens before the operator opens the tool and pastes text.
 */
export function AiDoorDescriptionCompare({ style, sampleUrl, onChooseOfficial }: AiDoorDescriptionCompareProps) {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<StoredAiDoorComparison>({ fields: {}, chosen: null, reference: {} });
  const [fields, setFields] = useState<Partial<Record<AiDoorModel, string>>>({});
  const [copyState, setCopyState] = useState<CopyState>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(
    () => (open ? parseAiDoorComparison(fields) : null),
    [open, fields],
  );

  function startComparison() {
    const loaded = readAiDoorComparison(style.id);
    setStored(loaded);
    setFields(loaded.fields);
    setSavedNote(null);
    setOpen(true);
  }

  async function copyPrompt(model: AiDoorModel) {
    const prompt = AI_DOOR_PROMPTS[model];
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      }
      setCopyState((current) => ({ ...current, [model]: "copied" }));
    } catch {
      setCopyState((current) => ({ ...current, [model]: "failed" }));
    }
  }

  function updateField(model: AiDoorModel, value: string) {
    // Text goes into local state only. Editing a field never re-chooses an
    // official description and never writes to storage on its own.
    setFields((current) => ({ ...current, [model]: value }));
  }

  function saveComparison() {
    const next = saveAiDoorComparison(style.id, { ...stored, fields });
    setStored(next);
    setSavedNote("Descriptions saved for this door style.");
  }

  function choose(model: AiDoorModel) {
    if (!parsed) return;
    const record = chooseOfficialAiDescription(parsed, model);
    if (!record) return;
    setBusy(true);
    try {
      const next = chooseOfficialAiDoorDescription(style.id, { ...stored, fields }, model);
      setStored(next);
      onChooseOfficial?.(record);
      setSavedNote(`${AI_DOOR_MODEL_LABELS[model]}'s description is now this door's official profile. The other two are kept as reference.`);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-3" data-testid="ai-door-compare-closed">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-semibold text-slate-800">AI door-description comparison</span>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Compare GPT, Claude, and Gemini descriptions of this door, preview each one, and keep the best as the official profile.
              Nothing runs until you start it.
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={startComparison} data-testid="ai-door-compare-start">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Compare descriptions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white px-3 py-3" data-testid="ai-door-compare">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold text-slate-800">AI door-description comparison</span>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Copy each prompt into that model, then paste its description back. The preview under each field draws what that
            description actually says; anything it does not state stays at the library default and is listed.
          </p>
        </div>
        {sampleUrl && (
          <img
            src={sampleUrl}
            alt="Door photo being described"
            className="h-16 w-16 rounded border object-cover"
            data-testid="ai-door-compare-sample"
          />
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {AI_DOOR_MODELS.map((model) => {
          const result = parsed?.[model];
          const isChosen = stored.chosen === model;
          return (
            <div
              key={model}
              className={`space-y-2 rounded-md border p-2.5 ${isChosen ? "border-emerald-400 bg-emerald-50/40" : "border-slate-200"}`}
              data-testid={`ai-door-model-${model}`}
            >
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor={`ai-door-${model}`} className="text-xs font-semibold">
                  {AI_DOOR_MODEL_LABELS[model]}
                </Label>
                {isChosen && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700" data-testid={`ai-door-chosen-${model}`}>
                    Official
                  </span>
                )}
              </div>

              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 text-xs"
                  onClick={() => void copyPrompt(model)}
                  data-testid={`ai-door-copy-${model}`}
                >
                  {copyState[model] === "copied" ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
                  {copyState[model] === "copied" ? "Copied" : copyState[model] === "failed" ? "Select manually" : "Copy prompt"}
                </Button>
              </div>
              {copyState[model] === "failed" && (
                <textarea
                  readOnly
                  value={AI_DOOR_PROMPTS[model]}
                  rows={3}
                  className="w-full rounded border bg-muted/30 px-2 py-1 text-[10px]"
                  data-testid={`ai-door-prompt-fallback-${model}`}
                />
              )}

              <textarea
                id={`ai-door-${model}`}
                value={fields[model] ?? ""}
                onChange={(event) => updateField(model, event.target.value)}
                rows={7}
                placeholder={`Paste ${AI_DOOR_MODEL_LABELS[model]}'s description of the door here`}
                className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                data-testid={`ai-door-field-${model}`}
              />

              <DoorPreview params={result?.params ?? { entryId: null, family: "unknown", railIn: null, stileIn: null, bevelWidthIn: null, bevelDepthIn: null, panelConstruction: null, insideEdgeProfile: null, cornerJoint: null, molding: null, painted: null, grainDirection: null, sheen: null, undertone: null, colorText: null }} colorSeed={style} />

              <p className="text-[10px] text-muted-foreground" data-testid={`ai-door-entry-${model}`}>
                {aiDoorPreviewEntryLabel(result?.params ?? { entryId: null, family: "unknown" } as never)}
              </p>

              {result && result.description && (
                <div className="space-y-1" data-testid={`ai-door-unstated-${model}`}>
                  {result.unstated.length > 0 ? (
                    <p className="text-[10px] text-amber-800">
                      Left at the library default: {result.unstated.join(", ")}
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-800">Every compared parameter was stated in this description.</p>
                  )}
                  {result.params.colorText && (
                    <p className="text-[10px] text-muted-foreground">Color, as described: {result.params.colorText}</p>
                  )}
                </div>
              )}

              <Button
                type="button"
                size="sm"
                className="h-7 w-full text-xs"
                variant={isChosen ? "secondary" : "outline"}
                disabled={busy || !result?.description}
                onClick={() => choose(model)}
                data-testid={`ai-door-choose-${model}`}
              >
                {isChosen ? "Official profile" : "Choose as official"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={saveComparison} data-testid="ai-door-save-comparison">
          Save descriptions
        </Button>
        {Object.entries(stored.reference).length > 0 && (
          <span className="text-[10px] text-muted-foreground" data-testid="ai-door-reference-note">
            Kept as reference: {Object.keys(stored.reference).map((model) => AI_DOOR_MODEL_LABELS[model as AiDoorModel]).join(", ")}
          </span>
        )}
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {savedNote && (
          <span role="status" className="text-[10px] font-medium text-emerald-800" data-testid="ai-door-saved-note">
            {savedNote}
          </span>
        )}
      </div>
    </div>
  );
}

export default AiDoorDescriptionCompare;
