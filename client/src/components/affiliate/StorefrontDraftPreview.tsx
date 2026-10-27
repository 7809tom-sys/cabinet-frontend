import { StorefrontSocialIcons } from "@/components/storefront/StorefrontSocialIcons";
import { storefrontCssVars, DEFAULT_SECTION_LABELS, type SectionLabelKey } from "@shared/affiliateStorefrontControls";
import type { PublicAffiliateSocialLink } from "@shared/affiliateSocialLinks";

export type StorefrontDraft = {
  storeName?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  logoDarkUrl?: string | null;
  faviconUrl?: string | null;
  heroImageUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  backgroundColor?: string | null;
  textColor?: string | null;
  fontFamily?: string | null;
  headingFont?: string | null;
  buttonRadius?: string | null;
  footerText?: string | null;
  publicEmail?: string | null;
  publicPhone?: string | null;
  publicAddress?: string | null;
  serviceArea?: string | null;
  showPublicEmail?: boolean;
  showPublicPhone?: boolean;
  showPublicAddress?: boolean;
  hidePlatformBranding?: boolean;
  sectionLabels?: Partial<Record<SectionLabelKey, string>>;
};

/** Live portal preview of the customer-facing storefront. Social icons render in the reserved slot from the Marketing Hub. */
export default function StorefrontDraftPreview({ draft, socialLinks = [] }: { draft: StorefrontDraft; socialLinks?: PublicAffiliateSocialLink[] }) {
  const vars = storefrontCssVars(draft);
  const labels = { ...DEFAULT_SECTION_LABELS, ...draft.sectionLabels };
  const logo = draft.logoUrl || draft.logoDarkUrl;
  const contact = [
    draft.showPublicEmail ? draft.publicEmail : null,
    draft.showPublicPhone ? draft.publicPhone : null,
    draft.showPublicAddress ? draft.publicAddress : null,
    draft.serviceArea,
  ].filter(Boolean);
  return (
    <div className="overflow-hidden rounded-lg border" style={{ ...vars, background: "var(--sf-bg, #fff)", color: "var(--sf-text, #1a1a1a)", fontFamily: "var(--sf-font-body, inherit)" }} data-testid="storefront-draft-preview">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          {logo ? <img src={logo} alt="" className="h-8 w-auto max-w-[120px] object-contain" /> : <span className="text-sm font-semibold" style={{ fontFamily: "var(--sf-font-heading, inherit)" }}>{draft.storeName || "Your store"}</span>}
        </div>
        <div className="hidden gap-3 text-xs sm:flex">
          <span>{labels.catalog}</span>
          <span>{labels.designer}</span>
          <span>{labels.quote}</span>
        </div>
        <span data-testid="social-links-slot" className="inline-flex items-center">
          <StorefrontSocialIcons links={socialLinks} />
        </span>
      </div>
      <div className="relative min-h-36 px-4 py-8" style={{ background: draft.heroImageUrl ? `center/cover url(${draft.heroImageUrl})` : "var(--sf-primary)" }}>
        <div className="max-w-md rounded-md bg-white/90 p-4 text-neutral-900">
          <h3 className="text-xl font-semibold" style={{ fontFamily: "var(--sf-font-heading, inherit)", color: "var(--sf-primary)" }}>{draft.storeName || "Your store"}</h3>
          <p className="mt-1 text-sm">{draft.tagline || "Your tagline appears here."}</p>
          <button type="button" className="mt-3 px-3 py-1.5 text-sm text-white" style={{ background: "var(--sf-primary)", borderRadius: "var(--sf-btn-radius, 0.375rem)" }}>{labels.designer}</button>
        </div>
      </div>
      <footer className="space-y-2 border-t px-4 py-3 text-xs">
        {draft.footerText && <p>{draft.footerText}</p>}
        {contact.length > 0 && <p>{contact.join(" · ")}</p>}
        <div className="flex items-center justify-between gap-3">
          <span data-testid="social-links-slot-footer" className="inline-flex items-center">
            <StorefrontSocialIcons links={socialLinks} />
          </span>
          {!draft.hidePlatformBranding && <span className="text-muted-foreground">Powered by CabinetDealz</span>}
        </div>
      </footer>
    </div>
  );
}
