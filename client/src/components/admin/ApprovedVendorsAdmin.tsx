import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Store, RefreshCw, Plus, Pencil, Trash2, CheckCircle2, XCircle, UserPlus, ShieldCheck, Clock, Link2, Copy, ExternalLink, Search, FileText, Upload, Download, Send } from "lucide-react";
import { Link } from "wouter";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type VendorLine = {
  id: number;
  name: string;
  sourceKey: string | null;
  category: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  isApproved: boolean;
  isCabinetVendor: boolean | null;
  totalSalesCents: number;
  salesUpdatedAt: Date | string | null;
  notes: string | null;
  websiteUrl: string | null;
  catalogPdfUrl: string | null;
  specBookPdfUrl: string | null;
  portalReadiness?: "not-approved" | "email-required" | "profile-only" | "ready";
  linkedDistributor?: { id: number; code: string; name: string } | null;
  linkedDistributorIds?: number[];
  linkedDistributors?: Array<{ id: number; code: string; name: string }>;
};

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function supplierCatalogLineLabel(line: { code: string; name: string }) {
  if (line.code === "USCD") return `Framed — ${line.name}`;
  if (line.code === "AEF") return `Frameless — ${line.name}`;
  return line.name;
}

const MAX_VENDOR_RESOURCE_BYTES = 12 * 1024 * 1024;

async function readPdfAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The PDF could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });
}

