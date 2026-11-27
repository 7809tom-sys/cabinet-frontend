import { useState, type ReactNode } from "react";
import { Ruler } from "lucide-react";

export type RoomLayoutPopupRoom = "bathroom" | "kitchen" | "closet";

export const ROOM_LAYOUT_POPUP_ROOMS: ReadonlyArray<{ id: RoomLayoutPopupRoom; label: string }> = [
  { id: "bathroom", label: "Bathroom" },
  { id: "kitchen", label: "Kitchen" },
  { id: "closet", label: "Closet" },
];

interface Props {
  /** The existing bathroom template section, unchanged. */
  bathroom: ReactNode;
  /** The existing kitchen layout choices (RoomLayoutStarter), unchanged. */
  kitchen: ReactNode;
  /** The existing closet template section, unchanged. */
  closet: ReactNode;
  /** Same opener and same enabled/title state the designer's Auto-Design buttons use. */
  autoDesign?: { onClick: () => void; enabled: boolean; title?: string; note?: string | null; anchorNote?: string | null };
}

/**
 * Opens collapsed: only Bathroom, Kitchen and Closet buttons. Choosing one
 * expands that room's existing layout choices. Auto-Design (kitchen only) is the
 * LAST step of the Kitchen section: it sits under the room shapes and starter
 * layouts, so the room plan and the door style come first and Auto-Design lays
 * out the cabinets and the outline on that plan (Tom, Nov 26 2026).
 */
export function RoomLayoutPopupPicker({ bathroom, kitchen, closet, autoDesign }: Props) {
  const [open, setOpen] = useState<RoomLayoutPopupRoom | null>(null);
  const body: Record<RoomLayoutPopupRoom, ReactNode> = { bathroom, kitchen, closet };
  return (
    <div data-testid="room-layout-popup-picker" className="space-y-2">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="Choose a room" className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-3">
          {ROOM_LAYOUT_POPUP_ROOMS.map((room) => {
            const expanded = open === room.id;
            return (
              <button
                key={room.id}
                type="button"
                data-testid={`room-layout-popup-${room.id}`}
                aria-expanded={expanded}
                aria-controls={`room-layout-popup-panel-${room.id}`}
                onClick={() => setOpen(room.id)}
                className={`rounded-md border px-2 py-1.5 text-sm font-semibold text-[#192432] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192432] ${expanded ? "border-[#192432] bg-[#f3efe6]" : "border-slate-300 bg-white hover:bg-slate-50"}`}
              >
                {room.label}
              </button>
            );
          })}
        </div>
        {open && (
          <button
            type="button"
            data-testid="room-layout-popup-back"
            onClick={() => setOpen(null)}
            className="shrink-0 text-xs font-medium text-[#192432] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192432]"
          >
            Close
          </button>
        )}
      </div>
      {open && (
        <div id={`room-layout-popup-panel-${open}`} data-testid={`room-layout-popup-panel-${open}`} role="region" aria-label={`${ROOM_LAYOUT_POPUP_ROOMS.find((r) => r.id === open)?.label} layouts`} className="space-y-2">
          {body[open]}
          {open === "kitchen" && autoDesign && (
            <div data-testid="room-layout-popup-auto-design-wrap" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-[#d4a75a]/70 bg-[#fff8e8]/60 px-2.5 py-1.5">
              <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-1">
                <span className="shrink-0 rounded bg-[#d4a75a]/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#765416]">Last step</span>
                <button
                  type="button"
                  data-testid="room-layout-popup-auto-design"
                  onClick={autoDesign.onClick}
                  disabled={!autoDesign.enabled}
                  title={autoDesign.title}
                  aria-label="Auto-Design"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#d4a75a] bg-white px-2.5 py-1 text-sm font-semibold text-[#765416] transition-colors hover:bg-[#fff8e8] disabled:opacity-60"
                >
                  <Ruler className="h-4 w-4" aria-hidden="true" /> Auto-Design
                </button>
                <p className="min-w-0 flex-1 text-xs leading-4 text-[#765416]">Your room shape above makes the outline; once the plan and your door style are set, Auto-Design fills it with cabinets and hands you a draft to adjust.</p>
              </div>
              {autoDesign.anchorNote && <p data-testid="room-layout-popup-auto-design-anchor-note" className="basis-full text-xs text-[#765416]">{autoDesign.anchorNote}</p>}
              {!autoDesign.enabled && autoDesign.note && <p className="basis-full text-xs font-medium text-amber-800">{autoDesign.note}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
