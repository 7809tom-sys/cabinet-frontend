/**
 * The Edit affordance that replaces a "not approved" badge and rides along with
 * any wrong-door warning.
 *
 * Owner rule: on a selected cabinet or door, and on any warning about one, there
 * is an Edit button that opens THAT door style in the door style editor (color and
 * style), then returns to the same spot in the design after save.
 *
 * It renders nothing for a shopper, and nothing when the cabinet has no style to
 * open — a dead button is worse than no button.
 */
import { ExternalLink, Pencil } from "lucide-react";
import { shouldOfferDoorStyleEdit } from "@/lib/doorStyleEditLink";

export type DoorStyleEditButtonProps = {
  isAdmin: boolean;
  styleId?: number | null;
  styleCode?: string | null;
  styleName?: string | null;
  /** The cabinet this was opened from, so the design reselects it on return. */
  cabinetUid?: string | null;
  cabinetCode?: string | null;
  /** The design URL to come back to, query included. */
  returnTo?: string | null;
  slot?: string | null;
  /** Builds the editor URL. Injected so this stays testable without a router. */
  hrefFor: (input: {
    styleId: number | null | undefined;
    styleCode?: string | null;
    styleName?: string | null;
    cabinetUid?: string | null;
    cabinetCode?: string | null;
    returnTo?: string | null;
    slot?: string | null;
  }) => string | null;
  /** "badge" for a compact inline chip, "button" for a toolbar control. */
  variant?: "badge" | "button";
  /** A warning needs the longer label so the action is obvious next to the problem. */
  label?: string;
  testId?: string;
  onNavigate?: () => void;
};

export function DoorStyleEditButton({
  isAdmin,
  styleId,
  styleCode,
  styleName,
  cabinetUid,
  cabinetCode,
  returnTo,
  slot,
  hrefFor,
  variant = "badge",
  label,
  testId = "door-style-edit",
  onNavigate,
}: DoorStyleEditButtonProps) {
  if (!shouldOfferDoorStyleEdit({ isAdmin, styleId })) return null;
  const href = hrefFor({ styleId, styleCode, styleName, cabinetUid, cabinetCode, returnTo, slot });
  if (!href) return null;
  const text = label ?? (variant === "badge" ? "Edit" : "Edit door style");
  const title = `Open the door style that colors this cabinet${cabinetCode ? ` (${cabinetCode})` : ""}: its color and its style. You come back to this exact cabinet after saving.`;
  const className = variant === "badge"
    ? "inline-flex items-center gap-1 rounded border border-[#1a2744]/30 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white"
    : "inline-flex items-center gap-1.5 rounded-md border border-[#1a2744]/30 bg-white px-2 py-1 text-[11px] font-semibold text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white";
  return (
    <a
      href={href}
      data-testid={testId}
      data-door-style-id={styleId}
      data-cabinet-uid={cabinetUid ?? undefined}
      title={title}
      aria-label={title}
      className={className}
      onClick={() => onNavigate?.()}
    >
      {variant === "badge" ? <Pencil className="h-2.5 w-2.5" /> : <ExternalLink className="h-3 w-3" />}
      {text}
    </a>
  );
}
