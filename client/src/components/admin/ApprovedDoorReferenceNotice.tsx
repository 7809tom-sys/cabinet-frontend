import { Badge } from "@/components/ui/badge";
import {
  APPROVED_REFERENCE_LABEL,
  NO_APPROVED_SOURCE_LABEL,
  featuredImagesAudit,
} from "@/lib/approvedDoorReference";
import { DoorStyleEditButton } from "@/components/design/DoorStyleEditButton";
import { doorStyleEditUrl } from "@/lib/doorStyleEditLink";

/**
 * Door approval state.
 *
 * Owner rule: a "not approved" label is a dead end — it tells the person something
 * is missing and gives them nothing to do about it. When a style still needs
 * approval (or needs a look because its photos do not match an approved render),
 * this shows an **Edit** button that opens that exact style in the door style
 * editor, where an admin can approve it right there or fix the color and style and
 * save.
 *
 * The approved badge stays a badge: nothing is wrong, so there is nothing to fix.
 * On a mismatch the Edit button sits beside the mismatch, so the problem and the
 * way to fix it are in the same place.
 */
export function ApprovedDoorReferenceNotice({
  approvedReferenceImageUrl,
  doorSampleImageUrl,
  drawerSampleImageUrl,
  approvedByName,
  /** Admin gate for the Edit affordance. A shopper sees only the state. */
  isAdmin = false,
  /** The style this notice is about, so Edit can open exactly it. */
  styleId,
  styleCode,
  styleName,
  /** The page to come back to after saving. */
  returnTo,
}: {
  approvedReferenceImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
  approvedByName?: string | null;
  isAdmin?: boolean;
  styleId?: number | null;
  styleCode?: string | null;
  styleName?: string | null;
  returnTo?: string | null;
}) {
  const audit = featuredImagesAudit({
    approvedReferenceImageUrl,
    doorSampleImageUrl,
    drawerSampleImageUrl,
  });
  const approved = Boolean(approvedReferenceImageUrl?.trim());
  const hasProblem = !approved || audit.failures.length > 0;
  return (
    <div className="space-y-1" data-testid="approved-door-reference-notice">
      {approved ? (
        <Badge className="bg-sky-700 text-white hover:bg-sky-700" data-testid="approved-reference-badge">
          {APPROVED_REFERENCE_LABEL}
        </Badge>
      ) : (
        // The "not approved" state, with the way out of it right beside it.
        <span className="inline-flex items-center gap-1.5" data-testid="no-approved-source">
          <Badge variant="outline">{NO_APPROVED_SOURCE_LABEL}</Badge>
          <DoorStyleEditButton
            isAdmin={isAdmin}
            styleId={styleId}
            styleCode={styleCode}
            styleName={styleName}
            returnTo={returnTo}
            hrefFor={doorStyleEditUrl}
            variant="badge"
            label="Edit"
            testId="no-approved-source-edit"
          />
        </span>
      )}
      {approved && approvedByName?.trim() ? (
        <p className="text-xs text-muted-foreground">Approved by {approvedByName.trim()}</p>
      ) : null}
      {audit.failures.map((failure) => (
        <p
          key={failure.image}
          className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-destructive"
          data-testid={`featured-mismatch-${failure.image}`}
        >
          <span>
            {failure.image === "door" ? "Door" : "Drawer"}: {failure.reason}
          </span>
          {/* The warning and the fix, together. */}
          <DoorStyleEditButton
            isAdmin={isAdmin}
            styleId={styleId}
            styleCode={styleCode}
            styleName={styleName}
            returnTo={returnTo}
            hrefFor={doorStyleEditUrl}
            variant="badge"
            label="Edit"
            testId={`featured-mismatch-${failure.image}-edit`}
          />
        </p>
      ))}
      {hasProblem && !isAdmin && (
        <p className="text-[11px] text-muted-foreground">
          An administrator can approve this door or correct its color and style.
        </p>
      )}
    </div>
  );
}
