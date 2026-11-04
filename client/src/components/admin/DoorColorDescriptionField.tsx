/**
 * Plain-text color description for a door profile.
 *
 * Hex answers "which color". This field answers "what does the finish look like" —
 * sheen, undertone, and anything beyond a hex value, e.g. "warm ivory with a soft
 * matte, low-luster finish, slight cream undertone".
 *
 * It is blank by default and never derived from a color name or a hex. Nothing
 * here guesses a description, and no brand-palette swatch is substituted.
 */
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { readDoorColorDescription, saveDoorColorDescription } from "@shared/aiDoorDescriptionStore";

export type DoorColorDescriptionFieldProps = {
  styleId: number | string | null | undefined;
  /**
   * Fires on blur and on explicit save, so the door editor can include the text
   * in its normal profile save. Never fires on mount.
   */
  onChange?: (description: string) => void;
  /** Called when the operator presses the save button. */
  onSave?: (description: string) => void;
};

export function DoorColorDescriptionField({ styleId, onChange, onSave }: DoorColorDescriptionFieldProps) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState<string | null>(null);

  // Load what was saved for this style. A style with nothing saved stays blank:
  // the field is never prefilled from the color name or hex.
  useEffect(() => {
    setValue(readDoorColorDescription(styleId));
    setSaved(null);
  }, [styleId]);

  function commit() {
    const stored = saveDoorColorDescription(styleId, value);
    setValue(stored);
    onChange?.(stored);
    setSaved("Color description saved for this door style.");
    onSave?.(stored);
  }

  return (
    <div className="space-y-1.5" data-testid="door-color-description">
      <Label htmlFor="ed-color-description">Color description</Label>
      <textarea
        id="ed-color-description"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => onChange?.(value.trim())}
        rows={2}
        placeholder="e.g. warm ivory with a soft matte, low-luster finish, slight cream undertone"
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
        data-testid="door-color-description-input"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={commit}
          className="inline-flex h-7 items-center rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-muted"
          data-testid="door-color-description-save"
        >
          Save color description
        </button>
        <p className="text-xs text-muted-foreground">
          Plain text beyond the hex: sheen, undertone, and the finish in words. Blank until you write it.
        </p>
      </div>
      {saved && (
        <span role="status" className="text-xs font-medium text-emerald-800" data-testid="door-color-description-saved">
          {saved}
        </span>
      )}
    </div>
  );
}

export default DoorColorDescriptionField;
