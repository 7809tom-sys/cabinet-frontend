// Shared CRM pipeline constants used by both the server router (validation) and
// the client board (columns, labels). Keep enum values in sync with the
// `crm_deals` table in drizzle/schema.ts.

export const CRM_STAGES = ["new", "new_sale", "contacted", "qualified", "image_review", "quoted", "won", "lost"] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

// Board order. New Sale sits beside New. Won stays so older closed deals
// still have a column; it is not an open lead stage.
export const CRM_PIPELINE_STAGES: CrmStage[] = ["new", "new_sale", "contacted", "qualified", "image_review", "quoted"];
export const CRM_CLOSED_STAGES: CrmStage[] = ["new_sale", "won", "lost"];

export const CRM_STAGE_LABELS: Record<CrmStage, { en: string; es: string }> = {
  new: { en: "New", es: "Nuevo" },
  new_sale: { en: "New Sale", es: "Nueva venta" },
  contacted: { en: "Contacted", es: "Contactado" },
  qualified: { en: "Qualified", es: "Calificado" },
  image_review: { en: "Image Review", es: "Revisión de imagen" },
  quoted: { en: "Quoted", es: "Cotizado" },
  won: { en: "Won", es: "Ganado" },
  lost: { en: "Lost", es: "Perdido" },
};

export const CRM_PRIORITIES = ["low", "medium", "high"] as const;
export type CrmPriority = (typeof CRM_PRIORITIES)[number];

export const CRM_PRIORITY_LABELS: Record<CrmPriority, { en: string; es: string }> = {
  low: { en: "Low", es: "Baja" },
  medium: { en: "Medium", es: "Media" },
  high: { en: "High", es: "Alta" },
};

export const CRM_ACTIVITY_KINDS = ["note", "call", "email", "meeting", "stage_change", "task"] as const;
export type CrmActivityKind = (typeof CRM_ACTIVITY_KINDS)[number];

export const CRM_SOURCES = ["manual", "order_request", "pro_application", "storefront", "referral", "verified_plan_image_request"] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

export const CRM_LANGUAGES = ["en", "es"] as const;
export type CrmLanguage = (typeof CRM_LANGUAGES)[number];

export function isWonRevenueStage(stage: string | null | undefined): boolean {
  return stage === "won" || stage === "new_sale";
}

export function isClosedStage(stage: CrmStage | string | null | undefined): boolean {
  return stage === "won" || stage === "lost" || stage === "new_sale";
}

// ─── CRM email (send-from-card) ─────────────────────────────────────────────────
// Pure, unit-testable helpers shared by the server procedure and the client
// composer. Keep free of DB/nodemailer imports.

export type SmtpReadiness = {
  configured: boolean; // host + user + pass all present
  enabled: boolean; // admin toggled sending on
};

/**
 * Decide whether an email may be sent given the saved SMTP state.
 * Returns null when OK, or a machine-readable reason when blocked.
 */
export function crmEmailBlockedReason(s: SmtpReadiness): "not_configured" | "disabled" | null {
  if (!s.configured) return "not_configured";
  if (!s.enabled) return "disabled";
  return null;
}

export const CRM_EMAIL_BLOCK_MESSAGES: Record<
  NonNullable<ReturnType<typeof crmEmailBlockedReason>>,
  { en: string; es: string }
> = {
  not_configured: {
    en: "Email sending isn't set up yet. Add your SMTP details in Email Settings first.",
    es: "El envío de correo aún no está configurado. Agregue su SMTP en Configuración de correo.",
  },
  disabled: {
    en: "Email sending is turned off. Enable it in Email Settings to send from a deal.",
    es: "El envío de correo está desactivado. Actívelo en Configuración de correo.",
  },
};

/** Escape user-provided text for safe embedding in an HTML email body. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build a simple, safe HTML email body from a plain-text message. Preserves line
 * breaks and escapes HTML so nothing the sender types can break the markup.
 */
export function crmEmailBodyToHtml(body: string): string {
  const safe = escapeHtml(body).replace(/\r\n/g, "\n").replace(/\n/g, "<br/>");
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a2b4a;white-space:normal;">${safe}</div>`;
}
