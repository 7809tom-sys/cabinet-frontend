import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Users, Search, Building2, Mail, Clock, ShieldCheck, Trash2 } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type Tier = "homeowner" | "contractor" | "wholesale";

const TIER_LABEL: Record<Tier, string> = {
  homeowner: "Homeowner",
  contractor: "Contractor",
  wholesale: "Wholesale",
};

type ManageableRole = "user" | "designer" | "partner" | "admin";

const ROLE_LABEL: Record<ManageableRole, string> = {
  user: "Member",
  designer: "Designer",
  partner: "Affiliate",
  admin: "Admin",
};

// Roles the owner can assign from this panel. Specialized accounts
// (distributor / dealer / sales_rep) are provisioned elsewhere and are
// shown read-only here.
const MANAGEABLE_ROLES: ManageableRole[] = ["user", "designer", "partner", "admin"];

function roleVariant(r: string): "default" | "secondary" | "outline" {
  if (r === "admin") return "default";
  if (r === "designer" || r === "partner") return "secondary";
  return "outline";
}

function tierVariant(t: string): "default" | "secondary" | "outline" {
  if (t === "wholesale") return "default";
  if (t === "contractor") return "secondary";
  return "outline";
}

const PAGE_SIZE = 25;

export default function CustomersAdmin() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");
  const [page, setPage] = useState(1);

  const query = trpc.customers.list.useQuery(
    {
      search: search.trim() || undefined,
      tier: tierFilter === "all" ? undefined : tierFilter,
      page,
      pageSize: PAGE_SIZE,
    },
    { retry: false },
  );

  const setTier = trpc.customers.setTier.useMutation({
    onSuccess: (res) => {
      utils.customers.list.invalidate();
      toast.success(`Tier set to ${TIER_LABEL[res.tier as Tier]}`);
    },
    onError: (e) => toast.error("Could not update tier", { description: e.message }),
  });

  const { user: me } = useAuth();
  const [confirmAdmin, setConfirmAdmin] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const deleteUser = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Member deleted");
      setConfirmDelete(null);
    },
    onError: (e) => toast.error("Could not delete member", { description: e.message }),
  });

  const setRole = trpc.customers.setRole.useMutation({
    onSuccess: (res) => {
      utils.customers.list.invalidate();
      toast.success(`Role set to ${ROLE_LABEL[res.role as ManageableRole] ?? res.role}`);
    },
    onError: (e) => toast.error("Could not update role", { description: e.message }),
  });

  const purgeMembers = trpc.customers.purgeTestMembers.useMutation({
    onSuccess: (res) => {
      utils.customers.list.invalidate();
      toast.success(`Purged ${res.deleted} test member${res.deleted === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error("Purge failed", { description: e.message }),
  });

  const counts = query.data?.counts ?? {};
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Tier summary chips */}
      <div className="flex flex-wrap gap-2">
        {(["homeowner", "contractor", "wholesale"] as Tier[]).map((t) => (
          <Badge key={t} variant={tierVariant(t)} className="px-3 py-1">
            {TIER_LABEL[t]}: {counts[t] ?? 0}
          </Badge>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, email, or company…"
            className="pl-9"
          />
        </div>
        <Select
          value={tierFilter}
          onValueChange={(v) => { setTierFilter(v as "all" | Tier); setPage(1); }}
        >
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tiers</SelectItem>
            <SelectItem value="homeowner">Homeowner</SelectItem>
            <SelectItem value="contractor">Contractor</SelectItem>
            <SelectItem value="wholesale">Wholesale</SelectItem>
          </SelectContent>
        </Select>
        {total > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive shrink-0">
                <Trash2 className="h-3.5 w-3.5" />
                Purge non-admins
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Purge all non-admin members?</AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently deletes all {total} member account{total === 1 ? "" : "s"} that are not admins,
                  along with their carts, saved designs, and order history. Admin accounts are kept.
                  Use this to clear out test sign-ups. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => purgeMembers.mutate()}
                >
                  Delete {total} member{total === 1 ? "" : "s"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>
      ) : query.error ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-destructive">Couldn't load customers: {query.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : (query.data?.rows.length ?? 0) === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No customers match your filters.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{total} customer{total === 1 ? "" : "s"}</p>
          <div className="space-y-2">
            {query.data!.rows.map((u) => (
              <Card key={u.id}>
                <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{u.name || "Unnamed user"}</span>
                      <Badge variant={tierVariant(u.pricingTier)} className="capitalize">
                        {TIER_LABEL[u.pricingTier as Tier] ?? u.pricingTier}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {u.email && (
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{u.email}</span>
                        </span>
                      )}
                      {u.companyName && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {u.companyName}
                        </span>
                      )}
                      {u.lastSignedIn && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Last seen {new Date(u.lastSignedIn).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {MANAGEABLE_ROLES.includes(u.role as ManageableRole) ? (
                      me?.id === u.id ? (
                        <Badge variant={roleVariant(u.role)} className="h-9 px-3 flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> You ({ROLE_LABEL[u.role as ManageableRole]})
                        </Badge>
                      ) : (
                        <Select
                          value={u.role}
                          onValueChange={(v) => {
                            const next = v as ManageableRole;
                            if (next === u.role) return;
                            if (next === "admin") {
                              setConfirmAdmin({ id: u.id, name: u.name || u.email || `User #${u.id}` });
                            } else {
                              setRole.mutate({ userId: u.id, role: next });
                            }
                          }}
                          disabled={setRole.isPending}
                        >
                          <SelectTrigger className="w-36 h-9" title="Assign this user's role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MANAGEABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    ) : (
                      <Badge variant="outline" className="h-9 px-3 flex items-center capitalize" title="This account type is managed elsewhere">
                        {u.role}
                      </Badge>
                    )}
                    <Select
                      value={u.pricingTier}
                      onValueChange={(v) => setTier.mutate({ userId: u.id, tier: v as Tier })}
                      disabled={setTier.isPending}
                    >
                      <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="homeowner">Homeowner</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="wholesale">Wholesale</SelectItem>
                      </SelectContent>
                    </Select>
                    {me?.id !== u.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete member"
                        onClick={() => setConfirmDelete({ id: u.id, name: u.name || u.email || `User #${u.id}` })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        Tip: when the live-chat ping tells you a customer is on the site, find them here and set their
        tier. Their assigned tier controls the prices they see and check out at. Homeowner is the default
        until you change it. Use the role dropdown to grant <strong>Designer</strong> (CRM-only staff),
        <strong> Affiliate</strong> (partner store owner), or <strong>Admin</strong> (full access).
        Distributor/dealer/sales-rep accounts are managed elsewhere and shown read-only.
      </p>

      {/* Delete member confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this member account and all their cart data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) deleteUser.mutate({ userId: confirmDelete.id });
              }}
            >
              Delete Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmAdmin} onOpenChange={(o) => { if (!o) setConfirmAdmin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {confirmAdmin?.name} an Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Admins get full access to the entire backend — pricing, orders, customers, and the ability
              to change other users' roles. Only promote people you fully trust.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAdmin) setRole.mutate({ userId: confirmAdmin.id, role: "admin" });
                setConfirmAdmin(null);
              }}
            >
              Yes, make Admin
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
