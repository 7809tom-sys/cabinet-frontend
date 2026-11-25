// Small lightbulb button that opens a short Outreach tip in a pop-up.
// Opens only on click/tap (or Enter/Space), never by itself. Closes with the ×,
// Escape, a click outside, or another click on the lightbulb. The pop-up is not
// modal, so every button on the page keeps working while it is open.

import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { OUTREACH_TIPS, type OutreachTipId } from "./outreachTips";

export function OutreachTip({ id, className = "" }: { id: OutreachTipId; className?: string }) {
  const tip = OUTREACH_TIPS[id];
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Tip: ${tip.title}`}
          data-outreach-tip={id}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full align-middle text-amber-500 hover:bg-amber-50 hover:text-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${className}`}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        role="note"
        aria-label={tip.title}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-72 max-w-[calc(100vw-2rem)] p-3 text-xs leading-snug"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-[#1a2b4a]">{tip.title}</p>
          <button
            type="button"
            aria-label="Close tip"
            onClick={() => setOpen(false)}
            className="-mr-1 -mt-1 inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-1 text-muted-foreground">{tip.body}</p>
      </PopoverContent>
    </Popover>
  );
}
