/**
 * A tab opened before a deploy still points at the previous build's hashed
 * chunks, which the new deployment no longer serves. React.lazy keeps the
 * rejected import, so remounting can never recover; only a page load that
 * fetches the current index.html does.
 */
const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading (?:CSS )?chunk [\w-]+ failed|ChunkLoadError/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return CHUNK_LOAD_ERROR.test(message);
}

export const STALE_CHUNK_RELOAD_KEY = "cabinet-dealz:stale-chunk-reload-at";
const RELOAD_GUARD_MS = 30_000;

export interface StaleChunkReloadEnv {
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  reload: () => void;
  now: () => number;
}

function browserEnv(): StaleChunkReloadEnv {
  let storage: StaleChunkReloadEnv["storage"] = null;
  try { storage = window.sessionStorage; } catch { storage = null; }
  return { storage, reload: () => window.location.reload(), now: () => Date.now() };
}

/**
 * Reloads the page once for a stale chunk. A second failure within the guard
 * window means the chunk is really missing, so it is left to the error panel
 * instead of reloading in a loop.
 */
export function reloadForStaleChunk(env: StaleChunkReloadEnv = browserEnv()): boolean {
  const now = env.now();
  try {
    const last = Number(env.storage?.getItem(STALE_CHUNK_RELOAD_KEY) ?? 0);
    if (Number.isFinite(last) && last > 0 && now - last < RELOAD_GUARD_MS) return false;
    env.storage?.setItem(STALE_CHUNK_RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: reload anyway; the browser's own navigation is the guard.
  }
  env.reload();
  return true;
}

/** Vite emits `vite:preloadError` when a dynamic import or its CSS fails to load. */
export function installStaleChunkReload(target: Pick<Window, "addEventListener"> = window, env?: StaleChunkReloadEnv): void {
  target.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleChunk(env)) event.preventDefault();
  });
}
