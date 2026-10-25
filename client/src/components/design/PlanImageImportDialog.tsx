import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { AlertTriangle, Camera, CheckCircle2, ImagePlus, Upload } from "lucide-react";
import {
  buildReviewedPlanImage,
  initializePlanImageReview,
  missingPlanImageDimensions,
  type InterpretedPlanImageCabinet,
  type PlanImageInterpretation,
  type ReviewedPlanImage,
  type ReviewedPlanImageAppliance,
} from "@/lib/planImageReview";

export type ReviewedPlan = ReviewedPlanImage;

export function PlanImageImportDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (plan: ReviewedPlan) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [result, setResult] = useState<PlanImageInterpretation | null>(null);
  const [reviewedCabinets, setReviewedCabinets] = useState<InterpretedPlanImageCabinet[]>([]);
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [reviewedAppliances, setReviewedAppliances] = useState<ReviewedPlanImageAppliance[]>([]);
  const [approvedAppliances, setApprovedAppliances] = useState<Set<number>>(new Set());
  const interpret = trpc.ocr.interpretPlan.useMutation({
    onSuccess: (next) => {
      setResult(next);
      const review = initializePlanImageReview(next);
      setReviewedCabinets(review.reviewedCabinets);
      setApproved(review.approvedCabinetIndexes);
      setReviewedAppliances(review.reviewedAppliances);
      setApprovedAppliances(review.approvedApplianceIndexes);
    },
    onError: (error) => toast.error(error.message),
  });

  const reset = () => {
    setImageDataUrl(null);
    setResult(null);
    setReviewedCabinets([]);
    setApproved(new Set());
    setReviewedAppliances([]);
    setApprovedAppliances(new Set());
  };

  const readImage = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose a plan image such as JPG, PNG, or WEBP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setImageDataUrl(dataUrl);
      setResult(null);
      setReviewedCabinets([]);
      setApproved(new Set());
      setReviewedAppliances([]);
      setApprovedAppliances(new Set());
      interpret.mutate({ imageDataUrl: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const apply = () => {
    if (!result) return;
    if (approved.size === 0) {
      toast.error("Approve at least one readable cabinet before applying this layout.");
      return;
    }
    onApply(buildReviewedPlanImage(result, reviewedCabinets, approved, reviewedAppliances, approvedAppliances));
    onOpenChange(false);
    reset();
  };

  const missingDimensions = result ? missingPlanImageDimensions(result) : { width: false, depth: false };
  const missingWidth = missingDimensions.width;
  const missingDepth = missingDimensions.depth;

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[88dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Existing Design</DialogTitle>
          <DialogDescription>
            Upload or photograph a kitchen plan. Readable cabinets are reviewed before they replace the current layout.
          </DialogDescription>
        </DialogHeader>

        {!imageDataUrl && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-6 text-center transition-colors hover:border-[#d4a75a] hover:bg-[#d4a75a]/5"
          >
            <ImagePlus className="h-10 w-10 text-[#d4a75a]" />
            <span className="font-medium">Choose or photograph a plan image</span>
            <span className="text-xs text-muted-foreground">JPG, PNG, WEBP · typed or clearly handwritten plans</span>
          </button>
        )}

        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => readImage(event.target.files?.[0])} />

        {imageDataUrl && (
          <div className="space-y-4">
            <img src={imageDataUrl} alt="Uploaded plan" className="max-h-60 w-full rounded-lg border border-border object-contain bg-muted/30" />
            {interpret.isPending && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-5 text-sm text-muted-foreground">
                <Spinner className="h-5 w-5" /> Reading the plan image…
              </div>
            )}

            {result && (
              <>
                {(missingWidth || missingDepth) && (
                  <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {missingWidth && "Room width was not readable. "}
                      {missingDepth && "Room depth was not readable. "}
                      The current designer measurement{missingWidth && missingDepth ? "s" : ""} will be retained until you confirm {missingWidth && missingDepth ? "them" : "it"}.
                    </span>
                  </div>
                )}
                <div className="rounded-lg border border-border">
                  <div className="border-b border-border px-3 py-2 text-sm font-semibold">Review readable cabinets</div>
                  <div className="divide-y divide-border">
                    {reviewedCabinets.map((cabinet, index) => {
                      const uncertain = cabinet.confidence < 0.8;
                      return (
                        <div key={`${cabinet.label}-${index}`} className="flex items-start gap-3 px-3 py-3">
                          <Checkbox
                            className="mt-1"
                            checked={approved.has(index)}
                            onCheckedChange={(checked) => setApproved((current) => {
                              const next = new Set(current);
                              if (checked) next.add(index); else next.delete(index);
                              return next;
                            })}
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-sm font-medium">{cabinet.label || cabinet.cabinetType}</span>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              <label className="text-[11px] font-medium text-muted-foreground">Type
                                <select
                                  aria-label={`Cabinet type for ${cabinet.label || index + 1}`}
                                  value={cabinet.cabinetType}
                                  onChange={(event) => setReviewedCabinets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, cabinetType: event.target.value } : item))}
                                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                >
                                  <option value="base cabinet">Base</option>
                                  <option value="wall cabinet">Wall</option>
                                  <option value="tall cabinet">Tall</option>
                                  <option value="appliance">Appliance</option>
                                </select>
                              </label>
                              <label className="text-[11px] font-medium text-muted-foreground">Width
                                <input
                                  aria-label={`Cabinet width for ${cabinet.label || index + 1}`}
                                  type="number"
                                  min="0"
                                  value={cabinet.widthInches || ""}
                                  onChange={(event) => setReviewedCabinets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, widthInches: Number(event.target.value) || 0 } : item))}
                                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                />
                              </label>
                              <label className="text-[11px] font-medium text-muted-foreground">Wall
                                <select
                                  aria-label={`Cabinet wall for ${cabinet.label || index + 1}`}
                                  value={cabinet.wall || "Back"}
                                  onChange={(event) => setReviewedCabinets((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, wall: event.target.value } : item))}
                                  className="mt-1 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                >
                                  <option value="Back">Back</option>
                                  <option value="Front">Front</option>
                                  <option value="Left">Left</option>
                                  <option value="Right">Right</option>
                                </select>
                              </label>
                            </div>
                          </div>
                          {uncertain ? <span className="text-xs font-medium text-amber-700">Confirm</span> : <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-600" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {result.appliances.length > 0 && (
                  <div className="rounded-lg border border-border">
                    <div className="border-b border-border px-3 py-2 text-sm font-semibold">Review readable appliances</div>
                    <div className="divide-y divide-border">
                      {reviewedAppliances.map((appliance, index) => (
                        <div key={`${appliance.label}-${index}`} className="flex items-center gap-3 px-3 py-3">
                          <Checkbox
                            checked={approvedAppliances.has(index)}
                            onCheckedChange={(checked) => setApprovedAppliances((current) => {
                              const next = new Set(current);
                              if (checked) next.add(index); else next.delete(index);
                              return next;
                            })}
                          />
                          <span className="min-w-0 flex-1 text-sm font-medium">{appliance.label}</span>
                          <label className="text-[11px] font-medium text-muted-foreground">Wall
                            <select
                              aria-label={`Appliance wall for ${appliance.label}`}
                              value={appliance.wall}
                              onChange={(event) => setReviewedAppliances((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, wall: event.target.value } : item))}
                              className="mt-1 h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                            >
                              <option value="Back">Back</option>
                              <option value="Front">Front</option>
                              <option value="Left">Left</option>
                              <option value="Right">Right</option>
                            </select>
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.reviewNotes.length > 0 && <p className="text-xs text-muted-foreground">{result.reviewNotes.join(" ")}</p>}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {imageDataUrl && <Button type="button" variant="outline" onClick={reset}><Upload className="mr-2 h-4 w-4" />Choose another image</Button>}
          <Button type="button" disabled={!result || interpret.isPending} onClick={apply}><Camera className="mr-2 h-4 w-4" />Replace with reviewed layout</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
