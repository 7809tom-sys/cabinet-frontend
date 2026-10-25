import { AFFILIATE_LIQUIDATED_DAMAGES_USD, AFFILIATE_NON_COMPETE_TERM_MONTHS } from "@shared/affiliateNonCompete";

export default function Terms() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">Terms &amp; Conditions</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: July 2025</p>

      <div className="space-y-8 text-foreground">

        <section>
          <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using the Cabinet Dealz website (cabinetdealz.com) or placing an order, you agree to be
            bound by these Terms &amp; Conditions. If you do not agree, please do not use our services. These terms apply
            to all users including customers, affiliates, contractors, and vendors.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. About Cabinet Dealz</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cabinet Dealz is operated by First Class Flooring &amp; Cabinet Design, 470 N Tamiami Trail, Osprey, FL 34229.
            We are a marketplace platform that connects buyers with authorized cabinet distributors and manufacturers.
            Cabinet Dealz acts as the seller of record for all transactions processed through our platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. Orders and Payments</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>All prices are in US dollars and subject to change without notice.</li>
            <li>Orders are not confirmed until payment is successfully processed.</li>
            <li>We reserve the right to cancel any order due to pricing errors, stock availability, or suspected fraud.</li>
            <li>Payment is processed securely via Stripe. By placing an order, you authorize us to charge your payment method.</li>
            <li>Sales tax is collected based on the delivery address in accordance with applicable state law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Pricing and Product Information</h2>
          <p className="text-muted-foreground leading-relaxed">
            We make every effort to display accurate product information and pricing. However, errors may occur.
            In the event of a pricing error, we will notify you and give you the option to proceed at the correct
            price or cancel your order. Product images are representative and actual products may vary slightly in
            color or finish due to monitor calibration and photography conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Shipping and Delivery</h2>
          <p className="text-muted-foreground leading-relaxed">
            Shipping is governed by our{" "}
            <a href="/shipping-policy" className="text-[var(--color-gold)] hover:underline">Shipping Policy</a>,
            which is incorporated into these Terms by reference. Risk of loss and title for items pass to you upon
            delivery to the carrier.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Returns and Warranties</h2>
          <p className="text-muted-foreground leading-relaxed">
            Returns and warranties are governed by our{" "}
            <a href="/return-policy" className="text-[var(--color-gold)] hover:underline">Return Policy &amp; Warranty</a>,
            which is incorporated into these Terms by reference. Warranty coverage is provided by the respective
            manufacturer and passed through to you.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Affiliate Program</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Affiliates are independent contractors, not employees of Cabinet Dealz.</li>
            <li>Affiliates earning $600 or more in a calendar year will receive a 1099-NEC tax form.</li>
            <li>Affiliates must provide accurate W-9 information and a valid government-issued ID before receiving payouts.</li>
            <li>Cabinet Dealz reserves the right to terminate any affiliate account for violation of these terms or misrepresentation.</li>
            <li>Affiliates may not make false or misleading claims about products or pricing.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7A. Affiliate Post-Termination Non-Competition Covenant</h2>
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">Draft — attorney review required before use.</p>
            <p className="mt-1">This proposed restrictive-covenant language is intended for the Affiliate Agreement and is subject to applicable law and legal review.</p>
          </div>
          <div className="mt-3 space-y-3 text-muted-foreground leading-relaxed">
            <p>
              To the fullest extent permitted by applicable law, during an Affiliate’s relationship with Cabinet Dealz and for {AFFILIATE_NON_COMPETE_TERM_MONTHS} months after its termination for any reason, the Affiliate shall not use Cabinet Dealz confidential information, pricing, customer relationships, platform materials, white-label storefront technology, or design-system data to operate, assist, or promote a competing cabinet marketplace or white-label cabinet-affiliate program in the territory where the Affiliate used the Cabinet Dealz Platform.
            </p>
            <p>
              Upon Cabinet Dealz’s documented good-faith determination of a violation, Cabinet Dealz may immediately suspend the Affiliate’s platform access and disable its affiliate storefront. Suspension of the storefront is a platform-protection measure and does not replace any notice, dispute-resolution, or other process required by applicable law or the signed Affiliate Agreement.
            </p>
            <p>
              The Affiliate agrees that a material violation may cause damages that are difficult to measure. Subject to applicable law and a signed Affiliate Agreement, the parties propose liquidated damages of ${AFFILIATE_LIQUIDATED_DAMAGES_USD.toLocaleString("en-US")} per violation as a reasonable pre-estimate of loss and not as a penalty, in addition to any other relief available at law or in equity.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Intellectual Property</h2>
          <p className="text-muted-foreground leading-relaxed">
            All content on this website — including text, images, logos, design tool software, and product data — is
            the property of Cabinet Dealz or its licensors and is protected by copyright and trademark law. You may
            not reproduce, distribute, or create derivative works without our express written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Limitation of Liability</h2>
          <p className="text-muted-foreground leading-relaxed">
            To the maximum extent permitted by law, Cabinet Dealz shall not be liable for any indirect, incidental,
            special, or consequential damages arising from your use of our services or products. Our total liability
            for any claim shall not exceed the amount you paid for the order giving rise to the claim.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Governing Law</h2>
          <p className="text-muted-foreground leading-relaxed">
            These Terms are governed by the laws of the State of Florida. Any disputes shall be resolved in the courts
            of Sarasota County, Florida, and you consent to personal jurisdiction in those courts.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">11. Changes to Terms</h2>
          <p className="text-muted-foreground leading-relaxed">
            We reserve the right to update these Terms at any time. Changes will be posted on this page with an
            updated date. Continued use of our services after changes constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">12. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For questions about these Terms, contact us at:<br />
            Cabinet Dealz / First Class Flooring &amp; Cabinet Design<br />
            470 N Tamiami Trail, Osprey, FL 34229<br />
            <a href="mailto:sales@cabinetdealz.com" className="text-[var(--color-gold)] hover:underline">sales@cabinetdealz.com</a><br />
            <a href="tel:+19418993288" className="text-[var(--color-gold)] hover:underline">(941) 899-3288</a>
          </p>
        </section>
      </div>
    </div>
  );
}
