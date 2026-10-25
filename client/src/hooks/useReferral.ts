import { useCallback, useEffect, useState } from "react";

// Persisted referral attribution. A referral code can arrive via a storefront
// visit (/store/:slug captures the affiliate's code) or a ?ref=CODE query param
// on any page. We stash it in localStorage so it survives navigation and is sent
// along when an order request is submitted.
const KEY = "cd_referral_code";
const KEY_AT = "cd_referral_at";
/** Affiliate slug stored alongside the referral code so the order builder can
 *  apply the affiliate's markup to prices (e.g. "abc-cabinets"). */
const KEY_SLUG = "cd_affiliate_slug";
// Referral attribution window: 30 days.
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function normalize(raw: string): string {
  return (raw || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

export function readReferralCode(): string | null {
  try {
    const code = localStorage.getItem(KEY);
    const at = Number(localStorage.getItem(KEY_AT) ?? "0");
    if (!code) return null;
    if (at && Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      localStorage.removeItem(KEY_AT);
      localStorage.removeItem(KEY_SLUG);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

/** Read the affiliate slug that was stored when the storefront was visited. */
export function readAffiliateSlug(): string | null {
  try {
    return localStorage.getItem(KEY_SLUG) || null;
  } catch {
    return null;
  }
}

export function setReferralCode(raw: string, slug?: string): string | null {
  const code = normalize(raw);
  if (!code) return null;
  try {
    localStorage.setItem(KEY, code);
    localStorage.setItem(KEY_AT, String(Date.now()));
    if (slug) localStorage.setItem(KEY_SLUG, slug.toLowerCase());
  } catch {
    /* ignore storage errors (private mode, etc.) */
  }
  return code;
}

export function clearReferralCode(): void {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(KEY_AT);
    localStorage.removeItem(KEY_SLUG);
  } catch {
    /* ignore */
  }
}

// Hook: on mount, capture ?ref= from the URL (if present) and expose the
// current referral code. Optionally seed a code (e.g. from a storefront).
export function useReferral(seed?: string | null) {
  const [code, setCode] = useState<string | null>(() => readReferralCode());

  useEffect(() => {
    // 1) Seed from a storefront slug visit.
    if (seed) {
      const saved = setReferralCode(seed);
      if (saved) setCode(saved);
    }
    // 2) Capture ?ref= on any page load.
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref");
      if (ref) {
        const saved = setReferralCode(ref);
        if (saved) setCode(saved);
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed]);

  const update = useCallback((raw: string) => {
    const saved = setReferralCode(raw);
    setCode(saved);
    return saved;
  }, []);

  const clear = useCallback(() => {
    clearReferralCode();
    setCode(null);
  }, []);

  return { referralCode: code, setReferral: update, clearReferral: clear };
}
