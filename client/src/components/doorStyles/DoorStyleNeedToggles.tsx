import { Checkbox } from "@/components/ui/checkbox";
import {
  doorStyleNeedView,
  SKIN_NEEDED_LOCKED_TOOLTIP,
  type SkinEligibilityStyle,
} from "@shared/canHaveSkins";

type NeedStyle = SkinEligibilityStyle & { id: number };

/**
 * At-a-glance Skin needed and Finished end needed checks.
 * Skin needed stays No and disabled unless the style is hickory frameless.
 * Finished end needed can be checked on every style. Absent fields use the defaults.
 */
export function DoorStyleNeedToggles({
  style,
  pending = false,
  onSkinNeeded,
  onFinishedEndNeeded,
}: {
  style: NeedStyle;
  pending?: boolean;
  onSkinNeeded: (styleId: number, needed: boolean) => void;
  onFinishedEndNeeded: (styleId: number, needed: boolean) => void;
}) {
  const view = doorStyleNeedView(style);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1" data-testid="door-style-need-toggles">
      <NeedCheck
        label="Skin needed"
        checked={view.skinNeeded}
        disabled={view.skinNeededDisabled || pending}
        title={view.skinNeededTooltip ?? "Skin needed"}
        onChange={(needed) => {
          if (view.skinNeededDisabled) return;
          onSkinNeeded(style.id, needed);
        }}
      />
      <NeedCheck
        label="Finished end needed"
        checked={view.finishedEndNeeded}
        disabled={pending}
        title="Finished end needed"
        onChange={(needed) => onFinishedEndNeeded(style.id, needed)}
      />
    </div>
  );
}

function NeedCheck({
  label,
  checked,
  disabled,
  title,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  title: string;
  onChange: (needed: boolean) => void;
}) {
  const answer = checked ? "Yes" : "No";
  return (
    <span title={disabled && title === SKIN_NEEDED_LOCKED_TOOLTIP ? title : title} className="inline-flex items-center gap-1.5">
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={`${label}: ${answer}`}
        onCheckedChange={(value) => onChange(value === true)}
      />
      <span className="text-xs text-foreground">{label}</span>
      <span className={`text-xs font-semibold ${checked ? "text-emerald-700" : "text-muted-foreground"}`}>{answer}</span>
    </span>
  );
}
