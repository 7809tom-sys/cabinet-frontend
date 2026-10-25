import { useMemo, useState } from "react";
import { Mail, Phone, User, Search, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// Admin view of contacts captured by the designer launch gate. These are people
// who started a design — they may or may not have saved a design or requested a
// quote, so this is the top-of-funnel follow-up list for reps.
export default function DesignLeadsAdmin() {
  const { data: leads, isLoading } = trpc.design.listLeads.useQuery();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const rows = leads ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (l) =>
        l.email.toLowerCase().includes(s) ||
        (l.name ?? "").toLowerCase().includes(s) ||
        (l.phone ?? "").toLowerCase().includes(s),
    );
  }, [leads, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Design Leads
          </h2>
          <p className="text-sm text-muted-foreground">
            Contacts captured when visitors launch the kitchen designer. Email is
            required; name and phone are collected when provided.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{(leads ?? []).length} total</Badge>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, phone"
              className="pl-8 w-64"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-lg">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>{q ? "No leads match your search." : "No design leads captured yet."}</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><User className="inline h-3.5 w-3.5 mr-1" />Name</TableHead>
                <TableHead><Mail className="inline h-3.5 w-3.5 mr-1" />Email</TableHead>
                <TableHead><Phone className="inline h-3.5 w-3.5 mr-1" />Phone</TableHead>
                <TableHead>Room</TableHead>
                <TableHead className="text-center">Launches</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead>Account</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <a className="text-primary hover:underline" href={`mailto:${l.email}`}>{l.email}</a>
                  </TableCell>
                  <TableCell>
                    {l.phone ? (
                      <a className="hover:underline" href={`tel:${l.phone}`}>{l.phone}</a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{l.roomType || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-center">{l.launchCount}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(l.lastLaunchAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {l.userId ? (
                      <Badge variant="outline">Member</Badge>
                    ) : (
                      <Badge variant="secondary">Guest</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
