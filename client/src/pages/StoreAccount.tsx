import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { migrateLegacyDesignerDraftToOwner, designerDraftStorageKey, OWNER_STORE_SCOPE } from "@/lib/affiliateContext";

const PROJECT_STATUSES = ["planning", "active", "quoted", "completed", "archived"] as const;

type AccountPreview = {
  draftReady?: boolean;
  profile: { pricingTier: string | null; companyName: string | null };
  affiliate: { storeName: string };
  designs: Array<{ id: number; name: string; thumbnailUrl: string | null; assistLabel: string | null; recordKind: string | null }>;
  orders: Array<{ id: number; requestNumber: string | null; status: string; totalAmount: string | null; kitchenDesignId: number | null }>;
  projects: Array<{ id: number; name: string; status: string; clientName: string | null; jobSiteAddress: string | null; notes?: string | null }>;
  designLinks: Array<{ projectId: number; kitchenDesignId: number }>;
  quoteLinks: Array<{ projectId: number; orderRequestId: number }>;
  revisions: Array<{ kitchenDesignId: number }>;
  notices: Array<{ id: number; title: string; body: string | null; readAt: string | null }>;
};

export default function StoreAccount({ slug, preview = null }: { slug: string; preview?: AccountPreview | null }) {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const overview = trpc.customerAccount.overview.useQuery({ slug }, { enabled: isAuthenticated && preview == null, retry: false });
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "designs" | "quotes" | "projects">("all");
  const [draftReady, setDraftReady] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [jobSite, setJobSite] = useState("");
  const [clientName, setClientName] = useState("");
  const [projectNotes, setProjectNotes] = useState("");
  const [revisionNote, setRevisionNote] = useState("");
  const [revisionOrderId, setRevisionOrderId] = useState<number | null>(null);

  useEffect(() => {
    if (preview) {
      setDraftReady(Boolean(preview.draftReady));
      return;
    }
    if (!isAuthenticated || !user?.email) return;
    migrateLegacyDesignerDraftToOwner(localStorage, user.email);
    const key = designerDraftStorageKey(slug || OWNER_STORE_SCOPE, user.email);
    setDraftReady(Boolean(localStorage.getItem(key)));
  }, [isAuthenticated, preview, slug, user?.email]);

  useEffect(() => {
    if (overview.data?.profile?.companyName != null) setCompanyName(overview.data.profile.companyName);
  }, [overview.data?.profile?.companyName]);

  const setAccountType = trpc.customerAccount.setAccountType.useMutation({
    onSuccess: () => { toast.success("Account updated"); void utils.customerAccount.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const createProject = trpc.customerAccount.createProject.useMutation({
    onSuccess: () => { setProjectName(""); setJobSite(""); setClientName(""); setProjectNotes(""); void utils.customerAccount.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const moveDesign = trpc.customerAccount.moveDesign.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const moveQuote = trpc.customerAccount.moveQuote.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const duplicateDesign = trpc.customerAccount.duplicateDesign.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const renameDesign = trpc.design.rename.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const removeDesign = trpc.design.remove.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const deleteProject = trpc.customerAccount.deleteProject.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate(), onError: (error) => toast.error(error.message) });
  const requestRevision = trpc.customerAccount.requestQuoteRevision.useMutation({
    onSuccess: () => { setRevisionNote(""); setRevisionOrderId(null); toast.success("Revision requested"); void utils.customerAccount.overview.invalidate(); },
    onError: (error) => toast.error(error.message),
  });
  const revertDesign = trpc.customerAccount.revertDesign.useMutation({ onSuccess: () => toast.success("Previous version restored"), onError: (error) => toast.error(error.message) });
  const markRead = trpc.customerAccount.markNoticeRead.useMutation({ onSuccess: () => void utils.customerAccount.overview.invalidate() });

  const data = preview ?? overview.data;
  const needle = search.trim().toLowerCase();
  const designs = useMemo(() => (data?.designs ?? []).filter((design) => !needle || design.name.toLowerCase().includes(needle)), [data?.designs, needle]);
  const orders = useMemo(() => (data?.orders ?? []).filter((order) => !needle || `${order.requestNumber ?? ""} ${order.status}`.toLowerCase().includes(needle)), [data?.orders, needle]);
  const projects = useMemo(() => (data?.projects ?? []).filter((project) => !needle || project.name.toLowerCase().includes(needle)), [data?.projects, needle]);
  const quoteTotal = (orderId: number) => {
    const order = orders.find((item) => item.id === orderId);
    return order?.totalAmount != null ? Number(order.totalAmount) : 0;
  };

  if (!preview && loading) return <div className="container py-16 text-sm text-muted-foreground">Loading your account…</div>;
  if (!preview && !isAuthenticated) {
    return (
      <div className="container max-w-lg py-16 text-center space-y-3">
        <h1 className="text-2xl font-semibold">My Account</h1>
        <p className="text-sm text-muted-foreground">Sign in to keep designs, quotes, and projects with this store. Guest work on this device is saved into your account after you sign in.</p>
        <Button asChild><a href={`/store/${slug}/signin?returnTo=${encodeURIComponent(`/store/${slug}/account`)}`}>Sign in or create an account</a></Button>
      </div>
    );
  }

  const tier = data?.profile?.pricingTier === "contractor" ? "contractor" : "homeowner";

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">My Account</h1>
        <p className="text-sm text-muted-foreground">{data?.affiliate.storeName ?? slug}</p>
      </div>
      {draftReady && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
          A design saved on this device is ready. <a className="underline" href={`/store/${slug}/design`}>Open the designer</a> and choose Save to store it on your account.
        </div>
      )}
      {(data?.notices ?? []).filter((notice) => !notice.readAt).map((notice) => (
        <div key={notice.id} className="rounded-lg border p-3 text-sm flex items-start justify-between gap-3">
          <div>
            <p className="font-medium">{notice.title}</p>
            <p className="text-muted-foreground">{notice.body}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => markRead.mutate({ noticeId: notice.id })}>Dismiss</Button>
        </div>
      ))}
      <section className="rounded-xl border p-4 space-y-3">
        <h2 className="font-semibold">Account type</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant={tier === "homeowner" ? "default" : "outline"} onClick={() => setAccountType.mutate({ accountType: "homeowner", companyName: companyName || null })}>Homeowner</Button>
          <Button variant={tier === "contractor" ? "default" : "outline"} onClick={() => setAccountType.mutate({ accountType: "contractor", companyName: companyName || null })}>Contractor</Button>
        </div>
        <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
        <Button size="sm" variant="outline" onClick={() => setAccountType.mutate({ accountType: tier, companyName: companyName || null })}>Save company</Button>
      </section>
      <div className="flex flex-wrap gap-2">
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search designs, quotes, projects" className="max-w-sm" />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
          <option value="all">All</option>
          <option value="designs">Designs</option>
          <option value="quotes">Quotes</option>
          <option value="projects">Projects</option>
        </select>
      </div>
      {(kind === "all" || kind === "projects") && (
        <section className="space-y-3">
          <h2 className="font-semibold">Saved projects</h2>
          <form className="grid gap-2 sm:grid-cols-2" onSubmit={(event) => {
            event.preventDefault();
            if (!projectName.trim()) return;
            createProject.mutate({ slug, name: projectName.trim(), jobSiteAddress: jobSite || null, clientName: clientName || null, notes: projectNotes || null });
          }}>
            <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="Project name" required />
            <Input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Client name (optional)" />
            <Input value={jobSite} onChange={(event) => setJobSite(event.target.value)} placeholder="Job site address (optional)" className="sm:col-span-2" />
            <Textarea value={projectNotes} onChange={(event) => setProjectNotes(event.target.value)} placeholder="Notes" className="sm:col-span-2" />
            <Button type="submit" className="sm:col-span-2 w-fit">Create project</Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((project) => {
              const designIds = (data?.designLinks ?? []).filter((link) => link.projectId === project.id).map((link) => link.kitchenDesignId);
              const quoteIds = (data?.quoteLinks ?? []).filter((link) => link.projectId === project.id).map((link) => link.orderRequestId);
              const total = quoteIds.reduce((sum, id) => sum + quoteTotal(id), 0);
              return (
                <article key={project.id} className="rounded-xl border p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">{project.name}</h3>
                    <Badge variant="outline">{project.status}</Badge>
                  </div>
                  {project.clientName && <p className="text-xs text-muted-foreground">{project.clientName}</p>}
                  {project.jobSiteAddress && <p className="text-xs text-muted-foreground">{project.jobSiteAddress}</p>}
                  <p className="text-sm">{designIds.length} designs · {quoteIds.length} quotes · {total.toLocaleString(undefined, { style: "currency", currency: "USD" })}</p>
                  <Button size="sm" variant="ghost" onClick={() => deleteProject.mutate({ projectId: project.id })}>Delete project</Button>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {(kind === "all" || kind === "designs") && (
        <section className="space-y-3">
          <h2 className="font-semibold">Saved designs</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {designs.map((design) => (
              <article key={design.id} className="rounded-xl border p-3 space-y-2">
                {design.thumbnailUrl && <img src={design.thumbnailUrl} alt="" className="h-28 w-full object-cover rounded" />}
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{design.name}</h3>
                  {design.assistLabel && <Badge>{design.assistLabel}</Badge>}
                  {design.recordKind === "suggested" && <Badge variant="outline">Suggested by your designer</Badge>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" asChild><a href={`/store/${slug}/design?load=${design.id}`}>Open</a></Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    const name = window.prompt("Rename design", design.name);
                    if (name?.trim()) renameDesign.mutate({ id: design.id, name: name.trim(), affiliateSlug: slug });
                  }}>Rename</Button>
                  <Button size="sm" variant="outline" onClick={() => duplicateDesign.mutate({ designId: design.id, slug })}>Duplicate</Button>
                  <Button size="sm" variant="outline" onClick={() => removeDesign.mutate({ id: design.id, affiliateSlug: slug })}>Delete</Button>
                  {(design.assistLabel || design.recordKind === "suggested") && (data?.revisions ?? []).some((revision) => revision.kitchenDesignId === design.id) && (
                    <Button size="sm" variant="outline" onClick={() => revertDesign.mutate({ designId: design.id })}>Revert</Button>
                  )}
                </div>
                <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" defaultValue="" onChange={(event) => {
                  const value = event.target.value;
                  moveDesign.mutate({ designId: design.id, projectId: value ? Number(value) : null });
                }}>
                  <option value="">Move to project…</option>
                  {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </article>
            ))}
          </div>
        </section>
      )}
      {(kind === "all" || kind === "quotes") && (
        <section className="space-y-3">
          <h2 className="font-semibold">Saved quotes</h2>
          {orders.map((order) => (
            <article key={order.id} className="rounded-xl border p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">{order.requestNumber}</h3>
                <Badge variant="outline">{order.status}</Badge>
              </div>
              <p className="text-sm">{order.totalAmount != null ? Number(order.totalAmount).toLocaleString(undefined, { style: "currency", currency: "USD" }) : "Total pending"}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild><a href={order.kitchenDesignId ? `/store/${slug}/design?load=${order.kitchenDesignId}` : `/store/${slug}/order`}>Reopen</a></Button>
                <Button size="sm" variant="outline" onClick={() => setRevisionOrderId(order.id)}>Request revision</Button>
              </div>
              <select className="h-8 w-full rounded-md border bg-background px-2 text-xs" defaultValue="" onChange={(event) => {
                const value = event.target.value;
                moveQuote.mutate({ orderRequestId: order.id, projectId: value ? Number(value) : null, slug });
              }}>
                <option value="">Move to project…</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              {revisionOrderId === order.id && (
                <form className="space-y-2" onSubmit={(event) => {
                  event.preventDefault();
                  requestRevision.mutate({ orderRequestId: order.id, slug, note: revisionNote });
                }}>
                  <Textarea value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="What should change?" />
                  <Button type="submit" size="sm" disabled={!revisionNote.trim()}>Send request</Button>
                </form>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
