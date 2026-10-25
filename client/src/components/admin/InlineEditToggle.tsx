/**
 * InlineEditToggle — admin-only inline boolean toggle.
 *
 * Usage:
 *   <InlineEditToggle
 *     value={style.isFeatured}
 *     onToggle={(v) => setFeaturedMut.mutate({ id: style.id, featured: v })}
 *     label="Featured"
 *     activeLabel="Featured"
 *     inactiveLabel="Not featured"
 *   />
 *
 * Renders a clickable badge/chip that toggles the boolean value on click
 * (admin only). Optionally wraps children with the toggle affordance.
 */
import { useState } from "react";
import { Star, StarOff, Loader2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { cn } from "@/lib/utils";

interface InlineEditToggleProps {
  value: boolean;
  onToggle: (newValue: boolean) => Promise<void> | void;
  label?: string;
  /** Text shown when value is true */
  activeLabel?: string;
  /** Text shown when value is false */
  inactiveLabel?: string;
  className?: string;
  /** If provided, wraps children instead of rendering a standalone badge */
  children?: React.ReactNode;
  /** Icon for active state */
  activeIcon?: React.ComponentType<{ className?: string }>;
  /** Icon for inactive state */
  inactiveIcon?: React.ComponentType<{ className?: string }>;
}

export function InlineEditToggle({
  value,
  onToggle,
  label,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  className,
  children,
  activeIcon: ActiveIcon = Star,
  inactiveIcon: InactiveIcon = StarOff,
}: InlineEditToggleProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    if (children) return <>{children}</>;
    return null;
  }

  async function handleToggle() {
    if (saving) return;
    setSaving(true);
    try {
      await onToggle(!value);
    } finally {
      setSaving(false);
    }
  }

  if (children) {
    // Wrap children with a toggle overlay
    return (
      <span className={cn("group relative inline-block", className)}>
        {children}
        <button
          onClick={handleToggle}
          disabled={saving}
          className={cn(
            "absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md transition-all",
            value
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "bg-gray-200 text-gray-500 hover:bg-gray-300 opacity-0 group-hover:opacity-100"
          )}
          title={label ?? (value ? `Unset ${activeLabel}` : `Set ${activeLabel}`)}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : value ? (
            <ActiveIcon className="h-3 w-3" />
          ) : (
            <InactiveIcon className="h-3 w-3" />
          )}
        </button>
      </span>
    );
  }

  // Standalone badge
  return (
    <button
      onClick={handleToggle}
      disabled={saving}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all",
        value
          ? "bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200"
          : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200",
        className
      )}
      title={label ?? (value ? `Click to unset ${activeLabel}` : `Click to set ${activeLabel}`)}
    >
      {saving ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : value ? (
        <ActiveIcon className="h-3 w-3" />
      ) : (
        <InactiveIcon className="h-3 w-3" />
      )}
      {value ? activeLabel : inactiveLabel}
    </button>
  );
}
