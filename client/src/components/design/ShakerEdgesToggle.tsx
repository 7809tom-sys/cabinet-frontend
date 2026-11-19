import { useShakerOutlinePolicy } from "@/lib/useShakerOutlinePolicy";

/** Show or hide the shaker edge lines on painted doors in the 3D Designer. */
export function ShakerEdgesToggle() {
  const { enabled, setEnabled } = useShakerOutlinePolicy();
  return (
    <button
      type="button"
      data-testid="shaker-edges-toggle"
      aria-pressed={enabled}
      title={enabled ? "Hide the door edge lines" : "Show the door edge lines"}
      onClick={() => setEnabled(!enabled)}
      className="rounded-full border border-slate-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-white"
    >
      Door edges: {enabled ? "On" : "Off"}
    </button>
  );
}
