export const AFFILIATE_RESOURCE_TYPES = ["script", "guide", "video", "pdf", "social", "link"] as const;
export type AffiliateResourceType = (typeof AFFILIATE_RESOURCE_TYPES)[number];

export const AFFILIATE_RESOURCE_FILE_PREFIX = "affiliate-resources/";

export type AffiliateResourceChapter = { label: string; startSeconds: number };

export type AffiliateResourceMeta = {
  chapters?: AffiliateResourceChapter[];
  durationSeconds?: number | null;
  hashtags?: string[];
  placeholder?: boolean;
};

export const SCRIPT_SITUATIONS = [
  { id: "phone", label: "Phone" },
  { id: "in-store", label: "In-store" },
  { id: "follow-up", label: "Follow-up" },
  { id: "objection", label: "Objection handling" },
  { id: "closing", label: "Closing" },
] as const;

export const GUIDE_TOPICS = [
  { id: "designer", label: "Designer basics" },
  { id: "quoting", label: "Quoting" },
  { id: "measuring", label: "Measuring" },
  { id: "ordering", label: "Ordering" },
  { id: "pricing", label: "Pricing and margins" },
  { id: "crm", label: "Using the CRM" },
] as const;

export function resourceMatchesQuery(
  item: { title: string; body?: string | null; category?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [item.title, item.body, item.category].some((value) => (value ?? "").toLowerCase().includes(needle));
}

export function youtubeIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const candidate = host === "youtu.be"
      ? parsed.pathname.split("/").filter(Boolean)[0]
      : (host === "youtube.com" || host === "youtube-nocookie.com" || host.endsWith(".youtube.com"))
        ? parsed.searchParams.get("v")
          ?? parsed.pathname.split("/").filter(Boolean).at(parsed.pathname.includes("/embed/") ? 1 : -1)
        : null;
    return candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function youtubeNocookieEmbed(url: string | null | undefined, startSeconds = 0): string | null {
  const id = youtubeIdFromUrl(url);
  if (!id) return null;
  const start = startSeconds > 0 ? `&start=${Math.floor(startSeconds)}` : "";
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0${start}`;
}
