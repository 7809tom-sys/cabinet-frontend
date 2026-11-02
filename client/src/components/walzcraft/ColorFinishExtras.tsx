import { doorSkinError, type DoorSkin } from "@shared/doorSkin";

/** Primary color display for woodGrain styles: label + grain swatch (hex is never the main label). */
export function WoodGrainColorDisplay({ label, swatchUrl, horizontal }: { label: string; swatchUrl: string | null; horizontal: boolean }) {
  return (
    <div data-testid="wood-grain-color-display" className="flex items-center gap-3 rounded border border-[#d7a46c] bg-[#fffdf9] p-2 text-[#244338]">
      <div className="h-16 w-12 overflow-hidden rounded border border-[#244338]/30 bg-[#fffdf9]">
        {swatchUrl ? <img src={swatchUrl} alt="Wood grain swatch" data-testid="wood-grain-swatch" className="h-full w-full object-cover" style={horizontal ? { transform: "rotate(90deg) scale(1.5)" } : undefined} /> : <span className="text-[10px]">no grain photo</span>}
      </div>
      <div className="text-sm font-semibold" data-testid="wood-grain-label">{label}</div>
    </div>
  );
}

export function DoorSkinField({ value, onChange, woodGrain }: { value: DoorSkin; onChange: (v: DoorSkin) => void; woodGrain: boolean }) {
  const err = doorSkinError(value);
  return (
    <div data-testid="door-skin-field" className={`space-y-1 rounded border p-2 text-xs text-[#244338] ${woodGrain ? "border-[#d7a46c] bg-[#d7a46c]/15" : ""}`}>
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" data-testid="skin-needed" checked={value.skinNeeded} onChange={(e) => onChange({ skinNeeded: e.target.checked, skinThicknessIn: e.target.checked ? value.skinThicknessIn : null })} />
        Skin needed?
        <span className="font-normal text-muted-foreground">(size not saved yet · this browser only)</span>
      </label>
      {value.skinNeeded && (
        <fieldset className="flex items-center gap-3 pl-5" data-testid="skin-size">
          <legend className="sr-only">Skin size (required)</legend>
          <span>Size (required):</span>
          {([0.25, 0.75] as const).map((t) => (
            <label key={t} className="flex items-center gap-1"><input type="radio" name="skin-size" required checked={value.skinThicknessIn === t} onChange={() => onChange({ skinNeeded: true, skinThicknessIn: t })} />{t === 0.25 ? "1/4 in" : "3/4 in"}</label>
          ))}
        </fieldset>
      )}
      {!value.skinNeeded && <p data-testid="skin-none-helper" className="pl-5">Exposed sides match the door color (no skin).</p>}
      {err && <p role="alert" data-testid="skin-size-error">{err}</p>}
      {woodGrain && <p data-testid="skin-woodgrain-note" className="font-semibold">Wood grain doors need a skin or 3/4 in end on exposed sides</p>}
    </div>
  );
}
