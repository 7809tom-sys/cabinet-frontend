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
 * The reply is handed to the door editor through `onDescription`, so it lands in
 * the door's own description field and not only in this panel. The panel keeps
 * its own copy: the column still fills, so the operator can read and compare all
 * three answers. The indicator beside the column label only turns green once
 * that handoff has actually happened — a model reply on its own is not enough.
 *
 * A column's preview does not exist until that column has real text. There is no
 * placeholder door outline: an empty column shows its prompt controls and an
 * empty field.
 */
import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AI_DOOR_MODELS,
  AI_DOOR_MODEL_LABELS,
  AI_DOOR_PROMPTS,
  aiDoorUnstatedSentence,
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
import {
  aiDoorDescribeInput,
  aiDoorStatusLabel,
  aiDoorStatusSentence,
  type AiDoorGenerateReason,
} from "@shared/aiDoorDescribe";
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
  /**
   * Called with a generated description as soon as it arrives, so the door
   * editor can put it in the door's own description field instead of leaving it
   * in this panel only. The panel keeps its own copy either way.
   *
   * Return `false` to say the text did not reach the door field. The indicator
   * then shows a handoff failure rather than a success, because a green light
   * must mean "the door has this description", not "a model answered".
   */
  onDescription?: (args: { model: AiDoorModel; description: string }) => boolean | void;
  /**
   * What the operator has typed in the door's description field. It is sent with
   * the fixed prompt, so their own words reach the model.
   */
  instructions?: string | null;
};

/**
 * Per-column Generate state. `saving` is the moment between a model reply and the
 * door's field having the text; `saved` is only set once that handoff returned
 * successfully.
 */
type GenerateState = Partial<Record<AiDoorModel, {
  status: "idle" | "loading" | "saving" | "saved" | "error" | "not-connected";
  message: string | null;
  /** Why it failed, so the indicator names the cause instead of saying "error". */
  reason: AiDoorGenerateReason | null;
}>>;

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

/**
 * The at-a-glance state of one column's Generate, beside its label.
 *
 * Green means the description is in the door's own field — not merely that a
 * model answered. Amber is in-flight, red names the actual cause, and a grey
 * "not connected" dot is a setup message rather than a failure.
 */
