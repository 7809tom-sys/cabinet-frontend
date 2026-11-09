import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, Fragment, createContext, useContext, useEffect, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Which surface this guards, for the console log and test hooks. */
  surface: string;
  /** When this changes while the panel is showing, the surface remounts (e.g. after an undo). */
  resetKey?: string | number;
  /**
   * Whether a chunk-load failure or a crash streak may reload the page. Off for a
   * surface nested in a designer that stays mounted, such as the 3D view.
   */
  pageReload?: boolean;
  children: ReactNode;
}

interface State {
  error: Error | null;
  mountKey: number;
  /** The page reload has already been tried and a draft can be dropped. */
  canDiscard: boolean;
}

/** A crash within this long of the last remount counts as the same streak. */
export const DESIGNER_BOUNDARY_STABLE_MS = 15_000;
/** The crash that starts a full page reload instead of another remount. */
export const DESIGNER_BOUNDARY_MAX_CRASHES = 3;
const DESIGNER_BOUNDARY_RELOAD_FLAG = "cabinetdealz.designerBoundaryReload";

/** Where a surface saves the state it crashed in, apart from its last good draft. */
export function designerCrashDraftKey(draftKey: string): string {
  return `${draftKey}::crashed`;
}

/** Each surface has its own guard, set and cleared only by that surface's boundary. */
export function designerBoundaryReloadFlag(surface: string): string {
  return `${DESIGNER_BOUNDARY_RELOAD_FLAG}:${surface}`;
}

/** Swappable in tests; jsdom cannot reload. */
export const designerBoundaryEnv = {
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

const CHUNK_LOAD_ERROR = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading (?:CSS )?chunk [\w-]+ failed|Unable to preload CSS/i;

/** A lazy page whose chunk could not load. React caches the rejection, so only a page reload recovers. */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  return CHUNK_LOAD_ERROR.test(`${String(name ?? "")}: ${String(message ?? error)}`);
}

/**
 * One automatic page reload per session until a surface has run cleanly for
 * DESIGNER_BOUNDARY_STABLE_MS, so a page that fails again after reloading shows
 * the panel instead of reloading forever. Without session storage there is no
 * guard, so nothing reloads automatically.
 */
function guardedPageReload(surface: string, reason: string): boolean {
  const storage = designerBoundaryEnv.storage();
  if (!storage) return false;
  try {
    const flag = designerBoundaryReloadFlag(surface);
    if (storage.getItem(flag) != null) return false;
    storage.setItem(flag, JSON.stringify({ surface, reason, at: designerBoundaryEnv.now() }));
  } catch {
    return false;
  }
  designerBoundaryEnv.reload();
  return true;
}

function reloadGuardUsed(surface: string): boolean {
  try {
    return designerBoundaryEnv.storage()?.getItem(designerBoundaryReloadFlag(surface)) != null;
  } catch {
    return false;
  }
}

function clearReloadFlag(surface: string) {
  try {
    designerBoundaryEnv.storage()?.removeItem(designerBoundaryReloadFlag(surface));
  } catch {
    /* storage unavailable */
  }
}

type CrashHandlers = {
  /** Saves the last committed state somewhere that does not replace the last good draft. */
  flush: () => void;
  /** Drops the saved draft so the next mount starts clean. */
  discard?: () => void;
};
type FlushRegistry = Set<CrashHandlers>;
const DesignerCrashFlushContext = createContext<FlushRegistry | null>(null);

/**
 * Registers the handlers the nearest designer boundary runs for this surface:
 * `flush` when it crashes, before it is torn down (its own unmount cancels any
 * pending debounced save), and `discard` from the panel's Discard draft button.
 */
/**
 * The value `snapshot` returned for the last committed render. A crash save reads
 * this instead of calling `snapshot` itself, which would see the state that crashed.
 */
export function useLastCommitted<T>(snapshot: () => T): { readonly current: T | null } {
  const committed = useRef<T | null>(null);
  useLayoutEffect(() => {
    committed.current = snapshot();
  });
  return committed;
}

export function useDesignerCrashFlush(flush: () => void, discard?: () => void) {
  const registry = useContext(DesignerCrashFlushContext);
  useEffect(() => {
    if (!registry) return;
    const handlers: CrashHandlers = { flush, discard };
    registry.add(handlers);
    return () => {
      registry.delete(handlers);
    };
  }, [registry, flush, discard]);
}

