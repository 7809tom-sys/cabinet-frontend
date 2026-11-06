import { describe, expect, it } from "vitest";
import {
  ORDER_RECEIVED_EMAIL_SQL_FILE,
  ORDER_STATUS_SQL_FILE,
  isMissingOrderSchemaMessage,
  orderStatusActionError,
} from "./orderStatusActionError";

describe("order status action errors", () => {
  it("recognises the missing-column failures the buttons were showing", () => {
    expect(isMissingOrderSchemaMessage("Unknown column 'orderVerifiedAt' in 'field list'")).toBe(true);
    expect(isMissingOrderSchemaMessage("ER_BAD_FIELD_ERROR: Unknown column 'orderShippedAt'")).toBe(true);
    expect(isMissingOrderSchemaMessage("Table 'cabinet_dealz.order_requests' doesn't exist")).toBe(true);
    expect(isMissingOrderSchemaMessage("Order status columns are missing on order_requests.")).toBe(true);
    expect(isMissingOrderSchemaMessage("Order status columns are missing on order_requests. Run the distributor order email SQL before marking an order verified, shipped, or signed.")).toBe(true);
  });

  it("does not claim a missing column for an unrelated failure", () => {
    expect(isMissingOrderSchemaMessage("Email is not configured")).toBe(false);
    expect(isMissingOrderSchemaMessage("timeout")).toBe(false);
    expect(isMissingOrderSchemaMessage(null)).toBe(false);
    expect(isMissingOrderSchemaMessage(undefined)).toBe(false);
  });

  it("names the SQL file to run instead of repeating the database error", () => {
    const message = orderStatusActionError("verified", { message: "Unknown column 'orderVerifiedAt' in 'field list'" });
    expect(message).toContain("Order verified");
    expect(message).toContain(ORDER_STATUS_SQL_FILE);
    expect(message).not.toContain("Unknown column");
  });

  it("points the received email at its own SQL file", () => {
    const message = orderStatusActionError("order_received_email", "Unknown column 'orderReceivedEmailSentAt'");
    expect(message).toContain(ORDER_RECEIVED_EMAIL_SQL_FILE);
    expect(message).toContain("Order received email");
  });

  it("passes an ordinary error through unchanged", () => {
    expect(orderStatusActionError("shipped", { message: "Carrier is required" })).toBe("Carrier is required");
  });

  it("still says something useful when the error has no message", () => {
    expect(orderStatusActionError("signed", null)).toBe("Order signed could not be saved.");
    expect(orderStatusActionError("signed", "   ")).toBe("Order signed could not be saved.");
  });
});
