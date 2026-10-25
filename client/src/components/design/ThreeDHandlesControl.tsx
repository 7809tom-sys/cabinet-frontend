import { useId, useRef, useState } from "react";
import { ChevronDown, Wrench } from "lucide-react";
import { CabinetHandlesControl } from "./CabinetHandlesControl";
import { hardwareStyle, type HardwareStyleId } from "@/lib/hardware";

function HardwarePreview({ style }: { style: HardwareStyleId }) {
  const resolved = hardwareStyle(style);
  const sample = (piece: "knob" | "pull" | "cup" | "none") => {
    if (piece === "none") return <span className="text-[10px] text-muted-foreground">none</span>;
    if (piece === "knob") return <span className="h-2.5 w-2.5 rounded-full bg-[#26364c] shadow-sm" aria-label="knob preview" />;
    if (piece === "cup") return <span className="inline-flex h-2.5 w-5 items-end justify-center rounded-b-md border-2 border-[#26364c]" aria-label="cup pull preview" />;
    return <span className="inline-flex h-1.5 w-6 rounded-full bg-[#26364c] shadow-sm" aria-label="bar pull preview" />;
  };
  return (
    <div data-testid="hardware-preview" className="mt-2 rounded-md border border-border/70 bg-muted/30 p-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hardware preview</p>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-2 gap-y-1 text-[10px]">
        <span className="font-medium">Door</span><span>{sample(resolved.doorPiece)}</span><span className="text-muted-foreground">{resolved.label}</span>
        <span className="font-medium">Drawer</span><span>{sample(resolved.drawerPiece)}</span><span className="text-muted-foreground">{resolved.label}</span>
      </div>
    </div>
  );
}

interface Props {
  value: HardwareStyleId;
  onChange: (value: HardwareStyleId) => void;
}

/** Same saved Designer choice, accessible even when the parent toolbar is off-screen. */
export function ThreeDHandlesControl({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const popupId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  return (
    <div
      data-testid="three-d-handles-control"
      className="relative shrink-0"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          event.currentTarget.querySelector<HTMLButtonElement>("button")?.focus();
        }
      }}
    >
      <button
        type="button"
        ref={buttonRef}
        data-testid="three-d-handles-trigger"
        aria-label="Cabinet handles in 3D"
        aria-expanded={open}
        aria-controls={popupId}
        title={`Handles: ${hardwareStyle(value).label}`}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 items-center gap-1 rounded-md border bg-background/95 px-2 text-xs font-semibold text-[#1a2744] shadow-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a87f33] active:scale-95"
      >
        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
        Handles
        <ChevronDown className="h-3 w-3" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={popupId}
          data-testid="three-d-handles-popover"
          role="group"
          aria-label="Choose cabinet handles"
          className="absolute right-0 top-full z-40 mt-1 w-56 max-w-[calc(100vw-1.5rem)] rounded-lg border bg-background p-2 text-xs text-foreground shadow-lg"
        >
          <CabinetHandlesControl value={value} tablet onChange={(style) => { onChange(style); setOpen(false); buttonRef.current?.focus(); }} />
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            {value === "none" ? "No handles selected. Choose a style to show handles on your cabinets." : `Current: ${hardwareStyle(value).label}.`}
            {" "}Finishing specification only; no added price.
          </p>
          <HardwarePreview style={value} />
        </div>
      )}
    </div>
  );
}
