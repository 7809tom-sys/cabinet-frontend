import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { glassPolicyForProduct } from "@/lib/glassPolicy";

/**
 * A compact catalog disclosure for items governed by a distributor's glass policy.
 * It intentionally renders nothing for ordinary cabinet nomenclature.
 */
export function GlassPolicyBadge({
  masterCode,
  glassIncluded,
  className = "",
}: {
  masterCode?: string | null;
  glassIncluded?: boolean | null;
  className?: string;
}) {
  const policy = glassPolicyForProduct(masterCode, glassIncluded);
  if (!policy) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          aria-label={policy.tooltip}
          data-testid="glass-policy-badge"
          className={`inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${className}`}
        >
          <Badge
            variant="outline"
            className={policy.included
              ? "border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
              : "border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}
          >
            {policy.label}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="max-w-60 leading-snug">
        {policy.tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
