import { Badge } from "@/components/ui/badge";
import { inheritedVendorZipSummary, normalizeShippingOriginZips } from "@shared/styleOriginInheritance";

/**
 * Read-only effective warehouse ZIPs for a style that inherits vendor coverage.
 * Visually distinct from a style's own removable origin badges: dashed outline, no remove control.
 */
export function InheritedVendorOriginZips({
  zips,
  compact = false,
}: {
  zips: readonly (string | null | undefined)[] | null | undefined;
  compact?: boolean;
}) {
  const vendorZips = normalizeShippingOriginZips(zips);
  const summary = inheritedVendorZipSummary(vendorZips);
  if (!summary) return null;
  return (
    <div
      data-testid="inherited-vendor-zips"
      className={compact ? "flex min-w-0 flex-wrap items-center gap-1" : "space-y-1.5"}
    >
      <p className={compact ? "text-[10px] font-medium text-violet-950" : "text-xs font-medium text-violet-950"}>
        {summary}
      </p>
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {vendorZips.map((zip) => (
          <Badge
            key={zip}
            variant="outline"
            data-testid="inherited-vendor-zip"
            className="border-dashed border-violet-400 bg-violet-50 py-1 text-violet-900"
          >
            {zip}
          </Badge>
        ))}
      </div>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">
          Read-only. These follow the vendor cabinet warehouse coverage and are not copied onto this style.
        </p>
      )}
    </div>
  );
}
