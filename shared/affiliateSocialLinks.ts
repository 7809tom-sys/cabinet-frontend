// Affiliate storefront social profiles.
// One JSON field on affiliates.socialLinks is the source of truth.
// facebookUrl and instagramUrl are mirrored for older Customize Store saves.
// Profile URLs and public handles only — never passwords or tokens.

export const AFFILIATE_SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "pinterest",
  "x",
  "linkedin",
  "houzz",
  "google_business",
  "yelp",
  "nextdoor",
  "custom",
] as const;

export type AffiliateSocialPlatform = (typeof AFFILIATE_SOCIAL_PLATFORMS)[number];

export type AffiliateSocialLink = {
  id: string;
  platform: AffiliateSocialPlatform;
  label: string;
  url: string;
  handle: string | null;
  enabled: boolean;
  sortOrder: number;
};

export type PublicAffiliateSocialLink = {
  platform: AffiliateSocialPlatform;
  label: string;
  url: string;
};

export const SOCIAL_PLATFORM_LABELS: Record<AffiliateSocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  pinterest: "Pinterest",
  x: "X",
  linkedin: "LinkedIn",
  houzz: "Houzz",
  google_business: "Google Business Profile",
  yelp: "Yelp",
  nextdoor: "Nextdoor",
  custom: "Custom",
};

const PLATFORM_HOSTS: Record<Exclude<AffiliateSocialPlatform, "custom">, string[]> = {
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  youtube: ["youtube.com", "youtu.be"],
  pinterest: ["pinterest.com", "pin.it"],
  x: ["x.com", "twitter.com"],
  linkedin: ["linkedin.com"],
  houzz: ["houzz.com"],
  google_business: ["business.google.com", "g.page", "maps.app.goo.gl", "goo.gl", "google.com"],
  yelp: ["yelp.com"],
  nextdoor: ["nextdoor.com"],
};

const SECRET_QUERY = /(?:^|[?&])(?:password|passwd|token|access_token|secret|auth)=/i;

export function isAffiliateSocialPlatform(value: string): value is AffiliateSocialPlatform {
  return (AFFILIATE_SOCIAL_PLATFORMS as readonly string[]).includes(value);
}

export function normalizeSocialHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/^@+/, "");
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function validateSocialProfileUrl(
  platform: AffiliateSocialPlatform,
  raw: string,
): { ok: true; url: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, message: "Enter the public profile link." };
  if (trimmed.length > 512) return { ok: false, message: "That link is too long." };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, message: "Enter a full https link." };
  }
  if (parsed.protocol !== "https:") return { ok: false, message: "Profile links must start with https." };
  if (parsed.username || parsed.password) {
    return { ok: false, message: "We only need your public profile link." };
  }
  if (SECRET_QUERY.test(parsed.search)) {
    return { ok: false, message: "We only need your public profile link." };
  }
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (platform === "custom") {
    if (!host || host === "localhost") return { ok: false, message: "Enter a public https link." };
    return { ok: true, url: parsed.toString() };
  }
  const allowed = PLATFORM_HOSTS[platform];
  const hostOk = allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (!hostOk) return { ok: false, message: `Use a ${SOCIAL_PLATFORM_LABELS[platform]} profile link.` };
  if (platform === "google_business") {
    const path = `${parsed.pathname}${parsed.search}`.toLowerCase();
    const obvious = host === "business.google.com" || host.endsWith(".g.page") || host === "g.page" || host === "maps.app.goo.gl";
    const maps = host.endsWith("google.com") && path.includes("/maps");
    const gooMaps = host === "goo.gl" && path.includes("maps");
    if (!obvious && !maps && !gooMaps) {
      return { ok: false, message: "Use a Google Maps or Business Profile link." };
    }
  }
  return { ok: true, url: parsed.toString() };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function readStoredSocialLinks(stored: unknown): AffiliateSocialLink[] | null {
  if (stored == null || stored === "") return null;
  if (typeof stored === "string") {
    try {
      return readStoredSocialLinks(JSON.parse(stored));
    } catch {
      return null;
    }
  }
  if (!Array.isArray(stored)) return null;
  const links: AffiliateSocialLink[] = [];
  stored.forEach((entry, index) => {
    const row = asRecord(entry);
    if (!row || typeof row.platform !== "string" || !isAffiliateSocialPlatform(row.platform)) return;
    const checked = typeof row.url === "string" ? validateSocialProfileUrl(row.platform, row.url) : { ok: false as const, message: "" };
    if (!checked.ok) return;
    const label = typeof row.label === "string" && row.label.trim()
      ? row.label.trim().slice(0, 40)
      : SOCIAL_PLATFORM_LABELS[row.platform];
    links.push({
      id: typeof row.id === "string" && /^[A-Za-z0-9:_-]{1,64}$/.test(row.id) ? row.id : `${row.platform}-${index}`,
      platform: row.platform,
      label,
      url: checked.url,
      handle: normalizeSocialHandle(row.handle),
      enabled: row.enabled !== false,
      sortOrder: typeof row.sortOrder === "number" && Number.isFinite(row.sortOrder) ? row.sortOrder : index,
    });
  });
  return links.sort((a, b) => a.sortOrder - b.sortOrder);
}

function legacyLink(platform: "facebook" | "instagram", url: string | null | undefined, sortOrder: number): AffiliateSocialLink | null {
  if (!url) return null;
  const checked = validateSocialProfileUrl(platform, url);
  if (!checked.ok) return null;
  return {
    id: `legacy-${platform}`,
    platform,
    label: SOCIAL_PLATFORM_LABELS[platform],
    url: checked.url,
    handle: null,
    enabled: true,
    sortOrder,
  };
}

