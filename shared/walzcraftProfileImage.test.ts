import { describe, expect, it } from "vitest";
import {
  WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY,
  folderLabel,
  libraryImagesForModel,
  lookUpWalzCraftModel,
  modelNumberInFileName,
  normalizeModelNumber,
  profileImageFromFile,
  readProfileImage,
  readProfileImageLibrary,
  resolveDoorProfileImage,
  selectFileForModel,
  selectFromSelection,
  walzCraftCatalogCodes,
  writeProfileImage,
} from "./walzcraftProfileImage";

function memory(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  return {
    store,
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
  };
}

/** A File stand-in: the shared module only reads name and webkitRelativePath. */
function file(name: string, dir?: string): File {
  const instance = new File(["x"], name, { type: "image/jpeg" });
  Object.defineProperty(instance, "webkitRelativePath", { value: dir ? `${dir}/${name}` : "" });
  return instance;
}

const skylineFolder = {
  files: [
    { name: "dover-white.jpg", path: "Skyline/dover-white.jpg" },
    { name: "S592", path: "Skyline/S592-barrington.jpg" },
    { name: "S592-barrington.jpg", path: "Skyline/S592-barrington.jpg" },
    { name: "s660-hale.webp", path: "Skyline/s660-hale.webp" },
    { name: "notes.txt", path: "Skyline/notes.txt" },
  ],
  folder: "Skyline",
};

describe("WalzCraft model number against the shared catalog", () => {
  it("reads the number in any form and finds a published profile", () => {
    for (const typed of ["S592", "s592", "S 592", "s-592"]) {
      expect(normalizeModelNumber(typed)).toBe("S592");
      expect(lookUpWalzCraftModel(typed)).toMatchObject({ found: true, modelNumber: "S592" });
    }
    const found = lookUpWalzCraftModel("S592");
    if (found.found) expect(found.style).toBe("S592 Barrington");
  });

  it("says plainly that an unknown model number is not in the catalog, and guesses nothing", () => {
    const miss = lookUpWalzCraftModel("S1234");
    expect(miss.found).toBe(false);
    if (miss.found) return;
    expect(miss.reason).not.toBe("no-number");
    expect(miss.message).toContain("is not in the WalzCraft catalog data");
    expect(miss.message).toContain("No profile is assumed");
    // Nothing like a nearest profile code comes back.
    expect(miss.message).not.toMatch(/\bS\d{3}\b/);
  });

  it("asks for a number instead of guessing when none is typed", () => {
    const blank = lookUpWalzCraftModel("");
    expect(blank.found).toBe(false);
    if (!blank.found) expect(blank.reason).toBe("no-number");
  });

  it("lists the catalog codes it can match", () => {
    const codes = walzCraftCatalogCodes();
    expect(codes).toContain("S592");
    expect(codes).toEqual([...codes].sort((a, b) => a.localeCompare(b, "en", { numeric: true })));
  });
});

describe("choosing a door profile image from a local folder", () => {
  it("finds the model number inside a file name", () => {
    expect(modelNumberInFileName("S592-barrington.jpg")).toBe("S592");
    expect(modelNumberInFileName("skyline_S615-castine.png")).toBe("S615");
    expect(modelNumberInFileName("door-2024-05-01.jpg")).toBeNull();
    expect(modelNumberInFileName("dover-white.jpg")).toBeNull();
  });

  it("auto-selects the file whose name carries the typed model number", () => {
    const chosen = selectFileForModel(skylineFolder, "S592");
    expect(chosen?.name).toBe("S592-barrington.jpg");
    expect(selectFileForModel(skylineFolder, "s615")).toBeNull();
    expect(selectFileForModel(skylineFolder, "s660")?.name).toBe("s660-hale.webp");
  });

  it("selects nothing rather than a guessed image when the number is not in the folder", () => {
    expect(selectFileForModel(skylineFolder, "S999")).toBeNull();
    // No typed number and several images: still no guess.
    expect(selectFileForModel(skylineFolder, "")).toBeNull();
    // No typed number and exactly one image: that image.
    expect(selectFileForModel({ files: [{ name: "door.jpg" }], folder: "Skyline" }, "")?.name).toBe("door.jpg");
  });

  it("matches a folder named for the model", () => {
    const pick = { files: [{ name: "door.jpg", path: "S592/door.jpg" }, { name: "drawer.jpg", path: "S592/drawer.jpg" }], folder: "S592" };
    expect(folderLabel(pick)).toBe("S592");
    const chosen = selectFileForModel(pick, "S592");
    // Two files in the S592 folder, so the choice is ambiguous and nothing is picked.
    expect(chosen).toBeNull();
  });

  it("turns a folder selection into the one image, with a note saying what happened", () => {
    const hit = selectFromSelection(
      [file("dover-white.jpg", "Skyline"), file("S592-barrington.jpg", "Skyline"), file("notes.txt", "Skyline")],
      "S592",
    );
    expect(hit.file?.name).toBe("S592-barrington.jpg");
    expect(hit.modelNumber).toBe("S592");
    expect(hit.catalogNote).toBeNull();
    expect(hit.note).toBe("Matched S592-barrington.jpg in Skyline.");

    const missed = selectFromSelection([file("dover-white.jpg", "Skyline")], "S1234");
    expect(missed.file).toBeNull();
    expect(missed.note).toContain("S1234 is not in the WalzCraft catalog data");
    expect(missed.note).toContain("Nothing was picked");

    // A catalog number that no file in the folder carries is also not guessed.
    const absent = selectFromSelection([file("dover-white.jpg", "Skyline")], "S660");
    expect(absent.file).toBeNull();
    expect(absent.note).toContain("No file in this selection carries model S660");
    expect(absent.note).toContain("Nothing was picked");

    const wrongFile = selectFromSelection([file("dover-white.jpg", "Skyline"), file("s660-hale.webp", "Skyline")], "S660");
    expect(wrongFile.file?.name).toBe("s660-hale.webp");

    const none = selectFromSelection([file("notes.txt", "Skyline")], "S592");
    expect(none.file).toBeNull();
    expect(none.note).toContain("holds no images");
  });

  it("records a profile image and says when the model number is not in the catalog", () => {
    const known = profileImageFromFile({ name: "S592-barrington.jpg", path: "Skyline/S592-barrington.jpg" }, "/uploads/s592.jpg", { modelNumber: "S592", folder: "Skyline" });
    expect(known).toMatchObject({ modelNumber: "S592", folder: "Skyline", fileName: "S592-barrington.jpg", inCatalog: true, catalogNote: null });
    const unknown = profileImageFromFile({ name: "x.jpg" }, "/uploads/x.jpg", { modelNumber: "S1234" });
    expect(unknown.inCatalog).toBe(false);
    expect(unknown.catalogNote).toContain("is not in the WalzCraft catalog data");
    const inferred = profileImageFromFile({ name: "S615-castine.png" }, "/uploads/s615.png");
    expect(inferred.modelNumber).toBe("S615");
    expect(inferred.inCatalog).toBe(true);
  });
});

