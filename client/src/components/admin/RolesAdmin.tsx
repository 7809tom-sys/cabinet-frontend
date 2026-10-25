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
} from "@/components/ui/alert-dialog";
import {
  ShieldCheck, Search, Mail, Building2, UserRound, Hammer, Store, Lock, Trash2,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

type ManageableRole = "user" | "designer" | "partner" | "admin";

const ROLE_LABEL: Record<ManageableRole, string> = {
  user: "Member",
  designer: "Designer",
  partner: "Affiliate",
  admin: "Admin",
};

const ROLE_DESCRIPTION: Record<ManageableRole, string> = {
  user: "Standard member with shopping access only.",
  designer: "Internal sales staff — admin backend limited to the Sales CRM & consultations.",
  partner: "Affiliate / partner store owner who earns commissions on referred sales.",
  admin: "Full platform administrator — pricing, orders, customers, and role management.",
};

const ROLE_ICON: Record<ManageableRole, typeof ShieldCheck> = {
  user: UserRound,
  designer: Hammer,
  partner: Store,
  admin: ShieldCheck,
};

const MANAGEABLE_ROLES: ManageableRole[] = ["admin", "designer", "partner", "user"];

function roleVariant(r: string): "default" | "secondary" | "outline" {
  if (r === "admin") return "default";
  if (r === "designer" || r === "partner") return "secondary";
  return "outline";
}

const PAGE_SIZE = 25;

export default function RolesAdmin() {
  const utils = trpc.useUtils();
  const { user: me } = useAuth();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | ManageableRole>("all");
  const [page, setPage] = useState(1);
  const [confirmAdmin, setConfirmAdmin] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const query = trpc.customers.list.useQuery(
    { search: search.trim() || undefined, page, pageSize: PAGE_SIZE },
    { retry: false },
  );

  const setRole = trpc.customers.setRole.useMutation({
    onSuccess: (res) => {
      utils.customers.list.invalidate();
      toast.success(`Role set to ${ROLE_LABEL[res.role as ManageableRole] ?? res.role}`);
    },
    onError: (e) => toast.error("Could not update role", { description: e.message }),
  });

  const deleteUser = trpc.customers.delete.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Account deleted");
      setConfirmDelete(null);
    },
    onError: (e) => {
      toast.error("Could not delete account", { description: e.message });
      setConfirmDelete(null);
    },
  });

  const allRows = query.data?.rows ?? [];
  const rows = roleFilter === "all" ? allRows : allRows.filter((u) => u.role === roleFilter);
  const total = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-serif text-xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[var(--color-navy)]" /> Roles &amp; Permissions
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Assign what each account can do on the platform. Pick a role from the dropdown next to
          any person below. Promoting someone to <strong>Admin</strong> asks for confirmation first.
          Distributor, dealer, and sales-rep accounts are provisioned elsewhere and show as
          read-only here.
        </p>
      </div>

      {/* Role legend */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {MANAGEABLE_ROLES.map((r) => {
          const Icon = ROLE_ICON[r];
          return (
            <div key={r} className="rounded-lg border border-border p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-[var(--color-navy)]" />
                <span className="font-semibold text-sm">{ROLE_LABEL[r]}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{ROLE_DESCRIPTION[r]}</p>
            </div>
          );
        })}
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
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | ManageableRole)}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {MANAGEABLE_ROLES.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>
      ) : query.error ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-destructive">Couldn't load accounts: {query.error.message}</p>
          <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No accounts match your filters.
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {roleFilter === "all"
              ? `${total} account${total === 1 ? "" : "s"}`
              : `${rows.length} ${ROLE_LABEL[roleFilter]} account${rows.length === 1 ? "" : "s"} on this page`}
          </p>
          <div className="space-y-2">
            {rows.map((u) => {
              const isManageable = MANAGEABLE_ROLES.includes(u.role as ManageableRole);
              const isSelf = me?.id === u.id;
              const isAdmin = u.role === "admin";
              // Delete button: never shown for admin accounts or your own account
              const canDelete = !isAdmin && !isSelf;
              return (
                <Card key={u.id}>
                  <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{u.name || "Unnamed user"}</span>
                        <Badge variant={roleVariant(u.role)} className="capitalize">
                          {ROLE_LABEL[u.role as ManageableRole] ?? u.role}
                        </Badge>
                        {isSelf && (
                          <Badge variant="outline" className="gap-1">
                            <ShieldCheck className="h-3 w-3" /> You
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {u.email && (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </span>
                        )}
                        {u.companyName && (
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" /> {u.companyName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {!isManageable ? (
                        <Badge
                          variant="outline"
                          className="h-9 px-3 flex items-center gap-1 capitalize"
                          title="This account type is provisioned elsewhere"
                        >
                          <Lock className="h-3.5 w-3.5" /> {u.role}
                        </Badge>
                      ) : isSelf ? (
                        <Badge
                          variant={roleVariant(u.role)}
                          className="h-9 px-3 flex items-center gap-1"
                          title="You can't change your own role"
                        >
                          <Lock className="h-3.5 w-3.5" /> {ROLE_LABEL[u.role as ManageableRole]}
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
                          <SelectTrigger className="w-40 h-9" title="Assign this user's role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MANAGEABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Delete button — hidden for admin accounts and self */}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Delete this account"
                          disabled={deleteUser.isPending}
                          onClick={() =>
                            setConfirmDelete({
                              id: u.id,
                              name: u.name || u.email || `User #${u.id}`,
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {roleFilter === "all" && totalPages > 1 && (
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
          {roleFilter !== "all" && totalPages > 1 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Filtering by role applies to the current page of {PAGE_SIZE}. Use search to find a
              specific person across all accounts.
            </p>
          )}
        </>
      )}

      {/* Confirm promote to admin */}
      <AlertDialog open={!!confirmAdmin} onOpenChange={(o) => { if (!o) setConfirmAdmin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make {confirmAdmin?.name} an Admin?</AlertDialogTitle>
            <AlertDialogDescription>
              Admins get full access to the entire backend — pricing, orders, customers, and the
              ability to change other users' roles. Only promote people you fully trust.
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

      {/* Confirm delete account */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the account and all associated data (cart, saved designs).
              This action <strong>cannot be undone</strong>.
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
              Delete account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
