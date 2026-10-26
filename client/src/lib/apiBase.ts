/**
 * Base URL of the API when the frontend and backend are hosted separately
 * (frontend on Vercel, API on Railway). Empty means same origin: local
 * development, or a single combined deployment.
 *
 * Only the main tRPC channel uses this. Large uploads and long AI calls go
 * straight to the API host (with CORS) instead of through the Vercel proxy.
 */
const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";

export const API_BASE_URL = raw.replace(/\/+$/, "");

export const apiUrl = (path: string): string =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * QuickBooks OAuth sets a host-scoped cookie and Intuit returns to this site's
 * `/api/qbo/callback`. Call the page origin (Vercel proxies `/api`) so that
 * cookie is present on the callback. Local Vite has no proxy, so it uses the
 * configured API host instead.
 */
export function sameSiteApiUrl(path: string, hostname?: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const host = hostname ?? (typeof window !== "undefined" ? window.location.hostname : "");
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "") return apiUrl(normalized);
  return normalized;
}
