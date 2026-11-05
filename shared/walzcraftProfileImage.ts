/**
 * Admin-chosen door profile image, from a local folder, for the WalzCraft wizard.
 *
 * The admin picks a folder (e.g. a Skyline color folder) or several files at once and
 * types a WalzCraft model number such as `S592`. The file whose name carries that model
 * number is selected automatically. When the model number is not in
 * shared/walzcraftCatalogProfiles.ts the wizard says so and never guesses one.
 *
 * The chosen image is the live profile on that door, and it is offered again next time
 * the same door opens. Persistence uses localStorage, which is the only store available
 * while the backend is on hold (see the PR's "Backend dependency (on hold)" section).
 *
 * Fallback rule: a door uses its WalzCraft wizard profile when one is present; otherwise it
 * keeps the door image it already had. `resolveDoorProfileImage` is the single place that
 * decides, and it never returns an empty string for a door that has an image.
 */
import { WALZCRAFT_CATALOG_PROFILES } from "./walzcraftCatalogProfiles";

export const WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY = "walzcraftDoorProfileImage.v1";

/** What one uploaded image looks like once the admin has chosen it. */
export type WalzCraftProfileImage = {
  /** WalzCraft model number this image was chosen for, or null when none was entered. */
  modelNumber: string | null;
  /** Display name of the source folder (e.g. "Skyline"), or null for loose files. */
  folder: string | null;
  /** File name as it sits in the folder. */
  fileName: string;
  /** URL the door renders. */
  url: string;
  /** True when the model number is in the catalog data. */
  inCatalog: boolean;
  /** Set when the model number could not be matched, for the admin to read. */
  catalogNote: string | null;
};

type MemoryStorage = Pick<Storage, "getItem" | "setItem">;

/** `s592`, `S 592`, `S-592` all read as S592. Anything without an S/SR/MP prefix shape is null. */
export function normalizeModelNumber(value: string | null | undefined): string | null {
  const compact = (value ?? "").trim().toUpperCase().replace(/[\s_.-]+/g, "");
  return /^[A-Z]{1,3}\d{2,4}[A-Z]?$/.test(compact) ? compact : null;
}

export type CatalogLookup =
  | { found: true; modelNumber: string; style: string }
  | { found: false; modelNumber: string | null; reason: "no-number" | "not-in-catalog"; message: string };

/**
 * Model number against the shared catalog. A miss is stated plainly; no nearest
 * profile is substituted.
 */
export function lookUpWalzCraftModel(value: string | null | undefined): CatalogLookup {
  const modelNumber = normalizeModelNumber(value);
  if (!modelNumber) {
    return { found: false, modelNumber: null, reason: "no-number", message: "Enter a WalzCraft model number such as S592." };
  }
  const row = WALZCRAFT_CATALOG_PROFILES[modelNumber];
  if (!row) {
    return {
      found: false,
      modelNumber,
      reason: "not-in-catalog",
      message: `${modelNumber} is not in the WalzCraft catalog data (shared/walzcraftCatalogProfiles.ts). No profile is assumed.`,
    };
  }
  return { found: true, modelNumber, style: row.style };
}

/** Every catalog key, for the admin to read when a number is not found. */
export function walzCraftCatalogCodes(): string[] {
  return Object.keys(WALZCRAFT_CATALOG_PROFILES).sort((left, right) => left.localeCompare(right, "en", { numeric: true }));
}

/**
 * Real WalzCraft catalog profiles, in catalog-code order.
 *
 * Used to fill the door editor's suggested-profile slots when the sheet ranks
 * fewer than four. Each entry is a published catalog row, so a filled slot is a
 * real library default and never an invented profile.
 */
export function walzCraftCatalogProfiles(): Array<{ name: string; code: string }> {
  return walzCraftCatalogCodes()
    .map((code) => WALZCRAFT_CATALOG_PROFILES[code])
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .map((row) => ({ name: row.style, code: row.style.split(" ")[0] ?? row.style }));
}

/** The model number a file name carries, if any: `S592-Barrington.jpg` -> S592. */
export function modelNumberInFileName(fileName: string): string | null {
  const base = fileName.split("/").pop() ?? fileName;
  // A leading S### / SR### token is a WalzCraft style number. Longer digit runs
  // (dates, phone numbers, camera counters) are not.
  const match = /\b(SR?\d{2,4}[A-Z]?)\b/i.exec(base.replace(/[_\s]+/g, "-"));
  return match ? normalizeModelNumber(match[1]) : null;
}

export type PickedFile = { name: string; path?: string | null };

