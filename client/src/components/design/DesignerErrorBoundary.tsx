import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";
import { isChunkLoadError } from "@/lib/staleChunkReload";

interface Props {
  /** Which surface this guards, for the console log and test hooks. */
  surface: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: number;
}

/**
 * Keeps a render error inside a designer surface (including React #185, the
 * update-depth limit) in place instead of the full-page error screen. Reload
 * remounts the surface, which restores the design from its saved draft or the
 * saved design it was opened from. A chunk that failed to load cannot be
 * recovered by a remount, so that case reloads the page instead.
 */
export class DesignerErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Designer surface "${this.props.surface}" failed to render`, error, info.componentStack);
  }

  reload = () => {
    if (isChunkLoadError(this.state.error)) {
      window.location.reload();
      return;
    }
    this.setState((current) => ({ error: null, resetKey: current.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      const staleBuild = isChunkLoadError(this.state.error);
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
              {staleBuild ? "A newer version of the designer was published" : "The designer hit a problem"}
            </p>
            {staleBuild && (
              <p className="text-xs text-muted-foreground">
                This page is still running the previous version. Reload the page to load the current one; your autosaved draft on this device is kept.
              </p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={this.reload} data-testid="designer-error-reload">
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {staleBuild ? "Reload page" : "Reload designer"}
            </Button>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
