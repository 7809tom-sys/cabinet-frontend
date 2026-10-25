import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { applyDoorOpeningAttributes, doorOpeningAppearance, roomDoorSwing, supportsRoomDoorSwing } from "@/lib/doorOpeningAppearance";
import { wallCeilingMin, wallLength, type RoomData, type WallOpening } from "@/lib/design";

export type DoorAttributesDialogProps = {
  opening: WallOpening | null;
  room: RoomData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (opening: WallOpening) => void;
  onDelete: (uid: string) => void;
};

const DOOR_COLOR_PRESETS = [
  { label: "White", value: "#ffffff" },
  { label: "Warm white", value: "#f4f0e8" },
  { label: "Gray", value: "#9ca3af" },
  { label: "Wood brown", value: "#ad8059" },
  { label: "Black", value: "#242424" },
] as const;

function presetForColor(color: string) {
  const normalized = color.toLowerCase();
  return DOOR_COLOR_PRESETS.some((preset) => preset.value === normalized) ? normalized : "custom";
}

function formatInches(value: number) {
  return Number.isFinite(value) ? String(value) : "—";
}

/**
 * Transactional editor for a regular room-door opening. It deliberately does
 * not edit cabinet doors, hardware, or the opening's wall position.
 */
export function DoorAttributesDialog({
  opening,
  room,
  open,
  onOpenChange,
  onChange,
  onDelete,
}: DoorAttributesDialogProps) {
  const isDoor = opening?.kind === "door";
  const initialAppearance = isDoor && opening
    ? doorOpeningAppearance(opening)
    : { color: "#ffffff", opacity: 0.25 };
  const [widthText, setWidthText] = useState(() => isDoor && opening ? String(opening.width) : "");
  const [heightText, setHeightText] = useState(() => isDoor && opening ? String(opening.height) : "");
  const [color, setColor] = useState(initialAppearance.color);
  const [colorPreset, setColorPreset] = useState(() => presetForColor(initialAppearance.color));
  const [transparencyText, setTransparencyText] = useState(() => String((1 - initialAppearance.opacity) * 100));
  const [openAngle, setOpenAngle] = useState<0 | 90>(opening ? roomDoorSwing(opening).angle : 0);
  const [hinge, setHinge] = useState<"left" | "right">(opening ? roomDoorSwing(opening).hinge : "left");
  const [error, setError] = useState<string | null>(null);

  // A dialog session is a transaction: reset only when it is reopened or a
  // different opening is selected, never while its local draft is being edited.
  useEffect(() => {
    if (!open || !isDoor || !opening) return;
    const appearance = doorOpeningAppearance(opening);
    setWidthText(String(opening.width));
    setHeightText(String(opening.height));
    setColor(appearance.color);
    setColorPreset(presetForColor(appearance.color));
    setTransparencyText(String((1 - appearance.opacity) * 100));
    setOpenAngle(roomDoorSwing(opening).angle);
    setHinge(roomDoorSwing(opening).hinge);
    setError(null);
  }, [opening?.uid, open]);

  if (!isDoor || !opening) return null;

  const wallLimit = wallLength(opening.side, room);
  const heightLimit = Math.max(0, wallCeilingMin(room, opening.side) - opening.sill);
  const endDistance = Math.max(0, wallLimit - opening.offset - opening.width);

  const apply = () => {
    const transparency = Number(transparencyText);
    const result = applyDoorOpeningAttributes(
      opening,
      {
        width: Number(widthText),
        height: Number(heightText),
        color,
        opacity: 1 - transparency / 100,
        ...(supportsRoomDoorSwing(opening) ? { openAngle, hinge } : {}),
      },
      room,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(result.item);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] overflow-y-auto sm:max-w-lg" data-testid="door-attributes-dialog">
        <DialogHeader>
          <DialogTitle>Door attributes</DialogTitle>
          <DialogDescription>
            Edit this room door&apos;s size, paint, transparency and swing. Its wall aperture remains in place; widening near the wall end may adjust its offset to fit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div aria-label="Current wall position" className="rounded-lg border bg-muted/25 p-3 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">Current wall position (read-only)</span>
            <strong className="mt-1 block text-foreground">
              {opening.side} wall · {formatInches(opening.offset)} in from wall start / left · {formatInches(endDistance)} in from wall end / right
            </strong>
          </div>

          <p className="text-xs leading-5 text-muted-foreground">
            Wall limits: width 6–{formatInches(wallLimit)} in; height 6–{formatInches(heightLimit)} in below this wall&apos;s ceiling.
            {opening.sill > 0 ? ` The door sill is ${formatInches(opening.sill)} in above the floor.` : ""}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium" htmlFor={`door-width-${opening.uid}`}>
              Door width in inches
              <Input
                id={`door-width-${opening.uid}`}
                aria-label="Door width in inches"
                className="h-11 text-base"
                type="number"
                inputMode="decimal"
                min={6}
                max={wallLimit}
                step="any"
                value={widthText}
                onChange={(event) => {
                  setWidthText(event.target.value);
                  setError(null);
                }}
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium" htmlFor={`door-height-${opening.uid}`}>
              Door height in inches
              <Input
                id={`door-height-${opening.uid}`}
                aria-label="Door height in inches"
                className="h-11 text-base"
                type="number"
                inputMode="decimal"
                min={6}
                max={heightLimit}
                step="any"
                value={heightText}
                onChange={(event) => {
                  setHeightText(event.target.value);
                  setError(null);
                }}
              />
            </label>
          </div>

          {supportsRoomDoorSwing(opening) ? <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Door position
              <select aria-label="Door position" value={openAngle} onChange={(event) => setOpenAngle(Number(event.target.value) as 0 | 90)} className="h-11 rounded-md border border-input bg-background px-3 text-base">
                <option value="0">Closed (0°)</option>
                <option value="90">Open (90°)</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Door hinge side
              <select aria-label="Door hinge side" value={hinge} onChange={(event) => setHinge(event.target.value as "left" | "right")} className="h-11 rounded-md border border-input bg-background px-3 text-base">
                <option value="left">Left hinge</option>
                <option value="right">Right hinge</option>
              </select>
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">Single-leaf inward swing is a visual planning guide. Check door travel and fixture clearances before installation.</p>
          </div> : <p className="text-xs text-muted-foreground">Sliding and bi-fold doors keep their own illustration; single-leaf 90° swing is not applied.</p>}

          <label className="grid gap-1.5 text-sm font-medium" htmlFor={`door-color-${opening.uid}`}>
            Door color
            <select
              id={`door-color-${opening.uid}`}
              aria-label="Door color"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              value={colorPreset}
              onChange={(event) => {
                const nextPreset = event.target.value;
                setColorPreset(nextPreset);
                if (nextPreset !== "custom") setColor(nextPreset);
                setError(null);
              }}
            >
              {DOOR_COLOR_PRESETS.map((preset) => (
                <option key={preset.value} value={preset.value}>{preset.label} ({preset.value})</option>
              ))}
              <option value="custom">Custom</option>
            </select>
          </label>

          {colorPreset === "custom" && (
            <label className="grid gap-1.5 text-sm font-medium" htmlFor={`door-custom-color-${opening.uid}`}>
              Custom door color
              <Input
                id={`door-custom-color-${opening.uid}`}
                aria-label="Custom door color"
                className="h-11 cursor-pointer p-1"
                type="color"
                value={color}
                onChange={(event) => {
                  setColor(event.target.value);
                  setError(null);
                }}
              />
            </label>
          )}

          <label className="grid gap-1.5 text-sm font-medium" htmlFor={`door-transparency-${opening.uid}`}>
            Door transparency
            <Input
              id={`door-transparency-${opening.uid}`}
              aria-label="Door transparency"
              className="h-11 text-base"
              type="number"
              inputMode="decimal"
              min={0}
              max={95}
              step="1"
              value={transparencyText}
              onChange={(event) => {
                setTransparencyText(event.target.value);
                setError(null);
              }}
            />
            <span className="text-xs font-normal text-muted-foreground">0% is opaque; 95% is the most transparent allowed.</span>
          </label>

          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>Cancel</Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="destructive"
              className="h-11"
              onClick={() => {
                onDelete(opening.uid);
                onOpenChange(false);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete door
            </Button>
            <Button type="button" className="h-11" data-testid="door-attributes-apply" onClick={apply}>Apply</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
