import { useState } from "react";
import { ImageOff, Check, X, ArrowRight, Clock } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

function Swatch({ url, label }: { url: string | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {url ? (
        <img
          src={url}
          alt={label}
          className="h-24 w-24 rounded-md object-cover ring-1 ring-border"
        />
      ) : (
        <div className="h-24 w-24 rounded-md bg-muted flex items-center justify-center ring-1 ring-border">
          <ImageOff className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

export default function DoorCorrectionsAdmin() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.doorStyles.listCorrections.useQuery({ status });

  const review = trpc.doorStyles.reviewCorrection.useMutation({
    onSuccess: (res) => {
      toast.success(res.approved ? "Correction approved — sample updated." : "Correction rejected.");
      utils.doorStyles.listCorrections.invalidate();
      utils.doorStyles.listForAdmin.invalidate();
      utils.doorStyles.featured.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-bold flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" /> Door Corrections
        </h2>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Field submissions of a real door photo to correct a style's on-file sample. Admin uploads
          apply instantly; these are submissions from others waiting for your review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.key}
            size="sm"
            variant={status === t.key ? "default" : "outline"}
            onClick={() => setStatus(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center text-muted-foreground">
          No {status === "all" ? "" : status} corrections.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Swatch url={c.previousImageUrl} label="Current" />
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                <Swatch url={c.imageUrl} label="Proposed" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">
                  {c.styleName ?? `Style #${c.styleId}`}
                  {c.styleCode ? (
                    <span className="text-muted-foreground"> · {c.styleCode}</span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Submitted by {c.submittedByName ?? `user #${c.submittedBy}`} ·{" "}
                  {new Date(c.createdAt).toLocaleDateString()}
                </p>
                {c.note ? <p className="text-sm mt-1.5 italic">“{c.note}”</p> : null}
                <div className="mt-1.5">
                  <Badge
                    variant={
                      c.status === "approved"
                        ? "default"
                        : c.status === "rejected"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
              </div>

              {c.status === "pending" && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: c.id, approve: true })}
                  >
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: c.id, approve: false })}
                  >
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
