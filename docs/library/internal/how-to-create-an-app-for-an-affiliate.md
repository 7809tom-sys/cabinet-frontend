# How to Create an App for an Affiliate

**Internal only.** Admin library document for Cabinetdealz. Do not publish to the affiliate portal until Tom checks the Affiliate library box.

This guide explains how an affiliate's customers get an "app" for that affiliate's store: the affiliate's branded web storefront, installed to the phone's home screen under the affiliate's own name and icon. No app store listing is involved.

---

## The model in one sentence

Every affiliate already has a white-label web storefront at `/store/<slug>` (and at `<slug>.cabinetdealz.com`), and a customer who taps "Add to Home Screen" on that storefront gets an icon with the affiliate's name and logo that opens the store full screen.

---

## Why this model

| Approach | What it means | Our position |
|---|---|---|
| Branded web storefront + Add to Home Screen | The affiliate's storefront, installed from the phone's browser, under the affiliate's name and icon | **Recommended.** Works today on iPhone and Android, no review, no store fees, every fix ships to every affiliate at once |
| One Cabinetdealz store app with a dealer picker | A single Cabinetdealz app in the stores; the customer picks or signs into an affiliate's store inside it | **Future option only.** See the last section |
| A separate store app per affiliate | One App Store and one Google Play listing for each affiliate brand, built from the same template | **Not recommended.** Apple rejects it (see below) |

### Why per-affiliate store apps are not recommended

Apple's App Review Guidelines (developer.apple.com/app-store/review/guidelines):

- **4.2.6:** apps created from a commercialized template or app generation service are rejected unless they are submitted directly by the provider of the app's content. Template services should not submit apps on behalf of their clients. Apple's acceptable alternative is a single app that hosts all clients in an aggregated or "picker" model.
- **4.3(a):** do not create multiple Bundle IDs of the same app. Apple asks for one app with the variations inside it.
- **4.2:** an app must offer more than a repackaged website.

A branded copy of the same storefront for each affiliate is exactly the template case 4.2.6 describes, and submitting those copies from Cabinetdealz accounts is what it forbids. Do not plan, build, or submit per-affiliate store listings.

---

## What the customer sees

On the affiliate's storefront (`/store/<slug>` or `<slug>.cabinetdealz.com`):

- **iPhone (Safari):** Share, then "Add to Home Screen." The suggested name is the affiliate's store name and the icon is the affiliate's icon. It opens full screen on the affiliate's storefront.
- **Android (Chrome):** menu, then "Add to Home screen" or "Install app." The name, icon, and theme color are the affiliate's. It opens full screen inside the affiliate's store.
- Nothing on the home screen says Cabinetdealz. The main cabinetdealz.com site still installs as CabinetDealz.

How it works: each storefront page links its own web manifest at `/store/<slug>/manifest.webmanifest` (store name, colors, start page and scope `/store/<slug>/`) and PNG icons at `/store/<slug>/app-icon-180.png`, `-192.png` and `-512.png`. The backend builds them from the affiliate's settings, so there is nothing to file or build per affiliate.

---

## What the affiliate sets up

All of this is in the affiliate dashboard, under the storefront branding settings:

1. **Store name** — the name under the home-screen icon. Short names read best; long names are cut off by the phone.
2. **Favicon** (this is also the app icon) — upload a square PNG or JPG, ideally 512 x 512 or larger. This is the home-screen icon.
3. **Logo** — used for the icon only when there is no favicon. A wide logo is fitted into a square on the store's background color, which can look small.
4. **Primary and background colors** — the theme color and the launch background.

If there is no usable favicon or logo (none uploaded, or only an SVG), the store gets a clean letter icon: the first letter of the store name on the primary color.

---

## Checklist — before telling an affiliate their store is "installable"

- [ ] Affiliate account is live and the storefront opens at `/store/<slug>`
- [ ] Store name is final
- [ ] A square favicon (PNG or JPG) is uploaded, or the letter icon is acceptable
- [ ] Primary color is set
- [ ] On an iPhone: open the storefront in Safari, Share, Add to Home Screen. The name and icon are the affiliate's
- [ ] On an Android phone: open the storefront in Chrome, Add to Home screen. The name, icon, and color are the affiliate's

Give the affiliate these two steps for their customers:

- **iPhone:** open the store in Safari, tap Share, then Add to Home Screen.
- **Android:** open the store in Chrome, tap the menu (three dots), then Add to Home screen or Install app.

---

## Known follow-up: custom domains

The home-screen install is built for `/store/<slug>` and `<slug>.cabinetdealz.com`. An affiliate's own custom domain (for example `reaveswaycabinets.com`) still needs a routing check before it is promised as installable: confirm on the live site that the custom domain's home page opens the affiliate's storefront and links the affiliate's manifest. Connecting a custom domain remains a separate step that needs Tom's OK.

---

## Future option: one Cabinetdealz store app with a dealer picker

If Cabinetdealz ever wants to be in the App Store and Google Play, the model Apple accepts is **one** Cabinetdealz app, submitted by Cabinetdealz, in which the customer picks or signs into an affiliate's store. That app would need real phone features beyond the website (for example camera measuring or order-status notifications) to pass guideline 4.2, and digital purchases inside it may need Apple's in-app purchase. It is several weeks of work and needs Tom's decision first. It is not planned today.

---

## Ops notes

- **One PR / one feature still applies** to any code change for storefront branding or install behavior.
- **No production DB writes** and **no DNS changes** without Tom's OK.
- **Do not change passwords** or share store-console or hosting credentials in docs or chat.
- Publishing this document to affiliates requires Tom to set visibility to affiliate and publish in the library UI. Until then it stays `visibility = internal` and `isPublished = 0`.

---

## Done means

An affiliate's storefront:

1. Opens at `/store/<slug>` (and at `<slug>.cabinetdealz.com`), and
2. Installs from Safari and Chrome under the affiliate's own name and icon, and
3. Shows no Cabinetdealz name or icon on the customer's home screen.

---

*Cabinetdealz internal — affiliate_literature library*
