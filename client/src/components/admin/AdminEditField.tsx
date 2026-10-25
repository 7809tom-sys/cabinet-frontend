/**
 * AdminEditField — inline editable text for admin users.
 *
 * Usage:
 *   <AdminEditField pageKey="home" field="hero_title" defaultValue="Welcome to Cabinet Dealz">
 *     {(value) => <h1>{value}</h1>}
 *   </AdminEditField>
 *
 * When the user is an admin, a pencil icon appears on hover.
 * Clicking it opens an inline textarea to edit the value.
 * The change is saved to the page_content table via tRPC.
 */
import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

interface AdminEditFieldProps {
  pageKey: string;
  field: string;
  defaultValue: string;
  /** Render prop — receives the current (possibly overridden) value */
  children: (value: string) => React.ReactNode;
  /** Optional: multiline textarea vs single-line input */
  multiline?: boolean;
  className?: string;
}

export function AdminEditField({
  pageKey,
  field,
  defaultValue,
  children,
  multiline = false,
  className,
}: AdminEditFieldProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Load the saved override for this page
  const { data: pageData, refetch } = trpc.pageContent.getPage.useQuery(
    { pageKey },
    { enabled: isAdmin },
  );

  const savedValue = pageData?.[field];
  const currentValue = savedValue ?? defaultValue;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentValue);
  const textRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  // Keep draft in sync when saved value loads
  useEffect(() => {
    if (!editing) setDraft(currentValue);
  }, [currentValue, editing]);

  const upsert = trpc.pageContent.upsertField.useMutation({
    onSuccess: () => { refetch(); setEditing(false); },
  });
  const reset = trpc.pageContent.resetField.useMutation({
    onSuccess: () => { refetch(); setEditing(false); },
  });

  const handleSave = () => {
    upsert.mutate({ pageKey, field, value: draft });
  };
  const handleReset = () => {
    reset.mutate({ pageKey, field });
  };
  const handleCancel = () => {
    setDraft(currentValue);
    setEditing(false);
  };

  // Focus textarea when editing starts
  useEffect(() => {
    if (editing && textRef.current) textRef.current.focus();
  }, [editing]);

  if (!isAdmin) {
    return <>{children(currentValue)}</>;
  }

  return (
    <span className={cn("group relative inline-block", className)}>
      {editing ? (
        <span className="inline-flex flex-col gap-1 w-full">
          {multiline ? (
            <textarea
              ref={textRef as React.Ref<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="w-full rounded border border-blue-400 bg-white/90 px-2 py-1 text-sm text-gray-900 shadow-lg outline-none ring-2 ring-blue-400 resize-y min-w-[200px]"
            />
          ) : (
            <input
              ref={textRef as React.Ref<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full rounded border border-blue-400 bg-white/90 px-2 py-1 text-sm text-gray-900 shadow-lg outline-none ring-2 ring-blue-400 min-w-[200px]"
            />
          )}
          <span className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={upsert.isPending}
              className="flex items-center gap-1 rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={12} /> Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-300"
            >
              <X size={12} /> Cancel
            </button>
            {savedValue && (
              <button
                onClick={handleReset}
                disabled={reset.isPending}
                className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-200 disabled:opacity-50"
                title="Reset to default"
              >
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </span>
        </span>
      ) : (
        <span className="relative">
          {children(currentValue)}
          <button
            onClick={() => { setDraft(currentValue); setEditing(true); }}
            className="absolute -top-1 -right-6 opacity-0 group-hover:opacity-100 transition-opacity z-50 rounded bg-blue-600 p-1 text-white shadow-md hover:bg-blue-700"
            title={`Edit "${field}"`}
          >
            <Pencil size={12} />
          </button>
          {savedValue && (
            <span className="absolute -top-1 -right-12 opacity-0 group-hover:opacity-100 transition-opacity z-50">
              <span className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700 font-medium">edited</span>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
