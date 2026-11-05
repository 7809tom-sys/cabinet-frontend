/**
 * AI door-description comparison — door editor only.
 *
 * Three columns, one per model. Each column holds a tailored prompt, a Generate
 * button that runs that prompt, a paste-back field for the answer, and a mini door
 * preview drawn from that answer. The previews update as text arrives, and one
 * can be chosen official; the other two are kept as reference.
 *
 * Nothing runs automatically. The panel mounts collapsed; opening it reads the
 * saved drafts and nothing else. No model is called until the operator presses
 * Generate in that column, and no call is made on mount, on open, or on typing.
 *
 * Generate runs server-side only: the button sends the prompt and the door
 * photo's URL to `doorStyles.describeWithAi` on the API server, which holds the
 * provider keys. No key is ever in this file, in the bundle, or in the request.
 * When a key is missing the column says so in plain words.
 *
 * A column's preview does not exist until that column has real text. There is no
 * placeholder door outline: an empty column shows its prompt controls and an
 * empty field.
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
  type AiDoorParseResult,
} from "@shared/aiDoorDescription";
import {
  readAiDoorComparison,
  saveAiDoorComparison,
  chooseOfficialAiDoorDescription,
  type StoredAiDoorComparison,
} from "@shared/aiDoorDescriptionStore";
import { aiDoorDescribeInput } from "@shared/aiDoorDescribe";
import {
  chosenProfileFromRecord,
  readChosenDoorProfile,
  saveChosenDoorProfile,
  clearChosenDoorProfile,
  chosenProfileAlreadySaved,
  withChosenDoorProfile,
} from "@shared/aiDoorChosenProfile";
import { aiDoorPreviewEntryLabel, aiDoorPreviewGeometry, previewFaceHex } from "@/lib/aiDoorPreview";
import { useAiDoorDescribe } from "@/lib/aiDoorDescribeClient";
import {
  aiDoorImageSourceLabel,
  aiDoorPreviewSource,
  aiDoorSampleSource,
  type AiDoorImageSource,
} from "@/lib/aiDoorImageSource";
import { announceChosenDoorProfile } from "@/lib/useChosenDoorProfiles";

export type AiDoorCompareStyle = {
  id: number;
  doorStyle?: string | null;
  color?: string | null;
  renderHex?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  panelConstruction?: "raised" | "flat" | "slab" | "glass" | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  bevelWidth?: string | number | null;
  bevelDepth?: string | null | number;
  insideEdgeProfile?: string | null;
  finishSheen?: "matte" | "satin" | "gloss" | null;
  grainDirection?: string | null;
};

export type AiDoorDescriptionCompareProps = {
  style: AiDoorCompareStyle;
  /** Door photo the operator is describing. Shown for reference, and sent with Generate. */
  sampleUrl?: string | null;
  /**
   * Called when the operator chooses an official description. The door editor
   * saves the winner through its existing profile storage.
   */
  onChooseOfficial?: (record: AiDoorOfficialRecord) => void;
};

type CopyState = Partial<Record<AiDoorModel, "idle" | "copied" | "failed">>;
/** Per-column Generate state: idle, running, or the plain message to show. */
type GenerateState = Partial<Record<AiDoorModel, { status: "idle" | "loading" | "error" | "not-connected"; message: string | null }>>;

const EMPTY_PARAMS: AiDoorParseResult["params"] = {
  entryId: null,
  family: "unknown",
  railIn: null,
  stileIn: null,
  bevelWidthIn: null,
  bevelDepthIn: null,
  panelConstruction: null,
  insideEdgeProfile: null,
  cornerJoint: null,
  molding: null,
  painted: null,
  grainDirection: null,
  sheen: null,
  undertone: null,
  colorText: null,
};

/**
 * Says where the picture it sits on really came from. Only rendered for a
 * source that exists, so there is no "AI generated" badge until an AI image
 * call actually makes one.
 */
