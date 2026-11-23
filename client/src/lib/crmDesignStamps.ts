/**
 * Read-only "First design saved" / "Last design saved" dates on a CRM contact.
 * The server stamps both automatically (database clock) whenever a design
 * linked to the contact is saved; staff never type them. Until SQL 0284 has run
 * on the database they come back NULL and the screens show "—".
 */
export type CrmDesignStampFields = {
  firstDesignSavedAt?: string | Date | null;
  lastDesignSavedAt?: string | Date | null;
};

type Lang = "en" | "es";

export const CRM_DESIGN_STAMP_LABELS = {
  first: { en: "First design saved", es: "Primer diseño guardado" },
  last: { en: "Last design saved", es: "Último diseño guardado" },
} as const;

/** A short local date ("11/23/2026"), or "—" when nothing has been saved yet. */
export function formatDesignSavedDate(value: string | Date | null | undefined, lang: Lang = "en"): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "es" ? "es-US" : "en-US");
}

/** Full local date and time, for a hover title. Empty when not stamped. */
export function designSavedTitle(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}