export function socialLinksFromLegacy(legacy?: {
  facebookUrl?: string | null;
  instagramUrl?: string | null;
}): AffiliateSocialLink[] {
  return [
    legacyLink("facebook", legacy?.facebookUrl, 0),
    legacyLink("instagram", legacy?.instagramUrl, 1),
  ].filter((link): link is AffiliateSocialLink => Boolean(link));
}

export function publicSocialLinks(
  stored: unknown,
  legacy?: { facebookUrl?: string | null; instagramUrl?: string | null },
): PublicAffiliateSocialLink[] {
  const storedLinks = readStoredSocialLinks(stored);
  const source = storedLinks ?? socialLinksFromLegacy(legacy);
  const seen = new Set<string>();
  return source
    .filter((link) => link.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .filter((link) => {
      const key = `${link.platform}:${link.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((link) => ({ platform: link.platform, label: link.label, url: link.url }));
}

export function legacySocialColumns(links: AffiliateSocialLink[]): { facebookUrl: string | null; instagramUrl: string | null } {
  const facebook = links.find((link) => link.platform === "facebook" && link.enabled);
  const instagram = links.find((link) => link.platform === "instagram" && link.enabled);
  return {
    facebookUrl: facebook?.url ?? null,
    instagramUrl: instagram?.url ?? null,
  };
}

export function editorSocialLinks(
  stored: unknown,
  legacy?: { facebookUrl?: string | null; instagramUrl?: string | null },
): AffiliateSocialLink[] {
  const storedLinks = readStoredSocialLinks(stored);
  const base = storedLinks ?? socialLinksFromLegacy(legacy);
  const missing = AFFILIATE_SOCIAL_PLATFORMS.filter(
    (platform) => platform !== "custom" && !base.some((link) => link.platform === platform),
  ).map((platform, index) => ({
    id: `platform:${platform}`,
    platform,
    label: SOCIAL_PLATFORM_LABELS[platform],
    url: "",
    handle: null,
    enabled: true,
    sortOrder: base.length + index,
  }));
  return [...base, ...missing];
}

export type SocialLinkDraft = {
  id?: string;
  platform: AffiliateSocialPlatform;
  label?: string;
  url?: string;
  handle?: string | null;
  enabled?: boolean;
};

export function sanitizeSocialLinkDrafts(drafts: SocialLinkDraft[]): { ok: true; links: AffiliateSocialLink[] } | { ok: false; message: string } {
  if (drafts.length > 24) return { ok: false, message: "Save up to 24 profile links." };
  const links: AffiliateSocialLink[] = [];
  const ids = new Set<string>();
  drafts.forEach((draft, index) => {
    const url = (draft.url ?? "").trim();
    const handle = normalizeSocialHandle(draft.handle);
    if (!url && !handle) return;
    if (!url) {
      links.push({
        id: "",
        platform: draft.platform,
        label: "",
        url: "__invalid__:Add the public profile link for that handle.",
        handle: null,
        enabled: false,
        sortOrder: index,
      });
      return;
    }
    const checked = validateSocialProfileUrl(draft.platform, url);
    if (!checked.ok) {
      links.push({
        id: "",
        platform: draft.platform,
        label: "",
        url: `__invalid__:${checked.message}`,
        handle: null,
        enabled: false,
        sortOrder: index,
      });
      return;
    }
    const label = (draft.label ?? "").trim() || SOCIAL_PLATFORM_LABELS[draft.platform];
    if (draft.platform === "custom" && label === SOCIAL_PLATFORM_LABELS.custom) {
      links.push({
        id: "",
        platform: draft.platform,
        label: "",
        url: "__invalid__:Add a label for the custom link.",
        handle: null,
        enabled: false,
        sortOrder: index,
      });
      return;
    }
    if (draft.handle && !handle) {
      links.push({
        id: "",
        platform: draft.platform,
        label: "",
        url: "__invalid__:Handles can only use letters, numbers, dots, and underscores.",
        handle: null,
        enabled: false,
        sortOrder: index,
      });
      return;
    }
    let id = draft.id && /^[A-Za-z0-9:_-]{1,64}$/.test(draft.id) ? draft.id : `link-${index}`;
    while (ids.has(id)) id = `${id}-${index}`;
    ids.add(id);
    links.push({
      id,
      platform: draft.platform,
      label: label.slice(0, 40),
      url: checked.url,
      handle,
      enabled: draft.enabled !== false,
      sortOrder: links.length,
    });
  });
  const invalid = links.find((link) => link.url.startsWith("__invalid__:"));
  if (invalid) return { ok: false, message: invalid.url.replace("__invalid__:", "") };
  return { ok: true, links };
}

export function mergeLegacySocialColumns(
  stored: unknown,
  next: { facebookUrl?: string | null; instagramUrl?: string | null },
  previous?: { facebookUrl?: string | null; instagramUrl?: string | null },
): AffiliateSocialLink[] {
  const storedLinks = readStoredSocialLinks(stored);
  const base = (storedLinks ?? socialLinksFromLegacy(previous ?? next)).filter(
    (link) => link.platform !== "facebook" && link.platform !== "instagram",
  );
  const facebook = legacyLink("facebook", next.facebookUrl, 0);
  const instagram = legacyLink("instagram", next.instagramUrl, 1);
  const merged = [...(facebook ? [facebook] : []), ...(instagram ? [instagram] : []), ...base];
  return merged.map((link, index) => ({ ...link, sortOrder: index }));
}
