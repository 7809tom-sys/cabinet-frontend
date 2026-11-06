# Payment receipts and owner payment notices

## Why the owner never got automatic receipts

Three independent faults. Any one of them alone was enough to stop the email.

| # | Fault | Where | Effect |
|---|---|---|---|
| 1 | A missing `receiptSentAt` column aborted the send | `server/lib/orderReceiptEmail.ts` `claimOrderReceipt` + `deliverOrderReceipt` | The marker is a manual SQL step (`docs/sql/0224`). Un-migrated, the claim returned `schema_missing`, `deliverOrderReceipt` returned early, and **nobody was emailed** |
| 2 | No `invoice.paid` / `invoice.payment_succeeded` handler | `server/stripeWebhook.ts` | An invoice-paid order was never confirmed and never receipted |
| 3 | Email failures were inside the webhook's failure path | `server/stripeWebhook.ts` | `sendPaidOrderReceipt` rethrows on delivery failure, so an email problem became a 500 → Stripe retried an already-successful payment |

Plus a fourth, specific to owner-placed orders:

| # | Fault | Where | Effect |
|---|---|---|---|
| 4 | Receipt invented `sales@cabinetdealz.com` as the internal copy | `orderReceiptEmail.ts` `DEFAULT_ORDER_NOTIFY_EMAIL` + `composeOrderReceipt` | When the customer address *was* the owner's, the BCC duplicated the recipient and was dropped — so even a delivered receipt told the owner nothing new |

### Evidence from production (read-only, Railway `cabinet-backend`)

- HTTP access logs for **2026-10-26 → 2026-11-06** contain **zero** requests to
  `/api/stripe/webhook`. The endpoint is mounted correctly
  (`server/_core/index.ts:100`, before `express.json()`), but nothing calls it —
  the Stripe Dashboard webhook is not configured. **This is the primary reason
  no automatic receipt can fire today: no event ever reaches the server.**
- Deploy logs contain **zero** `[Order Receipt]` and zero `[Stripe Webhook]`
  lines over the same period.
- The only `[OrderEmail] … Resend sent to 7809tom@gmail.com` lines are
  **distributor purchase orders** ("sent order … to distributor 210001"), not
  receipts. Those are a different path and were working.

## What this patch changes

`server/stripeWebhook.ts` and friends; see the patch header. In short:

1. A missing `receiptSentAt` now means "send without deduplication"
   (`unclaimable`) instead of "do not send".
2. `invoice.paid` and `invoice.payment_succeeded` confirm the order and notify.
3. All payment email work moved into `deliverPaymentEmails`, which logs and
   swallows — a paid order can no longer be reported to Stripe as failed.
4. The receipt no longer fabricates a BCC address. Unset copy address = no copy.
5. New `server/lib/paymentNoticeEmail.ts` sends the owner an independent
   payment-received notice (amount, customer, paid-at, Stripe reference) with its
   own claim marker, from **every** path that records a payment:
   Stripe checkout completion, payment intent success, `invoice.paid`,
   the Authorize.net `payments.charge` approval, and admin mark-paid.

## What the owner must do (not done here — no settings, env, or DNS changes)

1. **Run the SQL** — `docs/sql/0250_payment_notice_email.tidb.sql`, one statement.
   (`docs/sql/0224_order_admin_reconciliation.tidb.sql` is still worth running for
   the customer receipt marker; the receipt now works without it but will not
   deduplicate.)
2. **Add the Stripe webhook** in the Stripe Dashboard:
   - URL: `https://api.cabinetdealz.com/api/stripe/webhook`
   - Events: `checkout.session.completed`,
     `checkout.session.async_payment_succeeded`, `payment_intent.succeeded`,
     `invoice.paid`, `invoice.payment_succeeded`, `charge.refunded`,
     `payment_intent.payment_failed`
   - Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` on Railway.
     Until that variable is set, the handler throws
     "Stripe webhook signing secret is not configured" and returns 400.
3. **Set the notification inbox** — `ORDER_NOTIFY_EMAIL` (falls back to
   `OWNER_EMAIL`, which defaults to `7809tom@gmail.com`). This is the address the
   payment-received notice goes to.
