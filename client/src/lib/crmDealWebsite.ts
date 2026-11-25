/**
 * Distributor prospect deals carry their website in the notes on a line like
 * "Website: https://www.example.com/". The card shows it as a link.
 */
export type CrmDealWebsite = { url: string; label: string };

const WEBSITE_LINE = /\bWebsite:\s*(https?:\/\/[^\s|;,<>"'`]+)/i;

export function crmDealWebsite(notes: string | null | undefined): CrmDealWebsite | null {
  if (!notes) return null;
  const match = WEBSITE_LINE.exec(notes);
  if (!match) return null;
  try {
    const parsed = new URL(match[1]);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname) return null;
    return { url: parsed.href, label: parsed.hostname.replace(/^www\./i, "") };
  } catch {
    return null;
  }
}
