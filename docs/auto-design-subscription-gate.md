# Auto Design subscription gate + 90-day design credit

Requested by Tom by voice on Nov 19, 2026, 7:52 AM CT. **Ships dark: the gate is OFF by default.**

## What it does

- **Browsing stays open.** Anyone can open the Designer and the Auto Design dialog.
- **Only the Build (run) action is gated**, when `VITE_AUTO_DESIGN_SUBSCRIPTION_GATE=on`:
  1. Not signed in → sign-in prompt.
  2. No verified mobile number → SMS code prompt (phone verification).
  3. Verified phone with an active subscription / paid fee → runs.
  4. Verified phone with free runs left (default **1 per phone**) → runs, and the run is recorded against the phone.
  5. Otherwise → "Subscribe for $9.99" prompt.
- **Identity is the verified phone (E.164), not email.** One free design per phone number, so new emails don't get new free designs. The same phone keys the 90-day credit.

## 90-day design credit

When a customer pays the $9.99 fee (app download fee, or the web equivalent), every kitchen design created on that phone within 90 days of the payment counts toward a credit on the phone's **first kitchen order, once**. The credit equals the fee paid, capped at the order's merchandise total. Payments never stack. Refunded payments earn nothing. Logic: `shared/autoDesignCredit.ts` (`firstKitchenOrderCredit`).

### Store-fee policy

Google Play and Apple keep a cut of the download fee. **That cut is not passed on to the customer.** The credit is the full amount the customer paid (gross), not the net after the store cut. Kitchen sale revenue is separate and unaffected: no store fee is ever added to cabinet or kitchen prices. The customer copy (`autoDesignCreditCopy`) says this.

## Config (not settled pricing)

| Env | Default | Meaning |
|---|---|---|
| `VITE_AUTO_DESIGN_SUBSCRIPTION_GATE` | off | Turns the gate on |
| `VITE_AUTO_DESIGN_FREE_PER_PHONE` | 1 | Free runs per verified phone |
| `VITE_AUTO_DESIGN_FEE_CENTS` | 999 | Access / download fee |

Design packs are an empty list until Tom confirms them (he has also mentioned "3 free, then 5 for $9.99, 10 for more"). The client values are display only. The server must enforce the same numbers.

## Files

- `shared/autoDesignAccess.ts`: config, phone normalization (same rules as cabinet-backend `twilioVerify.normalizePhoneE164`), `decideAutoDesignRun`.
- `shared/autoDesignCredit.ts`: 90-day window, qualifying designs, first-order credit, customer copy.
- `client/src/lib/autoDesignAccessFlag.ts`: the flag (default OFF) and env config.
- `client/src/lib/autoDesignAccessProcedures.ts`: typed client view of the planned `autoDesignAccess` router.
- `client/src/hooks/useAutoDesignAccess.ts`: status query (disabled while the flag is off), decision, `noteRun`.
- `client/src/components/design/AutoDesignAccessDialog.tsx`: sign in / verify phone / subscribe prompt with credit copy.
- `client/src/pages/DesignTool.tsx`: `onBuild={gatedBuildAutoDesignLayout}`. This is the only change to the Designer. `InteractiveRoom3D` and Wall Builder are untouched.
- `docs/sql/0279_auto_design_phone_access_credit.tidb.sql`: **NOT APPLIED** proposed tables.

## Backend follow-up (cabinet-backend, not in this PR)

Add an `autoDesignAccess` tRPC router. All procedures are `protectedProcedure` except where noted.

- `status` → `{ signedIn, verifiedPhoneE164, hasActiveSubscription, runsForPhone }`. `runsForPhone` counts `auto_design_runs` by `phoneHash` across **all** accounts.
- `requestPhoneCode({ phone })` → reuse `server/lib/twilioVerify.ts` (`normalizePhoneE164`, `sendTwilioVerification`) with the 60 s resend / 10 min expiry already used by `designPhotoRenders.requestPhoneVerification`.
- `confirmPhoneCode({ phone, code })` → `checkTwilioVerification`, then upsert `auto_design_phones` (UNIQUE `phoneHash`). If the phone is already tied to another account, it keeps its run count (the point of the rule). Whether the second account may also use it is an open question.
- `recordRun({ roomType })` → **server-side hard gate**: recompute the decision with the same config, refuse if not allowed, otherwise insert into `auto_design_runs` in one transaction. The client check is UX only.
- `startCheckout({ returnPath })` → Stripe Checkout for the fee (existing Stripe setup, same pattern as `affiliateMembership.startCheckout`). The Stripe webhook inserts `auto_design_payments` (channel `web`, `grossCents` = amount paid).
- At order creation: call `firstKitchenOrderCredit` (shared module) with the phone's payments, designs and history. Insert `auto_design_order_credits` (UNIQUE phoneHash and orderId) and show the line on the order summary. The Cart and checkout are not changed in this PR. `result.note` is the ready-made line text.
- Env on Railway: `TWILIO_API_KEY`, `TWILIO_API_SECRET`, `TWILIO_VERIFY_SERVICE_SID` (none are set yet), plus a Stripe price for the fee.
- App Store / Play Store: there is no native app yet, so there is no receipt verification. When there is one, verify the receipt server-side and insert `auto_design_payments` with channel `app_store`/`play_store`, `grossCents` = customer price and `storeFeeCents` = the store cut (accounting only).
