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
}: {
  styles: readonly ColorStyleChoice[];
  value: number | null;
  onChange: (styleId: number) => void;
  disabled?: boolean;
  testId?: string;
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
    </label>
  );
}
