# Google reviews on affiliate storefronts

The storefront can show a store's real Google reviews. This file records what
Google's rules actually require, where each rule comes from, and what this repo
does — and does not — do to meet it.

**No API key lives in this repository.** The browser never holds one, and no key
is entered by an affiliate. The two server-side variables are named in
`shared/googleReviews.ts` and in the backend section below.

---

## 1. What Google requires (current, verified 2026-11-05)

### Places API (New) — Place Details reviews

- `reviews[]` is a `Review` object: `name`, `relativePublishTimeDescription`,
  `text` (`LocalizedText`), `originalText`, `rating`, `authorAttribution`,
  `publishTime`, `flagContentUri`, `googleMapsUri`, and `visitDate`.
- **"A maximum of 5 reviews can be returned."** A place cannot be made to give
  more, so the page never claims to show "all" reviews.
- The `reviews` field bills under the **Place Details Enterprise + Atmosphere**
  SKU.
- Source: <https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places>
  and <https://developers.google.com/maps/documentation/places/web-service/place-details>

### Attribution and display requirements

Every one of these is a "must" or a documented requirement, not a suggestion:

| Requirement | What we do |
|---|---|
| Credit the author of every review: avatar, name, profile link | Author avatar, name, and a link to `authorAttribution.uri` on every card |
| Position the author attribution so it is clearly associated with the review | Attribution is the card header, directly above the text |
| Every review must link to that review on Google Maps via `googleMapsUri` | "Review on Google Maps" link on every card |
| Offer Google's own content-report form (`flagContentUri`) | "Report this review" link on every card |
| Describe how reviews are ordered and filtered | Visible notice: order is Google's; nothing is filtered, edited, or reordered |
| Show the relative publish date (`relativePublishTimeDescription`) | Shown as a `<time>` element |
| Show `visitDate` month and year for places in France | Rendered when Google returns it |
| Tell the user when a review has been translated | "Translated by Google" + a "Read the original" toggle |
| Inform users that reviews are not verified by Google | Visible notice under the list |
| Show Google Maps attribution, near the content, in the same container, never hidden, obscured or modified | `Google Maps` text attribution above and below the list, `translate="no"`, Roboto/system sans, weight 400, `#5E5E5E`, 0.875rem, one line |
| The updated attribution is "Google Maps"; existing "Google" is still allowed | We use the current "Google Maps" form |
| Don't misrepresent Google Maps content by mixing it with non-Google reviews | The Google list is its own bordered container; the affiliate's own testimonials stay in a separate, clearly labelled section |

Source: <https://developers.google.com/maps/documentation/places/web-service/policies>

### Caching and storage

- **No pre-fetching, caching, indexing, storing, resharing, or rehosting** Google
  Maps content outside the service (Maps Platform Terms §3.2.3(a)).
- **No caching** except as the Maps Service Specific Terms expressly permit
  (§3.2.3(b)).
- Places API caching permission covers **latitude/longitude only, for up to 30
  consecutive calendar days** — not review text (§14.3).
- **The place ID is exempt** from the caching restrictions and may be stored
  indefinitely (Places policies, "Exceptions from caching restrictions").
- Google recommends **refreshing a stored place ID if it is more than 12 months
  old**; a refresh requesting only `id` is free.

Sources: <https://cloud.google.com/maps-platform/terms>,
<https://cloud.google.com/maps-platform/terms/maps-service-terms>,
<https://developers.google.com/maps/documentation/places/web-service/place-id>

**Consequence for this build:** the only stored Places value is
`affiliates.googlePlaceId` (plus the date it was last refreshed). Review text,
ratings, author names, and photos are read from Google at request time and are
never written to a database, a CDN cache, or the browser's storage.

### Maps Embed API

- The Embed API is an official, free, unlimited-use iframe:
  `https://www.google.com/maps/embed/v1/place?key=…&q=place_id:PLACE_ID`.
- It still **requires a key**, and that key must reach the browser to load the
  iframe, so it must be an **HTTP-referrer-restricted** Maps key.
- Documented iframe attributes: `allowfullscreen`, `style="border:0"`, and
  `referrerpolicy="strict-origin-when-cross-origin"` (so a referrer restriction
  can validate while page paths stay private). Minimum size is 200×200 px.
- Sources: <https://developers.google.com/maps/documentation/embed/get-started>,
  <https://developers.google.com/maps/documentation/embed/embedding-map>

