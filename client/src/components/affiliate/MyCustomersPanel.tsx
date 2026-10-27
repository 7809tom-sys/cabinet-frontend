import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  BROWSING_HISTORY_NOTE,
  customersToCsv,
  filterCustomers,
  type CustomerSource,
  type CustomerStatus,
  type UnifiedCustomer,
} from "@shared/customerDirectory";
import { toast } from "sonner";
import { Download, Mail, Phone, Search } from "lucide-react";

type ListCustomer = Omit<UnifiedCustomer, "designs" | "quotes">;

const SOURCES: Array<CustomerSource | "all"> = ["all", "design", "quote", "order", "lead", "crm", "estimate", "storefront"];
const STATUSES: Array<CustomerStatus | "all"> = ["all", "new", "contacted", "quoted", "won", "lost"];

function money(value: number) {
  return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function when(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

type PreviewDetail = {
  customer: UnifiedCustomer;
  designs: Array<{ id: number; name: string; thumbnailUrl: string | null; assistLabel: string | null }>;
  projects: Array<{ id: number; name: string; status: string; designIds: number[]; quoteIds: number[] }>;
  timeline: Array<{ at: string; kind: string; title: string }>;
  browsingNote: string;
  storeSlug: string | null;
};

export function MyCustomersPanel({
  affiliateId,
  initialCustomerKey = null,
  previewCustomers = null,
  previewDetail = null,
  canAssist = true,
}: {
  affiliateId: number | null;
  initialCustomerKey?: string | null;
  previewCustomers?: ListCustomer[] | null;
  previewDetail?: PreviewDetail | null;
  canAssist?: boolean;
}) {
  const utils = trpc.useUtils();
  const list = trpc.affiliateCustomers.list.useQuery(
    { affiliateId },
    { enabled: previewCustomers == null, retry: false },
  );
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<CustomerSource | "all">("all");
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasOpenQuote, setHasOpenQuote] = useState(false);
  const [unfinishedDesign, setUnfinishedDesign] = useState(false);
  const [followUpsDue, setFollowUpsDue] = useState(false);
  const [sort, setSort] = useState<"lastActivity" | "name" | "firstSeen" | "totalValue" | "status">("lastActivity");
  const [selectedKey, setSelectedKey] = useState<string | null>(initialCustomerKey);
  const customers = filterCustomers((previewCustomers ?? list.data?.customers ?? []) as UnifiedCustomer[], {
    search,
    source,
    status,
    from: from ? new Date(from).toISOString() : null,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
    hasOpenQuote,
    unfinishedDesign,
    followUpsDue,
    sort,
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">My Customers</h2>
          <p className="text-sm text-muted-foreground mt-1">People who browsed your store, saved a design, or requested a quote. Appointments are not included until consultations are stored with an affiliate.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const csv = customersToCsv(customers as UnifiedCustomer[]);
          const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
          const link = document.createElement("a");
          link.href = url;
          link.download = "my-customers.csv";
          link.click();
          URL.revokeObjectURL(url);
        }}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or phone" />
        </div>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={source} onChange={(event) => setSource(event.target.value as CustomerSource | "all")}>
          {SOURCES.map((item) => <option key={item} value={item}>{item === "all" ? "All sources" : item}</option>)}
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as CustomerStatus | "all")}>
          {STATUSES.map((item) => <option key={item} value={item}>{item === "all" ? "All statuses" : item}</option>)}
        </select>
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From" />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To" />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
          <option value="lastActivity">Last activity</option>
          <option value="firstSeen">First seen</option>
          <option value="name">Name</option>
          <option value="totalValue">Total value</option>
          <option value="status">Status</option>
        </select>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1"><input type="checkbox" checked={hasOpenQuote} onChange={(event) => setHasOpenQuote(event.target.checked)} /> Open quote</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={unfinishedDesign} onChange={(event) => setUnfinishedDesign(event.target.checked)} /> Unfinished design</label>
          <label className="flex items-center gap-1"><input type="checkbox" checked={followUpsDue} onChange={(event) => setFollowUpsDue(event.target.checked)} /> Follow-ups due</label>
        </div>
      </div>
      {list.isLoading && previewCustomers == null ? <p className="text-sm text-muted-foreground">Loading customers…</p> : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No customers match these filters.</div>
      ) : (
        <>
          <div className="hidden md:block rounded-xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left">
                <tr>
                  {["Name", "Email", "Phone", "Source", "First seen", "Last activity", "Status", "Deal", "Designs", "Quotes", "Orders", "Value"].map((heading) => (
                    <th key={heading} className="px-3 py-2 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.key} className="border-t cursor-pointer hover:bg-muted/30" onClick={() => setSelectedKey(customer.key)}>
                    <td className="px-3 py-2 font-medium">{customer.name}</td>
                    <td className="px-3 py-2">{customer.email ?? "—"}</td>
                    <td className="px-3 py-2">{customer.phone ?? "—"}</td>
                    <td className="px-3 py-2">{customer.sources.join(", ")}</td>
                    <td className="px-3 py-2">{when(customer.firstSeen)}</td>
                    <td className="px-3 py-2">{when(customer.lastActivity)}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{customer.status}</Badge></td>
                    <td className="px-3 py-2">{customer.dealId ? `#${customer.dealId}` : "—"}</td>
                    <td className="px-3 py-2">{customer.designCount}</td>
                    <td className="px-3 py-2">{customer.quoteCount}</td>
                    <td className="px-3 py-2">{customer.orderCount}</td>
                    <td className="px-3 py-2">{money(customer.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden space-y-2">
            {customers.map((customer) => (
              <button key={customer.key} type="button" onClick={() => setSelectedKey(customer.key)} className="w-full rounded-xl border bg-card p-3 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{customer.name}</span>
                  <Badge variant="outline">{customer.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{customer.email ?? customer.phone ?? "No contact yet"}</p>
                <p className="text-xs mt-1">{customer.designCount} designs · {customer.quoteCount} quotes · {money(customer.totalValue)}</p>
              </button>
            ))}
          </div>
        </>
      )}
      <CustomerDetailSheet
        affiliateId={affiliateId}
        customerKey={selectedKey}
        previewDetail={previewDetail}
        canAssist={canAssist}
        onClose={() => setSelectedKey(null)}
        onChanged={() => { void utils.affiliateCustomers.list.invalidate(); void utils.affiliateCustomers.get.invalidate(); }}
      />
    </div>
  );
}

function CustomerDetailSheet({ affiliateId, customerKey, previewDetail, canAssist, onClose, onChanged }: {
  affiliateId: number | null;
  customerKey: string | null;
  previewDetail?: PreviewDetail | null;
  canAssist: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const detail = trpc.affiliateCustomers.get.useQuery(
    { affiliateId, customerKey: customerKey ?? "" },
    { enabled: customerKey != null && previewDetail == null, retry: false },
  );
  const setStatus = trpc.affiliateCustomers.setStatus.useMutation({ onSuccess: onChanged, onError: (error) => toast.error(error.message) });
  const addNote = trpc.affiliateCustomers.addNote.useMutation({ onSuccess: () => { setNote(""); onChanged(); }, onError: (error) => toast.error(error.message) });
  const setFollowUp = trpc.affiliateCustomers.setFollowUp.useMutation({ onSuccess: onChanged, onError: (error) => toast.error(error.message) });
  const openDeal = trpc.affiliateCustomers.openDeal.useMutation({
    onSuccess: (result) => {
      const url = new URL(window.location.href);
      url.searchParams.set("section", "crm");
      url.searchParams.set("deal", String(result.dealId));
      window.location.assign(url.toString());
    },
    onError: (error) => toast.error(error.message),
  });
  const savePackage = trpc.priceShop.saveDesignAsPackage.useMutation({
    onSuccess: () => toast.success("Kitchen package saved as a copy. Publish it from Kitchen Packages."),
    onError: (error) => toast.error(error.message),
  });
  const [note, setNote] = useState("");
  const [packageDesignId, setPackageDesignId] = useState<number | null>(null);
  const [packageName, setPackageName] = useState("");
  const loaded = previewDetail ?? detail.data;
  const customer = loaded?.customer;
  const slug = loaded?.storeSlug;
  const designs = loaded?.designs ?? [];
  const projects = loaded?.projects ?? [];
  const timeline = loaded?.timeline ?? [];
  const quoteTotal = useMemo(() => customer?.totalValue ?? 0, [customer]);

  return (
    <Sheet open={customerKey != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {(detail.isLoading && previewDetail == null) || !customer ? <p className="text-sm text-muted-foreground">Loading customer…</p> : (
          <div className="space-y-4">
            <SheetHeader>
              <SheetTitle>{customer.name}</SheetTitle>
            </SheetHeader>
            <div className="text-sm space-y-1">
              {customer.email && <a className="flex items-center gap-2 text-primary" href={`mailto:${customer.email}`}><Mail className="h-4 w-4" />{customer.email}</a>}
              {customer.phone && <a className="flex items-center gap-2 text-primary" href={`tel:${customer.phone}`}><Phone className="h-4 w-4" />{customer.phone}</a>}
              <p className="text-xs text-muted-foreground">{customer.sources.join(", ")} · first seen {when(customer.firstSeen)} · {money(quoteTotal)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={customer.status} onChange={(event) => setStatus.mutate({ affiliateId, customerKey: customer.key, status: event.target.value as CustomerStatus })}>
                {STATUSES.filter((item) => item !== "all").map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <Input type="date" aria-label="Follow-up date" onChange={(event) => {
                if (!event.target.value) return;
                setFollowUp.mutate({ affiliateId, customerKey: customer.key, followUpAt: new Date(`${event.target.value}T12:00:00`).toISOString() });
              }} />
              <Button size="sm" variant="outline" onClick={() => openDeal.mutate({ affiliateId, customerKey: customer.key })}>Create or open CRM deal</Button>
            </div>
            <div className="space-y-2">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note" />
              <Button size="sm" disabled={!note.trim() || addNote.isPending} onClick={() => addNote.mutate({ affiliateId, customerKey: customer.key, body: note.trim() })}>Add note</Button>
            </div>
            <section>
              <h3 className="text-sm font-semibold mb-2">Designs, quotes, and projects</h3>
              <div className="space-y-2">
                {designs.map((design) => (
                  <div key={design.id} className="rounded-lg border p-2 flex gap-2">
                    {design.thumbnailUrl ? <img src={design.thumbnailUrl} alt="" className="h-14 w-14 rounded object-cover" /> : <div className="h-14 w-14 rounded bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{design.name}</p>
                      {design.assistLabel && <Badge variant="outline" className="text-[10px]">{design.assistLabel}</Badge>}
                      <div className="flex flex-wrap gap-2 mt-1">
                        {canAssist && <a className="text-xs text-primary underline" href={slug ? `/store/${slug}/design?load=${design.id}&assist=1` : `/design?load=${design.id}&assist=1`}>Open in Designer</a>}
                        {canAssist && <button type="button" className="text-xs text-primary underline" onClick={() => { setPackageDesignId(design.id); setPackageName(design.name); }}>Save as Kitchen Package</button>}
                      </div>
                    </div>
                  </div>
                ))}
                {customer.quotes.map((quote) => (
                  <div key={quote.id} className="rounded-lg border p-2 text-sm">
                    <span className="font-medium">{quote.number ?? `Quote ${quote.id}`}</span>
                    <span className="text-muted-foreground"> · {quote.status}{quote.total != null ? ` · ${money(quote.total)}` : ""}</span>
                  </div>
                ))}
                {projects.map((project) => (
                  <div key={project.id} className="rounded-lg border p-2 text-sm">
                    <span className="font-medium">{project.name}</span>
                    <span className="text-muted-foreground"> · {project.status} · {project.designIds.length} designs · {project.quoteIds.length} quotes</span>
                  </div>
                ))}
              </div>
            </section>
            {packageDesignId != null && (
              <form className="rounded-lg border p-3 space-y-2" onSubmit={(event) => {
                event.preventDefault();
                savePackage.mutate({ designId: packageDesignId, name: packageName || "Kitchen package" });
              }}>
                <p className="text-sm font-medium">Save as Kitchen Package</p>
                <p className="text-xs text-muted-foreground">This copies the design into a package. The customer's design stays where it is.</p>
                <Input value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="Package name" />
                <Button type="submit" size="sm" disabled={savePackage.isPending}>Create package copy</Button>
              </form>
            )}
            <section>
              <h3 className="text-sm font-semibold mb-1">Activity</h3>
              <p className="text-xs text-muted-foreground mb-2">{loaded?.browsingNote ?? BROWSING_HISTORY_NOTE}</p>
              <div className="space-y-2">
                {timeline.map((event, index) => (
                  <div key={`${event.at}-${index}`} className="border-l-2 pl-3 text-xs">
                    <p className="text-muted-foreground">{when(event.at)} · {event.kind}</p>
                    <p>{event.title}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