/**
 * Keeps a render error inside a designer surface (including React #185, the
 * update-depth limit) in place instead of the full-page error screen.
 *
 * Reload designer remounts the surface. The designer keeps its last good draft
 * and saves the last committed state at the crash under a separate key, so the
 * next mount can offer Restore previous or Start fresh; a design opened from a
 * saved design or package link reloads that saved version, without unsaved
 * edits. A chunk that failed to load, or a third crash in a row after Reload
 * designer, reloads the page once (see guardedPageReload) unless `pageReload`
 * is off. Once that reload has been used, the panel also offers Discard draft.
 */
export class DesignerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, mountKey: 0, canDiscard: false };
  private readonly flushes: FlushRegistry = new Set();
  private crashes = 0;
  private remountedAt = Number.NEGATIVE_INFINITY;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;
  private discards: (() => void)[] = [];

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    this.scheduleStable();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      // Not a retry by the user: a crash after this remount starts a new streak.
      this.remountedAt = Number.NEGATIVE_INFINITY;
      this.setState((current) => ({ error: null, mountKey: current.mountKey + 1, canDiscard: false }));
      return;
    }
    if (!this.state.error) this.scheduleStable();
  }

  componentWillUnmount() {
    if (this.stableTimer) clearTimeout(this.stableTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Designer surface "${this.props.surface}" failed to render`, error, info.componentStack);
    if (this.stableTimer) clearTimeout(this.stableTimer);
    this.stableTimer = null;
    this.discards = [];
    this.flushes.forEach(({ flush, discard }) => {
      if (discard) this.discards.push(discard);
      try {
        flush();
      } catch (flushError) {
        console.error(`Designer surface "${this.props.surface}" could not save its draft`, flushError);
      }
    });
    this.crashes = designerBoundaryEnv.now() - this.remountedAt <= DESIGNER_BOUNDARY_STABLE_MS ? this.crashes + 1 : 1;
    if (this.props.pageReload === false) return;
    const guardUsed = reloadGuardUsed(this.props.surface);
    if (isChunkLoadError(error)) guardedPageReload(this.props.surface, "chunk-load");
    else if (this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES) guardedPageReload(this.props.surface, "repeated-crash");
    if (guardUsed && this.discards.length > 0) this.setState({ canDiscard: true });
  }

  private scheduleStable() {
    if (this.stableTimer) return;
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      if (this.state.error) return;
      this.crashes = 0;
      if (this.props.pageReload !== false) clearReloadFlag(this.props.surface);
    }, DESIGNER_BOUNDARY_STABLE_MS);
  }

  private remount() {
    this.remountedAt = designerBoundaryEnv.now();
    this.setState((current) => ({ error: null, mountKey: current.mountKey + 1, canDiscard: false }));
  }

  reload = () => {
    if (this.props.pageReload !== false && (isChunkLoadError(this.state.error) || this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES)) {
      designerBoundaryEnv.reload();
      return;
    }
    this.remount();
  };

  discardDraft = () => {
    for (const discard of this.discards) {
      try {
        discard();
      } catch (discardError) {
        console.error(`Designer surface "${this.props.surface}" could not discard its draft`, discardError);
      }
    }
    this.discards = [];
    this.crashes = 0;
    this.remount();
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          data-testid="designer-error-boundary"
          data-designer-surface={this.props.surface}
          className="flex h-full min-h-[200px] w-full items-center justify-center p-4"
        >
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-background p-5 text-center shadow-sm">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">The designer hit a problem</p>
            <Button type="button" variant="outline" size="sm" onClick={this.reload}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              Reload designer
            </Button>
            {this.state.canDiscard && (
              <Button type="button" variant="ghost" size="sm" onClick={this.discardDraft}>
                Discard draft
              </Button>
            )}
          </div>
        </div>
      );
    }

    return (
      <DesignerCrashFlushContext.Provider value={this.flushes}>
        <Fragment key={this.state.mountKey}>{this.props.children}</Fragment>
      </DesignerCrashFlushContext.Provider>
    );
  }
}
