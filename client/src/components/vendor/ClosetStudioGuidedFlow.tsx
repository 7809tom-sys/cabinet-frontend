import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Ruler, Sparkles, WandSparkles } from "lucide-react";
import { REACH_IN_CLOSET_PRESETS, WALK_IN_CLOSET_PRESETS } from "@/lib/closetRoomPresets";
import {
  STUDIO_GUIDED_DEFAULTS, STUDIO_GUIDED_ROOM_DEFAULTS,
  type StudioGuidedAmount, type StudioGuidedAnswers, type StudioGuidedClosetType, type StudioGuidedStorageMix, type StudioGuidedYesNo,
} from "@/lib/vendorClosetStudio";

export type GuidedRoom = { wallWidthIn: number; roomDepthIn: number; roomHeightIn: number };

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b8804e]";

/** A compact two-up choice for the room shape and space kind, so the primary action stays on screen. */
function CompactChoice({ label, hint, selected, onSelect, testId, icon }: { label: string; hint?: string; selected: boolean; onSelect: () => void; testId?: string; icon?: string }) {
  return <button
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    data-testid={testId}
    className={`flex min-h-[58px] items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 sm:gap-2.5 sm:px-3 sm:py-2 text-left transition-transform active:scale-[0.99] ${FOCUS} ${selected ? "border-[#b8804e] bg-[#fff8ed] shadow-sm" : "border-[#dcd5c8] bg-white hover:border-[#c3a882] hover:bg-[#fdfbf7]"}`}
  >
    {icon && <span aria-hidden="true" className={`text-lg leading-none ${selected ? "text-[#a9763f]" : "text-[#b3a897]"}`}>{icon}</span>}
    <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-tight text-[#2b3a33]">{label}</span>{hint && <span className="mt-0.5 block text-[11px] leading-snug text-[#7c7468]">{hint}</span>}</span>
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-[#b8804e] bg-[#b8804e] text-white" : "border-[#cfc6b8] bg-white text-transparent"}`}><Check className="h-3 w-3" aria-hidden="true" /></span>
  </button>;
}

function Question({ legend, help, children, testId }: { legend: string; help?: string; children: React.ReactNode; testId?: string }) {
  return <fieldset className="mt-3 sm:mt-5" data-testid={testId}>
    <legend className="text-[13px] font-bold text-[#2b3a33] sm:text-[14px]">{legend}</legend>
    {help && <p className="mt-0.5 text-[11px] leading-snug text-[#7c7468]">{help}</p>}
    <div className="mt-2 grid gap-2">{children}</div>
  </fieldset>;
}

function SizeField({ label, hint, value, onChange, min, max, testId }: { label: string; hint: string; value: string; onChange: (value: string) => void; min: number; max: number; testId: string }) {
  return <label className="block text-[11px] font-semibold text-[#5f665f]">{label}
    <input
      type="number" inputMode="decimal" min={min} max={max} value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={hint}
      data-testid={testId}
      className={`mt-1 h-11 w-full rounded-lg border border-[#d9d5cb] bg-white px-2.5 text-sm font-normal text-[#2b3a33] ${FOCUS}`}
    />
    <span className="mt-0.5 block text-[10px] font-normal text-[#8d857a]">{hint}</span>
  </label>;
}

/**
 * The beginner flow: three plain steps, sensible defaults at every step, no part numbers or
 * studio jargon. Step 1 sizes the room, step 2 asks four everyday questions, and step 3 hands the
 * answers to the existing auto-builder. A complete answer set is always valid, so the primary
 * action is never blocked behind validation the user has to guess at.
 */
export function ClosetStudioGuidedFlow({
  initialAnswers, initialRoom, savedDraft, onStartGuided, onStartBlank, onContinueDraft, onCancelStart, onMoreSetups, introMode, onChooseMode, onChooseKids, initialStep = 1, testIdPrefix = "guided",
}: {
  initialAnswers: StudioGuidedAnswers;
  initialRoom: GuidedRoom;
  savedDraft: boolean;
  onStartGuided: (answers: StudioGuidedAnswers, room: GuidedRoom) => void;
  onStartBlank: (room: GuidedRoom) => void;
  onContinueDraft: () => void;
  onCancelStart?: () => void;
  /** Opens the original screen for pantry, mudroom and kids' closets. */
  onMoreSetups?: () => void;
  introMode: "closet" | "pantry" | "mudroom" | "kids";
  onChooseMode: (mode: "closet" | "pantry" | "mudroom" | "kids") => void;
  /** Kids' closets need a child's age and height, so that path keeps its own screen. */
  onChooseKids?: () => void;
  /** "Change answers" reopens the flow on the questions, not back at the room size. */
  initialStep?: 1 | 2;
  testIdPrefix?: string;
}) {
  const [step, setStep] = useState<1 | 2>(initialStep);
  const [answers, setAnswers] = useState<StudioGuidedAnswers>(initialAnswers);
  const [closetType, setClosetType] = useState<StudioGuidedClosetType>(initialAnswers.closetType);
  const [room, setRoom] = useState<{ width: string; depth: string; height: string }>({
    width: String(initialRoom.wallWidthIn), depth: String(initialRoom.roomDepthIn), height: String(initialRoom.roomHeightIn),
  });
  const [error, setError] = useState<string | null>(null);

  const presets = useMemo(() => closetType === "reachIn" ? REACH_IN_CLOSET_PRESETS : WALK_IN_CLOSET_PRESETS, [closetType]);
  const id = (name: string) => `${testIdPrefix}-${name}`;

  const applyPreset = (preset: { widthIn: number; depthIn: number }) => {
    setRoom({ width: String(preset.widthIn), depth: String(preset.depthIn), height: room.height });
    setError(null);
  };

  const chooseType = (type: StudioGuidedClosetType) => {
    setClosetType(type);
    setAnswers((current) => ({ ...current, closetType: type }));
    const defaults = STUDIO_GUIDED_ROOM_DEFAULTS[type];
    setRoom({ width: String(defaults.wallWidthIn), depth: String(defaults.roomDepthIn), height: room.height });
    setError(null);
  };

  const readRoom = (): GuidedRoom | null => {
    const width = Number(room.width), depth = Number(room.depth), height = Number(room.height);
    if (!(width >= 36 && width <= 240)) { setError("Enter a width from 36 to 240 inches."); return null; }
    if (!(depth >= 24 && depth <= 240)) { setError("Enter a depth from 24 to 240 inches."); return null; }
    if (!(height >= 72 && height <= 120)) { setError("Enter a ceiling height from 72 to 120 inches."); return null; }
    setError(null);
    return { wallWidthIn: width, roomDepthIn: depth, roomHeightIn: height };
  };

  const goToQuestions = () => {
    if (!readRoom()) return;
    setAnswers((current) => ({ ...current, closetType }));
    setStep(2);
  };

  const build = () => {
    const parsed = readRoom();
    if (!parsed) { setStep(1); return; }
    onStartGuided({ ...answers, closetType }, parsed);
  };

  const startBlank = () => {
    const parsed = readRoom();
    if (!parsed) return;
    onStartBlank(parsed);
  };

  const set = <K extends keyof StudioGuidedAnswers>(key: K, value: StudioGuidedAnswers[K]) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  return <div className={`flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-[#f5f2ec] text-[#25332c] ${FOCUS}`} data-testid={id("gate")} data-guided-step={step}>
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e2dcd0] bg-[#fbfaf7] px-4 py-3 sm:px-8">
      <a href="/" aria-label="CabinetDealz home" className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#244338] text-lg font-semibold text-[#f2e3c3]">M</span>
        <span className="min-w-0"><strong className="block truncate font-serif text-base leading-none sm:text-lg">Closet Planner</strong><span className="mt-1 block truncate text-[10px] uppercase tracking-[0.18em] text-[#8a8276]">CabinetDealz</span></span>
      </a>
      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden text-[11px] font-semibold text-[#8a8276] sm:inline">Step {step} of 2</span>
        {onCancelStart && <button type="button" onClick={onCancelStart} className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-[#5f665f] hover:bg-[#f0ede6] ${FOCUS}`}>Cancel</button>}
      </div>
    </header>

    <main className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
      <ol className="mb-3 flex items-center gap-2 sm:mb-5" aria-label="Progress">
        {([1, 2] as const).map((number) => <li key={number} className="flex flex-1 items-center gap-2">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step >= number ? "bg-[#244338] text-white" : "border border-[#d5cdc0] bg-white text-[#9a9083]"}`}>{step > number ? <Check className="h-4 w-4" /> : number}</span>
          <span className={`min-w-0 truncate text-[12px] font-semibold ${step >= number ? "text-[#2b3a33]" : "text-[#9a9083]"}`}>{number === 1 ? "Your room" : "What you store"}</span>
          {number === 1 && <span aria-hidden="true" className={`h-px min-w-4 flex-1 ${step > 1 ? "bg-[#244338]" : "bg-[#e0d9cc]"}`} />}
        </li>)}
      </ol>

      {step === 1 ? <section data-testid={id("step-room")}>
        <h1 className="font-serif text-xl leading-tight text-[#22362c] sm:text-3xl">Let&apos;s start with your closet</h1>
        <p className="mt-1 text-[12px] leading-snug text-[#6f6a5f] sm:mt-2 sm:text-[13px]">Two quick questions, then we build the closet for you. You can change anything afterwards.</p>

        <div className="mt-5 grid gap-2 sm:grid-cols-2" data-testid={id("closet-type")}>
          <CompactChoice icon="▯" label="Reach-in" hint="One wall, behind doors." selected={closetType === "reachIn"} onSelect={() => chooseType("reachIn")} testId={id("type-reach-in")} />
          <CompactChoice icon="▢" label="Walk-in" hint="A room you step into." selected={closetType === "walkIn"} onSelect={() => chooseType("walkIn")} testId={id("type-walk-in")} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2" data-testid={id("space")} role="group" aria-label="What kind of space is it">          <CompactChoice icon="◧" label="A closet" selected={introMode === "closet"} onSelect={() => onChooseMode("closet")} testId={id("space-closet")} />
          <CompactChoice icon="▧" label="A pantry" selected={introMode === "pantry"} onSelect={() => onChooseMode("pantry")} testId={id("space-pantry")} />
          <CompactChoice icon="⌂" label="A mudroom" selected={introMode === "mudroom"} onSelect={() => onChooseMode("mudroom")} testId={id("space-mudroom")} />
          <CompactChoice icon="◨" label="A kids' closet" selected={introMode === "kids"} onSelect={() => onChooseKids?.()} testId={id("space-kids")} />
        </div>

        <div className="mt-3">
          <h2 className="text-[13px] font-bold text-[#2b3a33] sm:text-[14px]">How big is it?</h2>
          <p className="mt-0.5 text-[11px] leading-snug text-[#7c7468]">Measure across the wall and into the room. We filled in a typical size.</p>
          <div className="mt-2 hidden gap-1.5 sm:grid sm:grid-cols-3" data-testid={id("presets")}>
            {presets.map((preset) => {
              const selected = room.width === String(preset.widthIn) && room.depth === String(preset.depthIn);
              return <button key={preset.id} type="button" onClick={() => applyPreset(preset)} aria-pressed={selected} data-testid={id(`preset-${preset.id}`)}
                className={`flex min-h-[46px] flex-col justify-center gap-0.5 rounded-lg border-2 px-2.5 py-1.5 text-left ${FOCUS} ${selected ? "border-[#b8804e] bg-[#fff8ed]" : "border-[#dcd5c8] bg-white hover:border-[#c3a882]"}`}>
                <span className="min-w-0 text-[12px] font-semibold leading-tight text-[#2b3a33]">{preset.label}</span>
                <span className="min-w-0 text-[10px] leading-tight text-[#7c7468]">{preset.description}</span>
              </button>;
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <SizeField label="Width" hint="36–240 in" value={room.width} min={36} max={240} onChange={(value) => { setRoom({ ...room, width: value }); setError(null); }} testId={id("width")} />
            <SizeField label="Depth" hint="24–240 in" value={room.depth} min={24} max={240} onChange={(value) => { setRoom({ ...room, depth: value }); setError(null); }} testId={id("depth")} />
            <SizeField label="Ceiling" hint="72–120 in" value={room.height} min={72} max={120} onChange={(value) => { setRoom({ ...room, height: value }); setError(null); }} testId={id("height")} />
          </div>
        </div>

        {error && <p role="alert" data-testid={id("error")} className="mt-3 rounded-lg border border-[#e5c9a2] bg-[#fff6e5] px-3 py-2 text-[12px] text-[#7a5734]">{error}</p>}

        <button type="button" onClick={goToQuestions} data-testid={id("next")} className={`mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#244338] px-5 text-base font-bold text-white shadow-md shadow-[#244338]/15 transition-transform hover:bg-[#315444] active:scale-[0.99] ${FOCUS}`}>Next<ArrowRight className="h-5 w-5" /></button>

        <div className="mt-3 flex flex-col gap-1 border-t border-[#e5dfd3] pt-2 sm:flex-row sm:justify-center">
          {savedDraft && <button type="button" onClick={onContinueDraft} data-testid={id("continue-draft")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-bold text-[#244338] underline underline-offset-2 hover:bg-[#f0ede6] ${FOCUS}`}>Continue my saved closet<ArrowRight className="h-4 w-4" /></button>}
          <button type="button" onClick={startBlank} data-testid={id("start-blank")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#5f665f] underline underline-offset-2 hover:bg-[#f0ede6] ${FOCUS}`}>Start with an empty tower instead</button>
          {onMoreSetups && <button type="button" onClick={onMoreSetups} data-testid={id("other-setups")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-[#5f665f] underline underline-offset-2 hover:bg-[#f0ede6] ${FOCUS}`}>Use the original setup screen</button>}
        </div>
      </section> : <section data-testid={id("step-questions")}>
        <h1 className="font-serif text-xl leading-tight text-[#22362c] sm:text-3xl">What do you keep in there?</h1>
        <p className="mt-1 text-[12px] leading-snug text-[#6f6a5f] sm:mt-2 sm:text-[13px]">Pick the closest answer. Nothing is permanent.</p>

        <Question legend="More hanging, more shelves, or a bit of both?" testId={id("storage-mix")}>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <CompactChoice label="Mostly hanging" hint="Dresses and shirts on hangers." selected={answers.storageMix === "mostlyHanging"} onSelect={() => set("storageMix", "mostlyHanging" as StudioGuidedStorageMix)} testId={id("mix-hanging")} />
            <CompactChoice label="A bit of both" hint="Most people pick this." selected={answers.storageMix === "balanced"} onSelect={() => set("storageMix", "balanced" as StudioGuidedStorageMix)} testId={id("mix-balanced")} />
            <CompactChoice label="Mostly shelves" hint="Folded clothes and bins." selected={answers.storageMix === "mostlyShelving"} onSelect={() => set("storageMix", "mostlyShelving" as StudioGuidedStorageMix)} testId={id("mix-shelving")} />
          </div>
        </Question>

        <Question legend="Do you need somewhere to hang long dresses or coats?" testId={id("long-hang")}>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <CompactChoice label="Yes, I have long things" hint="One area stays tall and clear." selected={answers.longHang === "yes"} onSelect={() => set("longHang", "yes" as StudioGuidedYesNo)} testId={id("long-hang-yes")} />
            <CompactChoice label="No, mostly shorter clothes" hint="Two rows gives you more room." selected={answers.longHang === "no"} onSelect={() => set("longHang", "no" as StudioGuidedYesNo)} testId={id("long-hang-no")} />
          </div>
        </Question>

        <Question legend="How many drawers do you want?" testId={id("drawers")}>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <CompactChoice label="None" selected={answers.drawers === "none"} onSelect={() => set("drawers", "none" as StudioGuidedAmount)} testId={id("drawers-none")} />
            <CompactChoice label="A few" selected={answers.drawers === "some"} onSelect={() => set("drawers", "some" as StudioGuidedAmount)} testId={id("drawers-some")} />
            <CompactChoice label="Lots" selected={answers.drawers === "lots"} onSelect={() => set("drawers", "lots" as StudioGuidedAmount)} testId={id("drawers-lots")} />
          </div>
        </Question>

        <Question legend="How much shoe storage?" testId={id("shoes")}>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <CompactChoice label="None" selected={answers.shoes === "none"} onSelect={() => set("shoes", "none" as StudioGuidedAmount)} testId={id("shoes-none")} />
            <CompactChoice label="A few pairs" selected={answers.shoes === "some"} onSelect={() => set("shoes", "some" as StudioGuidedAmount)} testId={id("shoes-some")} />
            <CompactChoice label="Lots of shoes" selected={answers.shoes === "lots"} onSelect={() => set("shoes", "lots" as StudioGuidedAmount)} testId={id("shoes-lots")} />
          </div>
        </Question>

        {error && <p role="alert" className="mt-3 rounded-lg border border-[#e5c9a2] bg-[#fff6e5] px-3 py-2 text-[12px] text-[#7a5734]">{error}</p>}

        <button type="button" onClick={build} data-testid={id("build")} className={`mt-4 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-[#244338] px-5 text-base font-bold text-white shadow-md shadow-[#244338]/15 transition-transform hover:bg-[#315444] active:scale-[0.99] ${FOCUS}`}><WandSparkles className="h-5 w-5" />Show my closet</button>
        <button type="button" onClick={() => setStep(1)} data-testid={id("back")} className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#d5cdc0] bg-white px-4 text-[13px] font-semibold text-[#4d5852] hover:bg-[#f0ede6] ${FOCUS}`}><ArrowLeft className="h-4 w-4" />Back to room size</button>
      </section>}

      <p className="mt-3 flex items-start gap-2 text-[10px] leading-relaxed text-[#8d857a]"><Ruler className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />Parts and prices come from the published March 2022 MasterTrac list. This is a planning tool, not a checkout quote.</p>
    </main>
  </div>;
}

/** The calm, plain-language result screen shown once the guided build lands in the studio. */
export function ClosetStudioGuidedSummary({ lines, onChangeAnswers, onMoreOptions, testIdPrefix = "guided" }: { lines: string[]; onChangeAnswers: () => void; onMoreOptions: () => void; testIdPrefix?: string }) {
  return <section className="pointer-events-auto max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-[#dfd8cb] bg-[#fffdf9]/97 p-3.5 shadow-lg backdrop-blur sm:p-5" data-testid={`${testIdPrefix}-summary`} aria-label="Your closet plan">
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e8f0e8] text-[#244338] sm:h-8 sm:w-8"><Sparkles className="h-3.5 w-3.5" aria-hidden="true" /></span>
      <div className="min-w-0">
        <h2 className="font-serif text-base leading-tight text-[#22362c] sm:text-lg">Here is your closet</h2>
        <p className="mt-0.5 text-[11px] text-[#7c7468]">Built from your answers. Nothing is ordered yet.</p>
      </div>
      <button type="button" onClick={onMoreOptions} aria-label="Dismiss summary" className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a8276] hover:bg-[#f0ede6]">✕</button>
    </div>
    <ul className="mt-2 space-y-1" data-testid={`${testIdPrefix}-summary-lines`}>
      {lines.map((line) => <li key={line} className="flex gap-1.5 text-[12px] leading-snug text-[#4a554e] sm:text-[13px]"><span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[#b8804e]" />{line}</li>)}
    </ul>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button type="button" onClick={onChangeAnswers} data-testid={`${testIdPrefix}-change-answers`} className={`flex min-h-11 items-center justify-center gap-1 rounded-lg border border-[#c3a882] bg-white px-2 text-[12px] font-bold text-[#6b4c2c] hover:bg-[#fff8ed] sm:text-[13px] ${FOCUS}`}><ArrowLeft className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Change answers</span></button>
      <button type="button" onClick={onMoreOptions} data-testid={`${testIdPrefix}-tune`} className={`flex min-h-11 items-center justify-center gap-1 rounded-lg bg-[#244338] px-2 text-[12px] font-bold text-white hover:bg-[#315444] sm:text-[13px] ${FOCUS}`}><span className="truncate">Tune the details</span></button>
    </div>
  </section>;
}
