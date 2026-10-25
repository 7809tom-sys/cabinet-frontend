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
