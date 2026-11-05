import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Building2, CheckCircle2, Forward, Inbox, Mail, Save, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  VENDOR_EMAIL_PURPOSES,
  isVendorEmailAddress,
  vendorAddressSections,
  vendorEmailPurposeLabel,
  vendorInboxAssignedTo,
  vendorInboxReceivedAt,
  type VendorEmailPurpose,
  type VendorInboxMail,
} from "@/lib/vendorSupportMail";

/**
 * `vendorEmails.*` is being added in the cabinet-backend draft. Typing the client
 * loosely keeps this screen compiling and lets every read fail into an empty
 * state until the procedures are deployed.
 */
type VendorEmailAddressRow = {
  id?: number | null;
  vendorLineId?: number | null;
  vendorName?: string | null;
  purpose?: string | null;
  address?: string | null;
  updatedAt?: string | Date | null;
};

type VendorEmailsClient = {
  vendorEmails: {
    list: {
      useQuery: (
        input?: unknown,
        options?: unknown,
      ) => { data?: { vendors?: unknown[]; mail?: unknown[] } | null; isLoading?: boolean; isError?: boolean; error?: unknown; refetch?: () => void };
    };
    get: {
      useQuery: (
        input?: unknown,
        options?: unknown,
      ) => { data?: { addresses?: unknown[] } | null; isLoading?: boolean; isError?: boolean };
    };
    updateAddresses: {
      useMutation: (options?: unknown) => {
        mutate: (input: unknown) => void;
        mutateAsync: (input: unknown) => Promise<unknown>;
        isPending?: boolean;
      };
    };
    forward: {
      useMutation: (options?: unknown) => {
        mutate: (input: unknown) => void;
        mutateAsync: (input: unknown) => Promise<unknown>;
        isPending?: boolean;
      };
    };
  };
};

const vendorEmails = (trpc as unknown as VendorEmailsClient).vendorEmails;

type VendorRow = {
  id: number;
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  addresses: VendorEmailAddressRow[];
};

