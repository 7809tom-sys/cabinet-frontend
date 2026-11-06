import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, PowerOff, RotateCcw, Wrench } from "lucide-react";
import {
  DEFAULT_DESIGNER_OFF_REASON,
  designerOffAttribution,
  designerOffLabel,
  activeDesignerOverride,
  designerOverrideDecision,
  designerReadyOverrideNote,
  isDesignerTurnedOff,
  type DesignerReadyCabinet,
} from "@shared/designerReadyOverride";
import { formatCentralDate, formatCentralTime } from "@/lib/orderStatusActor";

export type DesignerOverrideActionInput =
  | { action: "ready"; width: number | null; height: number | null; depth: number | null }
  | { action: "off"; reason: string; until: string | null }
  | { action: "reset" };

export type DesignerOverrideActions = {
  run: (input: DesignerOverrideActionInput) => void;
  pending?: boolean;
};

/**
 * The Designer-visibility marker on a catalog row, plus the admin controls.
 *
 * Admins get all three states: "Make designer ready" (forced on), "Turn off
 * designer" (forced off, with an optional reason and back-in-stock date), and
 * "Reset to automatic". Everyone else only sees the current state and its reason.
 *
 * A turned-off item keeps a small "Off: Out of stock until …" line and the name
 * of the administrator who did it, so nobody has to guess why a valid cabinet is
 * missing from the palette.
 */