export type FolderPick = {
  files: PickedFile[];
  /** Set when the images live inside one folder (e.g. the Skyline folder). */
  folder: string | null;
};

/**
 * Pick the file that carries the typed model number.
 *
 * An exact number match wins (`s592.jpg`, `S592 Barrington.png`). A file inside a folder
 * named for the model also counts (`S592/door.jpg`). With no typed number, a folder holding
 * exactly one image selects that image. Ambiguity returns null rather than a guess.
 */
export function selectFileForModel(pick: FolderPick, modelNumber: string | null | undefined): PickedFile | null {
  const files = pick.files.filter((file) => isImageName(file.name));
  if (files.length === 0) return null;
  const model = normalizeModelNumber(modelNumber);
  if (!model) return files.length === 1 ? files[0]! : null;
  const byName = files.filter((file) => modelNumberInFileName(file.name) === model);
  if (byName.length === 1) return byName[0]!;
  if (byName.length > 1) {
    const inFolder = byName.find((file) => folderOf(file)?.toUpperCase() === model);
    return inFolder ?? null;
  }
  const byFolder = files.filter((file) => folderOf(file)?.toUpperCase() === model);
  if (byFolder.length === 1) return byFolder[0]!;
  return null;
}

export function isImageName(name: string): boolean {
  return /\.(?:jpe?g|png|webp|avif|gif|bmp|tiff?)$/i.test(name);
}

/** Folder segment of a relative path, when the browser supplies one. */
export function folderOf(file: PickedFile): string | null {
  const path = (file.path ?? (file.name.includes("/") ? file.name : "")) || "";
  const segments = path.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  return segments[segments.length - 2] ?? null;
}

/** Source folder for display: the common folder of the chosen images, else the first file's folder. */
export function folderLabel(pick: FolderPick): string | null {
  if (pick.folder) return pick.folder;
  const folders: string[] = [];
  for (const file of pick.files) {
    const folder = folderOf(file);
    if (folder && !folders.includes(folder)) folders.push(folder);
  }
  return folders.length === 1 ? folders[0]! : null;
}

/** Build the wizard record from a chosen file. The model number is reported as found or not. */
export function profileImageFromFile(file: PickedFile, url: string | null, options: { modelNumber?: string | null; folder?: string | null } = {}): WalzCraftProfileImage {
  const model = normalizeModelNumber(options.modelNumber) ?? modelNumberInFileName(file.name);
  const lookup = model ? lookUpWalzCraftModel(model) : null;
  return {
    modelNumber: model,
    folder: options.folder ?? folderOf(file),
    fileName: file.name.split("/").pop() ?? file.name,
    // An empty URL means "no live image yet"; the fallback rule then keeps the door's own photo.
    url: url ?? "",
    inCatalog: lookup?.found === true,
    catalogNote: model && lookup && !lookup.found ? lookup.message : null,
  };
}

/**
 * The library of images the admin has already chosen, offered again in the wizard.
 * Browser-only while the backend is on hold.
 */
