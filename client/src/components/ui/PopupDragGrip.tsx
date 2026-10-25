import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";

export function PopupDragGrip({ className }: { className?: string }) {
  return (
    <button
      type="button"
      data-popup-drag-grip="true"
      data-popup-drag-handle="true"
      aria-label="Drag to move this popup"
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
      title="Drag to move"
      className={cn("inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 active:cursor-grabbing active:scale-95 [&_svg]:pointer-events-none", className)}
      // Pointer-up remains available to the popup content so it can finish and
      // remember a drag. The synthesized click that follows a completed drag
      // is not an activation and must not bubble into a dismiss handler.
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <GripVertical className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