function VendorPdfResourceField({
  vendorId,
  resource,
  label,
  description,
  value,
  onChange,
}: {
  vendorId?: number;
  resource: "catalog" | "specBook";
  label: string;
  description: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const inputId = `vendor-${vendorId ?? "new"}-${resource}-pdf`;
  const upload = trpc.vendors.uploadResourcePdf.useMutation({
    onSuccess: (result) => {
      onChange(result.url);
      toast.success(`${label} uploaded and linked to this vendor.`);
    },
    onError: (error) => toast.error(error.message || `Could not upload ${label.toLowerCase()}.`),
  });

  const handleFile = async (file?: File) => {
    if (!file || !vendorId) return;
    if (file.type !== "application/pdf") {
      toast.error("Choose a PDF file.");
      return;
    }
    if (file.size === 0 || file.size > MAX_VENDOR_RESOURCE_BYTES) {
      toast.error("PDF files must be between 1 byte and 12 MB.");
      return;
    }
    try {
      upload.mutate({
        id: vendorId,
        resource,
        fileBase64: await readPdfAsBase64(file),
        contentType: "application/pdf",
        fileName: file.name,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The PDF could not be read.");
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label htmlFor={`${inputId}-url`} className="text-sm font-semibold">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {value && (
          <a href={value} target="_blank" rel="noopener noreferrer" className="shrink-0">
            <Button type="button" size="sm" variant="outline" className="gap-1" title={`Open or download ${label}`}>
              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> PDF <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </a>
        )}
      </div>
      <Input
        id={`${inputId}-url`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Paste a verified PDF URL"
        type="url"
      />
      {vendorId ? (
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(event) => {
              void handleFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            disabled={upload.isPending}
            onClick={() => document.getElementById(inputId)?.click()}
          >
            <Upload className="h-3.5 w-3.5" /> {upload.isPending ? "Uploading…" : "Upload PDF"}
          </Button>
          <span className="text-xs text-muted-foreground">PDF only · max 12 MB</span>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Save this new vendor first to upload a PDF, or paste a verified PDF URL now.</p>
      )}
    </div>
  );
}

// ─── Invite Link Button ──────────────────────────────────────────────────────
function InviteLinkButton({ vendorId, vendorName }: { vendorId: number; vendorName: string }) {
  const generateInvite = trpc.vendors.generateInvite.useMutation({
    onSuccess: (res) => {
      if (res.success && res.token) {
        const url = `${window.location.origin}/vendor?invite=${res.token}`;
        navigator.clipboard.writeText(url).then(() => {
          toast.success(`Supplier setup link copied for ${vendorName}`, {
            description: "Send this private, one-time link to the vendor. They choose their own login email and password.",
            duration: 8000,
          });
        }).catch(() => {
          // Fallback: show the URL in the toast so they can copy manually
          toast.success(`Supplier setup link for ${vendorName}`, {
            description: url,
            duration: 12000,
          });
        });
      }
    },
    onError: (e) => toast.error(e.message || "Failed to generate invite"),
  });

  return (
    <Button
      size="sm"
      variant="outline"
      className="gap-1 whitespace-nowrap"
      disabled={generateInvite.isPending}
      onClick={() => generateInvite.mutate({ id: vendorId })}
      title={`Copy a one-time supplier portal setup link for ${vendorName}`}
    >
      <UserPlus className="h-3.5 w-3.5" /> Setup login
    </Button>
  );
}

function EmailPortalInviteButton({
  vendorId,
  vendorName,
  defaultEmail,
}: {
  vendorId: number;
  vendorName: string;
  defaultEmail?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const sendInvite = trpc.vendors.emailPortalInvite.useMutation({
    onSuccess: (result) => {
      toast.success(`Supplier Portal invitation emailed to ${result.sentTo}`, {
        description: `${vendorName} can use the private one-time link to create their own password.`,
        duration: 8000,
      });
      setOpen(false);
    },
    onError: (error) => toast.error(error.message || "Could not email the Supplier Portal invitation."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          title={`Email a private Supplier Portal setup link to ${vendorName}`}
        >
          <Send className="h-3.5 w-3.5" /> Email invite
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Email Supplier Portal invitation</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Send <strong>{vendorName}</strong> a private, one-time setup link. They choose their own password; no password is sent or displayed.
          </p>
          <div className="space-y-2">
            <Label htmlFor={`supplier-invite-${vendorId}`}>Recipient email</Label>
            <Input
              id={`supplier-invite-${vendorId}`}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="supplier-contact@company.com"
              autoComplete="email"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Delivery uses the SMTP connection in <strong>Admin → Email Settings</strong>. If it is not configured, nothing is sent and no setup link is activated.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            className="gap-1"
            disabled={sendInvite.isPending || !/^\S+@\S+\.\S+$/.test(email.trim())}
            onClick={() => sendInvite.mutate({ id: vendorId, toEmail: email.trim() })}
          >
            <Send className="h-4 w-4" /> {sendInvite.isPending ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type VendorDraft = {
  name: string;
  sourceKey: string | null;
  category: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
  isApproved: false;
  isCabinetVendor: null;
};

function VendorDialog({
  vendor,
  seed,
  trigger,
  onSaved,
}: {
  vendor?: VendorLine;
  seed?: VendorDraft | null;
  trigger: React.ReactNode;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const supplierLines = trpc.distributors.list.useQuery(undefined, { enabled: open });
  const [form, setForm] = useState({
    name: vendor?.name ?? seed?.name ?? "",
    sourceKey: vendor?.sourceKey ?? seed?.sourceKey ?? "",
    linkedDistributorIds: vendor?.linkedDistributorIds ?? [],
    category: vendor?.category ?? seed?.category ?? "",
    contactName: vendor?.contactName ?? seed?.contactName ?? "",
    contactEmail: vendor?.contactEmail ?? seed?.contactEmail ?? "",
    contactPhone: vendor?.contactPhone ?? seed?.contactPhone ?? "",
    isApproved: vendor?.isApproved ?? seed?.isApproved ?? true,
    isCabinetVendor: (vendor ? vendor.isCabinetVendor : seed?.isCabinetVendor) ?? null as boolean | null,
    notes: vendor?.notes ?? "",
    websiteUrl: vendor?.websiteUrl ?? seed?.websiteUrl ?? "",
    catalogPdfUrl: vendor?.catalogPdfUrl ?? "",
    specBookPdfUrl: vendor?.specBookPdfUrl ?? "",
  });

  const upsert = trpc.vendors.upsert.useMutation({
    onSuccess: () => {
      toast.success(vendor ? "Vendor updated" : "Vendor added");
      setOpen(false);
      onSaved();
    },
    onError: (e) => toast.error(e.message || "Failed to save vendor"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{vendor ? "Edit vendor line" : "Add vendor line"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-xs">Vendor / supply line name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Pelican Surfaces & Fixtures"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Category</Label>
              <Input
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Surfaces & Fixtures"
              />
            </div>
            <div>
              <Label className="text-xs">Source key (optional: sales and catalog line)</Label>
              <Input
                value={form.sourceKey}
                onChange={(e) => setForm({ ...form, sourceKey: e.target.value })}
                placeholder="Optional: pelican or dist:3"
              />
              <Select
                value={form.sourceKey.startsWith("dist:") ? form.sourceKey : undefined}
                onValueChange={(sourceKey) => setForm({ ...form, sourceKey })}
              >
                <SelectTrigger className="mt-2 h-8 text-xs">
                  <SelectValue placeholder="Select active supplier line" />
                </SelectTrigger>
                <SelectContent>
                  {(supplierLines.data ?? []).filter((line: any) => line.isActive).map((line: any) => (
                    <SelectItem key={line.id} value={`dist:${line.id}`}>
                      {line.name} ({line.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                This controls sales attribution and catalog tools. It is not required for an approved vendor to have its own editable supplier profile.
              </p>
            </div>
          </div>
          <div>
            <Label className="text-xs">Additional catalog lines for this supplier (optional)</Label>
            <div className="mt-2 grid max-h-36 gap-2 overflow-y-auto rounded-md border p-2">
              {(supplierLines.data ?? []).filter((line: any) => line.isActive).map((line: any) => {
                const selected = form.linkedDistributorIds.includes(line.id);
                return (
                  <label key={line.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) => setForm({
                        ...form,
                        linkedDistributorIds: event.target.checked
                          ? [...form.linkedDistributorIds, line.id]
                          : form.linkedDistributorIds.filter((id) => id !== line.id),
                      })}
                    />
                    <span>{line.name} <span className="font-mono text-xs text-muted-foreground">({line.code})</span></span>
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Use this for separate supplier catalog lines such as US Cabinet Depot Framed and Frameless. Their SKUs, pricing, availability, and orders remain separate.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Contact name</Label>
              <Input
                value={form.contactName}
                onChange={(e) => setForm({ ...form, contactName: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Contact phone</Label>
              <Input
                value={form.contactPhone}
                onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Contact email (optional direct supplier login)</Label>
            <Input
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
              placeholder="supplier-contact@company.com"
            />
            <p className="mt-1 text-xs text-muted-foreground" data-testid="approved-vendor-login-help">
              This email can create a password directly. Or use the visible <strong>Setup login</strong> action after saving to send a private one-time link; it works even before an email is saved here.
            </p>
          </div>
          <div>
            <Label className="text-xs">Website URL</Label>
            <Input
              value={form.websiteUrl}
              onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
              placeholder="https://www.supplier.com"
              type="url"
            />
          </div>
          <div className="grid gap-3">
            <VendorPdfResourceField
              vendorId={vendor?.id}
              resource="catalog"
              label="PDF catalog"
              description="The current source catalog for this supply line."
              value={form.catalogPdfUrl}
              onChange={(catalogPdfUrl) => setForm({ ...form, catalogPdfUrl })}
            />
            <VendorPdfResourceField
              vendorId={vendor?.id}
              resource="specBook"
              label="PDF spec book"
              description="Dimensions, packaging, installation, or technical specifications."
              value={form.specBookPdfUrl}
              onChange={(specBookPdfUrl) => setForm({ ...form, specBookPdfUrl })}
            />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="rounded-lg border p-3 space-y-2" data-testid="is-cabinet-vendor-field">
            <div className="flex items-start gap-2">
              <Checkbox
                id={`is-cabinet-vendor-${vendor?.id ?? "new"}`}
                checked={form.isCabinetVendor === true}
                onCheckedChange={(value) => setForm({ ...form, isCabinetVendor: value === true })}
              />
              <div>
                <Label htmlFor={`is-cabinet-vendor-${vendor?.id ?? "new"}`} className="text-sm">Is cabinet vendor</Label>
                <p className="text-xs text-muted-foreground">
                  {form.isCabinetVendor === true && "Cabinet catalog, door styles, room scenes, samples, and the cabinet designer tools."}
                  {form.isCabinetVendor === false && "Non-cabinet supplier. Category catalog and the shared tools only."}
                  {form.isCabinetVendor == null && "Not chosen yet. Tick this for a cabinet supplier, or mark them non-cabinet before approving."}
                </p>
              </div>
            </div>
            {form.isCabinetVendor !== false && (
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-xs"
                onClick={() => setForm({ ...form, isCabinetVendor: false })}
              >
                Not a cabinet vendor
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isApproved}
              onCheckedChange={(v) => setForm({ ...form, isApproved: v })}
            />
            <Label className="text-sm">Approved vendor</Label>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={upsert.isPending || !form.name.trim() || (form.isApproved && form.isCabinetVendor == null)}
            onClick={() => {
              if (form.isApproved && form.isCabinetVendor == null) {
                toast.error("Choose whether this is a cabinet vendor before approving it.");
                return;
              }
              upsert.mutate({
                id: vendor?.id,
                name: form.name.trim(),
                sourceKey: form.sourceKey.trim() || null,
                linkedDistributorIds: form.linkedDistributorIds,
                category: form.category,
                contactName: form.contactName,
                contactEmail: form.contactEmail,
                contactPhone: form.contactPhone,
                isApproved: form.isApproved,
                isCabinetVendor: form.isCabinetVendor,
                notes: form.notes,
                websiteUrl: form.websiteUrl.trim() || null,
                catalogPdfUrl: form.catalogPdfUrl.trim() || null,
                specBookPdfUrl: form.specBookPdfUrl.trim() || null,
              });
            }}
          >
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Provision Vendor Account Dialog ─────────────────────────────────────────
function ProvisionAccountDialog({ vendorId, vendorName, onDone }: { vendorId: number; vendorName: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  // Get list of distributors to link
  const distributors = trpc.distributors.list.useQuery(undefined, { enabled: open });
  const [selectedDistId, setSelectedDistId] = useState<string>("");

  const provision = trpc.vendor.adminProvisionVendor.useMutation({
    onSuccess: (res) => {
      toast.success(res.created ? `Account created for ${form.email}` : `Existing account linked to distributor`);
      setOpen(false);
      setForm({ email: "", password: "", name: "" });
      onDone();
    },
    onError: (e) => toast.error(e.message || "Failed to provision account"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1" title="Create vendor login">
          <UserPlus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Provision Vendor Account: {vendorName}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label className="text-xs">Email (login)</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="vendor@company.com"
            />
          </div>
          <div>
            <Label className="text-xs">Temporary Password (min 8 chars)</Label>
            <Input
              type="text"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Temp1234!"
            />
          </div>
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Contact name"
            />
          </div>
          <div>
            <Label className="text-xs">Link to Distributor Line</Label>
            <Select value={selectedDistId} onValueChange={setSelectedDistId}>
              <SelectTrigger><SelectValue placeholder="Select distributor line" /></SelectTrigger>
              <SelectContent>
                {(distributors.data ?? []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name} ({d.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={provision.isPending || !form.email || !form.password || form.password.length < 8 || !selectedDistId}
            onClick={() => provision.mutate({
              email: form.email,
              password: form.password,
              name: form.name || form.email,
              distributorId: Number(selectedDistId),
            })}
          >
            {provision.isPending ? "Creating…" : "Create Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Pending Products Approval ───────────────────────────────────────────────
function PendingProductsSection() {
  const utils = trpc.useUtils();
  const pending = trpc.distributorPortal.catalog.useQuery({ onlyPending: true, limit: 100, offset: 0 });
  const approve = trpc.distributorPortal.adminSetProductStatus.useMutation({
    onSuccess: () => {
      utils.distributorPortal.catalog.invalidate();
      toast.success("Product status updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const items = pending.data?.items ?? [];

  if (pending.isLoading) return <div className="py-4 text-center"><Spinner /></div>;
  if (items.length === 0) return (
    <div className="py-6 text-center text-sm text-muted-foreground">
      No pending product submissions.
    </div>
  );

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2">
        <Clock className="h-4 w-4" /> Pending Product Submissions ({items.length})
      </h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>Cabinet</TableHead>
            <TableHead>Style</TableHead>
            <TableHead>List Price</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item: any) => (
            <TableRow key={item.id}>
              <TableCell className="font-mono text-xs">{item.distributorSku}</TableCell>
              <TableCell>{item.masterCode || item.cabinetId}</TableCell>
              <TableCell>{item.styleName || item.styleId}</TableCell>
              <TableCell>{item.listPrice ? `$${item.listPrice}` : "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-green-600"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ skuId: item.id, status: "approved" })}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 text-destructive"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate({ skuId: item.id, status: "rejected" })}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function cabinetChoiceBadge(value: boolean | null) {
  if (value === true) return <Badge>Cabinet vendor</Badge>;
  if (value === false) return <Badge variant="outline">Non-cabinet</Badge>;
  return <Badge variant="secondary">Needs choice</Badge>;
}

function PendingVendorReview({
  vendors,
  onChanged,
}: {
  vendors: VendorLine[];
  onChanged: () => void;
}) {
  const review = trpc.vendors.pendingReview.useQuery();
  const items = review.data?.items ?? [];
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 space-y-3" data-testid="pending-vendor-review">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" /> Pending / Needs review
        </h3>
        <Badge variant="secondary" data-testid="pending-vendor-review-count">{review.data?.count ?? 0}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Sign-ups, vendor records that are not approved or still need the cabinet checkbox, and catalog lines or products with no approved vendor. Nothing here is approved automatically.
      </p>
      {review.isLoading ? <Spinner /> : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing is waiting for review.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const existing = item.vendorId != null ? vendors.find((vendor) => vendor.id === item.vendorId) : undefined;
            return (
              <div key={item.key} className="flex flex-col gap-2 rounded-md border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    <Badge variant="outline" className="capitalize">{item.kind === "vendor-record" ? "Vendor record" : item.kind === "application" ? "Application" : "Catalog reference"}</Badge>
                    {cabinetChoiceBadge(item.isCabinetVendor)}
                  </div>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
                {existing ? (
                  <VendorDialog
                    vendor={existing}
                    trigger={<Button size="sm" variant="outline">Review</Button>}
                    onSaved={onChanged}
                  />
                ) : item.draft ? (
                  <VendorDialog
                    seed={item.draft}
                    trigger={<Button size="sm" variant="outline">{item.kind === "application" ? "Add from application" : "Add vendor"}</Button>}
                    onSaved={onChanged}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ApprovedVendorsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.vendors.list.useQuery();
  const distList = trpc.distributors.list.useQuery();

  // Map sourceKey → distributorId for the View Portal button
  function getDistributorIdForVendor(sourceKey: string | null): number | null {
    if (!sourceKey) return null;
    if (sourceKey.startsWith("dist:")) return Number(sourceKey.slice(5)) || null;
    // Match sourceKey against distributor codes (UCD, CS, SK, PEL, pelican, etc.)
    const dists = distList.data ?? [];
    const match = dists.find((d: any) => d.code === sourceKey || d.code.toLowerCase() === sourceKey.toLowerCase());
    if (match) return match.id;
    // Special case: "pelican" maps to PEL distributor
    if (sourceKey.toLowerCase() === "pelican") {
      const pel = dists.find((d: any) => d.code === "PEL");
      if (pel) return pel.id;
    }
    return null;
  }

  const recompute = trpc.vendors.recomputeSales.useMutation({
    onSuccess: (res) => {
      if (res.success && (res as any).autoComputed === false) {
        toast.info("No auto-attribution rule for this line — set a source key (e.g. pelican, dist:3) or enter sales manually.");
      } else {
        toast.success("Sales recomputed");
      }
      utils.vendors.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to recompute"),
  });

  const remove = trpc.vendors.remove.useMutation({
    onSuccess: () => {
      toast.success("Vendor removed");
      utils.vendors.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Failed to remove"),
  });

  const [search, setSearch] = useState("");

  const vendors = (data ?? []) as VendorLine[];
  const filteredVendors = search.trim()
    ? vendors.filter(
        (v) =>
          v.name.toLowerCase().includes(search.toLowerCase()) ||
          (v.contactName ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (v.contactEmail ?? "").toLowerCase().includes(search.toLowerCase()) ||
          (v.category ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : vendors;
  const totalAll = vendors.reduce((sum, v) => sum + (v.totalSalesCents || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" /> Approved Vendors
            </CardTitle>
            <CardDescription>
              Your supplier scorecard. Track approval status and lifetime dollar
              sales per supplier. Sales recompute from real, non-cancelled orders —
              a Pelican line stays at $0 until Pelican products are actually
              ordered. A supplier can carry distinct Framed and Frameless catalog
              lines without merging their SKUs or prices. Set a source key (<code>pelican</code> or{" "}
              <code>dist:&lt;id&gt;</code>) to enable automatic totals. The exact
              contact email on an approved, linked line is also the supplier
              portal login email.
            </CardDescription>
          </div>
          <VendorDialog
            trigger={
              <Button className="gap-1 shrink-0">
                <Plus className="h-4 w-4" /> Add vendor
              </Button>
            }
            onSaved={() => {
              utils.vendors.list.invalidate();
              utils.vendors.pendingReview.invalidate();
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <PendingVendorReview vendors={vendors} onChanged={() => {
          utils.vendors.list.invalidate();
          utils.vendors.pendingReview.invalidate();
        }} />
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-6 text-center text-sm text-destructive">
            {error.message || "Could not load vendors."}
          </p>
        ) : vendors.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No vendor lines yet. Add your first approved vendor above.
          </p>
        ) : (
          <>
            <div className="mb-4 rounded-lg border bg-muted/30 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Total tracked sales across all vendors
              </div>
              <div className="text-2xl font-bold">{money(totalAll)}</div>
            </div>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search vendors by name, contact, category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {search && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {filteredVendors.length} of {vendors.length} vendors
                </p>
              )}
            </div>
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Vendor</TableHead>
                <TableHead className="w-[60px] text-center">ID</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[140px]">Cabinet vendor</TableHead>
                <TableHead className="w-[180px]">Portal login</TableHead>
                <TableHead className="w-[110px] text-right">Total Sales</TableHead>
                <TableHead className="w-[260px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {filteredVendors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      No vendors match &ldquo;{search}&rdquo;
                    </TableCell>
                  </TableRow>
                ) : filteredVendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="font-medium">{v.name}</div>
                      {v.linkedDistributors && v.linkedDistributors.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1" aria-label={`${v.name} linked catalog lines`}>
                          {v.linkedDistributors.map((line) => (
                            <Badge key={line.id} variant="secondary" className="gap-1 text-[10px] font-normal">
                              <span className="font-mono font-semibold">{line.code}</span>
                              <span>{supplierCatalogLineLabel(line)}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {v.contactName && (
                        <div className="text-xs text-muted-foreground">{v.contactName}</div>
                      )}
                      {v.contactEmail && (
                        <div className="text-xs text-muted-foreground">
                          {v.contactEmail} <span className="font-medium text-emerald-700">· portal login</span>
                        </div>
                      )}
                      {v.isApproved && !v.contactEmail && (
                        <div className="text-xs font-medium text-amber-700">
                          Use <strong>Setup login</strong> to give this approved vendor portal access now, or save a contact email for direct sign-up.
                        </div>
                      )}
                      {(v.catalogPdfUrl || v.specBookPdfUrl) && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {v.catalogPdfUrl && (
                            <a href={v.catalogPdfUrl} target="_blank" rel="noopener noreferrer" title="Open or download PDF catalog">
                              <Badge variant="outline" className="gap-1 text-xs hover:bg-muted">
                                <FileText className="h-3 w-3" aria-hidden="true" /> Catalog PDF <Download className="h-3 w-3" aria-hidden="true" />
                              </Badge>
                            </a>
                          )}
                          {v.specBookPdfUrl && (
                            <a href={v.specBookPdfUrl} target="_blank" rel="noopener noreferrer" title="Open or download PDF spec book">
                              <Badge variant="outline" className="gap-1 text-xs hover:bg-muted">
                                <FileText className="h-3 w-3" aria-hidden="true" /> Spec book <Download className="h-3 w-3" aria-hidden="true" />
                              </Badge>
                            </a>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground select-all">
                        {v.id}
                      </span>
                    </TableCell>
	                    <TableCell className="text-muted-foreground text-sm">
	                      {v.category || "—"}
	                    </TableCell>
	                    <TableCell>
	                      {v.isApproved ? (
	                        <Badge className="gap-1 bg-green-600 hover:bg-green-600">
	                          <CheckCircle2 className="h-3 w-3" /> Approved
	                        </Badge>
	                      ) : (
	                        <Badge variant="secondary" className="gap-1">
	                          <XCircle className="h-3 w-3" /> Inactive
	                        </Badge>
	                      )}
	                    </TableCell>
                    <TableCell>
                      {v.isCabinetVendor === true && <Badge data-testid="cabinet-vendor-badge">Cabinet vendor</Badge>}
                      {v.isCabinetVendor === false && <Badge variant="outline" data-testid="cabinet-vendor-badge">Non-cabinet</Badge>}
                      {v.isCabinetVendor == null && <Badge variant="secondary" data-testid="cabinet-vendor-badge">Needs choice</Badge>}
                    </TableCell>
	                    <TableCell className="text-xs">
                      {v.isApproved ? (
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800">Supplier login ready</Badge>
                          <p className="text-muted-foreground">{v.contactEmail ? "Direct email sign-up or setup link" : "Copy Setup login to onboard this vendor"}</p>
                        </div>
                      ) : (
	                        <span className="text-muted-foreground">Approve this vendor to enable login.</span>
	                      )}
	                    </TableCell>
	                    <TableCell className="text-right">
                      <div className="font-semibold">{money(v.totalSalesCents || 0)}</div>
                      {v.salesUpdatedAt && (
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(v.salesUpdatedAt).toLocaleDateString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {v.websiteUrl && (
                          <a href={v.websiteUrl} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1 border-primary/30 text-primary hover:bg-primary/5" title={`Visit ${v.name} website`}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={recompute.isPending}
                          onClick={() => recompute.mutate({ id: v.id })}
                          title="Recompute sales from orders"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <VendorDialog
                          vendor={v}
                          trigger={
                            <Button size="sm" variant="outline">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          }
                          onSaved={() => {
                            utils.vendors.list.invalidate();
                            utils.vendors.pendingReview.invalidate();
                          }}
                        />
                        <InviteLinkButton vendorId={v.id} vendorName={v.name} />
                        {v.isApproved && (
                          <EmailPortalInviteButton vendorId={v.id} vendorName={v.name} defaultEmail={v.contactEmail} />
                        )}
                        {(() => {
                          const distId = getDistributorIdForVendor(v.sourceKey);
                          const portalHref = distId ? `/vendor?as=${distId}&vendor=${v.id}` : `/vendor?vendor=${v.id}`;
                          return (
                            <Link href={portalHref}>
                              <Button size="sm" variant="outline" className="gap-1" title={`Preview ${v.name} Supplier Portal`}>
                                <ExternalLink className="h-3.5 w-3.5" /> Preview
                              </Button>
                            </Link>
                          );
                        })()}
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Remove vendor "${v.name}"?`)) remove.mutate({ id: v.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>

      {/* Pending product submissions */}
      <CardContent className="border-t pt-6">
        <PendingProductsSection />
      </CardContent>
    </Card>
  );
}
