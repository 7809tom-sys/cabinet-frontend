import { useMemo, useState } from "react";
import {
  framelessGrains,
  grainEnds,
  matchSavePatch,
  previewRotationDegrees,
  sortDoorsForReplicate,
  suggestWizardMatch,
  type FramelessGrain,
  type GrainOrientation,
  type MatchSavePatch,
  type ReplicateDoor,
} from "@shared/wizardDoorMatch";
import type { AuditStyle } from "@shared/walzcraftDoorAudit";

/**
 * One comparison card. The owner picks the hex and the grain.
 * Nothing is selected or applied until he does.
 */
export function DoorEditorWalzAudit({
  style,
  sampleUrl,
  others = [],
  onApply,
  onReplicate,
}: {
  style: AuditStyle & { id?: number | null; distributorId?: number | null; grainDirection?: string | null; doorSampleImageUrl?: string | null };
  sampleUrl?: string | null;
  others?: ReplicateDoor[];
  onApply?: (patch: MatchSavePatch) => void;
  onReplicate?: (ids: number[], patch: MatchSavePatch) => void;
}) {
  const suggestion = suggestWizardMatch(style);
  const grains = useMemo(() => framelessGrains(), []);
  const [grainCode, setGrainCode] = useState<string | null>(null);
  const [hex, setHex] = useState("");
  const [orientation, setOrientation] = useState<GrainOrientation | null>(null);
  const [query, setQuery] = useState("");
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [saved, setSaved] = useState<MatchSavePatch | null>(null);
  const grain = grains.find((item) => item.code === grainCode) ?? null;
  const photo = sampleUrl || style.doorSampleImageUrl || "";
  const ends = /^#[0-9a-f]{6}$/i.test(hex) ? grainEnds(hex) : null;
  const rotation = previewRotationDegrees(grain?.orientation ?? null, orientation);
  const doors = sortDoorsForReplicate(others, style.id ?? -1, style.distributorId).filter((door) => {
    const text = `${door.ourName ?? ""} ${door.styleCode ?? ""}`.toLowerCase();
    return query.trim() === "" || text.includes(query.trim().toLowerCase());
  });

  const chooseGrain = (item: FramelessGrain) => {
    setGrainCode(item.code);
    setOrientation(item.orientation);
    setSaved(null);
  };

  const sampleHex = (event: React.MouseEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 1;
    canvas.height = image.naturalHeight || 1;
    const context = canvas.getContext("2d");
    if (!context) return;
    try {
      context.drawImage(image, 0, 0);
      const rect = image.getBoundingClientRect();
      const x = Math.min(canvas.width - 1, Math.max(0, Math.round(((event.clientX - rect.left) / rect.width) * canvas.width)));
      const y = Math.min(canvas.height - 1, Math.max(0, Math.round(((event.clientY - rect.top) / rect.height) * canvas.height)));
      const pixel = context.getImageData(x, y, 1, 1).data;
      setHex(`#${[pixel[0], pixel[1], pixel[2]].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`);
      setSaved(null);
    } catch {
      /* The photo can be cross-origin. The hex box still works. */
    }
  };

  const apply = () => {
    if (!grain || !orientation && grain.hasGrain) return;
    const patch = matchSavePatch({ hex, grainCode: grain.code, orientation: orientation ?? "vertical" });
    if (!patch) return;
    setSaved(patch);
    onApply?.(patch);
  };

  return (
    <section data-testid="door-editor-walzcraft-audit" className="space-y-3 rounded-lg border border-[#d7a46c] bg-[#fffdf9] px-3 py-3 text-[#244338]">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide">Match this door</h3>
        <p className="text-xs text-muted-foreground">Compare the real photo with the working door. Nothing is chosen until you pick a grain and a hex.</p>
      </div>
      <div className="flex flex-wrap gap-3" data-testid="wizard-compare">
        <figure className="space-y-1">
          <figcaption className="text-[11px] font-semibold uppercase tracking-wide">Real door</figcaption>
          {photo ? (
            <img src={photo} alt="Real door" data-testid="wizard-real-door" className="h-40 w-28 rounded border bg-white object-contain" onClick={sampleHex} />
          ) : (
            <div className="flex h-40 w-28 items-center justify-center rounded border border-dashed text-xs">No photo</div>
          )}
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-[11px] font-semibold uppercase tracking-wide">Working door</figcaption>
          <div
            data-testid="wizard-working-door"
            className="flex h-40 w-28 items-end overflow-hidden rounded border bg-white"
            style={{
              backgroundColor: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "transparent",
              backgroundImage: grain?.photoUrl ? `url(${grain.photoUrl})` : undefined,
              backgroundSize: "cover",
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
            }}
          />
        </figure>
      </div>
      <p data-testid="wizard-suggestion" className="text-xs italic">{suggestion.note}{suggestion.needsColorReview ? " Flagged for review." : ""}</p>
      <label className="flex items-center gap-2 text-xs">
        Hex
        <input data-testid="wizard-hex" value={hex} onChange={(event) => { setHex(event.target.value); setSaved(null); }} placeholder="#8d8f92" className="rounded border px-1 py-0.5" />
        {ends && <span data-testid="wizard-grain-ends">light {ends.light} dark {ends.dark}</span>}
      </label>
      <div className="flex gap-2 text-xs">
        <button type="button" data-testid="wizard-orientation-horizontal" onClick={() => setOrientation("horizontal")} className={`rounded border px-2 py-1 ${orientation === "horizontal" ? "border-[#d7a46c]" : ""}`}>Horizontal</button>
        <button type="button" data-testid="wizard-orientation-vertical" onClick={() => setOrientation("vertical")} className={`rounded border px-2 py-1 ${orientation === "vertical" ? "border-[#d7a46c]" : ""}`}>Vertical</button>
      </div>
      <div data-testid="wizard-grains" className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
        {grains.map((item) => (
          <button
            key={item.code}
            type="button"
            data-testid={`grain-tile-${item.code}`}
            aria-pressed={grainCode === item.code}
            onClick={() => chooseGrain(item)}
            className={`rounded border p-1 text-left text-[10px] ${grainCode === item.code ? "border-[#d7a46c]" : "border-[#244338]/20"}`}
          >
            {item.photoUrl ? <img src={item.photoUrl} alt="" className="mb-1 h-16 w-full object-cover" /> : <span className="mb-1 block h-16 bg-[#f6f3ed]" />}
            <span className="block font-semibold">{item.code} {item.name}</span>
            <span>{item.hasGrain ? item.orientation : "no grain"}</span>
          </button>
        ))}
      </div>
      <button type="button" data-testid="wizard-apply" className="rounded bg-[#244338] px-2 py-1 text-xs font-semibold text-[#fffdf9]" onClick={apply}>Apply</button>
      {saved && <p data-testid="wizard-applied" className="text-xs">Saved {saved.renderHex} · {saved.woodSpecies ?? "no grain"} · {saved.grainDirection}</p>}
      <div data-testid="wizard-replicate" className="space-y-1">
        <p className="text-xs font-semibold">Apply to other doors</p>
        <input data-testid="wizard-replicate-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doors" className="w-full rounded border px-1 py-0.5 text-xs" />
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {doors.map((door) => (
            <li key={door.id}>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  data-testid={`wizard-replicate-${door.id}`}
                  checked={pickedIds.includes(door.id)}
                  onChange={() => setPickedIds((current) => current.includes(door.id) ? current.filter((id) => id !== door.id) : [...current, door.id])}
                />
                {door.ourName}
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          data-testid="wizard-replicate-apply"
          className="rounded border px-2 py-1 text-xs font-semibold"
          onClick={() => { if (saved) onReplicate?.(pickedIds, saved); }}
        >
          Apply to other doors
        </button>
      </div>
    </section>
  );
}
