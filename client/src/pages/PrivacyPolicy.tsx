export default function PrivacyPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">Last updated: July 2025</p>

      <div className="space-y-8 text-foreground">

        <section>
          <h2 className="text-xl font-semibold mb-3">1. Who We Are</h2>
          <p className="text-muted-foreground leading-relaxed">
            Cabinet Dealz ("we," "us," or "our") is located at 470 N Tamiami Trail, Osprey, FL 34229. We operate the website cabinetdealz.com and related services.
            This Privacy Policy explains how we collect, use, and protect your personal information.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">We collect information you provide directly to us, including:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Account information:</strong> name, email address, phone number</li>
            <li><strong className="text-foreground">Order information:</strong> shipping address, order details, payment information (processed securely via Stripe — we do not store card numbers)</li>
            <li><strong className="text-foreground">Affiliate information:</strong> business name, tax identification number, government-issued ID (for W-9 compliance)</li>
            <li><strong className="text-foreground">Communications:</strong> messages you send us via email or our contact form</li>
            <li><strong className="text-foreground">Usage data:</strong> pages visited, browser type, IP address, referring URLs (collected automatically)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>To process and fulfill your orders</li>
            <li>To communicate with you about your orders, account, and our services</li>
            <li>To process affiliate commissions and issue 1099 tax forms</li>
            <li>To improve our website and services</li>
            <li>To comply with legal obligations</li>
            <li>To send promotional communications (you may opt out at any time)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">4. Sharing Your Information</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            We do not sell your personal information. We may share your information with:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li><strong className="text-foreground">Distributors and vendors:</strong> to fulfill your order (name, shipping address, order details)</li>
            <li><strong className="text-foreground">Payment processors:</strong> Stripe processes payments securely on our behalf</li>
            <li><strong className="text-foreground">Shipping carriers:</strong> to deliver your order</li>
            <li><strong className="text-foreground">Legal authorities:</strong> when required by law or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use industry-standard security measures including SSL/TLS encryption, secure cloud storage, and access
            controls to protect your information. Sensitive data such as tax IDs and government IDs are stored encrypted.
            No method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">6. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            We use cookies and similar technologies to maintain your session, remember your preferences, and analyze
            site traffic. You can control cookies through your browser settings. Disabling cookies may affect some
            functionality of our website.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">7. Your Rights</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">You have the right to:</p>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate information</li>
            <li>Request deletion of your account and associated data</li>
            <li>Opt out of marketing communications</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed mt-3">
            To exercise these rights, contact us at{" "}
            <a href="mailto:sales@cabinetdealz.com" className="text-[var(--color-gold)] hover:underline">sales@cabinetdealz.com</a>.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
          <p className="text-muted-foreground leading-relaxed">
            Our services are not directed to children under 13. We do not knowingly collect personal information from
            children under 13. If you believe we have inadvertently collected such information, please contact us immediately.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
          <p className="text-muted-foreground leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of significant changes by posting
            the new policy on this page with an updated date. Continued use of our services after changes constitutes
            acceptance of the updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">10. Contact</h2>
          <p className="text-muted-foreground leading-relaxed">
            For privacy-related questions, contact us at:<br />
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
