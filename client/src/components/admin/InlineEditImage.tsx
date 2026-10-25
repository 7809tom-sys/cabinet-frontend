/**
 * InlineEditImage — admin-only inline image editor.
 *
 * Usage:
 *   <InlineEditImage
 *     value={style.thumbnailImageUrl ?? ""}
 *     onSave={(url) => updateMut.mutate({ id: style.id, thumbnailImageUrl: url })}
 *     label="Thumbnail"
 *   >
 *     <img src={style.thumbnailImageUrl} alt="Thumbnail" />
 *   </InlineEditImage>
 *
 * Shows a camera icon overlay on hover (admin only). Clicking opens a popover
 * with a URL input and file upload option. Saving calls onSave(newUrl).
 */
import { useState } from "react";
import { Camera, Check, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { MediaPicker } from "@/components/admin/MediaPicker";

interface InlineEditImageProps {
  value: string;
  onSave: (newUrl: string) => Promise<void> | void;
  label?: string;
  className?: string;
  /** Render the display content (the image) */
  children: React.ReactNode;
  /** Accept attribute for file input, defaults to "image/*" */
  accept?: string;
}

export function InlineEditImage({
  value,
  onSave,
  label,
  className,
  children,
  accept = "image/*",
}: InlineEditImageProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  if (!isAdmin) return <>{children}</>;

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className={cn("group relative inline-block", className)}>
      {/* Camera icon overlay */}
      {!editing && (
        <button
          onClick={() => { setDraft(value); setEditing(true); }}
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 bg-black/40 rounded"
          title={label ? `Edit ${label}` : "Edit image"}
        >
          <Camera className="h-5 w-5 text-white drop-shadow" />
        </button>
      )}
      {children}
      {editing && (
        <div className="absolute left-0 top-full mt-1 z-50 w-96 rounded-lg border border-border bg-white shadow-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-700">{label ? `Edit ${label}` : "Edit image"}</p>
          {/* MediaPicker: handles library browsing, upload, and URL paste */}
          <MediaPicker
            value={draft}
            onChange={(url) => setDraft(url)}
            label={label}
          />
          {/* Save / Cancel */}
          <div className="flex gap-1.5 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={11} />
              Save
            </button>
            <button
              onClick={() => { setDraft(value); setEditing(false); }}
              className="flex items-center gap-1 rounded bg-gray-100 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-200"
            >
              <X size={11} /> Cancel
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