function SourceBadge({ source }: { source: AiDoorImageSource | null }) {
  const label = aiDoorImageSourceLabel(source);
  if (!label) return null;
  const tone = label.kind === "door-sample"
    ? "bg-slate-800/85 text-white"
    : label.kind === "ai-generated"
      ? "bg-violet-700/90 text-white"
      : "bg-amber-100/95 text-amber-900 ring-1 ring-amber-300";
  return (
    <span
      data-testid={label.testId}
      data-source={label.kind}
      className={`pointer-events-none absolute left-1 top-1 z-10 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {label.label}
    </span>
  );
}

function DoorPreview({ params, colorSeed }: {
  params: AiDoorParseResult["params"];
  colorSeed: AiDoorCompareStyle;
}) {
  const geometry = aiDoorPreviewGeometry(params);
  const face = previewFaceHex(colorSeed);
  const edge = `color-mix(in srgb, ${face} 78%, black)` as string;
  const panel = `color-mix(in srgb, ${face} 92%, black)` as string;
  return (
    <div className="relative">
      {/* This drawing is the library default profile rendered locally. It is not a
          photo of the door and it is not an AI image, so it says so on the picture. */}
      <SourceBadge source={aiDoorPreviewSource()} />
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
    </div>
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
  const [generated, setGenerated] = useState<GenerateState>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Bumped on every choice so the Designer-facing draft is re-read. */
  const [choiceVersion, setChoiceVersion] = useState(0);
  const describe = useAiDoorDescribe();

  const parsed = useMemo(
    () => (open ? parseAiDoorComparison(fields) : null),
    [open, fields],
  );

  function startComparison() {
    const loaded = readAiDoorComparison(style.id);
    setStored(loaded);
    setFields(loaded.fields);
    setGenerated({});
    setChoiceVersion((current) => current + 1);
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

  /**
   * Ask this column's model for a description, on the button press only.
   *
   * The prompt and the door photo's URL go to the API server, which holds the
   * provider key. The answer is pasted into this column's own box and nowhere
   * else, so generating one column never rewrites another.
   */
  async function generate(model: AiDoorModel) {
    setGenerated((current) => ({ ...current, [model]: { status: "loading", message: null } }));
    const result = await describe.generate(model, aiDoorDescribeInput({
      model,
      prompt: AI_DOOR_PROMPTS[model],
      imageUrl: sampleUrl ?? null,
      doorName: [style.doorStyle, style.finish].map((part) => part ?? "").join(" ").trim() || null,
      styleId: style.id,
    }));
    if (result.description) {
      updateField(model, result.description);
      setGenerated((current) => ({ ...current, [model]: { status: "idle", message: null } }));
      return;
    }
    setGenerated((current) => ({
      ...current,
      [model]: { status: result.notConnected ? "not-connected" : "error", message: result.message },
    }));
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
      // Hand the choice to the Designer straight away: the door redraws from the
      // chosen profile on its next frame, before Save, and the editor's normal
      // Save still writes the real record.
      const profile = chosenProfileFromRecord(record);
      if (!chosenProfileAlreadySaved(profile, style)) saveChosenDoorProfile(style.id, profile);
      else clearChosenDoorProfile(style.id);
      announceChosenDoorProfile(style.id);
      setChoiceVersion((current) => current + 1);
      onChooseOfficial?.(record);
      setSavedNote(`${AI_DOOR_MODEL_LABELS[model]}'s description is now this door's official profile. The other two are kept as reference.`);
    } finally {
      setBusy(false);
    }
  }

  /**
   * True when the operator chose a profile earlier and the saved row has not
   * caught up with it, so the Designer is drawing from the draft right now.
   */
  const pendingProfile = useMemo(
    () => (open ? readChosenDoorProfile(style.id) : null),
    // Re-read after a choice and when the style row changes, not on every keystroke.
    [open, style.id, choiceVersion],
  );
  const profileIsLive = pendingProfile && !chosenProfileAlreadySaved(pendingProfile, style);
  const previewSeed = withChosenDoorProfile(style, profileIsLive ? pendingProfile : null) ?? style;

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
            Press Generate to have that model describe this door, or copy the prompt and paste its answer back. The preview
            under each field draws what that description actually says; anything it does not state stays at the library
            default and is listed.
          </p>
        </div>
        {sampleUrl && (
          <figure className="relative shrink-0" data-testid="ai-door-compare-sample-figure">
            <img
              src={sampleUrl}
              alt="Door photo being described"
              className="h-16 w-16 rounded border object-cover"
              data-testid="ai-door-compare-sample"
            />
            {/* The photo is the style's own saved sample, not an AI image. */}
            <SourceBadge source={aiDoorSampleSource(sampleUrl)} />
          </figure>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {AI_DOOR_MODELS.map((model) => {
          const result = parsed?.[model];
          const isChosen = stored.chosen === model;
          const state = generated[model] ?? { status: "idle" as const, message: null };
          const isLoading = state.status === "loading";
          const text = (fields[model] ?? "").trim();
          const hasText = text.length > 0;
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
                  className="h-7 flex-1 text-xs"
                  onClick={() => void generate(model)}
                  disabled={isLoading}
                  data-testid={`ai-door-generate-${model}`}
                >
                  {isLoading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}
                  {isLoading ? "Generating…" : "Generate"}
                </Button>
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
              {state.message && (
                <p
                  role={state.status === "not-connected" ? "status" : "alert"}
                  className={`text-[10px] font-medium ${state.status === "not-connected" ? "text-amber-800" : "text-red-700"}`}
                  data-testid={`ai-door-generate-message-${model}`}
                >
                  {state.message}
                </p>
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

              {/* No text, no door: an empty column shows no preview at all. */}
              {hasText && (
                <>
                  <DoorPreview params={result?.params ?? EMPTY_PARAMS} colorSeed={previewSeed} />

                  <p className="text-[10px] text-muted-foreground" data-testid={`ai-door-entry-${model}`}>
                    {aiDoorPreviewEntryLabel(result?.params ?? EMPTY_PARAMS)}
                  </p>

                  {result && (
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
                </>
              )}

              <Button
                type="button"
                size="sm"
                className="h-7 w-full text-xs"
                variant={isChosen ? "secondary" : "outline"}
                disabled={busy || !hasText}
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