describe("the uploaded image is offered again in the library", () => {
  it("keeps the chosen image for its door and for its model number", () => {
    const store = memory();
    const image = profileImageFromFile({ name: "S592-barrington.jpg" }, "/uploads/s592.jpg", { modelNumber: "S592", folder: "Skyline" });
    writeProfileImage(360001, image, store);
    expect(readProfileImage(360001, store)?.url).toBe("/uploads/s592.jpg");
    expect(readProfileImage("360001", store)?.modelNumber).toBe("S592");
    expect(readProfileImage(999999, store)).toBeNull();
    expect(readProfileImage(null, store)).toBeNull();
    const library = readProfileImageLibrary(store);
    expect(libraryImagesForModel("S592", library).map((entry) => entry.url)).toContain("/uploads/s592.jpg");
    expect(Object.keys(library)).toContain("style:360001");
    expect(Object.keys(library)).toContain("model:S592");
  });

  it("returns an empty library for a corrupt or hostile store", () => {
    expect(readProfileImageLibrary(memory({ [WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY]: "null" }))).toEqual({});
    expect(readProfileImageLibrary(memory({ [WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY]: "[]" }))).toEqual({});
    expect(readProfileImageLibrary(memory({ [WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY]: "{oops" }))).toEqual({});
    const filtered = readProfileImageLibrary(memory({ [WALZCRAFT_PROFILE_IMAGE_STORAGE_KEY]: JSON.stringify({ "style:1": { url: "" }, "style:2": { url: "/a.jpg", fileName: "a.jpg" } }) }));
    expect(Object.keys(filtered)).toEqual(["style:2"]);
  });

  it("removes an image when it is cleared", () => {
    const store = memory();
    writeProfileImage(21, profileImageFromFile({ name: "door.jpg" }, "/uploads/door.jpg"), store);
    expect(readProfileImage(21, store)).not.toBeNull();
    writeProfileImage(21, null, store);
    expect(readProfileImage(21, store)).toBeNull();
  });
});

describe("fallback rule: a door keeps its image", () => {
  const door = { id: 360001, doorSampleImageUrl: "/uploads/stone-gray.jpg", thumbnailImageUrl: "/uploads/stone-gray-thumb.jpg" };

  it("uses the wizard profile when one is present", () => {
    const store = memory();
    const image = profileImageFromFile({ name: "S592-barrington.jpg" }, "/uploads/s592.jpg", { modelNumber: "S592" });
    writeProfileImage(360001, image, store);
    expect(resolveDoorProfileImage(door, { stored: readProfileImage(360001, store) })).toEqual({ url: "/uploads/s592.jpg", source: "stored-profile" });
    expect(resolveDoorProfileImage({ ...door, profileImageUrl: "/uploads/live.jpg" }, { stored: null })).toEqual({ url: "/uploads/live.jpg", source: "wizard-profile" });
  });

  it("keeps the existing door image when the door has no profile, and never returns blank for a door with an image", () => {
    expect(resolveDoorProfileImage(door, { stored: null })).toEqual({ url: "/uploads/stone-gray.jpg", source: "door-sample" });
    expect(resolveDoorProfileImage({ id: 1, thumbnailImageUrl: "/uploads/t.jpg" }, { stored: null })).toEqual({ url: "/uploads/t.jpg", source: "thumbnail" });
    expect(resolveDoorProfileImage({ id: 1, doorSampleImageUrl: "   " }, { stored: null })).toEqual({ url: null, source: "none" });
    expect(resolveDoorProfileImage({ id: 1, doorSampleImageUrl: "/uploads/a.jpg" }, { stored: { ...profileImageFromFile({ name: "x" }, ""), url: "" } })).toEqual({ url: "/uploads/a.jpg", source: "door-sample" });
  });
});
