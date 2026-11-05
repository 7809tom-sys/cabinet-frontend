import { ExternalLink, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contractorPreviewHref, contractorPreviewUsesStaffMode } from "@/lib/contractorScope";

type Props = {
  /** Signed-in role. Partner/admin resolve to the real staff-preview portal. */
  role: string | null | undefined;
  /** This store's slug, carried onto the preview URL as ?store=. */
  storeSlug?: string | null;
  /** Optional click hook; navigation stays a plain link so opening in a new tab works. */
  className?: string;
};

/**
 * Prominent entry point to the view-only contractor portal. Nothing here can
 * change contractor data: staff-preview disables every write control, and the
 * sample fallback never talks to the contractor procedures at all.
 */
export function ContractorPreviewCard({ role, storeSlug, className = "" }: Props) {
  const href = contractorPreviewHref(role, storeSlug);
  const staffMode = contractorPreviewUsesStaffMode(role);
  return (
    <section
      data-testid="affiliate-contractor-preview"
      aria-labelledby="affiliate-contractor-preview-heading"
      className={`rounded-xl border border-amber-300 bg-amber-50 p-5 ${className}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-lg bg-amber-100 p-2.5">
            <HardHat className="h-5 w-5 text-amber-900" />
          </span>
          <div>
            <h2 id="affiliate-contractor-preview-heading" className="font-semibold text-amber-950">
              Preview the contractor page
            </h2>
            <p className="mt-1 max-w-xl text-sm text-amber-900">
              Open the portal your contractors sign in to. The preview is view-only — it can&rsquo;t add customers,
              assign designs, save labor estimates, or change contractor data.
            </p>
          </div>
        </div>
        <Button
          asChild
          size="lg"
          className="shrink-0 gap-2 bg-amber-900 text-white hover:bg-amber-900/90"
          data-testid="affiliate-contractor-preview-button"
        >
          <a href={href} target="_blank" rel="noopener noreferrer" title="Opens the view-only contractor portal in a new tab">
            Preview contractor page <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      </div>
      <p className="mt-3 text-xs text-amber-900/80">
        {staffMode
          ? "A yellow banner marks the contractor portal as preview mode, and a link there brings you back to this dashboard."
          : "This login can't load a contractor's records, so the preview shows sample data."}
      </p>
    </section>
  );
}