export function AiDoorGenerateStatus({
  model,
  state,
}: {
  model: AiDoorModel;
  state: { status: "idle" | "loading" | "saving" | "saved" | "error" | "not-connected"; message: string | null; reason: AiDoorGenerateReason | null } | undefined;
}) {
  const status = state?.status ?? "idle";
  const testId = `ai-door-status-${model}`;
  if (status === "idle") return null;

  if (status === "loading" || status === "saving") {
    const label = status === "loading" ? "Sending to AI…" : "Saving to the door field…";
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid={testId}
        data-state="waiting"
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-300"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {label}
      </span>
    );
  }

  if (status === "saved") {
    return (
      <span
        role="status"
        aria-live="polite"
        data-testid={testId}
        data-state="saved"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-emerald-300"
      >
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        Description received and saved to the door field
      </span>
    );
  }

  const notConnected = status === "not-connected";
  return (
    <span
      role={notConnected ? "status" : "alert"}
      aria-live="polite"
      data-testid={testId}
      data-state={notConnected ? "not-connected" : "failed"}
      data-reason={state?.reason ?? "provider-error"}
      title={state?.reason ?? "provider-error"}
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${
        notConnected
          ? "bg-amber-50 text-amber-900 ring-amber-300"
          : "bg-red-50 text-red-800 ring-red-300"
      }`}
    >
      <XCircle className="h-3 w-3" aria-hidden="true" />
      {notConnected ? aiDoorStatusLabel("not-connected") : aiDoorStatusLabel(state?.reason ?? "provider-error")}
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
export function AiDoorDescriptionCompare({ style, sampleUrl, onChooseOfficial, onDescription, instructions }: AiDoorDescriptionCompareProps) {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<StoredAiDoorComparison>({ fields: {}, chosen: null, reference: {} });
  const [fields, setFields] = useState<Partial<Record<AiDoorModel, string>>>({});
  const [generated, setGenerated] = useState<GenerateState>({});
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Bumped on every choice so the Designer-facing draft is re-read. */
  const [choiceVersion, setChoiceVersion] = useState(0);
  const describe = useAiDoorDescribe();

  const parsed = useMemo(
    () => (open ? parseAiDoorComparison(fields, style) : null),
    [open, fields, style],
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

  function updateField(model: AiDoorModel, value: string) {
    // Text goes into local state only. Editing a field never re-chooses an
    // official description and never writes to storage on its own.
    setFields((current) => ({ ...current, [model]: value }));
  }

  /**
   * Ask this column's model for a description, on the button press only.
   *
   * The prompt, the operator's own instructions, and the door photo's URL go to
   * the API server, which holds the provider key. The answer fills this column's
   * box — generating one column never rewrites another — and is then handed to
   * the door editor through `onDescription` so it lands in the door's own
   * description field. The panel copy stays, so all three answers remain
   * readable and comparable.
   *
   * The indicator only turns green after that handoff actually succeeds. A model
   * reply on its own is reported as a handoff failure, never as a success.
   */
  async function generate(model: AiDoorModel) {
    setGenerated((current) => ({ ...current, [model]: { status: "loading", message: null, reason: null } }));
    const result = await describe.generate(model, aiDoorDescribeInput({
      model,
      prompt: AI_DOOR_PROMPTS[model],
      imageUrl: sampleUrl ?? null,
      doorName: [style.doorStyle, style.finish].map((part) => part ?? "").join(" ").trim() || null,
      styleId: style.id,
      // The operator's words reach the model, and the field is replaced with the
      // answer below rather than silently left as an instruction.
      instructions: instructions ?? null,
    }));
    if (result.description) {
      updateField(model, result.description);
      setGenerated((current) => ({ ...current, [model]: { status: "saving", message: null, reason: null } }));
      const delivered = onDescription?.({ model, description: result.description });
      if (delivered === false) {
        setGenerated((current) => ({
          ...current,
          [model]: {
            status: "error",
            message: aiDoorStatusSentence({ model, reason: "handoff-failed" }),
            reason: "handoff-failed",
          },
        }));
        return;
      }
      setGenerated((current) => ({ ...current, [model]: { status: "saved", message: null, reason: null } }));
      return;
    }
    const reason = result.reason ?? (result.notConnected ? "not-connected" : "provider-error");
    setGenerated((current) => ({
      ...current,
      [model]: {
        status: result.notConnected ? "not-connected" : "error",
        message: aiDoorStatusSentence({ model, reason, message: result.message }),
        reason,
      },
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
              Compare GPT, Claude, and Gemini descriptions of this door and write the answer into the door's description
              field. The standing prompt is pre-loaded, so pressing Generate is the only step.
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
            The standing prompt is already loaded for each model. Press Generate and nothing else: the prompt, your
            instructions from the description field, and the door photo go to that model, and its answer is written into
            the door's description field. The column keeps a copy so you can compare all three. Anything a description
            does not state stays at the library default and is listed.
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
          const state = generated[model] ?? { status: "idle" as const, message: null, reason: null };
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
                <div className="flex items-center gap-1.5">
                  <AiDoorGenerateStatus model={model} state={state} />
                  {isChosen && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700" data-testid={`ai-door-chosen-${model}`}>
                      Official
                    </span>
                  )}
                </div>
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
              </div>
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
                        <p className="text-[10px] text-amber-800" data-testid={`ai-door-unstated-sentence-${model}`}>
                          {aiDoorUnstatedSentence(result.unstated)}
                        </p>
                      ) : (
                        <p className="text-[10px] text-emerald-800">Every compared detail was stated in this description.</p>
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
