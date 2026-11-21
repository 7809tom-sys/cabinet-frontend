/**
 * One-click approved door styles for a door editor, platform default first
 * (PLATFORM_DEFAULT_DOOR_STYLE: DL Shaker). Clicking only sets the editor field;
 * nothing is saved until the editor's own Save.
 */
import { PLATFORM_APPROVED_DOOR_STYLES, PLATFORM_DEFAULT_DOOR_STYLE } from "@shared/platformDoorDefaults";

export function ApprovedDoorStyleChips({
  value,
  onPick,
  testId = "approved-door-style-chips",
}: {
  value: string;
  onPick: (doorStyle: string) => void;
  testId?: string;
}) {
  const current = value.trim().toLowerCase();
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="flex flex-wrap gap-1">
        {PLATFORM_APPROVED_DOOR_STYLES.map((style) => {
          const selected = current === style.doorStyle.toLowerCase();
          const isDefault = style.id === PLATFORM_DEFAULT_DOOR_STYLE.id;
          return (
            <button
              key={style.id}
              type="button"
              data-door-style={style.doorStyle}
              aria-pressed={selected}
              onClick={() => onPick(style.doorStyle)}
              className={`rounded-full border px-2 py-0.5 text-xs ${selected ? "border-emerald-600 bg-emerald-50 text-emerald-900" : "border-muted-foreground/30 text-muted-foreground hover:bg-muted"}`}
            >
              {style.label}{isDefault ? " (default)" : ""}
            </button>
          );
        })}
      </div>
      {!current && (
        <p className="text-[11px] text-muted-foreground">
          No door style saved. The platform starter is {PLATFORM_DEFAULT_DOOR_STYLE.label}; pick it or another approved style above.
        </p>
      )}
    </div>
  );
}
