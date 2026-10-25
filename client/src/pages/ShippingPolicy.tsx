export default function ShippingPolicy() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">Shipping Policy</h1>
      <p className="text-sm text-muted-foreground mb-10">
        Cabinet Dealz ships orders fulfilled by our authorized vendor network. The following policies reflect
        the official terms of <strong className="text-foreground">U.S. Cabinet Depot</strong>, our primary
        vendor for framed cabinetry. Additional vendor-specific terms may apply for orders fulfilled by
        Clark &amp; Son Cabinets or Forevermark Cabinetry.
      </p>

      <div className="prose prose-neutral max-w-none space-y-8 text-foreground">

        {/* ── U.S. Cabinet Depot ── */}
        <section>
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">U.S. Cabinet Depot — Shipping &amp; Delivery</h2>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Order Processing &amp; Lead Times</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Full payment is required before an order will be processed (including backorders and approved written add-ons).</li>
              <li><strong className="text-foreground">Flat pack orders:</strong> Express Advantage shipping — ships within 3 full business days.</li>
              <li><strong className="text-foreground">Assembled orders:</strong> Processed and shipped within 15 full business days.</li>
              <li>"Day One" starts on the next full business day after the order is placed.</li>
              <li>Cancellations after an order is picked are subject to a 10% processing fee.</li>
              <li>Cancellations made after an order has been loaded onto a carrier's truck or picked up are subject to a 20% restocking/processing fee.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Rush Advantage Orders</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Rush Advantage is available for <strong className="text-foreground">flat pack orders only</strong> for an additional fee.</li>
              <li>Same-day warehouse pickup is available for flat pack orders placed by 12:00 PM local warehouse time (minimum 3-hour processing time).</li>
              <li>Same-day shipping is available for flat pack orders placed by 12:00 PM local warehouse time. Orders placed after 12:00 PM are processed the following business day.</li>
              <li>Rush Advantage is unavailable for assembly orders and discontinued lines.</li>
              <li>The Rush Fee applies to warehouse processing time only — it does not reduce transit time to your destination.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">LTL Freight Shipping</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>All LTL freight orders are packaged in individual boxes, placed on a pallet, shrink-wrapped, and strapped.</li>
              <li>All LTL freight shipping charges are calculated at the time of checkout.</li>
              <li>Standard transit time is <strong className="text-foreground">2–5 business days</strong> with LTL carriers. Allow at least one extra day for residential deliveries and deliveries requiring a scheduled appointment.</li>
              <li>You will receive a tracking number by email the day after the order has shipped.</li>
              <li>All destinations must be <strong className="text-foreground">tractor/trailer accessible</strong>, or a Limited Access fee of $100 will be applied.</li>
              <li>For residential deliveries and deliveries requiring an appointment, the freight company will contact you 24 hours in advance to schedule a delivery window (usually 3–4 hours).</li>
              <li>Shipping charges cover <strong className="text-foreground">one delivery attempt</strong>. The customer is responsible for any additional charges for delivery failure due to customer circumstances.</li>
              <li>U.S. Cabinet Depot reserves the right to fulfill orders from multiple distribution facilities without prior notification and at no additional cost.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">LTL Delivery Policies</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>The driver is only responsible for placing the pallet on the ground for deliveries with lift gate service selected at checkout.</li>
              <li>Address classifications are based on city zoning. A commercial property in a residential area is considered residential and is subject to residential delivery fees.</li>
              <li>A responsible party <strong className="text-foreground">must be present</strong> to inspect, inventory, and sign off on delivery.</li>
              <li>You <strong className="text-foreground">MUST</strong> notate if the number of pallets delivered does not match the number listed on the driver's delivery receipt.</li>
              <li>Careful inspection of packaging is vital to file freight claims. Any visible damages <strong className="text-foreground">must be noted on the paperwork</strong> when signing for the delivery, and documented with photos.</li>
              <li><strong className="text-foreground">Do NOT reject damaged items.</strong> Accept the delivery, document the damage, and file a claim online.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Missing &amp; Damaged Items</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Visible damage or shortage:</strong> Must be noted on the delivery receipt at time of delivery. Claims must be submitted within <strong className="text-foreground">5 business days</strong> of delivery with photos.</li>
              <li><strong className="text-foreground">Concealed damage:</strong> Must be reported within <strong className="text-foreground">5 business days</strong> of delivery with photos of the damage and original packaging.</li>
              <li>Failure to follow these procedures may result in denial of the claim.</li>
              <li>U.S. Cabinet Depot will review and replace damaged or missing pieces in a timely manner.</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Warehouse Pickup Orders</h3>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Orders must be picked up within <strong className="text-foreground">10 business days</strong> of receiving the ready-for-pickup email notification.</li>
              <li>After 10 business days, storage fees begin at $25/day per open order, capping at $250.</li>
              <li>Five weeks after the ready-for-pickup notification, the order will be returned to inventory and refunded less the $250 maximum storage fee and a 10% restocking fee.</li>
              <li>U.S. Cabinet Depot will not accept shipping damage claims for warehouse pickup orders that are later shipped at the dealer's discretion.</li>
            </ul>
          </section>
        </section>

        {/* ── General Cabinet Dealz Notes ── */}
        <section>
          <h2 className="text-2xl font-bold mb-4 border-b border-border pb-2">Cabinet Dealz — General Shipping Notes</h2>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
            <li>We ship to the <strong className="text-foreground">48 contiguous United States</strong> only. We do not ship to Alaska, Hawaii, Puerto Rico, or international destinations.</li>
            <li>Shipping costs are calculated based on order size, weight, delivery zip code, and the fulfilling distributor's warehouse location.</li>
            <li>For orders fulfilled by multiple distributors, separate shipments may arrive at different times.</li>
            <li>For shipping questions, contact us at{" "}
              <a href="mailto:sales@cabinetdealz.com" className="text-[var(--color-gold)] hover:underline">sales@cabinetdealz.com</a>{" "}
              or call <a href="tel:+19418993288" className="text-[var(--color-gold)] hover:underline">(941) 899-3288</a>.
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
