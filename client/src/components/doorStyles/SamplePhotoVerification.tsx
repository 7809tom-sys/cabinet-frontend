import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SamplePhotoVerification({
  image,
  verified,
  hasSavedPhoto = false,
  pending = false,
  onChange,
}: {
  image: "door" | "drawer";
  verified: boolean;
  hasSavedPhoto?: boolean;
  pending?: boolean;
  /** Omit for a read-only vendor badge. Admins pass the verify/unverify handler. */
  onChange?: (verified: boolean) => void;
}) {
  const label = image === "door" ? "Door verified" : "Drawer front verified";
  const noun = image === "door" ? "door photo" : "drawer front";
  const canVerify = verified || hasSavedPhoto;
  return (
    <div className="inline-flex flex-wrap items-center gap-1.5" data-testid={image === "door" ? "door-verified-control" : "drawer-front-verified-control"}>
      <Badge
        variant="outline"
        data-testid={image === "door" ? "door-verified-badge" : "drawer-front-verified-badge"}
        data-verified={verified ? "true" : "false"}
        className={verified
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-amber-300 bg-amber-50 text-amber-800"}
        title={verified ? `${label}` : `${label}: not confirmed yet`}
      >
        {verified ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {label}
      </Badge>
      {onChange && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          disabled={pending || !canVerify}
          title={canVerify ? undefined : "Upload the photo before verifying it."}
          aria-label={verified ? `Unverify ${noun}` : `Verify ${noun}`}
          onClick={() => onChange(!verified)}
        >
          {verified ? "Unverify" : "Verify"}
        </Button>
      )}
    </div>
  );
}
