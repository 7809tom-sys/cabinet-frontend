/**
 * EditableText — renders text normally for visitors, but shows an inline
 * pencil-icon edit control for admins. Saves to the page_content table.
 *
 * Usage:
 *   <EditableText pageKey="home" field="hero_title" defaultValue="Your One-Stop Shop">
 *     {(value) => <h1 className="...">{value}</h1>}
 *   </EditableText>
 *
 * Or with a simpler pattern (renders a <span> by default):
 *   <EditableText pageKey="home" field="hero_badge" defaultValue="Trade Platform">
 *     {(v) => v}
 *   </EditableText>
 */
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePageContent } from "@/hooks/usePageContent";
import { Spinner } from "@/components/ui/spinner";

interface EditableTextProps {
  pageKey: string;
  field: string;
  defaultValue: string;
  /** Render prop: receives the current (possibly overridden) value */
  children: (value: string) => React.ReactNode;
  multiline?: boolean;
  className?: string;
}

export function EditableText({
  pageKey,
  field,
  defaultValue,
  children,
  multiline = false,
  className,
}: EditableTextProps) {
  const { get, hasOverride, upsert, reset, isAdmin } = usePageContent(pageKey);
  const currentValue = get(field, defaultValue);
  const overridden = hasOverride(field);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Keep draft in sync when saved value loads or changes
  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  // Focus when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing]);

  if (!isAdmin) {
    return <>{children(currentValue)}</>;
  }

  async function handleSave() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await upsert(field, trimmed);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await reset(field);
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
      setDraft(currentValue);
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
              rows={4}
              className="w-full rounded border border-blue-400 bg-white/95 px-2 py-1 text-sm text-gray-900 shadow-xl outline-none ring-2 ring-blue-400 resize-y min-w-[220px]"
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded border border-blue-400 bg-white/95 px-2 py-1 text-sm text-gray-900 shadow-xl outline-none ring-2 ring-blue-400 min-w-[220px]"
            />
          )}
          <span className="flex gap-1 items-center flex-wrap">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Spinner className="h-3 w-3" /> : <Check size={12} />}
              Save
            </button>
            <button
              onClick={() => { setDraft(currentValue); setEditing(false); }}
              className="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300"
            >
              <X size={12} /> Cancel
            </button>
            {overridden && (
              <button
                onClick={handleReset}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                title="Reset to default"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </span>
        </span>
      ) : (
        <span className="relative inline-flex items-center gap-0.5">
          {children(currentValue)}
          <button
            onClick={() => { setDraft(currentValue); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity z-50 rounded bg-blue-600 p-0.5 text-white shadow-md hover:bg-blue-700 shrink-0 ml-0.5"
            title={`Edit "${field}"`}
          >
            <Pencil size={10} />
          </button>
          {overridden && (
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 font-medium">edited</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
