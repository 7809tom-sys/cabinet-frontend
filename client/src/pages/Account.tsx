import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { OrderTrackingPanel, SAMPLE_TRACKED_ORDERS } from "@/components/orders/OrderTrackingPanel";

function accountPreview(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

const SAMPLE_DESIGNS = [
  { id: 21, name: "Kitchen concept", updatedAt: "2026-10-22T12:00:00.000Z", roomLabel: "Kitchen" },
  { id: 22, name: "Guest bath", updatedAt: "2026-10-19T12:00:00.000Z", roomLabel: "Bath" },
];

export default function Account() {
  const preview = accountPreview();
  const { t } = useLanguage();
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();
  const designs = trpc.design.myDesigns.useQuery({ affiliateSlug: "owner" }, { enabled: !preview && Boolean(user), retry: false });

  // When not authenticated, send the user to the sign-in page.
  useEffect(() => {
    if (preview) return;
    if (!loading && !user) {
      const portal = window.location.pathname.startsWith("/customer") ? "customer" : null;
      const target = portal
        ? "/signin?portal=customer&returnTo=%2Fcustomer"
        : "/signin?returnTo=%2Faccount";
      navigate(target);
    }
  }, [loading, preview, user, navigate]);

  if (!preview && loading) {
    return (
      <div className="container flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!preview && !user) return null;

  const savedDesigns = preview ? SAMPLE_DESIGNS : (designs.data ?? []);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t("acc_signed_out"));
      navigate("/");
    } catch {
      toast.error(t("acc_signout_err"));
    }
  };

  const profile = user ?? { name: "Ada Lovelace", email: "ada@example.com", role: "user", companyName: null as string | null };
  const fields: { label: string; value: string | null | undefined }[] = [
    { label: t("acc_name"), value: profile.name },
    { label: t("acc_email"), value: profile.email },
    { label: t("acc_company"), value: (profile as { companyName?: string | null }).companyName },
  ];

  return (
    <div className="container max-w-5xl py-8 sm:py-12 space-y-8">
      {preview ? <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">Sample layout. Sign in to see your designs and orders.</p> : null}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{t("acc_title")}</CardTitle>
              <CardDescription>{t("acc_desc")}</CardDescription>
            </div>
            <Badge variant={profile.role === "admin" ? "default" : "secondary"}>
              {profile.role === "admin" ? t("acc_role_admin") : t("acc_role_user")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="divide-y divide-border rounded-lg border">
            {fields.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between px-4 py-3"
              >
                <dt className="text-sm font-medium text-muted-foreground">
                  {f.label}
                </dt>
                <dd className="text-sm font-medium">
                  {f.value || <span className="text-muted-foreground">—</span>}
                </dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap gap-3">
            {profile.role === "admin" && (
              <Link href="/admin">
                <Button variant="default">{t("acc_go_admin")}</Button>
              </Link>
            )}
            <Link href="/design">
              <Button variant="outline" className="bg-background">
                {t("acc_open_design")}
              </Button>
            </Link>
            <Button variant="outline" className="bg-background" onClick={handleLogout}>
              {t("acc_sign_out")}
            </Button>
          </div>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Saved designs</h2>
        <p className="text-sm text-muted-foreground">Plans you saved from the 3D Designer on your account.</p>
        {savedDesigns.length === 0 ? <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No saved designs yet.</p> : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {savedDesigns.map((design) => (
              <article key={design.id} className="rounded-xl border border-border p-4">
                <h3 className="font-semibold">{design.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{"roomLabel" in design && design.roomLabel ? String(design.roomLabel) : "Saved plan"}</p>
                <Button asChild size="sm" variant="outline" className="mt-3"><a href={`/design?load=${design.id}`}>Open in designer</a></Button>
              </article>
            ))}
          </div>
        )}
      </section>
      <OrderTrackingPanel previewOrders={preview ? SAMPLE_TRACKED_ORDERS : null} />
    </div>
  );
}
