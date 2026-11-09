/**
 * A tab opened before a deploy still points at the previous build's hashed
 * chunks, which the new deployment no longer serves. React.lazy keeps the
 * rejected import, so remounting can never recover; only a page load that
 * fetches the current index.html does.
 */
const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return CHUNK_LOAD_ERROR.test(`${String(name ?? "")}: ${String(message ?? error)}`);
}

/** Swappable in tests; jsdom cannot reload. */
export const pageReloadEnv = {
  reload: () => window.location.reload(),
  storage: (): Storage | null => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  },
  now: () => Date.now(),
};

/** Set by whichever automatic reload runs first for a stale chunk, so the other one does not reload again. */
export const STALE_CHUNK_RELOAD_FLAG = "cabinetdealz.staleChunkReload";
/** How long a page must run without a stale chunk before another automatic reload is allowed. */
export const STALE_CHUNK_STABLE_MS = 15_000;

let staleChunkThisLoad = false;
let reloadPending = false;

/**
 * True once an automatic reload is on its way. A cancelled `vite:preloadError`
 * resolves the import with nothing, so React then throws a different error
 * that is really the same stale chunk.
 */
export function pageReloadPending(): boolean {
  return reloadPending;
}

/** A fresh page load; jsdom tests call it between cases because the page never unloads. */
export function resetPageReloadState() {
  staleChunkThisLoad = false;
  reloadPending = false;
}

/**
 * The one guard for automatic page reloads. Reloads (deferred, so the current
 * commit and unload listeners finish first) only if none of `flags` is set yet,
 * and sets them all. Without session storage, or when it throws, there is no
 * guard, so nothing reloads automatically.
 */
export function guardedPageReload(flags: readonly string[], record: Record<string, unknown>): boolean {
  try {
    const storage = pageReloadEnv.storage();
    if (!storage) return false;
    if (flags.some((flag) => storage.getItem(flag) != null)) return false;
    const value = JSON.stringify({ ...record, at: pageReloadEnv.now() });
    for (const flag of flags) storage.setItem(flag, value);
  } catch {
    return false;
  }
  reloadPending = true;
  setTimeout(() => pageReloadEnv.reload(), 0);
  return true;
}

export function reloadGuardUsed(flag: string): boolean {
  try {
    return pageReloadEnv.storage()?.getItem(flag) != null;
  } catch {
    return false;
  }
}

export function clearReloadGuard(flag: string) {
  try {
    pageReloadEnv.storage()?.removeItem(flag);
  } catch {
    /* storage unavailable */
  }
}

/**
 * Reloads the page once for a stale chunk. `alsoFlags` lets a caller record the
 * reload under its own guard too. A second failure after that reload is left to
 * the error panel instead of reloading in a loop.
 */
export function reloadForStaleChunk(source: string, alsoFlags: readonly string[] = []): boolean {
  staleChunkThisLoad = true;
  return guardedPageReload([STALE_CHUNK_RELOAD_FLAG, ...alsoFlags], { surface: source, reason: "chunk-load" });
}

/**
 * Vite emits `vite:preloadError` when a dynamic import or its CSS fails to load;
 * cancelling it stops the import from rejecting while the page reloads. A page
 * load that runs STALE_CHUNK_STABLE_MS without a stale chunk re-arms the guard.
 */
export function installStaleChunkReload(target: Pick<Window, "addEventListener"> = window): void {
  resetPageReloadState();
  target.addEventListener("vite:preloadError", (event) => {
    if (reloadForStaleChunk("page")) event.preventDefault();
  });
  setTimeout(() => {
    if (!staleChunkThisLoad) clearReloadGuard(STALE_CHUNK_RELOAD_FLAG);
  }, STALE_CHUNK_STABLE_MS);
}
