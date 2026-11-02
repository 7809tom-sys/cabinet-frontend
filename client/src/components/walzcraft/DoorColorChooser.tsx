import { SHAKER_BRAND_DOOR_SURFACE_PALETTE, shakerDoorFamily, styleOwnColor, type ShakerStyleInput } from "@shared/shakerDoorBlueprint";
import { catalogForDoor } from "@shared/walzcraftProfileFill";
import { shadesForProfile, type ShadeColor } from "@shared/walzcraftDoorTemplates";
import type { DistributorDoorMatch } from "@shared/walzcraftDistributorMatches";

const BRAND_CHOICES: { hex: string; name: string }[] = [
  { hex: SHAKER_BRAND_DOOR_SURFACE_PALETTE[0], name: "Classic Cream" },
  { hex: "#fffdf9", name: "Cream" },
  { hex: "#f6f3ed", name: "Warm cream" },
  { hex: "#244338", name: "Green" },
  { hex: "#d7a46c", name: "Gold" },
];

export function familyShadesForDoor(door: DistributorDoorMatch | null | undefined): ShadeColor[] {
  if (!door) return [];
  const code = catalogForDoor(door).code;
  return code ? shadesForProfile(code).slice(0, 4) : [];
}

function exactHex(value: string | null | undefined): boolean {
  return /^#[0-9a-f]{6}$/i.test((value ?? "").trim());
}

/** Where the painted door color comes from. The WalzCraft sheet name is never the paint. */
export function explainDoorPaint(style: ShakerStyleInput & { sheetColor?: string | null }): { hex: string; sentence: string } {
  const hex = styleOwnColor(style);
  const shaker = shakerDoorFamily(style.doorStyle) === "shaker" || shakerDoorFamily(`${style.ourName ?? ""} ${style.aliasName ?? ""}`) === "shaker";
  let sentence: string;
  if (exactHex(style.renderHex)) sentence = `Door color ${hex} is the saved render hex. That is the color the Designer paints.`;
  else if (exactHex(style.color)) sentence = `Door color ${hex} is the catalog color hex. No render hex is saved.`;
  else if (style.color?.trim() || style.ourName?.trim() || style.finish?.trim()) sentence = `Door color ${hex} is guessed from the color name. No render hex is saved.`;
  else sentence = `Door color ${hex} is the default finish. No render hex and no color name are saved.`;
  if (shaker) sentence += " The shaker blueprint keeps this color. It does not replace it with a brand swatch.";
  const sheet = style.sheetColor?.trim();
  if (sheet) sentence += ` The WalzCraft sheet says “${sheet}”. That note is not the paint.`;
  return { hex, sentence };
}

export function DoorColorChooser({
  style,
  shades,
  onChoose,
}: {
  style: ShakerStyleInput & { sheetColor?: string | null };
  shades: ShadeColor[];
  onChoose: (hex: string, colorName: string) => void;
}) {
  const explained = explainDoorPaint(style);
  const shaker = shakerDoorFamily(style.doorStyle) === "shaker" || shakerDoorFamily(`${style.ourName ?? ""} ${style.aliasName ?? ""}`) === "shaker";
  return (
    <div data-testid="door-color-chooser" className="space-y-2 rounded-md border border-[#244338]/20 bg-[#fffdf9] p-2 text-[#244338]">
      <div className="flex items-start gap-2">
        <span data-testid="door-color-swatch" className="mt-0.5 h-8 w-8 shrink-0 rounded border border-[#244338]/30" style={{ backgroundColor: explained.hex }} />
        <p data-testid="door-color-source" className="text-xs">{explained.sentence}</p>
      </div>
      {shaker && (
        <div>
          <div className="text-xs font-semibold">Save a door color</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {BRAND_CHOICES.map((choice) => (
              <button
                key={choice.hex}
                type="button"
                data-testid={`brand-door-color-${choice.hex.slice(1)}`}
                onClick={() => onChoose(choice.hex, choice.name)}
                className="flex items-center gap-1 rounded border border-[#244338]/30 bg-white px-1.5 py-1 text-[11px] font-semibold"
              >
                <span className="h-4 w-4 rounded border border-[#244338]/20" style={{ backgroundColor: choice.hex }} />
                {choice.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {shades.length > 0 && (
        <div>
          <div className="text-xs font-semibold">Four shades of this WalzCraft profile</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {shades.map((shade) => (
              <button
                key={shade.id}
                type="button"
                data-testid={`profile-shade-${shade.id}`}
                onClick={() => onChoose(shade.hex, shade.name)}
                className="flex items-center gap-1 rounded border border-[#244338]/30 bg-white px-1.5 py-1 text-[11px]"
              >
                <span className="h-4 w-4 rounded border border-[#244338]/20" style={{ backgroundColor: shade.hex }} />
                {shade.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
