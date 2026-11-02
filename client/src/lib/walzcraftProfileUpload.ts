import { trpc } from "@/lib/trpc";

/**
 * The existing media library upload, called from the door-editor wizard.
 *
 * `mediaLibrary.upload` already ships on the backend and is what MediaPicker and
 * MediaLibraryAdmin use. This repo typechecks without the backend's AppRouter, so the
 * client is cast the same way the other frontend-only callers do. No new endpoint is
 * added here: this is the same `label / dataBase64 / contentType` call MediaPicker makes
 * and it returns the same `{ url }`.
 */
export type MediaLibraryUploadInput = {
  label: string;
  dataBase64: string;
  contentType: string;
};

export type MediaLibraryUploadResult = { url: string };

type MediaLibraryUploadMutation = {
  mutateAsync: (input: MediaLibraryUploadInput) => Promise<MediaLibraryUploadResult>;
  isPending: boolean;
};

export function useMediaLibraryUpload(): MediaLibraryUploadMutation {
  const client = trpc as unknown as {
    mediaLibrary: { upload: { useMutation: () => MediaLibraryUploadMutation } };
  };
  return client.mediaLibrary.upload.useMutation();
}

/** Reads one file as a data URL for the upload call. */
export function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
