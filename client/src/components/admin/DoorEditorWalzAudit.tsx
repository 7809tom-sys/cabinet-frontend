import { useEffect, useMemo, useRef, useState } from "react";
import {
  framelessGrains,
  grainEnds,
  previewRotationDegrees,
  sortDoorsForReplicate,
  suggestWizardMatch,
  type FramelessGrain,
  type GrainOrientation,
  type MatchSavePatch,
  type ReplicateDoor,
} from "@shared/wizardDoorMatch";
import type { AuditStyle } from "@shared/walzcraftDoorAudit";
import { writeWizardDoorFinish, type WizardDoorFinish } from "@shared/walzcraftDesignerPickup";
import {
  PAINT_FINISH,
  SHERWIN_WILLIAMS_ATTRIBUTION,
  STAIN_FINISH,
  STAIN_WHEEL_ENDS,
  paintAt,
  readPaintCodeInput,
  readStainCodeInput,
  stainAt,
  wizardColorByCode,
  wizardColorByPaintCode,
  wizardColorByStainCode,
  wizardColorPosition,
  wizardSavePatch,
  type WizardColor,
  type WizardFinish,
} from "@shared/walzcraftWizardColor";
import { paintWheelGradient } from "@shared/sherwinWilliamsPaint";
import { stainWheelGradient } from "@shared/sherwinWilliamsStain";
import {
  lookUpWalzCraftModel,
  profileImageFromFile,
  readProfileImage,
  readProfileImageLibrary,
  resolveDoorProfileImage,
  selectFromSelection,
  walzCraftCatalogCodes,
  writeProfileImage,
  type WalzCraftProfileImage,
} from "@shared/walzcraftProfileImage";

/**
 * One comparison card on the door editor. Nothing is selected or applied until the
 * owner picks a Sherwin-Williams stain or paint, or uploads a door profile image.
 *
 * The wheels are the only color source here: there is no grid of preloaded door swatches
 * under them. Stain keeps the wood grain and tints it; paint is an opaque solid.
 */

