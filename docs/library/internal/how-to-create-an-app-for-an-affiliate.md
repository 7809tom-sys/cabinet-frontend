# How to Create an App for an Affiliate

**Internal only.** Admin library document for Cabinetdealz. Do not publish to the affiliate portal until Tom checks the Affiliate library box.

This guide explains how Cabinetdealz ships a mobile app for an affiliate brand without forking the product for every store.

---

## The model in one sentence

One shared codebase for every affiliate. A separate Google Play listing and a separate Apple App Store listing for each affiliate brand. The app figures out which affiliate it belongs to at login, from the signed-in account and that affiliate's custom domain — not from which store listing the user installed.

---

## Why this model

| Approach | What it means | Why we use / avoid it |
|---|---|---|
| One shared app binary | All affiliates run the same Cabinetdealz app build | Fixes, catalog, designer, and checkout ship once |
| Separate store listings | Each brand has its own name, icon, and screenshots on Google Play and on the App Store | The customer sees the affiliate's brand in the store, not "Cabinetdealz" |
| Identity at login | After install, the user signs in; the backend resolves the affiliate from account + custom domain | Avoids rebuilding or rebranding the binary per affiliate |
| Identity at install | Hard-coding the affiliate into the download | Forces a separate binary (or heavy config) per brand; we do not do this |

Google Play and Apple each require their own branded listing. A Play listing does not cover iOS, and an App Store listing does not cover Android. Plan both when an affiliate wants a phone app under their name.

---

## What stays shared

- The Cabinetdealz frontend / mobile shell codebase
- Catalog, design tool, cart, checkout, and order flows
- Backend APIs and authentication
- Release pipeline, versioning, and crash / analytics wiring (where already in place)

Do not create a new repository per affiliate. Brand differences live in store listing assets and in runtime resolution after login.

---

## What is unique per affiliate

For **each** affiliate brand that gets an app:

1. **App name** — the name shown on Google Play and on the App Store (the affiliate's store / company name).
2. **App icon** — brand icon that meets each store's size and format rules.
3. **Screenshots** — phone (and tablet if you submit tablet) screens that show that affiliate's branding, not a generic Cabinetdealz capture unless Tom approves it.
4. **Store listing copy** — short and long description written for that brand.
5. **Developer / publisher listing** — submitted under the correct Google Play Console and Apple Developer account Tom designates for that brand (or under Cabinetdealz accounts if that is the chosen ops model — confirm before first submit).
6. **Custom domain** — the affiliate's connected domain, used after login so the session resolves to the right storefront and branding.

Privacy policy URL, support URL, and contact email must be valid for that listing. Prefer the affiliate's support contact when the listing is fully white-labeled.

---

## How identity is resolved (login, not install)

1. Customer installs the app from that affiliate's store listing (or from a shared listing if Tom has not yet cut a branded listing).
2. Customer opens the app and signs in (or creates an account) against Cabinetdealz auth.
3. Backend / app shell resolves the affiliate from:
   - the signed-in account's affiliate association, and/or
   - the affiliate custom domain configured for that store.
4. UI then shows that affiliate's storefront branding, catalog scope, and links.

**Do not** bake the affiliate id into the install package as the only source of truth. Listing branding is for the store page; runtime branding comes from account + domain after login.

If a user installs Brand A's listing but somehow signs into Brand B's account, follow existing product rules for account / domain mismatch — do not invent a new rule here. Escalate to Tom if the product does not already define the behavior.

---

## Checklist — before you start a listing

- [ ] Affiliate account is live and can sign in
- [ ] Custom domain is connected and working for the web storefront
- [ ] Logo / icon source files are on hand (high resolution)
- [ ] Brand display name is final (what appears under the icon)
- [ ] Screenshot source material exists (or a plan to capture from the branded web / staging app)
- [ ] Privacy policy and support URLs exist and load
- [ ] Tom has said which Google Play Console and which Apple Developer team to use
- [ ] Tom has said whether this listing stays internal-only for testing or goes public

---

## Checklist — Google Play (Android)

Each affiliate brand needs its own Play Store listing when the brand must appear under its own name.

- [ ] Create or select the app entry in Google Play Console
- [ ] Set the application name to the affiliate brand
- [ ] Upload the adaptive / high-res icon for that brand
- [ ] Add phone screenshots that show that brand
- [ ] Fill short description and full description
- [ ] Attach privacy policy URL
- [ ] Complete content rating, target audience, and store presence questionnaires as required by Play at submit time
- [ ] Upload the shared Android build (AAB) for that release track
- [ ] Use internal / closed testing first when Tom wants a dry run
- [ ] Submit for review only after Tom says go

Store policies and required forms change; follow the Console checklist on the day you submit. Do not invent fee amounts or review SLAs in this doc.

---

## Checklist — Apple App Store (iOS)

Each affiliate brand needs its own App Store listing when the brand must appear under its own name.

- [ ] Create or select the app record in App Store Connect
- [ ] Set the app name to the affiliate brand (within Apple's length limits)
- [ ] Upload the brand app icon
- [ ] Add iPhone screenshots (and iPad if you declare iPad support)
- [ ] Fill subtitle / description / keywords as needed for that brand
- [ ] Attach privacy policy URL and complete App Privacy answers truthfully for what the shared app collects
- [ ] Complete age rating and export compliance answers as required at submit time
- [ ] Upload the shared iOS build
- [ ] Use TestFlight for internal or external testers when Tom wants a dry run
- [ ] Submit for review only after Tom says go

Apple and Google are separate reviews. Passing one does not pass the other.

---

## Branding asset list (hand to design)

Per affiliate, gather at least:

- App icon master (square, large source; export to each store's required sizes)
- Feature graphic / promo image if Play requires one for that listing
- 3–8 screenshots per phone size you support, with the affiliate name / logo visible where appropriate
- Optional: short promo video (only if Tom wants one)
- Store description (plain language, no unverified claims)

Never snap door colors to the Cabinetdealz brand palette when capturing kitchen screenshots. Use the affiliate's real finishes.

---

## Ops notes

- **One PR / one feature still applies** to code changes that enable branded listings or login resolution. Do not sneak store-config into unrelated branches.
- **No production DB writes** and **no DNS changes** without Tom's OK. Connecting an affiliate custom domain for web remains a separate, approved step.
- **Do not change passwords** or rotate store console credentials in docs or chat.
- Publishing this document to affiliates requires Tom to set visibility to affiliate and publish in the library UI. Until then it stays `visibility = internal` and `isPublished = 0`.

---

## Done means

An affiliate has:

1. A Google Play listing under their brand (when Android is in scope), and
2. An App Store listing under their brand (when iOS is in scope), and
3. Installs of the **shared** app that, after login, resolve to that affiliate via account and custom domain.

If any of those three is missing, the branded app work is not finished.

---

*Cabinetdealz internal — affiliate_literature library*
