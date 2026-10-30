import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { Component, Fragment, type ErrorInfo, type ReactNode } from "react";

interface Props {
  tabName: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
  resetKey: number;
}

/**
 * Catches a render error inside one admin tab so the rest of the admin page
 * stays visible. Retry remounts the tab content.
 */
export class AdminTabErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Admin tab "${this.props.tabName}" failed to render`, error, info);
  }

  retry = () => {
    this.setState((current) => ({ error: null, resetKey: current.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          data-testid="admin-tab-error"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold">{this.props.tabName}</h2>
              <p className="mt-2 text-sm text-destructive">
                {this.state.error.message || "This tab could not be displayed."}
              </p>
              <Button type="button" variant="outline" className="mt-4 bg-background" onClick={this.retry}>
                Retry
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
