import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AffiliateSetup() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const token = useMemo(() => new URLSearchParams(search).get("token")?.trim() ?? "", [search]);
  const details = trpc.affiliates.getSetupDetails.useQuery({ token }, { enabled: token.length === 96, retry: false });
  const complete = trpc.affiliates.completeSetup.useMutation({
    onSuccess: (data) => {
      toast.success("Password created. You can now sign in.");
      navigate(`/signin?email=${encodeURIComponent(data.email ?? "")}`);
    },
    onError: (error) => toast.error(error.message),
  });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("Use at least 8 characters.");
    if (password !== confirmation) return toast.error("The passwords do not match.");
    complete.mutate({ token, password });
  };

  if (!token || (!details.isLoading && !details.data)) {
    return (
      <main className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>Invitation unavailable</CardTitle><CardDescription>This password setup link is invalid, expired, or already used. Ask the administrator to send a new invitation.</CardDescription></CardHeader>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Set up your Cabinet Dealz login</CardTitle>
          <CardDescription>{details.data?.storeName ?? "Your affiliate store"} · {details.data?.email ?? ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="affiliate-setup-password">Password</Label><Input id="affiliate-setup-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></div>
            <div className="space-y-2"><Label htmlFor="affiliate-setup-confirmation">Confirm password</Label><Input id="affiliate-setup-confirmation" type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={8} required /></div>
            <Button type="submit" className="w-full" disabled={complete.isPending || details.isLoading}>{complete.isPending ? "Saving…" : "Create password"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
