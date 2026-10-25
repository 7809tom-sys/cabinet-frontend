import { HARDWARE_STYLES, type HardwareStyleId } from "@/lib/hardware";

/** Regular Designer only. Other renderers retain their own unchanged defaults. */
export const DEFAULT_DESIGNER_HARDWARE_STYLE_ID: HardwareStyleId = "bar-pull";

interface Props {
  value: HardwareStyleId;
  onChange: (value: HardwareStyleId) => void;
  tablet?: boolean;
}

export function CabinetHandlesControl({ value, onChange, tablet = false }: Props) {
  return (
    <label
      data-testid="designer-handles-control"
      title="Handles are an unpriced finishing specification, not an added catalog or checkout charge."
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background px-1.5 text-[11px] font-medium text-[#1a2744] ${tablet ? "min-h-10" : "min-h-8"}`}
    >
      <span>Handles</span>
      <select
        aria-label="Cabinet handles"
        data-testid="designer-handles-select"
        value={value}
        onChange={(event) => onChange(event.target.value as HardwareStyleId)}
        className={`max-w-[7.5rem] min-w-0 cursor-pointer rounded border-0 bg-transparent px-1 text-[11px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#a87f33] ${tablet ? "min-h-10" : "min-h-8"}`}
      >
        {HARDWARE_STYLES.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
      </select>
    </label>
  );
}
