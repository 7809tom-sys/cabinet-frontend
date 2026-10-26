import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Users, UserCheck } from "lucide-react";

export function AffiliateTeamPanel({ affiliateId }: { affiliateId?: number }) {
  const utils = trpc.useUtils();
  const teamInput = affiliateId ? { affiliateId } : undefined;
  const { data: team, isLoading } = trpc.affiliates.myTeam.useQuery(teamInput);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "salesperson" as "salesperson" | "designer", accessCrm: true, accessDesigner: true });

  const addMember = trpc.affiliates.addTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Team member added");
      utils.affiliates.myTeam.invalidate(teamInput);
      setOpen(false);
      setForm({ email: "", name: "", role: "salesperson", accessCrm: true, accessDesigner: true });
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = trpc.affiliates.removeTeamMember.useMutation({
    onSuccess: () => {
      toast.success("Team member removed");
      utils.affiliates.myTeam.invalidate(teamInput);
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="py-8 flex justify-center"><Spinner className="h-6 w-6" /></div>;

  const activeMembers = (team ?? []).filter((m) => m.isActive);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">My Team</h2>
          <p className="text-sm text-muted-foreground">
            Add salespeople or designers who can access your CRM and design tool.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> Add Team Member</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Team Member</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Email (required)</Label>
                <Input
                  type="email"
                  placeholder="team@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">They'll use this email to sign in and access your CRM.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Name (optional)</Label>
                <Input
                  placeholder="John Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as "salesperson" | "designer" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="salesperson">Salesperson</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Access to CRM</Label>
                <Switch checked={form.accessCrm} onCheckedChange={(v) => setForm({ ...form, accessCrm: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Access to Design Tool</Label>
                <Switch checked={form.accessDesigner} onCheckedChange={(v) => setForm({ ...form, accessDesigner: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => addMember.mutate({ ...form, ...(affiliateId ? { affiliateId } : {}) })}
                disabled={!form.email.trim() || addMember.isPending}
              >
                {addMember.isPending ? "Adding…" : "Add Member"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {activeMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No team members yet. Add a salesperson or designer to give them access to your CRM and design tool.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium text-sm">{m.name || m.email}</div>
                  {m.name && <div className="text-xs text-muted-foreground">{m.email}</div>}
                  <div className="flex gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs capitalize">{m.role}</Badge>
                    {m.accessCrm && <Badge variant="outline" className="text-xs">CRM</Badge>}
                    {m.accessDesigner && <Badge variant="outline" className="text-xs">Designer</Badge>}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => removeMember.mutate({ id: m.id, ...(affiliateId ? { affiliateId } : {}) })}
                disabled={removeMember.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