export function readProfileImageLibrary(storage: MemoryStorage | undefined = globalThis.localStorage): Record<string, WalzCraftProfileImage> {
  try {
    const parsed = JSON.parse(storage?.getItem(WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const clean: Record<string, WalzCraftProfileImage> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const record = value as Partial<WalzCraftProfileImage> | null;
      if (!record || typeof record.url !== "string" || !record.url) continue;
      clean[key] = {
        modelNumber: record.modelNumber ?? null,
        folder: record.folder ?? null,
        fileName: typeof record.fileName === "string" ? record.fileName : "",
        url: record.url,
        inCatalog: record.inCatalog === true,
        catalogNote: record.catalogNote ?? null,
      };
    }
    return clean;
  } catch {
    return {};
  }
}

export function saveProfileImage(key: string, image: WalzCraftProfileImage | null, storage: MemoryStorage | undefined = globalThis.localStorage): Record<string, WalzCraftProfileImage> {
  const all = readProfileImageLibrary(storage);
  if (image) all[key] = image;
  else delete all[key];
  storage?.setItem(WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY, JSON.stringify(all));
  return all;
}

/** Saved profile image for one door, or null. Keyed by door style id, then by model number. */
export function readProfileImage(styleId: number | string | null | undefined, storage: MemoryStorage | undefined = globalThis.localStorage): WalzCraftProfileImage | null {
  if (styleId == null) return null;
  const all = readProfileImageLibrary(storage);
  const byStyle = all[styleKey(styleId)];
  if (byStyle) return byStyle;
  const model = normalizeModelNumber(String(styleId));
  if (model) return all[`model:${model}`] ?? null;
  return null;
}

export function writeProfileImage(styleId: number | string, image: WalzCraftProfileImage | null, storage: MemoryStorage | undefined = globalThis.localStorage): WalzCraftProfileImage | null {
  saveProfileImage(styleKey(styleId), image, storage);
  if (image?.modelNumber) saveProfileImage(`model:${image.modelNumber}`, image, storage);
  return image;
}

export function styleKey(styleId: number | string): string {
  return `style:${styleId}`;
}

export type SelectionResult =
  | { file: File; picked: PickedFile; folder: string | null; modelNumber: string | null; catalogNote: string | null; note: string }
  | { file: null; picked: null; folder: null; modelNumber: null; catalogNote: null; note: string };

/**
 * Turn a file/folder selection into the one chosen image, with a note the admin can read.
 *
 * The note says exactly what happened: which file was matched, or that the model number is
 * not in the catalog, or that nothing in the selection carries the number. It never quietly
 * substitutes a different image.
 */
export function selectFromSelection(files: readonly File[], modelNumber: string | null | undefined): SelectionResult {
  const empty = { file: null, picked: null, folder: null, modelNumber: null, catalogNote: null } as const;
  const images = files.filter((file) => isImageName(file.name));
  if (images.length === 0) {
    return { ...empty, note: "That selection holds no images. Choose a folder of door photos or an image file." };
  }
  const view: PickedFile[] = images.map((file) => ({
    name: file.name,
    path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || null,
  }));
  const folder = folderLabel({ files: view, folder: null });
  const typed = modelNumber ?? "";
  const chosen = selectFileForModel({ files: view, folder }, typed);
  const lookup = typed.trim() ? lookUpWalzCraftModel(typed) : null;
  if (!chosen) {
    const names = images.slice(0, 6).map((file) => file.name).join(", ");
    const count = `${images.length} image${images.length === 1 ? "" : "s"}`;
    const list = names ? ` (${names}${images.length > 6 ? ", …" : ""})` : "";
    return {
      ...empty,
      note:
        lookup && !lookup.found
          ? `${lookup.message} Nothing was picked from the ${count} you selected${list}.`
          : `No file in this selection carries ${typed.trim() ? `model ${typed.trim()}` : "the model number"}. ${count} seen${list}. Nothing was picked.`,
    };
  }
  const file = images[view.indexOf(chosen)] ?? images[0]!;
  const model = normalizeModelNumber(typed) ?? modelNumberInFileName(chosen.name);
  const resolved = model ? lookUpWalzCraftModel(model) : null;
  return {
    file,
    picked: chosen,
    folder,
    modelNumber: model,
    catalogNote: resolved && !resolved.found ? resolved.message : null,
    note: folder ? `Matched ${chosen.name} in ${folder}.` : `Matched ${chosen.name}.`,
  };
}

/** Images in the library that belong to a model number, newest key order. */
export function libraryImagesForModel(modelNumber: string | null | undefined, library: Record<string, WalzCraftProfileImage> = readProfileImageLibrary()): WalzCraftProfileImage[] {
  const model = normalizeModelNumber(modelNumber);
  if (!model) return Object.values(library);
  return Object.values(library).filter((image) => image.modelNumber === model);
}

export type DoorImageInput = {  id?: number | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  profileImageUrl?: string | null;
};

export type ResolvedDoorImage = {
  url: string | null;
  source: "wizard-profile" | "door-sample" | "thumbnail" | "stored-profile" | "none";
};

/**
 * Fallback rule, in one place.
 *
 * 1. A profile image the wizard stored for this door.
 * 2. The profile image passed in (live upload, before the save round-trip).
 * 3. The door's own sample image.
 * 4. The door's thumbnail.
 *
 * A door that has an image never resolves to nothing, and the wizard never
 * blanks an image it did not set.
 */
export function resolveDoorProfileImage(
  door: DoorImageInput | null | undefined,
  options: { stored?: WalzCraftProfileImage | null } = {},
): ResolvedDoorImage {
  const stored = options.stored === undefined ? readProfileImage(door?.id ?? null) : options.stored;
  if (stored?.url) return { url: stored.url, source: "stored-profile" };
  const wizard = trimmed(door?.profileImageUrl);
  if (wizard) return { url: wizard, source: "wizard-profile" };
  const sample = trimmed(door?.doorSampleImageUrl);
  if (sample) return { url: sample, source: "door-sample" };
  const thumbnail = trimmed(door?.thumbnailImageUrl);
  if (thumbnail) return { url: thumbnail, source: "thumbnail" };
  return { url: null, source: "none" };
}

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
}
