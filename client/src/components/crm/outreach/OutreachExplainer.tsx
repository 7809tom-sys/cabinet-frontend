// Sales CRM → "Outreach" view pill with a short explainer for new users.
// The pill itself still just switches the CRM to the Outreach view. The
// explainer opens on mouse hover (pill or ⓘ), on keyboard focus of the ⓘ,
// and on tap/click of the ⓘ, so a tap on the pill on a phone always navigates.
// Copy mirrors what OutreachPanel really does (AI follow-up sequence, enrol an
// imported list, preview/approval modes, caps, auto-stop on reply).

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Info } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const OUTREACH_EXPLAINER_TITLE = "What is Outreach?";
export const OUTREACH_EXPLAINER_LINES = [
  "Automatic email follow-ups for your imported customer lists. AI drafts each email from your step briefs (fixed templates if AI is off).",
  "To use it: set your steps and days between them under Settings, pick an imported list and click Enrol list, then approve drafts in the queue.",
  "Nothing sends until Outreach is on and the mode allows it. A reply, unsubscribe or bounce stops that contact.",
] as const;
export const OUTREACH_EXPLAINER_TIPS_TITLE = "Tips";
export const OUTREACH_EXPLAINER_TIPS = [
  "Segment: enrol one focused list at a time. Won and lost deals are skipped, and each contact's CRM stage shows in Enrolled contacts.",
  "Revive stale leads: put leads that went quiet in their own list. A click or reply moves them to Contacted.",
  "Time your sends: space steps a few days apart and keep the daily cap modest.",
  "Stay consistent: each sequence step is your template, so every contact gets the same follow-up plan.",
] as const;

const HOVER_CLOSE_DELAY_MS = 150;

export function OutreachViewButton({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const [hovering, setHovering] = useState(false);
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const open = hovering || pinned;

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Hover only for a real mouse; touch taps fire pointerenter too and must not pop it open.
  const hoverIn = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHovering(true);
  };
  const hoverOut = (event: ReactPointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHovering(false), HOVER_CLOSE_DELAY_MS);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => { if (!next) { setHovering(false); setPinned(false); } }}
    >
      <PopoverAnchor asChild>
        <span className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onSelect}
            onPointerEnter={hoverIn}
            onPointerLeave={hoverOut}
            aria-describedby={open ? "crm-outreach-explainer" : undefined}
            className={`rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-[#1a2b4a] text-white" : "bg-white text-[#1a2b4a] border border-slate-200"}`}
          >
            Outreach
          </button>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="What is Outreach?"
              onPointerEnter={hoverIn}
              onPointerLeave={hoverOut}
              onFocus={() => setPinned(true)}
              onClick={(event) => {
                // Handle the toggle ourselves so a click after a hover keeps it open.
                event.preventDefault();
                setPinned((value) => !value);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:text-[#1a2b4a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2b4a]/40"
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </span>
      </PopoverAnchor>
      <PopoverContent
        id="crm-outreach-explainer"
        align="start"
        side="bottom"
        aria-label={OUTREACH_EXPLAINER_TITLE}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onPointerEnter={hoverIn}
        onPointerLeave={hoverOut}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-2 p-3 text-xs leading-snug"
      >
        <p className="text-sm font-semibold text-[#1a2b4a]">{OUTREACH_EXPLAINER_TITLE}</p>
        {OUTREACH_EXPLAINER_LINES.map((line) => <p key={line} className="text-muted-foreground">{line}</p>)}
        <p className="pt-1 font-semibold text-[#1a2b4a]">{OUTREACH_EXPLAINER_TIPS_TITLE}</p>
        <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
          {OUTREACH_EXPLAINER_TIPS.map((tip) => <li key={tip}>{tip}</li>)}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
