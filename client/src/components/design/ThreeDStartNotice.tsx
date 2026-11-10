import { cn } from "@/lib/utils";
import { THREE_D_BLOCKED_MESSAGE, THREE_D_RECONNECTING_MESSAGE, THREE_D_STARTING_MESSAGE, THREE_D_UNAVAILABLE_MESSAGE } from "./threeDRendererHost";
import type { ThreeDRendererRecovery } from "./useThreeDRendererRecovery";

/** Covers a 3D view's mount while it has no renderer to show; nothing while it renders. */
export function ThreeDStartNotice({ recovery, testIdPrefix, className }: { recovery: ThreeDRendererRecovery; testIdPrefix: string; className?: string }) {
  if (recovery.status === "running" && !recovery.paused) return null;
  const unavailable = recovery.status === "unavailable" || recovery.status === "blocked";
  const message = recovery.status === "blocked"
    ? THREE_D_BLOCKED_MESSAGE
    : recovery.status === "unavailable"
      ? THREE_D_UNAVAILABLE_MESSAGE
      : recovery.paused
        ? THREE_D_RECONNECTING_MESSAGE
        : THREE_D_STARTING_MESSAGE;
  return (
    <div data-testid={`${testIdPrefix}-webgl-${unavailable ? "unavailable" : "starting"}`} role="status" className={cn("absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 px-6 text-center text-sm", className)}>
      <p>{message}</p>
      {recovery.status === "unavailable" && <button type="button" className="rounded-md border border-stone-400 bg-white px-3 py-1.5 text-sm font-semibold" onClick={recovery.retryNow}>Try again now</button>}
    </div>
  );
}
