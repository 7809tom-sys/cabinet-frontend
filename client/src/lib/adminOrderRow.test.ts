import { describe, expect, it } from "vitest";
import {
  ADMIN_ORDER_CARRIERS,
  adminOrderCarrierOptions,
  adminOrderCarrierUsesOrderNumber,
  adminOrderShipment,
  adminOrderTrackingFieldLabel,
  adminOrderVerified,
} from "./adminOrderRow";
import { PALLET_PHOTO_MAX_BYTES, adminOrderPalletPhotos, palletPhotoValidation } from "./orderPalletPhoto";

const base = {
  orderShippedAt: null,
  shipmentCarrier: null,
  shipmentTracking: null,
  shipments: [],
} as const;

describe("admin order carrier choices", () => {
  it("offers exactly the four carriers Tom books with", () => {
    expect([...ADMIN_ORDER_CARRIERS]).toEqual([
      "FedEx",
      "Skyline",
      "Worldwide Express",
      "US Cabinet Depot",
    ]);
    expect(adminOrderCarrierOptions(null)).toEqual([...ADMIN_ORDER_CARRIERS]);
  });

  it("keeps a carrier already saved on the order even when it is not in the list", () => {
    expect(adminOrderCarrierOptions("UPS")).toEqual([...ADMIN_ORDER_CARRIERS, "UPS"]);
    // A saved value that matches a list entry case-insensitively is not duplicated.
    expect(adminOrderCarrierOptions("fedex")).toEqual([...ADMIN_ORDER_CARRIERS]);
  });

  it("treats the US Cabinet Depot field as their order number", () => {
    expect(adminOrderCarrierUsesOrderNumber("US Cabinet Depot")).toBe(true);
    expect(adminOrderTrackingFieldLabel("US Cabinet Depot")).toBe("Order number");
    expect(adminOrderTrackingFieldLabel("FedEx")).toBe("Tracking number");
    expect(adminOrderCarrierUsesOrderNumber("Skyline")).toBe(false);
  });
});

describe("admin order shipment summary", () => {
  it("reads the saved carrier and tracking when the order has shipped", () => {
    const shipment = adminOrderShipment({
      ...base,
      orderShippedAt: "2026-11-02T15:00:00.000Z",
      shipmentCarrier: "FedEx",
      shipmentTracking: "1Z999AA10123456784",
    });
    expect(shipment.shipped).toBe(true);
    // FedEx has a URL format already in the codebase, so the link is shown.
    expect(shipment.trackingUrl).toBe("https://www.fedex.com/fedextrack/?trknbr=1Z999AA10123456784");
  });

  it("does not invent a tracking link for a carrier with no URL format in the codebase", () => {
    const shipment = adminOrderShipment({
      ...base,
      orderShippedAt: "2026-11-02T15:00:00.000Z",
      shipmentCarrier: "Skyline",
      shipmentTracking: "SK-4417",
    });
    expect(shipment.tracking).toBe("SK-4417");
    expect(shipment.trackingUrl).toBeNull();
  });

  it("falls back to a shipment record and reports not shipped otherwise", () => {
    expect(adminOrderShipment({ ...base, shipments: [{ status: "shipped", carrier: "FedEx", trackingNumber: "1Z2" }] }).shipped).toBe(true);
    expect(adminOrderShipment(base).shipped).toBe(false);
    expect(adminOrderVerified({ orderVerifiedAt: null })).toBe(false);
    expect(adminOrderVerified({ orderVerifiedAt: "2026-11-01T10:00:00.000Z" })).toBe(true);
  });
});

describe("pallet photo helpers", () => {
  it("lists only real photo urls attached to the order or its shipments", () => {
    const photos = adminOrderPalletPhotos({
      ...base,
      palletPhotoUrl: " https://cdn.example/pallet-1.jpg ",
      palletPhotoUrls: ["https://cdn.example/pallet-1.jpg", "https://cdn.example/pallet-2.jpg"],
      shipments: [{ status: "shipped", palletPhotos: ["https://cdn.example/pallet-3.jpg"] }],
    } as never);
    expect(photos.map((photo) => photo.url)).toEqual([
      "https://cdn.example/pallet-1.jpg",
      "https://cdn.example/pallet-2.jpg",
      "https://cdn.example/pallet-3.jpg",
    ]);
  });

  it("rejects a photo that is empty, not an image, or too large", () => {
    expect(palletPhotoValidation(null)).toContain("Choose a photo");
    expect(palletPhotoValidation({ size: 0, type: "image/jpeg" })).toContain("empty");
    expect(palletPhotoValidation({ size: 1000, type: "application/pdf" })).toContain("Only photos");
    expect(palletPhotoValidation({ size: PALLET_PHOTO_MAX_BYTES + 1, type: "image/jpeg" })).toContain("MB");
    expect(palletPhotoValidation({ size: 1000, type: "image/jpeg" })).toBeNull();
  });
});
