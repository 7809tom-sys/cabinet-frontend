import { Component, type ErrorInfo, type ReactNode } from "react";

/** Keeps a WalzCraft helper crash from blanking the door style editor. */
export class WalzCraftErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("WalzCraft block failed to render", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div role="alert" data-testid="walzcraft-error" className="rounded-md border border-[#d7a46c] bg-[#fffdf9] p-2 text-xs text-[#244338]">
          {this.props.label ?? "WalzCraft match"} could not load for this door. The rest of the form still works.
          <button type="button" className="ml-2 underline" onClick={() => this.setState({ error: null })}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}
