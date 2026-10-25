import { Loader2, Truck } from "lucide-react";

export function FreightCalculatingStatus({
  upsRequested = false,
  compact = false,
}: {
  upsRequested?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Calculating freight"
      className={compact
        ? "flex items-center gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-primary"
        : "flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-primary shadow-sm"}
    >
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden="true">
        <span className="absolute inset-1 rounded-full bg-primary/15 motion-safe:animate-ping" />
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-primary/30 bg-background">
          <Loader2 className="h-5 w-5 animate-spin" />
          <Truck className="absolute h-3 w-3" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Calculating freight...</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {upsRequested
            ? "Checking UPS with the cart’s package dimensions and weight. If UPS cannot rate it, the LTL estimate will appear automatically."
            : "Calculating package dimensions, loaded weight, and the available shipping rate. This can take up to 30 seconds."}
        </p>
      </div>
    </div>
  );
}
