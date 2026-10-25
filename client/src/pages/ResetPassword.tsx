import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

function errMessage(error: { message?: string } | null | undefined, fallback: string) {
  return error?.message || fallback;
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  // The Supabase recovery link signs the user in on arrival; without that
  // session the link was invalid, expired or opened in another browser.
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setHasRecoverySession(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasRecoverySession(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasRecoverySession) {
      toast.error("That password-reset link is invalid or expired. Request a new one from sign in.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      toast.error("Passwords do not match.");
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.updateUser({ password });
    setPending(false);
    if (error) {
      toast.error(errMessage(error, "That reset link is invalid or expired."));
      return;
    }
    toast.success("Password updated.");
    window.location.assign("/signin");
  };

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>Choose a new password for your Cabinet Dealz account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="reset-password">New password</Label>
              <div className="relative">
                <Input
                  id="reset-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-password-confirmation">Confirm new password</Label>
              <Input
                id="reset-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                minLength={8}
                required
              />
            </div>
            {hasRecoverySession === false && (
              <p className="text-sm text-destructive">
                This reset link is invalid or has expired. Request a new one from sign in.
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending || hasRecoverySession === false}>
              {pending ? "Updating password…" : "Set new password"}
            </Button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link href="/signin" className="underline underline-offset-4 hover:text-foreground">Return to sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
