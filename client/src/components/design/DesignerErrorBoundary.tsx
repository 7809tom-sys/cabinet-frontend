import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, Fragment, createContext, useContext, useEffect, useLayoutEffect, useRef, type ErrorInfo, type ReactNode } from "react";
import {
  STALE_CHUNK_RELOAD_FLAG,
  clearReloadGuard,
  guardedPageReload,
  isChunkLoadError,
  pageReloadEnv,
  pageReloadPending,
  reloadForStaleChunk,
  reloadGuardUsed,
} from "@/lib/staleChunkReload";

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
  /** Replaces the default crash title. The shared 3D page uses its own wording. */
  message?: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  mountKey: number;
  /** The page reload has already been tried and a draft can be dropped. */
  canDiscard: boolean;
  /** Reload loads the page again; known only once the crash has been counted. */
  reloadsPage: boolean;
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

/** Swappable in tests; jsdom cannot reload. Shared with the page's stale-chunk reload. */
export const designerBoundaryEnv = pageReloadEnv;
export { isChunkLoadError };

/** A chunk from an older deploy, or the error React throws while the reload for one is on its way. */
function isStaleChunk(error: unknown): boolean {
  return isChunkLoadError(error) || pageReloadPending();
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
 * designer, reloads the page once (the shared guard in staleChunkReload) unless
 * `pageReload` is off. Once that reload has been used, the panel also offers
 * Discard draft. Reload on a stale chunk always reloads the page, since a
 * remount replays the same failed import.
 */
export class DesignerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, mountKey: 0, canDiscard: false, reloadsPage: false };
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
      this.setState((current) => ({ error: null, mountKey: current.mountKey + 1, canDiscard: false, reloadsPage: false }));
      return;
    }
    if (!this.state.error) this.scheduleStable();
  }

  componentWillUnmount() {
    if (this.stableTimer) clearTimeout(this.stableTimer);
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Designer surface "${this.props.surface}" failed to render`, error, info.componentStack);
    // The page is already reloading for a stale chunk; the draft autosave on unload keeps the last good state.
    if (!isChunkLoadError(error) && pageReloadPending()) return;
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
    if (this.reloadsPage()) this.setState({ reloadsPage: true });
    if (this.props.pageReload === false) return;
    const surfaceFlag = designerBoundaryReloadFlag(this.props.surface);
    const guardUsed = reloadGuardUsed(surfaceFlag);
    if (isChunkLoadError(error)) reloadForStaleChunk(this.props.surface, [surfaceFlag]);
    else if (this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES) guardedPageReload([surfaceFlag], { surface: this.props.surface, reason: "repeated-crash" });
    if (guardUsed && this.discards.length > 0) this.setState({ canDiscard: true });
  }

  private scheduleStable() {
    if (this.stableTimer) return;
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      if (this.state.error) return;
      this.crashes = 0;
      if (this.props.pageReload === false) return;
      clearReloadGuard(designerBoundaryReloadFlag(this.props.surface));
      clearReloadGuard(STALE_CHUNK_RELOAD_FLAG);
    }, DESIGNER_BOUNDARY_STABLE_MS);
  }

  private remount() {
    this.remountedAt = designerBoundaryEnv.now();
    this.setState((current) => ({ error: null, mountKey: current.mountKey + 1, canDiscard: false, reloadsPage: false }));
  }

  /** Whether Reload loads the page again instead of remounting the surface. */
  private reloadsPage(): boolean {
    // A remount can never recover a stale chunk, so that reload is a page reload even where automatic ones are off.
    if (isStaleChunk(this.state.error)) return true;
    return this.props.pageReload !== false && this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES;
  }

  reload = () => {
    if (this.reloadsPage()) {
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
      const staleBuild = isStaleChunk(this.state.error);
      return (
        <div
          role="alert"
          data-testid="designer-error-boundary"
          data-designer-surface={this.props.surface}
          className="flex h-full min-h-[200px] w-full items-center justify-center p-4"
        >
          <div className="flex max-w-sm flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-background p-5 text-center shadow-sm">
            <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium">
              {staleBuild ? "A newer version of the designer was published" : (this.props.message ?? "The designer hit a problem")}
            </p>
            {staleBuild && (
              <p className="text-xs text-muted-foreground">
                This page is still running the previous version. Reload the page to load the current one; your autosaved draft on this device is kept.
              </p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={this.reload} data-testid="designer-error-reload">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {staleBuild || this.state.reloadsPage ? "Reload page" : "Reload designer"}
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