function AddressSection({
  vendorId,
  vendorName,
  purpose,
  label,
  description,
  address,
}: {
  vendorId: number;
  vendorName: string;
  purpose: VendorEmailPurpose;
  label: string;
  description: string;
  address: string;
}) {
  const utils = trpc.useUtils();
  const [value, setValue] = useState(address);
  const update = vendorEmails.updateAddresses.useMutation({
    onSuccess: () => {
      toast.success(`${label} address saved for ${vendorName}`);
      void (utils as unknown as { vendorEmails?: { list?: { invalidate?: () => void } } }).vendorEmails?.list?.invalidate?.();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : `Could not save the ${label} address.`),
  });

  const valid = value.trim() === "" || isVendorEmailAddress(value);
  const dirty = value.trim() !== address.trim();

  return (
    <Card data-testid={`vendor-email-section-${purpose}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          {label}
          {address ? (
            <Badge variant="outline" className="border-emerald-300 text-emerald-700">Set</Badge>
          ) : (
            <Badge variant="secondary">No address yet</Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1 space-y-1">
          <Label htmlFor={`vendor-${vendorId}-${purpose}`} className="text-xs">{label} email</Label>
          <Input
            id={`vendor-${vendorId}-${purpose}`}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder={`${label.toLowerCase()}@vendor.example`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={!valid}
            className={valid ? undefined : "border-destructive"}
            data-testid={`vendor-email-input-${purpose}`}
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={!valid || !dirty || update.isPending}
          onClick={() => update.mutate({ vendorLineId: vendorId, purpose, address: value.trim() })}
          data-testid={`vendor-email-save-${purpose}`}
        >
          {update.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          Save
        </Button>
        {!valid && <p className="w-full text-xs text-destructive">That does not look like an email address.</p>}
      </CardContent>
    </Card>
  );
}

function VendorMailboxes({ vendors }: { vendors: VendorRow[] }) {
  if (!vendors.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground" data-testid="vendor-mailboxes-empty">
          <Building2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p>No vendors are set up yet. Add an approved vendor first, then come back to file its four addresses.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {vendors.map((vendor) => {
        const sections = vendorAddressSections(vendor.addresses);
        return (
          <section key={vendor.id} className="space-y-3" data-testid={`vendor-mailboxes-${vendor.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h3 className="text-base font-semibold">{vendor.name}</h3>
              <span className="text-xs text-muted-foreground">
                {sections.filter((row) => row.address).length} of {VENDOR_EMAIL_PURPOSES.length} addresses set
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {sections.map((section) => (
                <AddressSection
                  key={`${vendor.id}-${section.purpose}`}
                  vendorId={vendor.id}
                  vendorName={vendor.name}
                  purpose={section.purpose}
                  label={section.label}
                  description={section.description}
                  address={section.address}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ForwardDialog({ mail, onClose }: { mail: VendorInboxMail; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [to, setTo] = useState((mail.assignedToEmail ?? "").trim());
  const [note, setNote] = useState("");
  const forward = vendorEmails.forward.useMutation({
    onSuccess: () => {
      toast.success(`Forwarded to ${to || "the assigned staff member"}`);
      void (utils as unknown as { vendorEmails?: { list?: { invalidate?: () => void } } }).vendorEmails?.list?.invalidate?.();
      onClose();
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : "Could not forward this message."),
  });
  const valid = isVendorEmailAddress(to);
  return (
    <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4" data-testid="vendor-mail-forward-panel">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Forward className="h-4 w-4 text-primary" />
        Forward “{mail.subject || `Message #${mail.id}`}”
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Nothing is sent until you press Forward. One message goes out, then the original stays in this inbox.
      </p>
      <div className="mt-3 space-y-2">
        <div className="space-y-1">
          <Label htmlFor="vendor-mail-forward-to" className="text-xs">Send to</Label>
          <Input
            id="vendor-mail-forward-to"
            type="email"
            inputMode="email"
            placeholder="staff@cabinetdealz.com"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-invalid={!valid}
            className={valid ? undefined : "border-destructive"}
            data-testid="vendor-mail-forward-to"
          />
          {!valid && <p className="text-xs text-destructive">Enter the staff email that should receive this.</p>}
        </div>
        <div className="space-y-1">
          <Label htmlFor="vendor-mail-forward-note" className="text-xs">Note (optional)</Label>
          <Textarea
            id="vendor-mail-forward-note"
            rows={2}
            placeholder="Anything the person receiving it should know"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          disabled={!valid || forward.isPending}
          onClick={() => forward.mutate({ id: mail.id, to: to.trim(), note: note.trim() || undefined })}
          data-testid="vendor-mail-forward-send"
        >
          {forward.isPending ? <Spinner className="h-3.5 w-3.5" /> : <Forward className="h-3.5 w-3.5" />}
          Forward
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} data-testid="vendor-mail-forward-cancel">
          Cancel
        </Button>
      </div>
    </div>
  );
}

function VendorInbox({ mail, loading, unavailable }: { mail: VendorInboxMail[]; loading: boolean; unavailable: boolean }) {
  const [purposeFilter, setPurposeFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const visible = useMemo(
    () => mail.filter((row) => purposeFilter === "all" || (row.purpose ?? "") === purposeFilter),
    [mail, purposeFilter],
  );

  if (loading) {
    return <div className="flex justify-center py-10"><Spinner className="h-6 w-6" /></div>;
  }

  return (
    <div className="space-y-3">
      {unavailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50/60 p-3 text-xs text-amber-900" data-testid="vendor-inbox-unavailable">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            The vendor mailbox service is not live yet, so this inbox is empty. Addresses you save above are kept,
            and mail will appear here once the backend mailbox procedures are deployed.
          </p>
        </div>
      )}
      <Tabs value={purposeFilter} onValueChange={setPurposeFilter}>
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger value="all">All types</TabsTrigger>
          {VENDOR_EMAIL_PURPOSES.map((purpose) => (
            <TabsTrigger key={purpose.key} value={purpose.key}>{purpose.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground" data-testid="vendor-inbox-empty">
            <Inbox className="mx-auto mb-2 h-8 w-8 opacity-30" />
            <p>No {purposeFilter === "all" ? "" : `${vendorEmailPurposeLabel(purposeFilter).toLowerCase()} `}messages yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((row) => (
                <Fragment key={row.id}>
                  <TableRow data-testid={`vendor-mail-${row.id}`}>
                    <TableCell className="text-sm font-medium">{row.vendorName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{vendorEmailPurposeLabel(row.purpose)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[22rem]">
                      <p className="truncate text-sm" title={row.subject ?? undefined}>{row.subject || "(no subject)"}</p>
                      {row.bodyPreview && <p className="truncate text-xs text-muted-foreground">{row.bodyPreview}</p>}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{vendorInboxAssignedTo(row)}</p>
                      {row.toAddress && <p className="text-muted-foreground">{row.toAddress}</p>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {vendorInboxReceivedAt(row) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.forwardedAt ? (
                        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Forwarded
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs"
                          onClick={() => setOpenId(openId === row.id ? null : row.id)}
                          data-testid={`vendor-mail-forward-${row.id}`}
                        >
                          <Forward className="h-3 w-3" />
                          Forward
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                  {openId === row.id && (
                    <TableRow>
                      <TableCell colSpan={6} className="bg-muted/20">
                        <ForwardDialog mail={row} onClose={() => setOpenId(null)} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function VendorSupportAdmin() {
  const list = vendorEmails.list.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const vendors = useMemo(() => {
    const rows = (list.data?.vendors ?? []) as Array<Record<string, unknown>>;
    return rows
      .map((row) => ({
        id: Number(row.id),
        name: String(row.name ?? "Vendor"),
        contactName: (row.contactName as string | null) ?? null,
        contactEmail: (row.contactEmail as string | null) ?? null,
        addresses: ((row.addresses ?? []) as VendorEmailAddressRow[]),
      }))
      .filter((row) => Number.isFinite(row.id));
  }, [list.data]);
  const mail = useMemo(() => ((list.data?.mail ?? []) as VendorInboxMail[]), [list.data]);
  const unavailable = !!list.isError;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Vendor Support</h2>
        <p className="text-sm text-muted-foreground">
          File each vendor’s four addresses — Claims, Support, Sales and Sales Communication — and read what they send us.
          Messages are addressed to the assigned Cabinet Deals staff member. Nothing is forwarded until an admin sends it.
        </p>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Email addresses by vendor</h3>
        <VendorMailboxes vendors={vendors} />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vendor inbox</h3>
        <VendorInbox mail={mail} loading={!!list.isLoading} unavailable={unavailable} />
      </section>
    </div>
  );
}
