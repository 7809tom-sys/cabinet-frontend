import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function CabinetVerificationControl({
  checked,
  onCheckedChange,
  disabled = false,
  verifiedDescription = "You've reviewed all fields and confirmed everything is correct",
  pendingDescription = "Check this when you've finished reviewing all fields",
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  verifiedDescription?: string;
  pendingDescription?: string;
}) {
  return (
    <div
      data-verification-state={checked ? "verified" : "pending"}
      className={cn(
        "relative flex items-center justify-between gap-4 overflow-hidden rounded-lg border px-4 py-3 shadow-sm motion-safe:transition-colors",
        checked
          ? "border-emerald-300 bg-emerald-50/90 dark:border-emerald-700 dark:bg-emerald-950/30"
          : "border-rose-400 bg-rose-50 ring-2 ring-rose-200/80 dark:border-rose-500 dark:bg-rose-950/35 dark:ring-rose-900/70"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          checked ? "bg-emerald-500" : "bg-rose-500"
        )}
      />
      <div className="flex min-w-0 items-start gap-2.5 pl-1">
        {checked ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-sm font-bold", checked ? "text-emerald-950 dark:text-emerald-100" : "text-rose-950 dark:text-rose-100")}>
              {checked ? "Verified" : "Mark as Verified"}
            </p>
            {!checked && (
              <Badge className="border-0 bg-rose-600 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-rose-600">
                Review required
              </Badge>
            )}
          </div>
          <p className={cn("mt-0.5 text-xs", checked ? "text-emerald-800 dark:text-emerald-200" : "text-rose-800 dark:text-rose-200")}>
            {checked ? verifiedDescription : pendingDescription}
          </p>
        </div>
      </div>
      <Switch
        aria-label={checked ? "Mark cabinet configuration as unverified" : "Mark cabinet configuration as verified"}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="shrink-0 data-[state=unchecked]:bg-rose-300 data-[state=checked]:bg-emerald-600 focus-visible:ring-rose-500"
      />
    </div>
  );
}
