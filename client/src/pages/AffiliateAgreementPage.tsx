import { AFFILIATE_AGREEMENT_VERSION, buildAffiliateAgreementText } from "@shared/affiliateAgreement";
import { PublishedLegalSlot } from "@/components/legal/PublishedLegalSlot";

export default function AffiliateAgreementPage() {
  return (
    <PublishedLegalSlot slug="affiliate-agreement">
      <article className="max-w-3xl mx-auto px-4 py-16 whitespace-pre-wrap text-foreground leading-relaxed">
        {buildAffiliateAgreementText(AFFILIATE_AGREEMENT_VERSION)}
      </article>
    </PublishedLegalSlot>
  );
}
