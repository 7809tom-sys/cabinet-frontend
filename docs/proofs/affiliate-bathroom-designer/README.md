# Affiliate bathroom designer — findings and fixes

Investigated on the production site (`www.cabinetdealz.com`) on 6 Nov 2026 using
`store/reaves-way-cabinet-shop/design` (affiliate scope), the main-site
`/design` (no storefront scope), and the kitchen designer for comparison.
Evidence commands and screenshots are listed per item. Screenshots in this
folder are `before-*` (production) and `after-*` (this branch, run locally
against the production API through a same-origin proxy).

## Ranked list of what is wrong

### 1. Affiliate fixtures and flooring are priced at the platform price, not the affiliate's

The affiliate Designer listed Pelican vanity sinks, vanity faucets, flooring,
and tile at the platform retail while the affiliate's own storefront sells the
same SKU at the affiliate's marked-up retail. This is a money bug: the Designer
under-quoted every fixture on the affiliate site.

| Product | Affiliate storefront | Affiliate Designer (before) |
| --- | --- | --- |
| `PL-3608` vanity basin | (not on storefront page 1) | `$55.15` |
| `PL-3099 White` vanity basin | `$112.47` (`scope=catalog`) | `$46.44` |
| `PL-8112 BN` vanity faucet | — | `$116.10` (platform) |
| `Aviles 20mil Dryback Planks` | `$148.34` | `$95.70` |
| `Bahia 12mil Vinyl Flooring` | `$115.09` | `$74.25` |
| `Arctic Vail` tile | `$37.20` | `$24.00` |

Cause: `surfaces.recommended`, `surfaces.byIds`, `surfaces.designerByIds`,
`surfaces.designSelectionByIds`, and `surfaces.matchingFlooringAccessories`
have no affiliate scope at all — they always return the platform price — and the
Designer never passed one. `pelican.byCategory` already supported
`affiliateSlug`; the Designer's sink, faucet, pot-filler and countertop pickers
did not pass it either.

Fixed in this branch: the client now passes `affiliateSlug` on every Pelican
list the Designer prices, and the backend patch
`docs/patches/cabinet-backend-affiliate-surface-pricing.patch` teaches those
five `surfaces` procedures to price through the affiliate's own markup.
**The backend patch must ship for the prices to be right** — the frontend alone
only makes the existing `pelican.byCategory` calls affiliate-scoped.

### 2. The bathroom Designer offers the measured KITCHEN Auto-Design, and it fails

In Bathroom mode the toolbar still showed **Auto-Design** and **Dishwasher
side**. Opening Auto-Design asked for a range, dishwasher, refrigerator, "how do
you use this kitchen", and a 30/36/42 in. wall-cabinet height, then failed with
*"The kitchen appliance palette is still loading…"* because a bathroom catalog
is in scope and there is no `RANGE-30` / `DW-24` / `FRIDGE-36` row. No cabinet
was ever placed.

Fixed: Auto-Design is gated on `roomType === "kitchen"`. The audience gate
(admin or affiliate) is unchanged and still separately tested. The build also
now explains the room rule instead of dying on the appliance palette.

### 3. No way to open the bathroom designer — every entry is a kitchen

There is no `?room=` support, and the entry gate, desktop toolbar title, and
first catalog tab are all hard-coded Kitchen. A storefront link lands on "Start
Your Kitchen Design" with the Kitchen room and the Base tab, so the customer has
to know to hunt for the Bathroom tab.

Fixed: `?room=bathroom` (also `?roomType=`, plus `bath`/`vanity` synonyms) opens
the room directly — gate title, room tab, and catalog tab. Every existing link
is unchanged because no room parameter means kitchen.

### 4. The default fixture on a bathroom vanity is a 26-inch kitchen faucet

Placing a vanity sink base with no faucet chosen auto-placed
**PL-8237 Fountain Series Kitchen Faucet** and said so in a toast. The kitchen
default was applied to every room.

Fixed: a bathroom sink now falls back to the verified single-hole vanity faucet
`PL-8112 BN` (12 7/16 in. overall) and says so. The kitchen path is unchanged.
Screenshot: `after-05-vanity-faucet-default.png`.

