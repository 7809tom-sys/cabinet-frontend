import { buildSalesRepAgreementText } from "@shared/salesRepAgreement";
import { PublishedLegalSlot } from "@/components/legal/PublishedLegalSlot";

export default function SalesRepAgreementPage() {
  return (
    <PublishedLegalSlot slug="sales-rep-agreement">
      <article className="max-w-3xl mx-auto px-4 py-16 whitespace-pre-wrap text-foreground leading-relaxed">
        {buildSalesRepAgreementText()}
      </article>
    </PublishedLegalSlot>
  );
}
