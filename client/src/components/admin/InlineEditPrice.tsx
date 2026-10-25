/**
 * InlineEditPrice — admin-only inline price editor.
 *
 * Usage:
 *   <InlineEditPrice
 *     value={cabinet.listPrice}
 *     onSave={(v) => updateMut.mutate({ id: cabinet.id, listPrice: v })}
 *     label="List price"
 *   >
 *     <span>${cabinet.listPrice.toFixed(2)}</span>
 *   </InlineEditPrice>
 *
 * Shows a pencil icon on hover (admin only). Clicking opens an inline numeric
 * input with a $ prefix. Saving calls onSave(newValue).
 */
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

interface InlineEditPriceProps {
  /** Current price value (dollars, e.g. 299.99) */
  value: number;
  onSave: (newValue: number) => Promise<void> | void;
  label?: string;
  className?: string;
  /** Render the display content */
  children: React.ReactNode;
  /** Minimum allowed value (default 0) */
  min?: number;
  /** Maximum allowed value */
  max?: number;
}

export function InlineEditPrice({
  value,
  onSave,
  label,
  className,
  children,
  min = 0,
  max,
}: InlineEditPriceProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep draft in sync when value prop changes externally
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!isAdmin) return <>{children}</>;

  const parsedDraft = parseFloat(draft);
  const isValid = !isNaN(parsedDraft) && parsedDraft >= min && (max === undefined || parsedDraft <= max);

  async function handleSave() {
    if (!isValid) return;
    if (parsedDraft === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(parsedDraft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setDraft(String(value)); setEditing(false); }
  }

  return (
    <span className={cn("group relative inline-block", className)}>
      {editing ? (
        <span className="inline-flex items-center gap-1">
          <span className="text-sm text-gray-500 font-medium">$</span>
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            min={min}
            max={max}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-24 rounded border border-blue-400 bg-white px-2 py-0.5 text-sm text-gray-900 shadow-lg outline-none ring-2 ring-blue-400",
              !isValid && "border-red-400 ring-red-400"
            )}
          />
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check size={11} />}
          </button>
          <button
            onClick={() => { setDraft(String(value)); setEditing(false); }}
            className="flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-200"
          >
            <X size={11} />
          </button>
        </span>
      ) : (
        <span className="relative inline-flex items-center gap-1">
          {children}
          <button
            onClick={() => { setDraft(String(value)); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity z-50 rounded bg-blue-600 p-0.5 text-white shadow-md hover:bg-blue-700 shrink-0 ml-0.5"
            title={label ? `Edit ${label}` : "Edit price"}
          >
            <Pencil size={10} />
          </button>
        </span>
      )}
    </span>
  );
}