export default function DesignerReadyBadge({
  cabinet,
  role,
  hasPublishedPrice = true,
  actions,
  reason,
  now,
}: {
  cabinet: DesignerReadyCabinet;
  role: string | null | undefined;
  hasPublishedPrice?: boolean;
  actions?: DesignerOverrideActions;
  reason?: string | null;
  now?: Date;
}) {
  const [mode, setMode] = useState<"idle" | "confirm-ready" | "off">("idle");
  const [offReason, setOffReason] = useState(DEFAULT_DESIGNER_OFF_REASON);
  const [offUntil, setOffUntil] = useState("");
  const isAdmin = role === "admin";
  const offLabel = designerOffLabel(cabinet, formatCentralDate, now);
  const approvedNote = designerReadyOverrideNote(cabinet, formatCentralTime, now);
  const offAttribution = designerOffAttribution(cabinet, formatCentralTime, now);
  const turnedOff = isDesignerTurnedOff(cabinet, now);
  const pending = actions?.pending ?? false;

  const readyDecision = designerOverrideDecision(cabinet, "ready", { role, hasPublishedPrice, now });
  const offDecision = designerOverrideDecision(cabinet, "off", { role, hasPublishedPrice, now });
  const resetDecision = designerOverrideDecision(cabinet, "reset", { role, hasPublishedPrice, now });

  // ── Turned off ────────────────────────────────────────────────────────────
  if (turnedOff) {
    return (
      <div className="flex flex-wrap items-center gap-1" data-testid="designer-turned-off">
        <Badge
          variant="outline"
          className="gap-1 border-slate-300 bg-slate-100 px-1 py-0 text-[10px] font-normal text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
        >
          <PowerOff className="h-2.5 w-2.5" />
          Designer off
        </Badge>
        <span className="text-[10px] text-muted-foreground" data-testid="designer-off-label">{offLabel}</span>
        {offAttribution && (
          <span className="text-[10px] text-muted-foreground" data-testid="designer-off-attribution">{offAttribution}</span>
        )}
        {isAdmin && actions && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 gap-1 px-1 text-[10px]"
            disabled={pending || !resetDecision.allowed}
            onClick={() => actions.run({ action: "reset" })}
            data-testid="designer-reset"
            title={resetDecision.allowed ? "Return this item to the catalog's own rules" : undefined}
          >
            <RotateCcw className="h-2.5 w-2.5" />
            Reset to automatic
          </Button>
        )}
      </div>
    );
  }

  // ── Forced ready ──────────────────────────────────────────────────────────
  if (approvedNote) {
    return (
      <div className="flex flex-wrap items-center gap-1" data-testid="designer-ready-approved">
        <Badge variant="outline" className="gap-1 border-emerald-300 px-1 py-0 text-[10px] font-normal text-emerald-700">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Designer ready
        </Badge>
        <span className="text-[10px] text-muted-foreground" title={cabinet.designerReadyOverrideBy ?? undefined} data-testid="designer-ready-note">
          {approvedNote}
        </span>
        {isAdmin && actions && (
          <>
            {offDecision.allowed && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 gap-1 px-1 text-[10px]"
                disabled={pending}
                onClick={() => setMode("off")}
                data-testid="designer-turn-off"
              >
                <PowerOff className="h-2.5 w-2.5" />
                Turn off designer
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-1 text-[10px]"
              disabled={pending || !resetDecision.allowed}
              onClick={() => actions.run({ action: "reset" })}
              data-testid="designer-reset"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              Reset to automatic
            </Button>
            {mode === "off" && <OffForm />}
          </>
        )}
      </div>
    );
  }

  // ── The catalog already allows it ─────────────────────────────────────────
  // Nothing to say, and no flag to explain. An admin can still turn it off from
  // the catalog's own controls; this marker stays out of the way.
  if (cabinet.designerEligible === true && activeDesignerOverride(cabinet, now) == null) return null;

  // ── Flagged by the catalog rules ──────────────────────────────────────────
  return (
    <div className="flex flex-wrap items-center gap-1" data-testid="designer-ready-flagged">
      <Badge
        variant="outline"
        className="gap-1 border-red-300 bg-red-50 px-1 py-0 text-[10px] font-normal text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
        title={reason ?? "Not available in the 3D Designer"}
      >
        Not designer ready
      </Badge>

      {isAdmin && actions && (
        <>
          {mode === "confirm-ready" ? (
            <>
              <Button
                type="button"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                disabled={pending}
                onClick={() => {
                  actions.run({
                    action: "ready",
                    width: readyDecision.allowed && readyDecision.source === "derived" ? readyDecision.dimensions.width : null,
                    height: readyDecision.allowed && readyDecision.source === "derived" ? readyDecision.dimensions.height : null,
                    depth: readyDecision.allowed && readyDecision.source === "derived" ? readyDecision.dimensions.depth : null,
                  });
                  setMode("idle");
                }}
                data-testid="designer-ready-confirm"
              >
                Confirm
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px]"
                onClick={() => setMode("idle")}
                data-testid="designer-ready-cancel"
              >
                Cancel
              </Button>
              {readyDecision.allowed && (
                <span className="w-full text-[10px] text-muted-foreground" data-testid="designer-ready-confirm-note">
                  {readyDecision.note}
                </span>
              )}
            </>
          ) : readyDecision.allowed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 gap-1 px-1.5 text-[10px]"
              disabled={pending}
              onClick={() => setMode("confirm-ready")}
              data-testid="designer-ready-make"
            >
              <Wrench className="h-2.5 w-2.5" />
              Make designer ready
            </Button>
          ) : (
            <span
              className="text-[10px] text-amber-700 dark:text-amber-400"
              title={readyDecision.reason ?? undefined}
              data-testid="designer-ready-blocked"
            >
              {readyDecision.reason}
            </span>
          )}

          {offDecision.allowed && mode !== "off" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-1 text-[10px]"
              disabled={pending}
              onClick={() => setMode("off")}
              data-testid="designer-turn-off"
            >
              <PowerOff className="h-2.5 w-2.5" />
              Turn off designer
            </Button>
          )}
          {mode === "off" && <OffForm />}
        </>
      )}
    </div>
  );

  /** The optional reason and back-in-stock date for turning an item off. */
  function OffForm() {
    return (
      <div className="mt-1 w-full space-y-1 rounded border bg-muted/40 p-1.5" data-testid="designer-off-form">
        <p className="text-[10px] text-muted-foreground">
          Hidden from the 3D Designer and auto-design. Saved designs keep the item but mark it unavailable.
        </p>
        <div className="flex flex-wrap items-center gap-1">
          <Input
            value={offReason}
            onChange={(event) => setOffReason(event.target.value)}
            placeholder={DEFAULT_DESIGNER_OFF_REASON}
            aria-label="Reason"
            className="h-6 w-40 text-[11px]"
            data-testid="designer-off-reason"
          />
          <Input
            type="date"
            value={offUntil}
            onChange={(event) => setOffUntil(event.target.value)}
            aria-label="Back in stock date"
            className="h-6 w-36 text-[11px]"
            data-testid="designer-off-until"
          />
          <Button
            type="button"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            disabled={pending}
            onClick={() => {
              actions?.run({ action: "off", reason: offReason, until: offUntil || null });
              setMode("idle");
            }}
            data-testid="designer-off-confirm"
          >
            Turn off
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[10px]"
            onClick={() => setMode("idle")}
            data-testid="designer-off-cancel"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }
}