### 5. A placed vanity reads "Unavailable" for several seconds

Right after placing, the line showed **Unavailable** in red and `$0.00` in the
total for ~9 s while the price query ran, then settled. It reads as a broken
catalog on the first cabinet every shopper places.

Fixed: the label is **Pricing…** while the lookup is in flight and only says
Unavailable when the source has actually answered without a price.
Screenshot: `after-03-pricing-in-flight.png`.

### 6. A saved or reloaded bathroom plan reopens on the kitchen Base tab

`roomType` restores from the draft but the catalog tab does not, so a bathroom
plan reopened on Base with a kitchen lineup. Fixed: a restored bathroom plan
opens on **Vanity**, a closet plan on Closet parts, a laundry on Fixtures.

### 7. Two different door pictures for the same style

The color rail and door grid (`DoorStyleSwatch`) preferred
`thumbnailImageUrl`; the Designer face and 3D texture prefer
`doorSampleImageUrl`. 33 of 123 styles carry two different images, so the rail
could show a different door than the one that gets built. The rail also ignored
an approved render entirely.

Fixed: `approved render → door sample → thumbnail`, matching the stated rule.
The approved render only counts when a run was actually accepted.

### 8. The room tab row clipped "Bathroom"

A five-column grid gave each cell ~40 px; "Bathroom" needs ~54 px, so the tab
read "Bathroo". Fixed with a wrapping flex row of content-sized tabs.

### 9. Kitchen wording and platform branding on a bathroom / affiliate plan

- Entry gate: "Start Your **Kitchen** Design" → names the room
  (`after-01-gate-bathroom.png`).
- Save dialog: "Save **kitchen** design" → "Save bathroom design".
- Filler help: "existing **CabinetDealz** filler stock" (platform brand leaked
  into an affiliate store) → "the selected line's existing filler stock".
- The affiliate brand row was printed twice above the entry gate.

### 10. Vanity tab asked for a distributor when a door style is enough

The door-style picker placeholder read "Choose a distributor or door style",
but a style alone lists all 20 vanity cabinets. Now "Choose a door style".

## Not changed in this PR

- **Back / Forward navigation** — explicitly another PR.
- **`kitchenRules.parameters` 404 and `designerHelper.mailerStatus` 404** — both
  procedures ship in backend patches already in this repo
  (`docs/patches/cabinet-backend-kitchen-rules.patch`,
  `cabinet-backend-designer-helper-queue.patch`) that are not deployed. The
  Designer degrades safely, but the console shows two NOT_FOUND per session.
- **Affiliate subdomains for stores other than `reaves-way-cabinet-shop` do not
  serve TLS** (`firstclass.cabinetdealz.com` → Cloudflare error 1001, 409 over
  HTTP). DNS for `*.cabinetdealz.com` still points at the retired Manus host.
  This is a DNS/Vercel cutover task, not a code change.
- **`styleEnabled` is honoured by the storefront list but not by the Designer.**
  On `sales-demo` (two styles explicitly disabled) the Designer still offers
  `Cinder Core`, `Drism Clear`, and `Nocturne Glass`. Placing one yields zero
  cabinets, so the failure is visible rather than a wrong price — left for a
  follow-up because the fix belongs with the backend style-visibility gate.
- **Affiliate buy-cost tier is not reflected in the Designer's own estimator**
  beyond the storefront retail; that is the same pricing surface as item 1 and
  is covered by the patch plus the existing tier work.

## Verification

- `npx vitest run` — no new failures versus `abe8252`: 61 failing files before
  and after (pre-existing, mostly `AppRouter` types and UI snapshots).
- New tests: `client/src/pages/DesignTool.bathroomCopy.test.ts`,
  `client/src/components/DoorStyleSwatch.precedence.test.ts`,
  `client/src/lib/designerRoomEntry.test.ts`,
  `client/src/lib/autoDesignFaucet.bathroomDefault.test.ts`.
- Local run of the branch against the production API (same-origin proxy):
  gate title, room tab, first catalog tab, "Pricing…" → price, vanity faucet
  default, and "Save bathroom design" all confirmed. See the screenshots.
