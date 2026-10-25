import { useEffect, useRef, useState } from "react";
import { TRPCClientError } from "@trpc/client";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { supabase } from "@/lib/supabase";
import { isSafeSiteReturnPath } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { Eye, EyeOff } from "lucide-react";

function errMessage(error: unknown, fallback: string): string {
  if (error instanceof TRPCClientError) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

/** Brand glyphs for the social sign-in buttons (inline SVG, no extra deps). */
function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.6-.21-2.36H12v4.47h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.73z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.29v3.09A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.62H1.29A12 12 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l4-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.62l4 3.09C6.23 6.86 8.88 4.75 12 4.75z" />
    </svg>
  );
}

export default function SignIn() {
  const utils = trpc.useUtils();
  const { t, lang } = useLanguage();
  useSeo({ title: t("seo_signin_t"), description: t("seo_signin_d"), lang });

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showResetRequest, setShowResetRequest] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  // Signup state
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const [pending, setPending] = useState<"login" | "signup" | "reset" | "google" | null>(null);
  const finishing = useRef(false);

  const requestedReturn = () => {
    const value = new URLSearchParams(window.location.search).get("returnTo");
    return isSafeSiteReturnPath(value) ? value : null;
  };

  const afterAuth = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      // The server links or creates the users row on this first authenticated
      // request, then picks a safe destination (affiliate owners go to their
      // Affiliate Administration). A full navigation remounts the header.
      await utils.auth.me.invalidate();
      const me = await utils.auth.me.fetch();
      if (!me) {
        toast.error("Your sign-in could not be confirmed. Please try again.");
        return;
      }
      const { destination } = await utils.auth.signInDestination.fetch({ returnPath: requestedReturn() });
      toast.success("Signed in successfully.");
      window.location.assign(destination);
    } catch (e) {
      toast.error(errMessage(e, "Your sign-in could not be confirmed. Please try again."));
    } finally {
      finishing.current = false;
    }
  };

  // Returning from Google (or an email-confirmation link) lands here with a
  // Supabase session already established from the URL.
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void afterAuth();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Supabase emails and OAuth come back to this same page (and same origin,
  // so affiliate subdomains keep their own session), preserving returnTo.
  const authRedirectUrl = () => {
    const url = new URL("/signin", window.location.origin);
    const returnTo = requestedReturn();
    if (returnTo) url.searchParams.set("returnTo", returnTo);
    return url.toString();
  };

  const handleGoogle = async () => {
    setPending("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl() },
    });
    if (error) {
      setPending(null);
      toast.error(errMessage(error, "Unable to start Google sign-in."));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      toast.error("Enter your email and password.");
      return;
    }
    setPending("login");
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    if (error) {
      setPending(null);
      toast.error(errMessage(error, "Unable to sign in."));
      return;
    }
    await afterAuth();
    setPending(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupPassword) {
      toast.error("Email and password are required.");
      return;
    }
    if (signupPassword.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (signupPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setPending("signup");
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        emailRedirectTo: authRedirectUrl(),
        // Read by the server when it creates the users row.
        data: { name: name.trim() || undefined, companyName: companyName.trim() || undefined },
      },
    });
    if (error) {
      setPending(null);
      toast.error(errMessage(error, "Unable to create account."));
      return;
    }
    if (!data.session) {
      // Email confirmation is on: the account becomes usable from the link.
      setPending(null);
      toast.success("Check your email to confirm your account, then sign in.");
      return;
    }
    await afterAuth();
    setPending(null);
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = resetEmail.trim() || loginEmail.trim();
    if (!email) {
      toast.error("Enter the account email first.");
      return;
    }
    setPending("reset");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("/reset-password", window.location.origin).toString(),
    });
    setPending(null);
    if (error) {
      toast.error(errMessage(error, "Unable to request a password reset."));
      return;
    }
    toast.success("If that email is registered, a reset link is on its way.");
  };

  return (
    <div className="container max-w-md py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Cabinet Dealz</CardTitle>
          <CardDescription>
            Sign in to manage orders, pricing, and designs.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Create Account</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showLoginPw ? "text" : "password"}
                      autoComplete="current-password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showLoginPw ? "Hide password" : "Show password"}
                    >
                      {showLoginPw ? <><EyeOff className="h-4 w-4" />Hide</> : <><Eye className="h-4 w-4" />Show</>}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending !== null}
                >
                  {pending === "login" ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
              <div className="mt-3 text-center">
                <button
                  type="button"
                  className="text-sm font-medium text-primary underline underline-offset-4 hover:text-primary/80"
                  onClick={() => {
                    setResetEmail(loginEmail);
                    setShowResetRequest((value) => !value);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              {showResetRequest && (
                <form onSubmit={handleResetRequest} className="mt-4 space-y-3 rounded-md border bg-muted/30 p-3 text-left">
                  <div>
                    <Label htmlFor="password-reset-email">Account email</Label>
                    <Input
                      id="password-reset-email"
                      type="email"
                      autoComplete="email"
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="mt-1"
                      required
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full" disabled={pending !== null}>
                    {pending === "reset" ? "Sending reset link…" : "Email password-reset link"}
                  </Button>
                </form>
              )}
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-company">
                    Company <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="signup-company"
                    type="text"
                    autoComplete="organization"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Company name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="signup-password"
                      type={showSignupPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showSignupPw ? "Hide password" : "Show password"}
                    >
                      {showSignupPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm password</Label>
                  <div className="relative">
                    <Input
                      id="signup-confirm"
                      type={showConfirmPw ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPw ? "Hide password" : "Show password"}
                    >
                      {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={pending !== null}
                >
                  {pending === "signup" ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    "Create Account"
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full bg-background gap-2 font-medium"
            onClick={handleGoogle}
            disabled={pending !== null}
          >
            {pending === "google" ? <Spinner className="h-4 w-4" /> : <GoogleGlyph />}
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