**Consequence for this build:** without an embed key the section renders a plain
link card to the place instead of an iframe. It never falls back to the
undocumented `maps.google.com/maps?q=…&output=embed` URL, which is neither an
official Embed API request nor a supported way to display a place.

### Write-a-review and read-reviews links

- Google Business Profile's own documentation tells businesses to copy the review
  link from **Read reviews → Get more reviews**; the documented direct form is
  `https://search.google.com/local/writereview?placeid=PLACE_ID`.
  <https://support.google.com/business/answer/16816815>
- The Places API also returns official links: `googleMapsLinks.writeAReviewUri`
  and `googleMapsLinks.reviewsUri`. We prefer those when the API answered and
  fall back to the documented URL forms.
  <https://developers.google.com/maps/documentation/places/web-service/maps-links>
- Reading reviews on Maps: the documented way to point a Maps link at one exact
  place is `https://www.google.com/maps/search/?api=1&query=…&query_place_id=…`.
  <https://developers.google.com/maps/documentation/urls/get-started>

### There is no official Google reviews "badge" widget for a third-party site

- **Google Customer Reviews** is a **Merchant Center add-on**. Its badge shows the
  merchant's *own* post-checkout survey rating on the merchant's own site, and it
  requires the Merchant Center opt-in module after checkout and an agreement in
  the merchant's account. It is not a way to display a Business Profile's Google
  Maps reviews on someone else's site.
  <https://support.google.com/merchants/answer/7124319>
- **Place Details reviews** is the documented API for showing a place's reviews,
  and it comes with the attribution rules above.
- **Places UI Kit** is Google's own pre-built widget (it handles attribution for
  you), but it requires loading Google's Maps JavaScript library and its own key.
  This build uses the Places API + Embed API instead so the section can match the
  affiliate's own layout; switching to Places UI Kit later would be a
  like-for-like change of the presentation layer only.
- Conclusion: **do not** tell an affiliate to install a "Google reviews badge".
  Anything that displays Google review text on a third-party site must follow the
  Places API rules, and anything claiming otherwise is a third-party widget, not
  Google.

### FTC and Google content rules: no filtering, no editing, no incentives

- **Google Maps user-generated content policy**: merchants may not offer
  incentives (payment, discounts, free goods/services) for posting, revising, or
  removing a review; may not discourage or prohibit negative reviews; may not
  selectively solicit positive reviews; may not pressure customers on premises or
  request specific content.
  <https://support.google.com/contributionpolicy/answer/7400114>
- **Google Business Profile tips**: offering incentives in exchange for reviews is
  "strictly prohibited"; "a mix of positive and negative feedback often feels
  more trustworthy."
  <https://support.google.com/business/answer/7035772>
- **FTC Endorsement Guides, 16 CFR 255.2(d)**: advertisers "should not take
  actions that have the effect of distorting or otherwise misrepresenting what
  consumers think," including suppressing, boosting, organizing, or editing
  reviews. Suppressing reviews below four stars while claiming to show reviews is
  given as a deceptive example.
  <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-255>
- **FTC Rule on Consumer Reviews, 16 CFR Part 465**: §465.4 makes it unlawful to
  give incentives conditioned on a review's sentiment; §465.7 makes it unlawful
  to misrepresent that displayed reviews are most or all reviews when negative
  ones are suppressed.
  <https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-465>

**Consequence for this build:** the component cannot filter, sort, or reword.
`toReviewViews()` maps Google's array in order, keeps every entry, and the tests
assert that a 2-star review appears between two higher ones. There is no sorting
control, no "only show 4+ stars" option, and no editable review text anywhere.

---

## 2. What the affiliate does

In **Affiliate portal → Plugins & Add-ons → Google reviews**:

1. Paste a Google Place ID (`ChIJ…`) or a Google Maps link that already contains
   `query_place_id`. Anything else is rejected with instructions, because
   resolving a shortened or `cid=` link requires a server-side API lookup.
2. Save. The storefront picks it up on the next visit.

No key, business name, or review text is collected. There is no field for a key.

---

## 3. How the public storefront renders it

Order of what appears, top to bottom, inside one section:

1. Heading, average rating and total review count when Google returns them.
2. **Maps Embed iframe** for the place (only when the API server supplied the
   referrer-restricted embed key).
