// ─── Storefront Template Preview ─────────────────────────────────────────────
// Renders a live, full-page preview of a storefront template using mock data.
// Accessible at /store-preview/:template for every approved affiliate layout.
// Used by the "Add Affiliate" dialog so admins can see each template before picking.

import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "lucide-react";
import Storefront from "@/pages/Storefront";
import {
  AFFILIATE_STOREFRONT_TEMPLATE_IDS,
  AFFILIATE_STOREFRONT_TEMPLATES,
  isAffiliateStorefrontTemplate,
  type AffiliateStorefrontTemplate,
} from "@shared/affiliateStorefrontTemplates";

const TEMPLATE_NAMES = Object.fromEntries(
  AFFILIATE_STOREFRONT_TEMPLATES.map((item) => [item.id, item.name])
) as Record<AffiliateStorefrontTemplate, string>;

export default function StorefrontPreview({ template }: { template: string }) {
  const id = isAffiliateStorefrontTemplate(template) ? template : "classic";

  const { data, isLoading } = trpc.affiliates.previewTemplate.useQuery({ template: id });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Preview banner */}
      <div className="sticky top-0 z-[100] bg-[#1a2b4a] text-white px-4 py-2.5 flex items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <button className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </button>
          </Link>
          <span className="text-white/40">|</span>
          <span className="text-sm font-medium">
            Template Preview:{" "}
            <span className="text-[#c9a227] font-semibold">{TEMPLATE_NAMES[id]}</span>
          </span>
          <span className="text-xs bg-[#c9a227]/20 text-[#c9a227] border border-[#c9a227]/30 rounded px-2 py-0.5">
            Demo Data
          </span>
        </div>
        <div className="flex items-center gap-2">
          {AFFILIATE_STOREFRONT_TEMPLATE_IDS.filter((t) => t !== id).map((t) => (
            <Link key={t} href={`/store-preview/${t}`}>
              <button className="text-xs text-white/70 hover:text-white px-2.5 py-1 rounded border border-white/20 hover:border-white/50 transition-colors">
                {TEMPLATE_NAMES[t]}
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* Full storefront rendered with mock data */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 min-h-[60vh]">
          <Spinner className="h-8 w-8" />
        </div>
      ) : data ? (
        <Storefront slug={`preview-${id}`} previewData={data} />
      ) : (
        <div className="container py-24 text-center text-muted-foreground">
          Preview unavailable.
        </div>
      )}
    </div>
  );
}
