/**
 * InlineEditText — admin-only inline text editor for any string field.
 *
 * Usage:
 *   <InlineEditText
 *     value={style.ourName ?? ""}
 *     onSave={(v) => updateMut.mutate({ id: style.id, ourName: v })}
 *     label="Style name"
 *   >
 *     <span>{style.ourName}</span>
 *   </InlineEditText>
 *
 * The pencil icon appears on hover (admin only). Clicking opens an inline
 * input/textarea. Saving calls onSave(newValue). Cancel restores the original.
 */
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

interface InlineEditTextProps {
  value: string;
  onSave: (newValue: string) => Promise<void> | void;
  label?: string;
  multiline?: boolean;
  className?: string;
  /** Render the display content */
  children: React.ReactNode;
  /** Extra classes for the edit input */
  inputClassName?: string;
  /** Minimum width for the input */
  minWidth?: string;
}

export function InlineEditText({
  value,
  onSave,
  label,
  multiline = false,
  className,
  children,
  inputClassName,
  minWidth = "180px",
}: InlineEditTextProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Keep draft in sync when value prop changes externally
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // Focus when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  }

  return (
    <span className={cn("group relative inline-block", className)}>
      {editing ? (
        <span className="inline-flex flex-col gap-1 w-full">
          {multiline ? (
            <textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              style={{ minWidth }}
              className={cn(
                "w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 shadow-lg outline-none ring-2 ring-blue-400 resize-y",
                inputClassName
              )}
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ minWidth }}
              className={cn(
                "w-full rounded border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 shadow-lg outline-none ring-2 ring-blue-400",
                inputClassName
              )}
            />
          )}
          <span className="flex gap-1 items-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Spinner className="h-3 w-3" /> : <Check size={12} />}
              Save
            </button>
            <button
              onClick={() => { setDraft(value); setEditing(false); }}
              className="flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
            >
              <X size={12} /> Cancel
            </button>
          </span>
        </span>
      ) : (
        <span className="relative inline-flex items-center gap-1">
          {children}
          <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity z-50 rounded bg-blue-600 p-0.5 text-white shadow-md hover:bg-blue-700 shrink-0 ml-0.5"
            title={label ? `Edit ${label}` : "Edit"}
          >
            <Pencil size={10} />
          </button>
        </span>
      )}
    </span>
  );
}
