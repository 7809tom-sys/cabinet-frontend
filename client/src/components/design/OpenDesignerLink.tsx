import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { designerWorkspaceHref } from "@/lib/designerFreshStart";

/**
 * Opens a new Designer tab on a fresh floor plan for this door style.
 * A missing door style still starts a new design (header fallback).
 */
export function OpenDesignerLink({
  doorStyleId = null,
  distributorId = null,
  className,
  label = "Open Designer",
  ariaLabel,
}: {
  doorStyleId?: number | null;
  distributorId?: number | null;
  className?: string;
  label?: string;
  ariaLabel?: string;
}) {
  return (
    <Button asChild size="sm" variant="outline" className={className ?? "h-8 shrink-0 gap-1.5"}>
      <a
        href={designerWorkspaceHref({ doorStyleId, distributorId })}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={ariaLabel ?? label}
        data-testid="open-designer-link"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {label}
      </a>
    </Button>
  );
}
