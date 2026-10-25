import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Check, ChevronsUpDown, Search, Store } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

/**
 * Admin-only store switcher for the affiliate dashboard.
 *
 * Admins previously had to hand-edit ?viewAs=<id> in the URL to change which
 * store they were editing, and with no visible indicator it was easy to edit the
 * wrong store. This makes the current store explicit and switching one click.
 *
 * Note: this is intentionally a DropdownMenu with a plain text filter rather
 * than a Select. Radix Select throws on empty-string item values and needs one
 * value per item, which previously white-screened this page; a menu of buttons
 * avoids that class of bug entirely.
 */
export function AffiliateStoreSwitcher({
  currentId,
  currentName,
  isAdmin,
}: {
  currentId: number;
  currentName: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  // Only admins can list or switch stores; partners never fetch this.
  const list = trpc.affiliates.adminSwitcherList.useQuery(undefined, {
    enabled: isAdmin,
    retry: false,
    staleTime: 60_000,
  });

  const options = useMemo(() => {
    const rows = list.data ?? [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.storeName.toLowerCase().includes(q) || (r.slug ?? "").toLowerCase().includes(q)
    );
  }, [list.data, filter]);

  if (!isAdmin) return null;

  function switchTo(id: number) {
    // Preserve the section the admin is currently on so switching stores keeps
    // them in the same panel (e.g. stay on Customize Store).
    const params = new URLSearchParams(window.location.search);
    params.set("viewAs", String(id));
    window.location.search = params.toString();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 min-w-0 max-w-full rounded-md px-2 py-1 hover:bg-accent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title="Switch store"
        >
          <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-semibold tracking-tight truncate text-sm">{currentName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search stores…"
              className="h-8 pl-7 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {list.isLoading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading stores…</div>
          )}
          {!list.isLoading && options.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No stores match that search.</div>
          )}
          {options.map((o) => {
            const active = o.id === currentId;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => switchTo(o.id)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors ${
                  active ? "bg-accent/60" : ""
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${active ? "opacity-100 text-primary" : "opacity-0"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.storeName}</span>
                  <span className="block truncate text-xs text-muted-foreground">/{o.slug}</span>
                </span>
                {o.status !== "active" && (
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                    {o.status}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          Admin only — you are editing this store's settings.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
