/**
 * InlineEditDropdown — admin-only inline dropdown/select editor.
 *
 * Usage:
 *   <InlineEditDropdown
 *     value={cabinet.category}
 *     options={[
 *       { value: "base", label: "Base Cabinet" },
 *       { value: "wall", label: "Wall Cabinet" },
 *     ]}
 *     onSave={(v) => updateMut.mutate({ id: cabinet.id, category: v })}
 *     label="Category"
 *   >
 *     <span>{cabinet.category}</span>
 *   </InlineEditDropdown>
 *
 * Shows a pencil icon on hover (admin only). Clicking opens a popover with a
 * searchable list. Saving calls onSave(newValue).
 */
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface InlineEditDropdownProps {
  value: string;
  options: Option[];
  onSave: (newValue: string) => Promise<void> | void;
  label?: string;
  className?: string;
  /** Render the display content */
  children: React.ReactNode;
  /** Allow free-text entry in addition to options */
  allowCustom?: boolean;
  placeholder?: string;
}

export function InlineEditDropdown({
  value,
  options,
  onSave,
  label,
  className,
  children,
  allowCustom = false,
  placeholder = "Search...",
}: InlineEditDropdownProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && searchRef.current) {
      searchRef.current.focus();
    }
  }, [editing]);

  // Close on outside click
  useEffect(() => {
    if (!editing) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editing]);

  if (!isAdmin) return <>{children}</>;

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSelect(val: string) {
    if (val === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(val);
      setEditing(false);
      setSearch("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span ref={containerRef} className={cn("group relative inline-block", className)}>
      {editing ? (
        <span className="inline-block">
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-border bg-white shadow-xl p-2 space-y-1.5">
            <p className="text-xs font-semibold text-gray-700 px-1">{label ? `Select ${label}` : "Select value"}</p>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder={placeholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
                className="w-full rounded border border-gray-200 pl-6 pr-2 py-1 text-xs text-gray-900 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
            {/* Options list */}
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-2">No options found</p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handleSelect(o.value)}
                    disabled={saving}
                    className={cn(
                      "w-full text-left rounded px-2 py-1 text-xs transition-colors",
                      o.value === value
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    {saving && o.value === value ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                      </span>
                    ) : (
                      o.label
                    )}
                  </button>
                ))
              )}
            </div>
            {/* Custom value entry */}
            {allowCustom && search && !options.some((o) => o.value === search) && (
              <button
                onClick={() => handleSelect(search)}
                disabled={saving}
                className="w-full text-left rounded px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 border-t border-gray-100 mt-1 pt-1.5"
              >
                Use &ldquo;{search}&rdquo;
              </button>
            )}
            {/* Cancel */}
            <div className="pt-1 border-t border-gray-100">
              <button
                onClick={() => { setEditing(false); setSearch(""); }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-1"
              >
                <X size={10} /> Cancel
              </button>
            </div>
          </div>
          {children}
        </span>
      ) : (
        <span className="relative inline-flex items-center gap-1">
          {children}
          <button
            onClick={() => { setSearch(""); setEditing(true); }}
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
