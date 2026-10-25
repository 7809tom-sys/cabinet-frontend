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

export default function Account() {
  const { t } = useLanguage();
  const { user, loading, logout } = useAuth();
  const [, navigate] = useLocation();

  // When not authenticated, send the user to the sign-in page.
  useEffect(() => {
    if (!loading && !user) {
      navigate("/signin");
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="container flex items-center justify-center py-24">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success(t("acc_signed_out"));
      navigate("/");
    } catch {
      toast.error(t("acc_signout_err"));
    }
  };

  const fields: { label: string; value: string | null | undefined }[] = [
    { label: t("acc_name"), value: user.name },
    { label: t("acc_email"), value: user.email },
    { label: t("acc_company"), value: (user as { companyName?: string | null }).companyName },
  ];

  return (
    <div className="container max-w-2xl py-12">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{t("acc_title")}</CardTitle>
              <CardDescription>{t("acc_desc")}</CardDescription>
            </div>
            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
              {user.role === "admin" ? t("acc_role_admin") : t("acc_role_user")}
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
            {user.role === "admin" && (
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
    </div>
  );
}
