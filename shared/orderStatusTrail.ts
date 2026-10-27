// Pure status trail for an incoming order. The admin and sales screens render
// these four steps; the server stores the timestamps and the UI refreshes them.

export type OrderTrailKey = "email_sent" | "verified" | "shipped" | "signed";

export type OrderShipmentFact = {
  status?: string | null;
  shippedAt?: string | Date | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  shippedBy?: string | null;
  signatureName?: string | null;
  deliveredWithSignature?: boolean | null;
};

export type OrderTrailInput = {
  distributorEmailStatus?: string | null;
  distributorEmailSentAt?: string | Date | null;
  distributorEmailTo?: string | null;
  distributorEmailError?: string | null;
  sentToDistributorAt?: string | Date | null;
  sentToDistributorEmail?: string | null;
  orderVerifiedAt?: string | Date | null;
  orderVerifiedBy?: string | null;
  orderShippedAt?: string | Date | null;
  orderShippedBy?: string | null;
  shipmentCarrier?: string | null;
  shipmentTracking?: string | null;
  orderSignedAt?: string | Date | null;
  orderSignedBy?: string | null;
  signerName?: string | null;
  shipments?: OrderShipmentFact[] | null;
};

export type OrderTrailStep = {
  key: OrderTrailKey;
  label: string;
  done: boolean;
  at: string | null;
  actor: string | null;
  detail: string | null;
};

export function trailTimestamp(value: string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function shippedShipment(shipments: OrderShipmentFact[]): OrderShipmentFact | null {
  return shipments.find((row) => row.status === "shipped" || row.shippedAt != null) ?? null;
}

function signedShipment(shipments: OrderShipmentFact[]): OrderShipmentFact | null {
  return shipments.find((row) => row.deliveredWithSignature || (row.signatureName ?? "").trim()) ?? null;
}

export function buildOrderStatusTrail(input: OrderTrailInput): OrderTrailStep[] {
  const shipments = input.shipments ?? [];
  const shipped = shippedShipment(shipments);
  const signed = signedShipment(shipments);
  const emailAt = trailTimestamp(input.distributorEmailSentAt) ?? trailTimestamp(input.sentToDistributorAt);
  const emailTo = (input.distributorEmailTo || input.sentToDistributorEmail || "").trim() || null;
  const emailSent = input.distributorEmailStatus === "sent" || emailAt != null;
  const emailDetail = emailSent
    ? emailTo
    : input.distributorEmailStatus === "no_email"
      ? "No order email set"
      : input.distributorEmailStatus === "failed"
        ? (input.distributorEmailError || "Email failed")
        : input.distributorEmailError || null;

  const shippedAt = trailTimestamp(input.orderShippedAt) ?? trailTimestamp(shipped?.shippedAt);
  const carrier = input.shipmentCarrier || shipped?.carrier || null;
  const tracking = input.shipmentTracking || shipped?.trackingNumber || null;
  const shipDetail = [carrier, tracking].filter(Boolean).join(" · ") || null;

  const signedAt = trailTimestamp(input.orderSignedAt);
  const signatureDone = signedAt != null || signed != null;
  const signer = (input.signerName || signed?.signatureName || "").trim() || null;

  return [
    {
      key: "email_sent",
      label: "Email sent",
      done: emailSent,
      at: emailAt,
      actor: emailSent ? "Distributor email" : null,
      detail: emailDetail,
    },
    {
      key: "verified",
      label: "Order verified",
      done: trailTimestamp(input.orderVerifiedAt) != null,
      at: trailTimestamp(input.orderVerifiedAt),
      actor: input.orderVerifiedBy?.trim() || null,
      detail: null,
    },
    {
      key: "shipped",
      label: "Order shipped",
      done: shippedAt != null,
      at: shippedAt,
      actor: input.orderShippedBy?.trim() || shipped?.shippedBy?.trim() || (shipped ? "Shipment record" : null),
      detail: shipDetail,
    },
    {
      key: "signed",
      label: "Order signed",
      done: signatureDone,
      at: signedAt,
      actor: input.orderSignedBy?.trim() || (signed ? "Delivery signature" : null),
      detail: signer,
    },
  ];
}
