/**
 * Turns a backend failure from an order status action into something an
 * administrator can act on.
 *
 * The status dots write columns added by docs/sql/0227 (and the "order received"
 * note writes the 0249 columns). When that SQL has not been run, the backend
 * rejects the update and the panel showed a generic failure — indistinguishable
 * from "the button is broken". The buttons are fine; the columns are missing, and
 * the message should say so by name.
 */

export const ORDER_STATUS_SQL_FILE = "docs/sql/0227_distributor_order_email.tidb.sql";
export const ORDER_RECEIVED_EMAIL_SQL_FILE = "docs/sql/0249_order_received_email.tidb.sql";

/** True when the database rejected the write because a column or table is absent. */
export function isMissingOrderSchemaMessage(message: string | null | undefined): boolean {
  return /unknown column|ER_BAD_FIELD_ERROR|ER_NO_SUCH_TABLE|doesn't exist|does not exist|no such table|no such column|status columns are missing|missing on order_requests/i
    .test(message ?? "");
}

export type OrderStatusAction =
  | "verified"
  | "shipped"
  | "signed"
  | "order_received_email";

const ACTION_LABELS: Record<OrderStatusAction, string> = {
  verified: "Order verified",
  shipped: "Order shipped",
  signed: "Order signed",
  order_received_email: "Order received email",
};

/**
 * The line to show the administrator. A missing-columns failure names the exact
 * SQL file to run instead of repeating the raw database error.
 */
export function orderStatusActionError(
  action: OrderStatusAction,
  error: { message?: string | null } | string | null | undefined,
): string {
  const message = typeof error === "string" ? error : (error?.message ?? "");
  const sqlFile = action === "order_received_email" ? ORDER_RECEIVED_EMAIL_SQL_FILE : ORDER_STATUS_SQL_FILE;
  if (isMissingOrderSchemaMessage(message)) {
    return `"${ACTION_LABELS[action]}" needs database columns that are not on this database yet. Run ${sqlFile}, then try again.`;
  }
  const trimmed = message.trim();
  return trimmed || `${ACTION_LABELS[action]} could not be saved.`;
}
