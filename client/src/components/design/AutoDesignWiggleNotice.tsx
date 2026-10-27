import { formatEighthInches } from "@/lib/design";
import {
  formatAutoDesignWiggleBadge,
  formatAutoDesignWiggleMessage,
  type AutoDesignWiggleMove,
} from "@/lib/designerLayoutRules";

/** Persistent Auto-Design summary of every appliance wiggle-room shift. */
export function AutoDesignWiggleNotice({ moves, notes = [] }: { moves: readonly AutoDesignWiggleMove[]; notes?: readonly string[] }) {
  if (moves.length === 0 && notes.length === 0) return null;
  return (
    <div
      role="status"
      data-testid="auto-design-wiggle-notice"
      className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-md"
    >
      <p className="font-semibold">Auto-Design wiggle room</p>
      <ul className="mt-1 space-y-1">
        {notes.map((note) => (
          <li key={note} data-testid="auto-design-layout-note">{note}</li>
        ))}
        {moves.map((move) => (
          <li key={move.uid} data-testid={`auto-design-wiggle-notice-${move.uid}`}>
            <p>{formatAutoDesignWiggleMessage(move)}</p>
            <p className="text-xs text-amber-900">
              {move.wallLabel}: {formatEighthInches(move.originalPositionIn)} → {formatEighthInches(move.newPositionIn)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small label drawn on the appliance that Auto-Design shifted. */
export function AutoDesignWiggleBadge({ move, className }: { move: AutoDesignWiggleMove; className?: string }) {
  return (
    <span
      data-testid="auto-design-wiggle-badge"
      data-appliance-uid={move.uid}
      title={formatAutoDesignWiggleMessage(move)}
      className={className ?? "pointer-events-none whitespace-nowrap rounded bg-amber-700 px-1.5 py-0.5 text-[8px] font-bold leading-none text-white shadow"}
    >
      {formatAutoDesignWiggleBadge(move)}
    </span>
  );
}
