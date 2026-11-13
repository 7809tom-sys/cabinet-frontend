/**
 * "Best picture" for a door style (Tom, Nov 13 2026).
 *
 * The door editor already has several pictures of the same door: the supplier's
 * uploaded photo, the WalzCraft brochure crop, the accepted AI render and the
 * catalog thumbnail. This picker lets the operator choose which one represents
 * the door. The chosen picture becomes the style's sample image, so the Original
 * image tile, the 2D/3D door faces, the Designer and the image generator all read
 * the same picture.
 *
 * Pure presentation: it never uploads, generates or deletes a picture.
 */

export type DoorBestPicture = {
  /** Stable id used for the test id and the selected state. */
  id: string;
  label: string;
  url: string;
};

export type DoorBestPicturePickerProps = {
  pictures: readonly DoorBestPicture[];
  /** The picture currently used as the sample image, if any. */
  selectedUrl?: string | null;
  onPick: (picture: DoorBestPicture) => void;
};

export function DoorBestPicturePicker({ pictures, selectedUrl, onPick }: DoorBestPicturePickerProps) {
  const available = pictures.filter((picture) => (picture.url ?? "").trim());
  if (!available.length) return null;
  const selected = (selectedUrl ?? "").trim();
  return (
    <section data-testid="door-best-picture" className="space-y-2 rounded-lg border border-[#d4a75a]/70 bg-white px-3 py-3">
      <div>
        <span className="text-xs font-semibold">Best picture</span>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pick the picture that represents this door. It becomes the sample image the Designer, the tiles and the image generator read.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {available.map((picture) => {
          const isSelected = selected !== "" && picture.url === selected;
          return (
            <button
              key={picture.id}
              type="button"
              data-testid={`door-best-picture-${picture.id}`}
              data-state={isSelected ? "on" : "off"}
              aria-pressed={isSelected}
              title={picture.label}
              onClick={() => onPick(picture)}
              className={
                "group relative overflow-hidden rounded-md border-2 bg-white p-1 text-left transition-colors " +
                (isSelected ? "border-[#2563eb] shadow-sm" : "border-border hover:border-[#2563eb]/50")
              }
            >
              <span className="block aspect-square w-full overflow-hidden rounded bg-[#f6f2e9]">
                <img src={picture.url} alt={picture.label} className="h-full w-full object-cover" />
              </span>
              <span className="mt-1 block truncate text-[11px] font-semibold leading-tight text-[#1a2744]">{picture.label}</span>
              {isSelected && (
                <span aria-hidden="true" className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#2563eb] text-[11px] font-bold leading-none text-white shadow">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default DoorBestPicturePicker;
