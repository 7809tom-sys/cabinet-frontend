import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The payment-receipt fix lives in the backend repo, which this repository
 * cannot push to. It is carried as a patch (the same convention as the other
 * `docs/patches/cabinet-backend-*.patch` files) plus the SQL the owner runs.
 * These checks keep the patch present, self-consistent, and reviewable.
 */
const patch = readFileSync(new URL("../../../docs/patches/cabinet-backend-payment-receipts.patch", import.meta.url), "utf8");
const sql = readFileSync(new URL("../../../docs/sql/0250_payment_notice_email.tidb.sql", import.meta.url), "utf8");

describe("payment receipt patch", () => {
  it("carries the owner payment notice module", () => {
    expect(patch).toContain("server/lib/paymentNoticeEmail.ts");
    expect(patch).toContain("sendOwnerPaymentNotice");
  });

  it("handles every paid Stripe event shape, including invoice.paid", () => {
    for (const eventType of [
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "payment_intent.succeeded",
      "invoice.paid",
      "invoice.payment_succeeded",
    ]) {
      expect(patch).toContain(eventType);
    }
  });

  it("no longer aborts the customer receipt on a missing marker column", () => {
    // The removed behaviour was the root cause of "no receipts ever": an early
    // return that skipped the send entirely. Only the receipt module's added
    // lines are checked; the patch naturally still shows the old lines removed,
    // and the owner notice module legitimately uses "schema_missing" for its own
    // (send-anyway) claim.
    const receiptSection = patch.slice(
      patch.indexOf("diff --git a/server/lib/orderReceiptEmail.ts"),
      patch.indexOf("diff --git a/server/lib/orderSideEffects.ts"),
    );
    expect(receiptSection.length).toBeGreaterThan(200);
    const added = receiptSection
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .join("\n");
    expect(added).toContain('claim === "unclaimable"');
    expect(added).not.toContain('claim === "schema_missing"');
    // The old guard that skipped the whole send for an unusable notify address
    // must not come back either.
    expect(added).not.toContain("ORDER_NOTIFY_EMAIL is not a usable address, so the paid-order receipt was not sent.");
  });

  it("covers the non-Stripe payment paths as well", () => {
    expect(patch).toContain("authorizenet.payments.charge");
    expect(patch).toContain("admin:${by}");
  });
});

describe("payment notice SQL", () => {
  it("is one statement per line, qualified for the owner to paste", () => {
    const statements = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("--"));
    expect(statements).toHaveLength(1);
    expect(statements[0]).toMatch(/^ALTER TABLE cabinet_dealz\.order_requests /);
    expect(statements[0]).toContain("ADD COLUMN IF NOT EXISTS paymentNoticeSentAt TIMESTAMP NULL");
  });

  it("is safe to re-run", () => {
    expect(sql).toContain("IF NOT EXISTS");
    expect(sql).not.toContain("DROP ");
  });
});
