import { useEffect, useState } from "react";

/**
 * Shows a notice once for `durationMs`, then hides it. Dismissing it, or the
 * timer finishing, sticks for this exact signature so a re-render does not
 * bring the same notice back. A new signature (a new action) shows again.
 */
export function useTransientNotice(signature: string, durationMs = 8000): { visible: boolean; dismiss: () => void } {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  useEffect(() => {
    if (!signature || dismissed === signature) return undefined;
    setExpired((current) => (current === signature ? current : null));
    const timer = window.setTimeout(() => setExpired(signature), durationMs);
    return () => window.clearTimeout(timer);
  }, [dismissed, durationMs, signature]);
  const visible = signature.length > 0 && dismissed !== signature && expired !== signature;
  return {
    visible,
    dismiss: () => setDismissed(signature),
  };
}
