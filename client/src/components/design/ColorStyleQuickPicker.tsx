import { Pencil } from "lucide-react";

export type ColorStyleChoice = {
  id: number;
  name: string;
};

/**
 * Compact door-style control for the Designer toolbar and the 3D front view.
 * It stays visible on desktop, tablet, and phone. The price-panel color slots
 * remain the two-tone editor.
 */
export function ColorStyleQuickPicker({
  styles,
  value,
  onChange,
  disabled = false,
  testId = "color-style-quick-picker",
  editHref = null,
}: {
  styles: readonly ColorStyleChoice[];
  value: number | null;
  onChange: (styleId: number) => void;
  disabled?: boolean;
  testId?: string;
  /** Admin only: the door editor link for the chosen style. A pencil shows beside the control when set. */
  editHref?: string | null;
}) {
  return (
    <label
      data-testid={testId}
      title="Change the door style and color for this design"
      className="inline-flex min-h-8 max-w-full shrink-0 items-center gap-1 rounded-md border border-[#d4a75a]/70 bg-[#fffaf1] px-1.5 text-[11px] font-medium text-[#1a2744]"
    >
      <span className="shrink-0">Color style</span>
      <select
        aria-label="Select a color style"
        data-testid={`${testId}-select`}
        value={value == null ? "" : String(value)}
        disabled={disabled || styles.length === 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next > 0) onChange(next);
        }}
        className="max-w-[11rem] min-w-[8.5rem] cursor-pointer rounded border-0 bg-transparent px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a87f33] disabled:cursor-not-allowed"
      >
        <option value="">{styles.length === 0 ? "No color styles" : "Select a color style"}</option>
        {styles.map((style) => (
          <option key={style.id} value={style.id}>{style.name}</option>
        ))}
      </select>
      {editHref && value != null && (
        <a
          href={editHref}
          data-testid={`${testId}-edit`}
          title="Edit this door style in the door editor"
          aria-label="Edit this door style in the door editor"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#1a2744] hover:bg-[#1a2744] hover:text-white"
        >
          <Pencil className="h-3 w-3" />
        </a>
      )}
    </label>
  );
}
