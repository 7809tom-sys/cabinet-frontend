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
 * expands that room's existing layout choices. Auto-Design (kitchen only) lives
 * in the Kitchen section and calls the designer's existing opener.
 */
export function RoomLayoutPopupPicker({ bathroom, kitchen, closet, autoDesign }: Props) {
  const [open, setOpen] = useState<RoomLayoutPopupRoom | null>(null);
  const body: Record<RoomLayoutPopupRoom, ReactNode> = { bathroom, kitchen, closet };
  return (
    <div data-testid="room-layout-popup-picker" className="space-y-4">
      <div role="group" aria-label="Choose a room" className="grid gap-2 sm:grid-cols-3">
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
              className={`rounded-lg border p-3 text-sm font-semibold text-[#192432] shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192432] ${expanded ? "border-[#192432] bg-[#f3efe6]" : "border-slate-300 bg-white hover:bg-slate-50"}`}
            >
              {room.label}
            </button>
          );
        })}
      </div>
      {open && (
        <div id={`room-layout-popup-panel-${open}`} data-testid={`room-layout-popup-panel-${open}`} role="region" aria-label={`${ROOM_LAYOUT_POPUP_ROOMS.find((r) => r.id === open)?.label} layouts`} className="space-y-4">
          <button
            type="button"
            data-testid="room-layout-popup-back"
            onClick={() => setOpen(null)}
            className="text-sm font-medium text-[#192432] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#192432]"
          >
            ← Back to Bathroom, Kitchen, Closet
          </button>
          {open === "kitchen" && autoDesign && (
            <div data-testid="room-layout-popup-auto-design-wrap" className="rounded-xl border border-[#d4a75a]/70 bg-[#fff8e8]/60 p-4">
              <button
                type="button"
                data-testid="room-layout-popup-auto-design"
                onClick={autoDesign.onClick}
                disabled={!autoDesign.enabled}
                title={autoDesign.title}
                aria-label="Auto-Design"
                className="inline-flex items-center gap-1.5 rounded-md border border-[#d4a75a] bg-white px-3 py-2 text-sm font-semibold text-[#765416] transition-colors hover:bg-[#fff8e8] disabled:opacity-60"
              >
                <Ruler className="h-4 w-4" aria-hidden="true" /> Auto-Design
              </button>
              <p className="mt-2 text-xs leading-5 text-[#765416]">Answer a few questions about your kitchen and Auto-Design lays out a first draft you can adjust.</p>
              {autoDesign.anchorNote && <p data-testid="room-layout-popup-auto-design-anchor-note" className="mt-1 text-xs text-[#765416]">{autoDesign.anchorNote}</p>}
              {!autoDesign.enabled && autoDesign.note && <p className="mt-1 text-xs font-medium text-amber-800">{autoDesign.note}</p>}
            </div>
          )}
          {body[open]}
        </div>
      )}
    </div>
  );
}
