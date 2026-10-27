import { Badge } from "@/components/ui/badge";
import {
  APPROVED_REFERENCE_LABEL,
  NO_APPROVED_SOURCE_LABEL,
  featuredImagesAudit,
} from "@/lib/approvedDoorReference";

export function ApprovedDoorReferenceNotice({
  approvedReferenceImageUrl,
  doorSampleImageUrl,
  drawerSampleImageUrl,
  approvedByName,
}: {
  approvedReferenceImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  drawerSampleImageUrl?: string | null;
  approvedByName?: string | null;
}) {
  const audit = featuredImagesAudit({
    approvedReferenceImageUrl,
    doorSampleImageUrl,
    drawerSampleImageUrl,
  });
  const approved = Boolean(approvedReferenceImageUrl?.trim());
  return (
    <div className="space-y-1" data-testid="approved-door-reference-notice">
      {approved ? (
        <Badge className="bg-sky-700 text-white hover:bg-sky-700" data-testid="approved-reference-badge">
          {APPROVED_REFERENCE_LABEL}
        </Badge>
      ) : (
        <Badge variant="outline" data-testid="no-approved-source">
          {NO_APPROVED_SOURCE_LABEL}
        </Badge>
      )}
      {approved && approvedByName?.trim() ? (
        <p className="text-xs text-muted-foreground">Approved by {approvedByName.trim()}</p>
      ) : null}
      {audit.failures.map((failure) => (
        <p
          key={failure.image}
          className="text-xs font-medium text-destructive"
          data-testid={`featured-mismatch-${failure.image}`}
        >
          {failure.image === "door" ? "Door" : "Drawer"}: {failure.reason}
        </p>
      ))}
    </div>
  );
}
