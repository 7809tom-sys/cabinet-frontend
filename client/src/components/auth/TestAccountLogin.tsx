import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TOKEN_KEY = "cd.testAccountToken";

export function TestAccountLogin({ suggested }: { suggested?: "customer" | "contractor" }) {
  const enabled = trpc.auth.testAccountsEnabled.useQuery(undefined, { retry: false });
  const login = trpc.auth.testLogin.useMutation();
  const [username, setUsername] = useState(suggested ?? "customer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!enabled.data?.enabled) return null;

  return (
    <form
      className="mb-6 rounded-xl border border-dashed border-border p-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        login.mutate({ username, password }, {
          onSuccess: (result) => {
            window.sessionStorage.setItem(TOKEN_KEY, result.token);
            window.location.assign(result.destination);
          },
          onError: (err) => setError(err.message),
        });
      }}
    >
      <div>
        <p className="text-sm font-semibold">Test login</p>
        <p className="text-xs text-muted-foreground">Shown only while the API has test accounts turned on.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="test-username">Username</Label>
          <Input id="test-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="test-password">Password</Label>
          <Input id="test-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
        </div>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" variant="outline" disabled={login.isPending}>Sign in with test account</Button>
    </form>
  );
}
