import {
  buildTawkEmbedUrl,
  isTawkConfigured as isConfigured,
  normalizeWidgetId,
} from "@shared/tawk";

/**
 * Tawk.to live-chat integration.
 *
 * The owner creates a free account at https://tawk.to, adds a property for the
 * site, and pastes the Property ID + Widget ID into the env vars below. Until
 * then everything no-ops gracefully (the "Talk to a live person" button shows a
 * friendly note instead of opening the live chat).
 *
 *   VITE_TAWK_PROPERTY_ID = the long id in the embed src (e.g. 5f1a2b3c...)
 *   VITE_TAWK_WIDGET_ID   = the widget id after the slash (often "default")
 */

const PROPERTY_ID = (import.meta.env.VITE_TAWK_PROPERTY_ID as string | undefined)?.trim();
const WIDGET_ID = normalizeWidgetId(import.meta.env.VITE_TAWK_WIDGET_ID as string | undefined);

declare global {
  interface Window {
    Tawk_API?: any;
    Tawk_LoadStart?: Date;
  }
}

let loadPromise: Promise<boolean> | null = null;

export function isTawkConfigured(): boolean {
  return isConfigured(PROPERTY_ID);
}

/**
 * Lazily inject the Tawk.to script. Returns true once the API is available.
 * Safe to call multiple times — the script is only added once.
 */
export function loadTawk(): Promise<boolean> {
  const src = buildTawkEmbedUrl(PROPERTY_ID, WIDGET_ID);
  if (!src) return Promise.resolve(false);
  if (typeof window === "undefined") return Promise.resolve(false);
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<boolean>((resolve) => {
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_API.onLoad = () => {
      try {
        window.Tawk_API?.hideWidget?.();
      } catch {
        /* ignore */
      }
      resolve(true);
    };
    window.Tawk_LoadStart = new Date();

    const s = document.createElement("script");
    s.async = true;
    s.src = src;
    s.charset = "UTF-8";
    s.setAttribute("crossorigin", "*");
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

  return loadPromise;
}

/**
 * Open the Tawk.to live chat, loading it on demand. Returns false if Tawk is
 * not configured (caller can show a fallback message).
 */
export async function openLiveChat(): Promise<boolean> {
  const ok = await loadTawk();
  if (!ok) return false;
  try {
    window.Tawk_API?.showWidget?.();
    window.Tawk_API?.maximize?.();
    return true;
  } catch {
    return false;
  }
}
