import { PublishedLegalSlot } from "@/components/legal/PublishedLegalSlot";

/**
 * Public warranty page. The wording below is copied from the warranty sections
 * of client/src/pages/ReturnPolicy.tsx. That return page is left unchanged, so
 * /return-policy still shows the same words. A per-cabinet spreadsheet, when
 * uploaded, renders under this text and does not edit it.
 */
export function WarrantySections() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-2">Warranty</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Manufacturer warranty wording from the return policy page, copied verbatim into its own page.
        Returns stay on <a href="/return-policy" className="underline underline-offset-4">/return-policy</a>.
        Product pages that mention a warranty on a specific item are unchanged.
      </p>
      <div className="space-y-10 text-foreground">
        <section>
          <h2 className="text-xl font-semibold mb-1">Clark &amp; Son — 5 Year Limited Warranty</h2>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Vendor warrants to the original consumer purchaser that cabinetry, door hinges, and drawer
            glides will be free from defects in material and workmanship under normal use and service for
            a period of <strong className="text-foreground">five (5) years</strong> from purchase date
            (Proof of Purchase is required). This warranty is not transferable and only applicable to
            product used for residential purposes. Representatives of this cabinet line do not have the
            authority to change or enlarge this warranty.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            This warranty does not cover normal wear and tear, damage or defects caused by accidents,
            misuse, abuse, or lack of necessary maintenance; nor does it cover alteration, modification,
            improper installation, improper handling / storage, environmental conditions, nor any labor
            expenses.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Vendor, at our option, may elect to repair or replace with a functionally equivalent product
            any product covered by this warranty. Some replacement parts are subject to availability and
            may differ from original parts received. Return of defective product may be required for a
            replacement to be issued. Repair parts or replacement parts are at the expense of the vendor,
            but customer shall bear all other expenses. These expenses may include, but are not limited to,
            cost of removal and re-installation of product, labor expenses, etc.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Just as no two trees are alike, no two pieces of wood are alike. The variation in color and
            grain pattern in wood adds to its natural beauty and is not considered an imperfection.
            Environmental factors, including but not limited to artificial / natural light, moisture,
            cleaners, smoke, etc., may cause the darkening or mellowing of a cabinet over time. This is
            a natural process and can be expected. This warranty does not cover the natural aging or
            darkening / mellowing of wood color, the inherent growth characteristics of, or variation in
            wood.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            Some cabinet lines feature a glazed finish that accentuates the door and drawer front profiles.
            This glaze is hand-applied over a stain or paint and may, due to the nature of application,
            consist of random drips, runs, etc. As glazing is a hand-applied process there will be
            variations in color and appearance from door to door and cabinet to cabinet. This is not
            considered a defect and is considered normal with hand-applied finishes.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            It is the nature of wood to expand and contract to varying degrees depending on climate
            conditions. As a result, cabinet lines with painted surfaces may show fractures in the paint
            at joints. This is normal and is not considered a defect.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-3">
            This warranty is valid only in the United States of America and is not transferable. All
            implied warranties are limited in duration to the shorter of the period provided by law or
            the period of this warranty. To the extent permitted by law, this warranty excludes special,
            incidental, or consequential damages. Some states do not allow the exclusion or limitations
            of incidental or consequential damages or limitations on how long an implied warranty lasts,
            so the above limitations or exclusions may not apply to you. This warranty gives you specific
            legal rights; you may have other rights which vary from state to state.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            To exercise this warranty, please contact the supplier from whom you purchased the product.
            Report, in writing, all defects claimed and include proof of purchase documentation.
          </p>
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-1">Forevermark Cabinetry — Limited Warranty</h2>
          <p className="text-xs text-muted-foreground mb-4">Source: TSG, LLC d/b/a Forevermark Cabinetry</p>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Forevermark Cabinetry offers a limited warranty on cabinetry parts and hardware to the
            original consumer purchaser. This warranty guarantees that Forevermark cabinetry products
            will be free from manufacturer defects and unavoidable defects in material and workmanship
            under normal residential use.
          </p>
          <h3 className="font-semibold mb-2">Warranty Period</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground mb-4">
            <li>
              <strong className="text-foreground">Two (2) to five (5) years</strong> from the date of
              purchase by the original consumer purchaser.
            </li>
            <li>
              Cabinets with painted finishes are limited to a{" "}
              <strong className="text-foreground">two (2) year</strong> warranty.
            </li>
            <li>
              This warranty applies only to residential use at the original site of installation and is
              non-transferable.
            </li>
          </ul>
          <h3 className="font-semibold mb-2">What Is Covered</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            This limited warranty covers manufacturing defects in materials and workmanship under normal
            use and service. TSG, LLC d/b/a Forevermark Cabinetry, at its sole discretion, will repair
            or replace defective cabinetry or components proven to be defective within the warranty
            period.
          </p>
          <h3 className="font-semibold mb-2">What Is Not Covered</h3>
          <ul className="list-disc pl-5 space-y-2 text-muted-foreground mb-4">
            <li>Normal wood characteristics such as variations in grain, color, mineral streaks, knots, or color softening.</li>
            <li>Changes due to exposure to sunlight, UV light, aging, or environmental conditions.</li>
            <li>Hairline cracks, joint lines, or gaps caused by normal wood movement.</li>
            <li>Warpage not exceeding one-quarter inch (1/4&quot;).</li>
            <li>Damage caused by misuse, mishandling, abuse, improper installation, modification, improper storage, excess moisture, extreme temperatures, cleaning with abrasive products, accidents, or neglect.</li>
            <li>Damage resulting from improper installation or use outside normal residential applications.</li>
            <li>Labor costs, removal, installation, transportation, or subsequent damage related to repair or replacement.</li>
            <li>Products used in conjunction with countertops, appliances, plumbing fixtures, or other components.</li>
          </ul>
          <h3 className="font-semibold mb-2">Wood Disclaimer</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Forevermark cabinets are constructed from solid wood and wood veneers on plywood. Natural
            variations in color, grain, and texture are inherent to wood products and are not considered
            defects. Newly produced cabinets may not match existing cabinetry due to natural aging and
            color changes.
          </p>
          <h3 className="font-semibold mb-2">Inspection &amp; Claims</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            TSG reserves the right to inspect any alleged defects in the field to determine whether
            repair or replacement is appropriate. Defective products should not be returned unless
            expressly requested by TSG. Photographs may be required for claim evaluation.
          </p>
          <h3 className="font-semibold mb-2">Warranty Claims Process</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Warranty claims must be submitted through the dealer or distributor from whom the product
            was purchased. Proof of purchase is required. Claims cannot be submitted directly by the
            original consumer purchaser to Forevermark Cabinetry.
          </p>
          <h3 className="font-semibold mb-2">Replacement Policy</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            If a product is discontinued or unavailable, TSG may replace it with a comparable product.
            Replacement products may differ in appearance from the original and are subject to
            availability.
          </p>
          <h3 className="font-semibold mb-2">Limitation of Liability</h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            This warranty is limited exclusively to repair or replacement of defective products. TSG
            shall not be liable for incidental, consequential, or special damages including, but not
            limited to, loss of profits, loss of business opportunity, or personal injury.
          </p>
          <h3 className="font-semibold mb-2">Governing Law</h3>
          <p className="text-muted-foreground leading-relaxed">
            This limited warranty is governed by the laws of the State of New Jersey. Any legal action
            related to this warranty shall be brought exclusively in New Jersey courts. This warranty
            constitutes the complete and exclusive warranty provided by TSG. All other express or
            implied warranties, including warranties of merchantability and fitness for a particular
            purpose, are expressly disclaimed.
          </p>
        </section>
      </div>
    </div>
  );
}

export default function Warranty() {
  return (
    <PublishedLegalSlot slug="warranty">
      <WarrantySections />
    </PublishedLegalSlot>
  );
}
