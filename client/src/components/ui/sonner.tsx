import { useTheme } from "next-themes";
import { toast, Toaster as Sonner, type ToasterProps } from "sonner";
import { TOAST_INFO_MS, toastDuration } from "@/lib/toastDurations";

type ToastData = { duration?: number; id?: string | number; closeButton?: boolean };

function withDuration(
  original: (message: unknown, data?: ToastData) => string | number,
  kind: "info" | "alert",
) {
  return (message: unknown, data?: ToastData) => original(message, {
    closeButton: true,
    ...data,
    duration: toastDuration(kind, data),
  });
}

let toastDurationsInstalled = false;

/** One place so Designer and admin review toasts leave on their own and can be closed. */
export function installToastDurations() {
  if (toastDurationsInstalled) return;
  toastDurationsInstalled = true;
  const target = toast as unknown as Record<"success" | "info" | "message" | "warning" | "error", (message: unknown, data?: ToastData) => string | number>;
  target.success = withDuration(target.success.bind(toast), "info");
  target.info = withDuration(target.info.bind(toast), "info");
  target.message = withDuration(target.message.bind(toast), "info");
  target.warning = withDuration(target.warning.bind(toast), "alert");
  target.error = withDuration(target.error.bind(toast), "alert");
}

installToastDurations();

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      closeButton
      duration={TOAST_INFO_MS}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          // Deployment notices must stay visible above every Dialog, Sheet,
          // and Designer attribute panel. They remain non-blocking and reload
          // only after the user selects the explicit action.
          zIndex: 2147483647,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
