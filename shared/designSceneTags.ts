/**
 * Tags a generated room scene should keep with the design that produced it.
 *
 * The Designer image test (Gemini / Nano Banana, `designPhotoRenders.startGeminiImageTest`)
 * stores a plan fingerprint, design id, camera, and material manifest. It does
 * not store the layout shape. Door-style room scene rows (`room_scene` photos
 * on a style) store `styleId`, scene name, and optional cabinet/style id lists.
 * They do not store the layout shape either.
 *
 * These fields are the proposed addition: persist them on the saved design and
 * copy them onto the image-test provenance and the room-scene row when Tom
 * saves a perfect run from the Designer. This frontend does not call image
 * generation.
 */
export type DesignSceneTags = {
  layoutShape: "galley" | "l-shape" | "u-shape" | "single-wall" | "peninsula";
  doorStyleId: number;
  doorStyleName: string;
  seed: string;
  roomWidthIn: number;
  roomDepthIn: number;
};