3. **See all reviews on Google** and **Write a review** links.
4. **Google Maps** attribution, then up to five review cards in Google's order,
   each with author avatar, name, profile link, stars, relative date, the review
   text exactly as Google returned it, the translation notice when applicable,
   and the "Review on Google Maps" and "Report this review" links.
5. The ordering/filtering notice, the "not verified by Google" notice, and the
   **Google Maps** attribution again.

With a place ID but no reviews, or with a failed request, the section shows the
empty/error sentence and the link to Google. It never shows sample content.

No place ID → **no section, no anchor, no nav link**. `readStoredGooglePlaceId()`
is the single gate.

---

## 4. Backend work this needs (`cabinet-backend`)

The API lives in the separate `cabinet-backend` repository. This frontend PR
carries the contract in `shared/googleReviews.ts` and **does not invent a server
implementation**. Nothing here works end-to-end until the following exists.

### 4.1 Columns

`docs/sql/0248_affiliate_google_reviews.tidb.sql` adds two nullable columns to
`cabinet_dealz.affiliates`:

| Column | Type | Purpose |
|---|---|---|
| `googlePlaceId` | `VARCHAR(255) NULL` | The stored place ID. The one Places value we may keep. |
| `googlePlaceIdRefreshedAt` | `TIMESTAMP NULL` | When the place ID was last refreshed (Google: refresh after 12 months). |

### 4.2 Environment variables

Add on **cabinet-backend on Railway**, never in Vercel and never with a `VITE_`
prefix:

| Variable | Scope | Restriction |
|---|---|---|
| `GOOGLE_PLACES_API_KEY` | Server only. Used for Place Details (New). | Restrict the key to the Places API (New) API only. It must never be sent to a browser. |
| `GOOGLE_MAPS_EMBED_API_KEY` | Server reads it and returns it to the storefront so the iframe can load. | Must be **HTTP-referrer restricted** to the storefront domains (`https://*.cabinetdealz.com/*`, `https://www.cabinetdealz.com/*`, plus the Vercel preview domain). Enable the Maps Embed API for it. |

Both may be the same Google Cloud key only when one key can carry both the
Places API (New) and Maps Embed API restrictions and the referrer restriction
does not break server-side Places calls. Two keys is the safe default.

### 4.3 Procedure

`googleReviews.bySlug({ slug })` → `GoogleReviewsResult` (see
`shared/googleReviews.ts`). Public, unauthenticated, keyed by the store slug.

Server behaviour:

1. Resolve the affiliate by slug; read `googlePlaceId`. No place → return
   `{ status: "not-configured" }` (the storefront renders nothing anyway).
2. Call Place Details (New):
   `GET https://places.googleapis.com/v1/places/{placeId}` with
   `X-Goog-Api-Key: GOOGLE_PLACES_API_KEY` and
   `X-Goog-FieldMask: id,displayName,rating,userRatingCount,googleMapsLinks,reviews`.
3. Return Google's reviews array **unmodified and in Google's order**. Do not
   sort, filter, truncate by rating, or re-word. Cap at five only if Google ever
   returns more (`GOOGLE_REVIEWS_MAX_RETURNED`).
4. Map `INVALID_REQUEST` / `NOT_FOUND` → `{ status: "unavailable", code:
   "invalid-place" }`; `429` → `"rate-limited"`; anything else → `"upstream-error"`.
5. Include `embedApiKey: process.env.GOOGLE_MAPS_EMBED_API_KEY ?? null`.
6. **Do not cache the response** beyond an in-flight request dedupe of a few
   seconds. Review text is Google Maps content; it may not be stored.
7. Optionally refresh a place ID older than 12 months with a free
   `fields=id` request and update `googlePlaceIdRefreshedAt`.

### 4.4 The storefront's own payload

`affiliates.bySlug` (public projection) must include `googlePlaceId` (the place
ID only — no reviews, no key). `affiliates.updateMyStorefront` must accept
`googlePlaceId: string | null`, validate it with `parseGooglePlaceInput` from
`shared/googleReviews.ts`, and store only the parsed ID. Both procedures are
owner/admin-gated exactly as they are today.

### 4.5 Until that ships

`client/src/lib/googleReviewsProcedures.ts` and
`client/src/components/affiliate/AffiliateGoogleReviewsPanel.tsx` cast the tRPC
client, so this frontend build compiles and runs without the new router keys. The
storefront then renders the heading, the two link buttons, and the empty notice
with the link to Google — with no iframe and no review cards. The affiliate panel
says which key is still missing instead of failing silently.