/** A local preview URL for a chosen file. Null where the browser has no object URLs. */
function createPreviewUrl(file: File): string | null {
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

type WizardStyle = AuditStyle & {
  id?: number | null;
  distributorId?: number | null;
  grainDirection?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  profileImageUrl?: string | null;
};

export function DoorEditorWalzAudit({
  style,
  sampleUrl,
  others = [],
  onApply,
  onReplicate,
  onProfileImage,
  onSaveFinish,
  uploadImage,
}: {
  style: WizardStyle;
  sampleUrl?: string | null;
  others?: ReplicateDoor[];
  onApply?: (patch: MatchSavePatch) => void;
  onReplicate?: (ids: number[], patch: MatchSavePatch) => void;
  /** Called when the admin chooses a profile image, so the editor can save it with the door. */
  onProfileImage?: (image: WalzCraftProfileImage | null) => void;
  /**
   * Called with the finish the admin applied, so the editor can keep the record the
   * Designer reads. Without it the wizard writes that record itself.
   */
  onSaveFinish?: (finish: WizardDoorFinish) => void;
  /**
   * Uploads one file through the existing media library endpoint and returns its URL.
   * Without it the wizard falls back to a local object URL, which lasts for this page only.
   */
  uploadImage?: (file: File) => Promise<string | null>;
}) {
  const suggestion = suggestWizardMatch(style);
  const grains = useMemo(() => framelessGrains(), []);
  const [grainCode, setGrainCode] = useState<string | null>(null);
  const [orientation, setOrientation] = useState<GrainOrientation | null>(null);
  const [finish, setFinish] = useState<WizardFinish>(suggestion.finish);
  const [stainCode, setStainCode] = useState<string | null>(null);
  const [paintCode, setPaintCode] = useState<string | null>(null);
  const [stainInput, setStainInput] = useState("");
  const [paintInput, setPaintInput] = useState("");
  const [stainNote, setStainNote] = useState<string | null>(null);
  const [paintNote, setPaintNote] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [modelNumber, setModelNumber] = useState("");
  const [profileImage, setProfileImage] = useState<WalzCraftProfileImage | null>(null);
  const [library, setLibrary] = useState<Record<string, WalzCraftProfileImage>>({});
  const [query, setQuery] = useState("");
  const [pickedIds, setPickedIds] = useState<number[]>([]);
  const [saved, setSaved] = useState<MatchSavePatch | null>(null);
  const [savedColor, setSavedColor] = useState<WizardColor | null>(null);
  const folderRef = useRef<HTMLInputElement | null>(null);
  const filesRef = useRef<HTMLInputElement | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => { for (const url of objectUrls.current) URL.revokeObjectURL(url); }, []);

  useEffect(() => {
    setLibrary(readProfileImageLibrary());
    const stored = readProfileImage(style.id ?? null);
    if (stored) setProfileImage(stored);
  }, [style.id]);

  const grain = grains.find((item) => item.code === grainCode) ?? null;
  const stain = stainCode ? wizardColorByStainCode(stainCode) : null;
  const paint = paintCode ? wizardColorByPaintCode(paintCode) : null;
  const active: WizardColor | null = finish === STAIN_FINISH ? stain : paint;
  const hex = active?.hex ?? "";
  const ends = active && hex ? grainEnds(hex) : null;
  const rotation = previewRotationDegrees(grain?.orientation ?? null, orientation);
  const resolvedImage = resolveDoorProfileImage(
    { id: style.id, doorSampleImageUrl: sampleUrl || style.doorSampleImageUrl, thumbnailImageUrl: style.thumbnailImageUrl, profileImageUrl: style.profileImageUrl },
    { stored: profileImage },
  );
  const photo = resolvedImage.url ?? "";
  const modelLookup = modelNumber.trim() ? lookUpWalzCraftModel(modelNumber) : null;
  const libraryImages = Object.values(library);
  const doors = sortDoorsForReplicate(others, style.id ?? -1, style.distributorId).filter((door) => {
    const text = `${door.ourName ?? ""} ${door.styleCode ?? ""}`.toLowerCase();
    return query.trim() === "" || text.includes(query.trim().toLowerCase());
  });

  const clearSaved = () => {
    setSaved(null);
    setSavedColor(null);
  };

  const pickStain = (next: WizardColor | null, message: string | null = null) => {
    setFinish(STAIN_FINISH);
    setStainCode(next?.code ?? null);
    setStainNote(message);
    setPaintNote(null);
    clearSaved();
  };

  const pickPaint = (next: WizardColor | null, message: string | null = null) => {
    setFinish(PAINT_FINISH);
    setPaintCode(next?.code ?? null);
    setPaintNote(message);
    setStainNote(null);
    clearSaved();
  };

  const applyPaintCode = () => {
    const result = readPaintCodeInput(paintInput);
    if (!result.found) {
      pickPaint(null, result.message);
      return;
    }
    pickPaint(result.color);
  };

  const applyStainCode = () => {
    const result = readStainCodeInput(stainInput);
    if (!result.found) {
      pickStain(null, result.message);
      return;
    }
    pickStain(result.color);
  };

  const chooseGrain = (item: FramelessGrain) => {
    setGrainCode(item.code);
    setOrientation(item.orientation);
    clearSaved();
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
      const picked = `#${[pixel[0], pixel[1], pixel[2]].map((channel) => channel!.toString(16).padStart(2, "0")).join("")}`;
      const match = wizardColorByCode(picked);
      if (match?.finish === STAIN_FINISH) pickStain(match);
      else pickPaint(match);
    } catch {
      /* The photo can be cross-origin. The wheels and code boxes still work. */
    }
  };

  const apply = () => {
    if (!active) return;
    const patch = wizardSavePatch(
      active,
      grain ? { name: grain.name, orientation: grain.hasGrain ? (orientation ?? grain.orientation) : null } : null,
    );
    if (!patch) return;
    setSaved(patch);
    setSavedColor(active);
    commitWizardFinish(active, patch);
    onApply?.(patch);
  };

  /** Hands the finish to the editor, which saves it and writes the record the Designer reads. */
  const commitWizardFinish = (color: WizardColor, patch: MatchSavePatch) => {
    const finishRecord: WizardDoorFinish = {
      finish: color.finish,
      code: color.code,
      label: color.label,
      hex: color.hex,
      woodSpecies: patch.woodSpecies,
      grainDirection: patch.grainDirection,
      profileImageUrl: profileImage?.url ?? resolvedImage.url,
    };
    if (onSaveFinish) onSaveFinish(finishRecord);
    else writeWizardDoorFinish(style.id ?? patch.renderHex, finishRecord);
  };

  const takeFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selection = selectFromSelection(Array.from(files), modelNumber);
    if (!selection.file || !selection.picked) {
      setUploadNote(selection.note);
      return;
    }
    const url = createPreviewUrl(selection.file);
    if (url) objectUrls.current.push(url);
    const image = profileImageFromFile(selection.picked, url, { modelNumber: selection.modelNumber, folder: selection.folder });
    setProfileImage(image);
    writeProfileImage(style.id ?? image.fileName, image);
    setLibrary(readProfileImageLibrary());
    onProfileImage?.(image);
    void persist(selection.file, image);
  };

  /** Hands the chosen file to the existing media library upload, then keeps the returned URL. */
  const persist = async (file: File, image: WalzCraftProfileImage) => {
    if (!uploadImage) {
      setUploadNote(`${image.catalogNote ? `${image.catalogNote} ` : ""}Using ${image.fileName} as the live profile on this page. The library upload is unavailable, so it is not offered again.`);
      return;
    }
    const url = await uploadImage(file);
    if (!url) {
      setUploadNote(`${image.catalogNote ? `${image.catalogNote} ` : ""}Using ${image.fileName} as the live profile on this page. The library upload failed, so it is not offered again.`);
      return;
    }
    const stored = { ...image, url };
    setProfileImage(stored);
    writeProfileImage(style.id ?? stored.fileName, stored);
    setLibrary(readProfileImageLibrary());
    setUploadNote(`${image.catalogNote ? `${image.catalogNote} ` : ""}Using ${stored.fileName} as the live profile${stored.modelNumber ? ` for ${stored.modelNumber}` : ""}. It is offered again in the library.`);
    onProfileImage?.(stored);
  };

  const chooseFromLibrary = (image: WalzCraftProfileImage) => {
    setProfileImage(image);
    writeProfileImage(style.id ?? image.fileName, image);
    setLibrary(readProfileImageLibrary());
    setUploadNote(`Using ${image.fileName} again as the live profile.`);
    onProfileImage?.(image);
  };

  return (
    <section data-testid="door-editor-walzcraft-audit" className="space-y-3 rounded-lg border border-[#d7a46c] bg-[#fffdf9] px-3 py-3 text-[#244338]">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide">WalzCraft color and profile</h3>
        <p className="text-xs text-muted-foreground">
          Slide a Sherwin-Williams stain or paint beside the sample door. Nothing is chosen until you pick, and the pick is what gets saved.
        </p>
      </div>

      <div className="flex flex-wrap gap-3" data-testid="wizard-compare">
        <figure className="space-y-1">
          <figcaption className="text-[11px] font-semibold uppercase tracking-wide">Sample door</figcaption>
          {photo ? (
            <div className="relative h-40 w-28 overflow-hidden rounded border bg-white">
              <img
                src={photo}
                alt="Sample door"
                data-testid="wizard-real-door"
                className="h-40 w-28 object-contain"
                onClick={sampleHex}
                style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
              />
              {/* The pick lands on the sample door as it is made, without replacing the photo. */}
              {hex && (
                <span
                  aria-hidden="true"
                  data-testid="wizard-sample-finish"
                  data-finish={active?.finish ?? "none"}
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundColor: hex,
                    opacity: active?.finish === PAINT_FINISH ? 0.85 : 0.45,
                    mixBlendMode: active?.finish === PAINT_FINISH ? "normal" : "multiply",
                  }}
                />
              )}
            </div>
          ) : (
            <div className="flex h-40 w-28 items-center justify-center rounded border border-dashed text-xs">No photo</div>
          )}
        </figure>
        <figure className="space-y-1">
          <figcaption className="text-[11px] font-semibold uppercase tracking-wide">Canvas door</figcaption>
          <div
            data-testid="wizard-working-door"
            data-finish={active?.finish ?? "none"}
            data-hex={hex || undefined}
            data-grain-photo={grain?.photoUrl ?? undefined}
            className="h-40 w-28 overflow-hidden rounded border bg-cover"
            style={{
              // Paint covers the door as an opaque solid. A stain is a tint over the grain,
              // so the grain photo stays visible under it.
              backgroundColor: hex || "transparent",
              // Paint is an opaque solid of the chip: no grain shows through.
              // A stain is a tint over the grain, so the grain photo stays visible under it.
              backgroundImage: active?.finish === STAIN_FINISH && (grain?.photoUrl ?? photo)
                ? `url(${grain?.photoUrl ?? photo})`
                : undefined,
              backgroundBlendMode: active?.finish === STAIN_FINISH && hex ? "multiply" : undefined,
              backgroundSize: "cover",
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
            }}
          >
            <span className="sr-only">{photo ? "Same profile image as the sample door" : "Profile image missing"}</span>
          </div>
        </figure>
        <div className="min-w-[12rem] flex-1 space-y-2">
          <p data-testid="wizard-suggestion" className="text-xs italic">{suggestion.note}{suggestion.needsColorReview ? " Flagged for review." : ""}</p>
          <p data-testid="wizard-selection" className="text-xs">
            {active ? `${active.label} · ${active.hex} · ${active.finish === STAIN_FINISH ? "stain keeps the grain" : "opaque paint"}` : "No Sherwin-Williams color picked yet."}
          </p>
          {ends && <p data-testid="wizard-grain-ends" className="text-[11px]">light {ends.light} dark {ends.dark}</p>}
        </div>
      </div>

      {/* Sherwin-Williams STAIN wheel */}
      <div data-testid="wizard-stain-wheel" className="space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide">Sherwin-Williams stain · keeps the wood grain</span>
          <span className="text-[11px] text-muted-foreground">{STAIN_WHEEL_ENDS.light} → {STAIN_WHEEL_ENDS.dark}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          aria-label="Sherwin-Williams stain wheel"
          data-testid="wizard-stain-slider"
          value={Math.round(wizardColorPosition(stain) * 1000)}
          onChange={(event) => pickStain(stainAt(Number(event.target.value) / 1000))}
          className="h-6 w-full cursor-pointer appearance-none rounded"
          style={{ backgroundImage: stainWheelGradient() }}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            data-testid="wizard-stain-code"
            value={stainInput}
            onChange={(event) => setStainInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applyStainCode(); }}
            placeholder="MW230"
            className="w-24 rounded border px-1 py-0.5"
          />
          <button type="button" data-testid="wizard-stain-code-apply" onClick={applyStainCode} className="rounded border px-2 py-0.5">Use stain code</button>
          {stain && <span data-testid="wizard-stain-picked">{stain.label} · {stain.hex}</span>}
        </div>
        {stainNote && <p data-testid="wizard-stain-note" role="status" className="text-[11px]">{stainNote}</p>}
        {/* A stain keeps a grain. The grain is one choice in a compact picker, not a swatch wall. */}
        <div data-testid="wizard-grain-picker" className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            <span className="text-[11px] font-semibold">Grain</span>
            <select
              data-testid="wizard-grain-select"
              value={grainCode ?? ""}
              onChange={(event) => {
                const next = grains.find((item) => item.code === event.target.value);
                if (next) chooseGrain(next);
                else { setGrainCode(null); setOrientation(null); clearSaved(); }
              }}
              className="rounded border px-1 py-0.5"
            >
              <option value="">— none yet —</option>
              {grains.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} {item.name}{item.hasGrain ? ` · ${item.orientation}` : " · no grain"}
                </option>
              ))}
            </select>
          </label>
          <button type="button" data-testid="wizard-orientation-horizontal" onClick={() => setOrientation("horizontal")} className={`rounded border px-2 py-0.5 ${orientation === "horizontal" ? "border-[#d7a46c]" : ""}`}>Horizontal</button>
          <button type="button" data-testid="wizard-orientation-vertical" onClick={() => setOrientation("vertical")} className={`rounded border px-2 py-0.5 ${orientation === "vertical" ? "border-[#d7a46c]" : ""}`}>Vertical</button>
        </div>
      </div>

      {/* Sherwin-Williams PAINT wheel + chip code box */}
      <div data-testid="wizard-paint-wheel" className="space-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wide">Sherwin-Williams paint · opaque solid</span>
        <input
          type="range"
          min={0}
          max={1000}
          step={1}
          aria-label="Sherwin-Williams paint wheel"
          data-testid="wizard-paint-slider"
          value={Math.round(wizardColorPosition(paint) * 1000)}
          onChange={(event) => pickPaint(paintAt(Number(event.target.value) / 1000))}
          className="h-6 w-full cursor-pointer appearance-none rounded"
          style={{ backgroundImage: paintWheelGradient() }}
        />
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            data-testid="wizard-paint-code"
            value={paintInput}
            onChange={(event) => setPaintInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") applyPaintCode(); }}
            placeholder="SW 7005"
            className="w-24 rounded border px-1 py-0.5"
          />
          <button type="button" data-testid="wizard-paint-code-apply" onClick={applyPaintCode} className="rounded border px-2 py-0.5">Use chip code</button>
          {paint && <span data-testid="wizard-paint-picked">{paint.label} · {paint.hex}</span>}
        </div>
        {paintNote && <p data-testid="wizard-paint-note" role="status" className="text-[11px]">{paintNote}</p>}
      </div>

      {/* Door profile image from a local folder, plus the WalzCraft model number */}
      <div data-testid="wizard-profile-image" className="space-y-1 rounded border border-[#244338]/20 p-2">
        <p className="text-xs font-semibold">Door profile image</p>
        <p className="text-[11px] text-muted-foreground">
          Choose a folder of door photos (for example a Skyline color folder) or several files, then type the WalzCraft model number. The file whose name carries that number is picked for you.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            data-testid="wizard-model-number"
            value={modelNumber}
            onChange={(event) => setModelNumber(event.target.value)}
            placeholder="S592"
            className="w-24 rounded border px-1 py-0.5"
          />
          <span data-testid="wizard-model-status" role="status" className="text-[11px]">
            {!modelLookup
              ? "No model number entered."
              : modelLookup.found
                ? `${modelLookup.modelNumber} · ${modelLookup.style}`
                : modelLookup.message}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input ref={folderRef} type="file" accept="image/*" multiple className="sr-only" data-testid="wizard-folder-input"
            {...{ webkitdirectory: "", directory: "" }}
            onChange={(event) => { takeFiles(event.target.files); event.target.value = ""; }} />
          <button type="button" data-testid="wizard-folder-button" onClick={() => folderRef.current?.click()} className="rounded border px-2 py-0.5">Choose folder</button>
          <input ref={filesRef} type="file" accept="image/*" multiple className="sr-only" data-testid="wizard-files-input"
            onChange={(event) => { takeFiles(event.target.files); event.target.value = ""; }} />
          <button type="button" data-testid="wizard-files-button" onClick={() => filesRef.current?.click()} className="rounded border px-2 py-0.5">Choose files</button>
          {profileImage && <span data-testid="wizard-profile-in-use">In use: {profileImage.fileName}</span>}
        </div>
        {uploadNote && <p data-testid="wizard-upload-note" role="status" className="text-[11px]">{uploadNote}</p>}
        <p className="text-[10px] text-[#244338]/70">Catalog codes: {walzCraftCatalogCodes().join(", ")}</p>
        {libraryImages.length > 0 && (
          <div data-testid="wizard-profile-library" className="space-y-1">
            <p className="text-[11px] font-semibold">Offered again</p>
            <div className="flex flex-wrap gap-1">
              {libraryImages.map((image) => (
                <button
                  key={`${image.fileName}-${image.url}`}
                  type="button"
                  data-testid={`wizard-profile-library-${image.fileName}`}
                  onClick={() => chooseFromLibrary(image)}
                  className={`rounded border p-1 text-[10px] ${profileImage?.fileName === image.fileName ? "border-[#d7a46c]" : "border-[#244338]/20"}`}
                >
                  <img src={image.url} alt="" className="mb-0.5 h-12 w-9 object-cover" />
                  <span className="block max-w-[5rem] truncate">{image.modelNumber ?? image.fileName}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <button type="button" data-testid="wizard-apply" className="rounded bg-[#244338] px-2 py-1 text-xs font-semibold text-[#fffdf9]" onClick={apply}>Apply</button>
      {saved && <p data-testid="wizard-applied" className="text-xs">Saved {saved.renderHex} · {saved.woodSpecies ?? "no grain"} · {saved.grainDirection}{savedColor ? ` · ${savedColor.label}` : ""}</p>}
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
      <p className="text-[10px] leading-snug text-[#244338]/70">{SHERWIN_WILLIAMS_ATTRIBUTION}</p>
    </section>
  );
}
