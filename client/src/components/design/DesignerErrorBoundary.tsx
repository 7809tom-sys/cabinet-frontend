import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, Fragment, createContext, useContext, useEffect, type ErrorInfo, type ReactNode } from "react";

interface Props {
  /** Which surface this guards, for the console log and test hooks. */
  surface: string;
  /** When this changes while the panel is showing, the surface remounts (e.g. after an undo). */
  resetKey?: string | number;
  children: ReactNode;
}

interface State {
  error: Error | null;
  mountKey: number;
}

/** A crash within this long of the last remount counts as the same streak. */
export const DESIGNER_BOUNDARY_STABLE_MS = 15_000;
/** The crash that starts a full page reload instead of another remount. */
export const DESIGNER_BOUNDARY_MAX_CRASHES = 3;
export const DESIGNER_BOUNDARY_RELOAD_FLAG = "cabinetdealz.designerBoundaryReload";

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
    if (storage.getItem(DESIGNER_BOUNDARY_RELOAD_FLAG) != null) return false;
    storage.setItem(DESIGNER_BOUNDARY_RELOAD_FLAG, JSON.stringify({ surface, reason, at: designerBoundaryEnv.now() }));
  } catch {
    return false;
  }
  designerBoundaryEnv.reload();
  return true;
}

function clearReloadFlag() {
  try {
    designerBoundaryEnv.storage()?.removeItem(DESIGNER_BOUNDARY_RELOAD_FLAG);
  } catch {
    /* storage unavailable */
  }
}

type FlushRegistry = Set<() => void>;
const DesignerCrashFlushContext = createContext<FlushRegistry | null>(null);

/**
 * Registers a save that the nearest designer boundary runs when the surface
 * crashes, before the surface is torn down (its own unmount cancels any pending
 * debounced save).
 */
export function useDesignerCrashFlush(flush: () => void) {
  const registry = useContext(DesignerCrashFlushContext);
  useEffect(() => {
    if (!registry) return;
    registry.add(flush);
    return () => {
      registry.delete(flush);
    };
  }, [registry, flush]);
}

/**
 * Keeps a render error inside a designer surface (including React #185, the
 * update-depth limit) in place instead of the full-page error screen.
 *
 * Reload designer remounts the surface. It comes back from its saved draft,
 * flushed here at the crash; a design opened from a saved design or package
 * link reloads that saved version instead, without unsaved edits. A chunk that
 * failed to load, or a third crash in a row, reloads the page once (see
 * guardedPageReload).
 */
export class DesignerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, mountKey: 0 };
  private readonly flushes: FlushRegistry = new Set();
  private crashes = 0;
  private remountedAt = Number.NEGATIVE_INFINITY;
  private stableTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidMount() {
    this.scheduleStable();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.remount();
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
    this.flushes.forEach((flush) => {
      try {
        flush();
      } catch (flushError) {
        console.error(`Designer surface "${this.props.surface}" could not save its draft`, flushError);
      }
    });
    this.crashes = designerBoundaryEnv.now() - this.remountedAt <= DESIGNER_BOUNDARY_STABLE_MS ? this.crashes + 1 : 1;
    if (isChunkLoadError(error)) guardedPageReload(this.props.surface, "chunk-load");
    else if (this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES) guardedPageReload(this.props.surface, "repeated-crash");
  }

  private scheduleStable() {
    if (this.stableTimer) return;
    this.stableTimer = setTimeout(() => {
      this.stableTimer = null;
      if (this.state.error) return;
      this.crashes = 0;
      clearReloadFlag();
    }, DESIGNER_BOUNDARY_STABLE_MS);
  }

  private remount() {
    this.remountedAt = designerBoundaryEnv.now();
    this.setState((current) => ({ error: null, mountKey: current.mountKey + 1 }));
  }

  reload = () => {
    if (isChunkLoadError(this.state.error) || this.crashes >= DESIGNER_BOUNDARY_MAX_CRASHES) {
      designerBoundaryEnv.reload();
      return;
    }
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
