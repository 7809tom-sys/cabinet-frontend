/** Success and info notices leave on their own after about five seconds. */
export const TOAST_INFO_MS = 5000;
/** Warnings and errors stay a little longer, then leave on their own. */
export const TOAST_ALERT_MS = 8000;
/** The deployed-version prompt is a decision (refresh or later), so it stays. */
export const VERSION_TOAST_ID = "cabinet-dealz-version-update";

export function toastDuration(
  kind: "info" | "alert" | "loading",
  data?: { duration?: number; id?: string | number },
): number {
  if (kind === "loading") return data?.duration ?? Number.POSITIVE_INFINITY;
  if (data?.id === VERSION_TOAST_ID && data.duration === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  if (data?.duration != null && data.duration !== Number.POSITIVE_INFINITY) return data.duration;
  return kind === "alert" ? TOAST_ALERT_MS : TOAST_INFO_MS;
}
