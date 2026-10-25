import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import type { WallSide } from "@/lib/design";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SiteStringKey } from "@/lib/i18n/site";

interface Props {
  onPick: (side: WallSide) => void;
  customTargets?: Array<{ id: string; label: string }>;
  onPickPeninsula?: (runId: string) => void;
  peninsulaTarget?: { id: string; label: string } | null;
  disabled?: boolean;
}

const BUTTONS: { side: WallSide; labelKey: SiteStringKey; Icon: typeof ArrowUp }[] = [
  { side: "top", labelKey: "dt_wall_back", Icon: ArrowUp },
  { side: "left", labelKey: "dt_wall_left", Icon: ArrowLeft },
  { side: "right", labelKey: "dt_wall_right", Icon: ArrowRight },
  { side: "bottom", labelKey: "dt_wall_front", Icon: ArrowDown },
];

// A compact wall selector shown when a cabinet is selected. Clicking a side
// snaps the cabinet flush to that wall, so users can place a cabinet on the
// wall they actually want instead of dragging and hoping it snaps.
export function WallPicker({ onPick, customTargets, onPickPeninsula, peninsulaTarget = null, disabled }: Props) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">{t("dt_snap_to_wall")}</span>
      <div className="flex flex-wrap items-center gap-0.5">
        {customTargets?.length ? customTargets.map((target) => (
          <button
            key={target.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(target.id as WallSide)}
            title={`Snap this cabinet to ${target.label}`}
            className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#1a2744]"
          >
            {target.label}
          </button>
        )) : BUTTONS.map(({ side, labelKey, Icon }) => {
          const label = t(labelKey);
          return (
            <button
              key={side}
              type="button"
              disabled={disabled}
              onClick={() => onPick(side)}
              title={t("dt_snap_to_x_wall", { wall: label.toLowerCase() })}
              className="flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-[#1a2744]"
            >
              <Icon className="h-3 w-3" /> {label}
            </button>
          );
        })}
        {peninsulaTarget && onPickPeninsula && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPickPeninsula(peninsulaTarget.id)}
            title={`Snap this cabinet to ${peninsulaTarget.label}`}
            className="rounded-md border border-[#b78932] bg-[#fff7e7] px-2 py-1 text-[11px] font-bold text-[#704b0a] transition-colors hover:bg-[#d4a75a] hover:text-[#1a2744] disabled:opacity-40"
          >
            {peninsulaTarget.label}
          </button>
        )}
      </div>
    </div>
  );
}
