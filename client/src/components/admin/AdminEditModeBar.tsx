/**
 * AdminEditModeBar — A slim, fixed top bar visible only to admins.
 * Signals that inline edit controls are active on the current page.
 * Renders nothing for non-admins so it has zero impact on customers.
 */
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Pencil, X, ChevronRight } from "lucide-react";
import { Link } from "wouter";

export function AdminEditModeBar() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (!user || (user as any).role !== "admin") return null;
  if (dismissed) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between gap-2 px-4 py-1.5 text-xs font-medium"
      style={{
        background: "linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)",
        color: "#fff",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    >
      <div className="flex items-center gap-2">
        <Pencil className="h-3.5 w-3.5 shrink-0" />
        <span className="font-semibold tracking-wide uppercase text-[10px] opacity-80">Admin Edit Mode</span>
        <span className="hidden sm:inline opacity-70">·</span>
        <span className="hidden sm:inline opacity-70">
          Hover over any text, price, or image to reveal inline edit controls
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/admin"
          className="hidden sm:inline-flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity"
        >
          Admin Panel <ChevronRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          aria-label="Dismiss admin bar"
          onClick={() => setDismissed(true)}
          className="opacity-70 hover:opacity-100 transition-opacity p-0.5 rounded"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
