import { useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InstallationEstimatesPanel } from "@/components/affiliate/InstallationEstimatesPanel";
import { ContractorApplicationFields } from "@/components/contractor/ContractorApplicationFields";
import { OrderTrackingPanel, SAMPLE_TRACKED_ORDERS } from "@/components/orders/OrderTrackingPanel";
import { PortalSignInChooser } from "@/components/auth/PortalSignInChooser";
import { CrmBoard } from "@/components/crm/CrmBoard";
import {
  HardHat,
  ClipboardList,
  Users,
  Wrench,
  Package,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

type CustomerRow = { id: number; name: string; email: string | null; phone: string | null; notes: string | null };
type DesignRow = {
  id: number;
  name: string;
  projectName: string | null;
  roomLabel: string | null;
  roomType: string | null;
  thumbnailUrl: string | null;
  updatedAt: string | Date;
  contractorCustomerId: number | null;
};

const SAMPLE_CUSTOMERS: CustomerRow[] = [
  { id: 1, name: "Ada Lovelace", email: "ada@example.com", phone: "555-0100", notes: "Kitchen remodel" },
  { id: 2, name: "Grace Hopper", email: "grace@example.com", phone: null, notes: null },
];

const SAMPLE_DESIGNS: DesignRow[] = [
  { id: 11, name: "Main kitchen", projectName: "Lovelace", roomLabel: "Kitchen", roomType: "Kitchen", thumbnailUrl: null, updatedAt: "2026-10-20T12:00:00.000Z", contractorCustomerId: 1 },
  { id: 12, name: "Primary bath", projectName: "Lovelace", roomLabel: "Bath", roomType: "Bathroom", thumbnailUrl: null, updatedAt: "2026-10-18T12:00:00.000Z", contractorCustomerId: 1 },
  { id: 13, name: "Unassigned laundry", projectName: null, roomLabel: "Laundry", roomType: "Laundry", thumbnailUrl: null, updatedAt: "2026-10-12T12:00:00.000Z", contractorCustomerId: null },
];

function previewRequested(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export default function ContractorDashboard() {
  const preview = previewRequested();
  const { user, loading, isAuthenticated } = useAuth();
  const [justUpgraded, setJustUpgraded] = useState(false);
  const application = trpc.contractorAccess.mine.useQuery(undefined, { enabled: isAuthenticated && !preview, retry: false });
  const submit = trpc.contractorAccess.submit.useMutation({
    onSuccess: async () => {
      toast.success("Application sent. You'll stay a customer until it's approved.");
      await application.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  if (!preview && loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!preview && !isAuthenticated) {
    return (
      <div className="container py-12 max-w-3xl">
        <ContractorIntro />
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-2xl font-bold">Sign in to your contractor portal</h2>
          <p className="text-muted-foreground mt-2 mb-6">Use the same CabinetDealz sign-in. Google and email both work.</p>
          <PortalSignInChooser active="contractor" />
          <Button asChild size="lg" className="w-full sm:w-auto bg-[var(--color-navy,#1a2b4a)] text-white">
            <a href="/contractor/login?portal=contractor&returnTo=%2Fcontractor">Continue to contractor sign-in</a>
          </Button>
        </div>
      </div>
    );
  }

  const role = user?.role ?? "user";
  const isContractor = preview || role === "contractor";
  const hasOtherCrmHome = ["admin", "designer", "partner", "sales_rep", "distributor"].includes(role);

  if (!preview && !isContractor && !hasOtherCrmHome) {
    const pending = application.data?.status === "pending";
    return (
      <div className="container py-12 max-w-3xl">
        <ContractorIntro />
        <div className="mt-8 rounded-xl border border-border bg-card p-6 space-y-4">
          {pending ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Your contractor application is pending approval. You can keep using your customer dashboard until CabinetDealz approves it.
              <div className="mt-3"><Button asChild variant="outline"><Link href="/customer">Go to your customer dashboard</Link></Button></div>
            </div>
          ) : (
            <form className="grid gap-3" onSubmit={(event) => {
              event.preventDefault();
              submit.mutate({ businessName: businessName.trim(), phone: phone.trim(), licenseNumber: licenseNumber.trim() || null });
            }}>
              <p className="text-sm text-muted-foreground">Contractor tools stay closed until an admin approves this request. Your account remains a customer in the meantime.</p>
              <ContractorApplicationFields
                businessName={businessName}
                phone={phone}
                licenseNumber={licenseNumber}
                onBusinessNameChange={setBusinessName}
                onPhoneChange={setPhone}
                onLicenseNumberChange={setLicenseNumber}
              />
              <Button type="submit" className="w-fit bg-[var(--color-navy,#1a2b4a)] text-white" disabled={submit.isPending}>
                {submit.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <HardHat className="h-4 w-4 mr-2" />}
                Apply for contractor access
              </Button>
            </form>
          )}
        </div>
      </div>
    );
  }

  if (!preview && hasOtherCrmHome) {
    return (
      <div className="container py-16 max-w-2xl text-center">
        <HardHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-2xl font-bold mb-2">This login already has a portal</h1>
        <p className="text-muted-foreground mb-6">Affiliate, distributor, and staff accounts keep their own dashboards.</p>
        <Button asChild className="bg-[var(--color-navy,#1a2b4a)] text-white">
          <Link href={role === "partner" ? "/affiliate" : role === "distributor" ? "/distributor" : "/admin"}>
            Go to your dashboard <ArrowRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    );
  }

  return <ContractorHome preview={preview} justUpgraded={justUpgraded} />;
}

function ContractorHome({ preview, justUpgraded }: { preview: boolean; justUpgraded: boolean }) {
  const utils = trpc.useUtils();
  const customersQuery = trpc.contractorPortal.customers.list.useQuery(undefined, { enabled: !preview, retry: false });
  const designsQuery = trpc.contractorPortal.designs.list.useQuery(undefined, { enabled: !preview, retry: false });
  const [tab, setTab] = useState("designs");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const customers = (preview ? SAMPLE_CUSTOMERS : customersQuery.data ?? []) as CustomerRow[];
  const designs = (preview ? SAMPLE_DESIGNS : designsQuery.data ?? []) as DesignRow[];
  const visibleDesigns = useMemo(() => {
    if (customerFilter === "all") return designs;
    if (customerFilter === "none") return designs.filter((design) => design.contractorCustomerId == null);
    const id = Number(customerFilter);
    return designs.filter((design) => design.contractorCustomerId === id);
  }, [customerFilter, designs]);

  const createCustomer = trpc.contractorPortal.customers.create.useMutation({
    onSuccess: () => {
      setName(""); setEmail(""); setPhone(""); setNotes("");
      toast.success("Customer saved");
      void utils.contractorPortal.customers.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const assignDesign = trpc.contractorPortal.designs.assign.useMutation({
    onSuccess: () => void utils.contractorPortal.designs.list.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="container py-8 sm:py-10 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="h-6 w-6 text-[var(--color-navy,#1a2b4a)]" />
            <h1 className="font-serif text-3xl font-bold">Contractor portal</h1>
          </div>
          <p className="text-muted-foreground">Save designs from the 3D Designer, group them by customer, and price labor with the same estimator affiliates use.</p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link href="/design"><ClipboardList className="h-4 w-4" /> Open 3D Designer</Link>
        </Button>
      </div>
      {preview ? <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">Sample layout. Sign in to load your designs, customers, and orders.</p> : null}
      {justUpgraded ? (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          You're a contractor. Plans you save in the designer show up under Designs.
        </div>
      ) : null}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="designs" className="gap-1"><ClipboardList className="h-4 w-4" /> Designs</TabsTrigger>
          <TabsTrigger value="customers" className="gap-1"><Users className="h-4 w-4" /> Customers</TabsTrigger>
          <TabsTrigger value="labor" className="gap-1"><Wrench className="h-4 w-4" /> Labor</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1"><Package className="h-4 w-4" /> Orders</TabsTrigger>
          <TabsTrigger value="crm" className="gap-1"><Users className="h-4 w-4" /> CRM</TabsTrigger>
        </TabsList>
        <TabsContent value="designs" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">Saved designs</h2>
              <p className="text-sm text-muted-foreground">These are the plans on your account from the 3D Designer. Assign each one to a customer.</p>
            </div>
            <Label className="text-sm sm:min-w-56">
              Filter by customer
              <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}>
                <option value="all">All customers</option>
                <option value="none">Unassigned</option>
                {customers.map((customer) => <option key={customer.id} value={String(customer.id)}>{customer.name}</option>)}
              </select>
            </Label>
          </div>
          {!preview && designsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading designs…</p> : null}
          {!preview && designsQuery.error ? <p className="text-sm text-destructive">{designsQuery.error.message}</p> : null}
          {visibleDesigns.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No designs in this filter. Open the 3D Designer and save a plan.</p> : null}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleDesigns.map((design) => (
              <article key={design.id} className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{design.name}</h3>
                    <p className="text-xs text-muted-foreground">{[design.roomLabel, design.roomType, design.projectName].filter(Boolean).join(" · ") || "Saved plan"}</p>
                  </div>
                  <Badge variant="outline">{design.contractorCustomerId == null ? "Unassigned" : "Assigned"}</Badge>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild size="sm" variant="outline"><a href={`/design?load=${design.id}`}>Open</a></Button>
                  <select
                    aria-label={`Assign ${design.name}`}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
                    value={design.contractorCustomerId == null ? "" : String(design.contractorCustomerId)}
                    disabled={preview || assignDesign.isPending}
                    onChange={(event) => {
                      const value = event.target.value;
                      assignDesign.mutate({ designId: design.id, customerId: value ? Number(value) : null });
                    }}
                  >
                    <option value="">No customer</option>
                    {customers.map((customer) => <option key={customer.id} value={String(customer.id)}>{customer.name}</option>)}
                  </select>
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="customers" className="mt-6 space-y-4">
          <h2 className="text-xl font-bold">Customers</h2>
          <form className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            if (preview) return;
            createCustomer.mutate({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null, notes: notes.trim() || null });
          }}>
            <div className="space-y-1"><Label htmlFor="customer-name">Name</Label><Input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
            <div className="space-y-1"><Label htmlFor="customer-email">Email</Label><Input id="customer-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-1"><Label htmlFor="customer-phone">Phone</Label><Input id="customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
            <div className="space-y-1 sm:col-span-2"><Label htmlFor="customer-notes">Notes</Label><Textarea id="customer-notes" value={notes} onChange={(event) => setNotes(event.target.value)} /></div>
            <Button type="submit" className="sm:col-span-2 w-fit" disabled={preview || createCustomer.isPending}>Add customer</Button>
          </form>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {customers.map((customer) => {
              const count = designs.filter((design) => design.contractorCustomerId === customer.id).length;
              return (
                <button key={customer.id} type="button" className="rounded-xl border border-border p-4 text-left hover:border-[var(--color-navy,#1a2b4a)]" onClick={() => { setCustomerFilter(String(customer.id)); setTab("designs"); }}>
                  <div className="font-semibold">{customer.name}</div>
                  <div className="text-sm text-muted-foreground">{customer.email || customer.phone || "No contact yet"}</div>
                  <div className="mt-2 text-xs">{count} design{count === 1 ? "" : "s"}</div>
                </button>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="labor" className="mt-6">
          {preview ? <p className="text-sm text-muted-foreground">The labor estimator loads after you sign in. It is the same Kitchen cost sheet affiliates use.</p> : <InstallationEstimatesPanel audience="contractor" />}
        </TabsContent>
        <TabsContent value="orders" className="mt-6">
          <OrderTrackingPanel previewOrders={preview ? SAMPLE_TRACKED_ORDERS : null} heading="Your orders" />
        </TabsContent>
        <TabsContent value="crm" className="mt-6">
          {preview ? <p className="text-sm text-muted-foreground">The CRM is the same board affiliates use. After approval it shows only this contractor's deals, contacts, notes, and invoice PDF.</p> : <CrmBoard lang="en" />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContractorIntro() {
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-medium">
        <HardHat className="h-4 w-4" /> For contractors
      </span>
      <h1 className="font-serif text-4xl font-bold mt-4">Designs, customers, and labor in one place</h1>
      <p className="text-muted-foreground text-lg mt-3 max-w-2xl">Save a kitchen in the 3D Designer, attach it to a customer, and build the same installation estimate an affiliate would.</p>
    </div>
  );
}
