import { useState } from "react";
import { UserRound, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OptionalContactNudgeProps {
  initialName?: string;
  initialPhone?: string;
  onAdd: (contact: { name?: string; phone?: string }) => void;
  onDismiss: () => void;
  isSaving?: boolean;
}

/** A compact, dismissible follow-up prompt that never blocks design work. */
export function OptionalContactNudge({
  initialName = "",
  initialPhone = "",
  onAdd,
  onDismiss,
  isSaving = false,
}: OptionalContactNudgeProps) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const hasContact = Boolean(name.trim() || phone.trim());

  return (
    <section
      aria-label="Optional design assistance"
      className="mx-3 mt-2 flex flex-col gap-3 border border-[#d4a75a]/60 bg-[#fffaf0] px-3 py-2.5 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="font-semibold text-[#1a2744]">Want help finishing this plan?</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-600">Add a name and phone for optional design help. You can continue without them.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(8rem,1fr)_minmax(8rem,1fr)_auto_auto] sm:items-center">
        <label className="relative block">
          <span className="sr-only">Name (optional)</span>
          <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Name (optional)" className="h-8 min-w-0 pl-8 text-xs" />
        </label>
        <label className="relative block">
          <span className="sr-only">Phone (optional)</span>
          <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" inputMode="tel" autoComplete="tel" placeholder="Phone (optional)" className="h-8 min-w-0 pl-8 text-xs" />
        </label>
        <Button type="button" size="sm" className="h-8 bg-[#1a2744] text-xs text-white hover:bg-[#24375f]" disabled={!hasContact || isSaving} onClick={() => onAdd({ name: name.trim() || undefined, phone: phone.trim() || undefined })}>
          {isSaving ? "Saving…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onDismiss}>Not now</Button>
      </div>
    </section>
  );
}
