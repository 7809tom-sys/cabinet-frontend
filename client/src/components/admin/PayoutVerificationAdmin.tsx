import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  CheckCircle2, XCircle, Clock, Eye, FileText, CreditCard,
  User, Building2, Phone, Mail, MapPin, AlertTriangle, Download,
} from "lucide-react";

type VerificationStatus = "pending" | "approved" | "rejected" | "needs_info";

interface AffiliatePayoutRecord {
  id: number;
  storeName: string;
  email: string;
  // W-9 fields
  legalName: string | null;
  businessName: string | null;
  taxEntityType: string | null;
  taxId: string | null; // masked
  taxAddress: string | null;
  taxCity: string | null;
  taxState: string | null;
  taxZip: string | null;
  // Bank fields
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountLast4: string | null;
  bankRoutingLast4: string | null;
  // ID docs
  ssnCardUrl: string | null;
  dlFrontUrl: string | null;
  dlBackUrl: string | null;
  // Status
  payoutVerificationStatus: string | null;
  payoutVerificationNotes: string | null;
  payoutEsignedAt: number | null;
  payoutSetupCompletedAt: number | null;
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") {
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
  }
  if (status === "approved") {
    return <Badge className="gap-1 bg-green-600 text-white"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
  }
  if (status === "rejected") {
    return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
  }
  if (status === "needs_info") {
    return <Badge className="gap-1 bg-amber-500 text-white"><AlertTriangle className="h-3 w-3" />Needs Info</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

function DocLink({ url, label }: { url: string | null; label: string }) {
  if (!url) return <span className="text-muted-foreground text-sm italic">Not uploaded</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
    >
      <Eye className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

export default function PayoutVerificationAdmin() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<VerificationStatus | "all">("all");

  const { data: affiliates, isLoading, refetch } = trpc.affiliates.listForPayoutVerification.useQuery();

  const updateMutation = trpc.affiliates.updatePayoutVerification.useMutation({
    onSuccess: () => {
      toast.success("Verification status updated");
      setSelectedId(null);
      setNotes("");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = (affiliates ?? []).filter((a: AffiliatePayoutRecord) => {
    if (filterStatus === "all") return true;
    const s = a.payoutVerificationStatus ?? "pending";
    return s === filterStatus;
  });

  const selected = affiliates?.find((a: AffiliatePayoutRecord) => a.id === selectedId);

  const handleAction = (status: VerificationStatus) => {
    if (!selectedId) return;
    updateMutation.mutate({ affiliateId: selectedId, status, notes });
  };

  const completionPct = (a: AffiliatePayoutRecord) => {
    const steps = [
      !!a.legalName,
      !!a.taxId,
      !!a.bankName,
      !!a.ssnCardUrl,
      !!a.dlFrontUrl,
      !!a.payoutEsignedAt,
    ];
    return Math.round((steps.filter(Boolean).length / steps.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Payout Verification (1099-NEC)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review affiliate W-9 information, identity documents, and bank details before enabling payouts.
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "approved", "rejected", "needs_info"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filterStatus === s ? "default" : "outline"}
            onClick={() => setFilterStatus(s)}
            className="capitalize"
          >
            {s === "all" ? "All" : s === "needs_info" ? "Needs Info" : s.charAt(0).toUpperCase() + s.slice(1)}
            {s !== "all" && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
                {(affiliates ?? []).filter((a: AffiliatePayoutRecord) => (a.payoutVerificationStatus ?? "pending") === s).length}
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No affiliates match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((a: AffiliatePayoutRecord) => {
            const pct = completionPct(a);
            return (
              <Card key={a.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {(a.storeName || a.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold">{a.storeName || "Unnamed Store"}</div>
                        <div className="text-sm text-muted-foreground">{a.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Completion bar */}
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: pct === 100 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626",
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{pct}%</span>
                      </div>

                      <StatusBadge status={a.payoutVerificationStatus} />

                      <Button size="sm" variant="outline" onClick={() => { setSelectedId(a.id); setNotes(a.payoutVerificationNotes ?? ""); }}>
                        <Eye className="h-4 w-4 mr-1" /> Review
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={selectedId !== null} onOpenChange={(o) => { if (!o) { setSelectedId(null); setNotes(""); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Payout Verification — {selected?.storeName}</DialogTitle>
          </DialogHeader>

          {selected && (
            <div className="space-y-6">
              {/* W-9 / Tax Info */}
              <section>
                <div className="flex items-center gap-2 font-semibold mb-3">
                  <FileText className="h-4 w-4 text-primary" /> W-9 / Tax Information
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Legal Name</div>
                    <div>{selected.legalName || <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Business Name (DBA)</div>
                    <div>{selected.businessName || <span className="italic text-muted-foreground">N/A</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Entity Type</div>
                    <div>{selected.taxEntityType || <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">SSN / EIN (masked)</div>
                    <div className="font-mono">{selected.taxId ? `***-**-${selected.taxId.slice(-4)}` : <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">Tax Address</div>
                    <div>
                      {selected.taxAddress
                        ? `${selected.taxAddress}, ${selected.taxCity}, ${selected.taxState} ${selected.taxZip}`
                        : <span className="italic text-muted-foreground">Not provided</span>}
                    </div>
                  </div>
                </div>
              </section>

              {/* Bank Info */}
              <section>
                <div className="flex items-center gap-2 font-semibold mb-3">
                  <CreditCard className="h-4 w-4 text-primary" /> Bank / ACH Information
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Bank Name</div>
                    <div>{selected.bankName || <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Account Type</div>
                    <div className="capitalize">{selected.bankAccountType || <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Account # (last 4)</div>
                    <div className="font-mono">{selected.bankAccountLast4 ? `••••${selected.bankAccountLast4}` : <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Routing # (last 4)</div>
                    <div className="font-mono">{selected.bankRoutingLast4 ? `•••••${selected.bankRoutingLast4}` : <span className="italic text-muted-foreground">Not provided</span>}</div>
                  </div>
                </div>
              </section>

              {/* Identity Documents */}
              <section>
                <div className="flex items-center gap-2 font-semibold mb-3">
                  <User className="h-4 w-4 text-primary" /> Identity Documents
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Social Security Card</span>
                    <DocLink url={selected.ssnCardUrl} label="View SSN Card" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Driver's License (Front)</span>
                    <DocLink url={selected.dlFrontUrl} label="View DL Front" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Driver's License (Back)</span>
                    <DocLink url={selected.dlBackUrl} label="View DL Back" />
                  </div>
                </div>
              </section>

              {/* E-signature */}
              <section>
                <div className="flex items-center gap-2 font-semibold mb-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> E-Signature Consent
                </div>
                {selected.payoutEsignedAt ? (
                  <div className="text-sm text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Signed on {new Date(selected.payoutEsignedAt).toLocaleDateString()}
                  </div>
                ) : (
                  <div className="text-sm text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Not yet signed
                  </div>
                )}
              </section>

              {/* Admin Notes */}
              <section>
                <div className="font-semibold mb-2 text-sm">Admin Notes</div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes for this affiliate (visible to admin only)..."
                  rows={3}
                />
              </section>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => handleAction("approved")}
                  disabled={updateMutation.isPending}
                >
                  <CheckCircle2 className="h-4 w-4" /> Approve Payout
                </Button>
                <Button
                  variant="destructive"
                  className="gap-2"
                  onClick={() => handleAction("rejected")}
                  disabled={updateMutation.isPending}
                >
                  <XCircle className="h-4 w-4" /> Reject
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 border-amber-500 text-amber-600 hover:bg-amber-50"
                  onClick={() => handleAction("needs_info")}
                  disabled={updateMutation.isPending}
                >
                  <AlertTriangle className="h-4 w-4" /> Needs More Info
                </Button>
                {updateMutation.isPending && <Spinner className="h-5 w-5 self-center" />}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
