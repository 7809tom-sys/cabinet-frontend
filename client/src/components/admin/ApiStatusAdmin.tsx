import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  CheckCircle2, XCircle, AlertCircle, Mail, Truck, CreditCard,
  RefreshCw, ExternalLink,
} from "lucide-react";

type StatusLevel = "active" | "configured" | "partial" | "inactive";

function StatusBadge({ level }: { level: StatusLevel }) {
  const map: Record<StatusLevel, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    configured: { label: "Configured", className: "bg-blue-100 text-blue-800 border-blue-200" },
    partial: { label: "Partial", className: "bg-amber-100 text-amber-800 border-amber-200" },
    inactive: { label: "Not configured", className: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const { label, className } = map[level];
  return <Badge className={className}>{label}</Badge>;
}

function StatusIcon({ level }: { level: StatusLevel }) {
  if (level === "active") return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  if (level === "configured") return <CheckCircle2 className="h-5 w-5 text-blue-500" />;
  if (level === "partial") return <AlertCircle className="h-5 w-5 text-amber-500" />;
  return <XCircle className="h-5 w-5 text-slate-400" />;
}

export default function ApiStatusAdmin() {
  const { data, isLoading, refetch, isFetching } = trpc.emailSettings.getApiStatus.useQuery(
    undefined,
    { refetchInterval: 30_000 }
  );

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  const smtp = data?.smtp;
  const shipping = data?.shipping;
  const payment = data?.payment;

  function smtpLevel(): StatusLevel {
    if (!smtp?.configured) return "inactive";
    if (smtp.enabled) return "active";
    return "configured";
  }

  function shippingLevel(): StatusLevel {
    if (shipping?.mode === "estimator") return "configured"; // built-in estimator always works
    if (!shipping?.configured) return "partial"; // live mode but no key
    if (shipping.enabled) return "active";
    return "configured";
  }

  function paymentLevel(): StatusLevel {
    if (!payment?.configured) return "inactive";
    if (payment.enabled) return "active";
    return "configured";
  }

  const integrations = [
    {
      id: "smtp",
      icon: Mail,
      label: "Email (SMTP)",
      description: "Transactional emails, CRM messages, and notification alerts.",
      level: smtpLevel(),
      details: smtp?.configured
        ? `${smtp.host} · ${smtp.user}`
        : "No credentials saved",
      extraDetail: smtp?.enabled ? "Sending enabled" : "Sending disabled",
      tab: "email-settings",
    },
    {
      id: "shipping",
      icon: Truck,
      label: "Shipping / Freight",
      description: "LTL freight quotes for order checkout.",
      level: shippingLevel(),
      details:
        shipping?.mode === "estimator"
          ? "Built-in zone estimator (no API key needed)"
          : shipping?.configured
          ? `${shipping.provider} · Live quotes`
          : `${shipping?.provider ?? "easypost"} · API key missing`,
      extraDetail: shipping?.enabled ? "Shipping enabled" : "Shipping disabled",
      tab: "shipping",
    },
    {
      id: "payment",
      icon: CreditCard,
      label: "Payments (Authorize.Net)",
      description: "Credit card processing for orders.",
      level: paymentLevel(),
      details: payment?.configured
        ? `Authorize.Net · ${payment.environment === "production" ? "Live" : "Sandbox"}`
        : "No credentials saved",
      extraDetail: payment?.enabled ? "Payments enabled" : "Payments disabled",
      tab: "payments",
    },
  ];

  const activeCount = integrations.filter((i) => i.level === "active").length;
  const totalCount = integrations.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Integration Status</CardTitle>
              <CardDescription className="mt-1">
                {activeCount} of {totalCount} integrations active · Auto-refreshes every 30 seconds
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Integration cards */}
      <div className="grid gap-4">
        {integrations.map(({ id, icon: Icon, label, description, level, details, extraDetail, tab }) => (
          <Card key={id} className={level === "inactive" ? "opacity-75" : ""}>
            <CardContent className="pt-4">
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-lg ${
                    level === "active"
                      ? "bg-emerald-50"
                      : level === "configured"
                      ? "bg-blue-50"
                      : level === "partial"
                      ? "bg-amber-50"
                      : "bg-slate-100"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${
                      level === "active"
                        ? "text-emerald-600"
                        : level === "configured"
                        ? "text-blue-600"
                        : level === "partial"
                        ? "text-amber-600"
                        : "text-slate-400"
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{label}</span>
                    <StatusBadge level={level} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  <div className="mt-2 flex items-center gap-3 text-xs">
                    <StatusIcon level={level} />
                    <span className="text-muted-foreground">{details}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className={level === "active" ? "text-emerald-600" : "text-muted-foreground"}>
                      {extraDetail}
                    </span>
                  </div>
                </div>
                <Link href={`/admin?tab=${tab}`}>
                  <Button variant="outline" size="sm" className="shrink-0">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Configure
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Legend */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <p className="text-sm font-medium mb-3">Status Guide</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(["active", "configured", "partial", "inactive"] as StatusLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-2">
                <StatusIcon level={level} />
                <div>
                  <p className="text-xs font-medium capitalize">{level}</p>
                  <p className="text-xs text-muted-foreground">
                    {level === "active" && "Credentials saved & enabled"}
                    {level === "configured" && "Credentials saved, disabled"}
                    {level === "partial" && "Partially configured"}
                    {level === "inactive" && "No credentials saved"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
