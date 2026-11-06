/**
 * Where a picture in the AI door-description section actually comes from.
 *
 * The section shows two kinds of picture and they are never the same thing:
 *
 *   - the door style's own saved sample photo, sent with Generate as the
 *     reference the model looks at
 *   - the door image Generate actually drew, from that photo and the model's
 *     description — this is the result Tom asked for
 *
 * The locally drawn vector door that used to sit under a generated description
 * is no longer a column's result. It was labelled "Library default", which read
 * as a result when it was only a sketch of the shipped profile; a column that
 * shows it says so in words beside its caption instead of badging it like a photo.
 */

export type AiDoorImageSource = "door-sample" | "generated" | "library-default";

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
    label: "Door photo sent",
    testId: "ai-door-source-door-sample",
  },
  generated: {
    kind: "generated",
    label: "AI generated",
    testId: "ai-door-source-generated",
  },
  "library-default": {
    kind: "library-default",
    label: "Library default",
    testId: "ai-door-source-library-default",
  },
};

/**
 * The badge for a picture, or null when there is no picture to label.
 *
 * A generated door carries its own URL, so it is badged from the image the server
 * returned. A saved sample is badged as the photo that was sent, never as a
 * result.
 */
export function aiDoorImageSourceLabel(source: AiDoorImageSource | null | undefined): AiDoorImageSourceLabel | null {
  if (!source) return null;
  return LABELS[source] ?? null;
}

/**
 * What the sample image slot is showing: the style's own saved photo, which is
 * the reference sent to the model. Empty means there is no photo to send.
 */
export function aiDoorSampleSource(savedSampleUrl: string | null | undefined): AiDoorImageSource | null {
  const url = (savedSampleUrl ?? "").trim();
  return url ? "door-sample" : null;
}

/**
 * The badge for a picture Generate drew. Only a real image URL earns it; the
 * locally drawn sketch never does.
 */
export function aiDoorGeneratedImageSource(generatedUrl: string | null | undefined): AiDoorImageSource | null {
  const url = (generatedUrl ?? "").trim();
  return url ? "generated" : null;
}

/**
 * A locally drawn vector door, which is a sketch of the library profile and not
 * a photograph. It is never badged; callers name it in words instead.
 */
export function aiDoorPreviewSource(): AiDoorImageSource {
  return "library-default";
}
