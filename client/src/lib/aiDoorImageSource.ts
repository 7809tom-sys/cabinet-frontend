/**
 * Where a picture in the AI door-description section actually comes from.
 *
 * The section shows two different pictures and they are not the same thing:
 *
 *   - the door style's own saved sample photo, when the style has one
 *   - the library default profile/3D door preview, drawn from the shipped
 *     blueprint's geometry when the description does not state a value
 *
 * Nothing in this section is produced by an AI image call. The Generate button
 * asks a model for *text*; the picture beside it is drawn locally. So an
 * "AI generated" label is only ever allowed for a source that really is an AI
 * image, and there is no such source today.
 */

export type AiDoorImageSource = "door-sample" | "library-default" | "ai-generated";

export type AiDoorImageSourceLabel = {
  kind: AiDoorImageSource;
  /** Visible badge text. */
  label: string;
  /** Stable hook for tests and for the badge's own title. */
  testId: string;
};

const LABELS: Record<AiDoorImageSource, AiDoorImageSourceLabel> = {
  "door-sample": {
    kind: "door-sample",
    label: "Door sample photo",
    testId: "ai-door-source-door-sample",
  },
  "library-default": {
    kind: "library-default",
    label: "Library default",
    testId: "ai-door-source-library-default",
  },
  "ai-generated": {
    kind: "ai-generated",
    label: "AI generated",
    testId: "ai-door-source-ai-generated",
  },
};

/**
 * The badge for a picture, or null when there is no picture to label.
 *
 * `sampleUrl` is the door style's own saved sample photo. A preview drawn from
 * the library default profile has no URL of its own, so it is labelled from its
 * own source and never claims to be a photo of the door.
 */
export function aiDoorImageSourceLabel(source: AiDoorImageSource | null | undefined): AiDoorImageSourceLabel | null {
  if (!source) return null;
  return LABELS[source] ?? null;
}

/**
 * What the sample image slot is showing.
 *
 * `savedSampleUrl` is the style's own saved photo. When it is empty the section
 * has no photo at all and falls back to the library default drawing, which is
 * also why an absent sample never gets a photo label.
 */
export function aiDoorSampleSource(savedSampleUrl: string | null | undefined): AiDoorImageSource | null {
  const url = (savedSampleUrl ?? "").trim();
  return url ? "door-sample" : null;
}

/**
 * Every picture inside the section is a local vector draw from the library
 * default profile. It is never an AI image, so it is always labelled
 * "Library default".
 */
export function aiDoorPreviewSource(): AiDoorImageSource {
  return "library-default";
}
