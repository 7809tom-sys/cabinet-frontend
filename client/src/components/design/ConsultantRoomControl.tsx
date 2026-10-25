import React from "react";
import { Sparkles } from "lucide-react";

export function ConsultantRoomControl({
  open,
  onToggle,
  label,
  compact = false,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  compact?: boolean;
}) {
  const size = compact ? "h-7 w-7" : "h-8 w-8";
  return (
    <button
      type="button"
      data-designer-control="consultant-room-controls"
      className={`inline-flex items-center justify-center ${size} rounded-md border transition-colors shrink-0 ${open ? "bg-[#1a2744] border-[#1a2744] text-white" : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"}`}
      onClick={onToggle}
      title={label}
      aria-label={label}
    >
      <Sparkles className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </button>
  );
}
