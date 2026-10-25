import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Users, ShieldCheck, Store, Lock } from "lucide-react";

type PricingVisibility = "public" | "logged_in" | "dealer" | "admin" | "hidden";

const OPTIONS: {
  value: PricingVisibility;
  label: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
}[] = [
  {
    value: "public",
    label: "Everyone (Public)",
    description: "All visitors — including guests who are not logged in — can see pricing.",
    icon: <Eye className="h-5 w-5 text-green-500" />,
    badge: "Open",
    badgeVariant: "default",
  },
  {
    value: "logged_in",
    label: "Logged-In Users Only",
    description: "Any user who has created an account and signed in can see pricing. Guests see a 'Sign in to view pricing' prompt.",
    icon: <Users className="h-5 w-5 text-blue-500" />,
    badge: "Members",
    badgeVariant: "secondary",
  },
  {
    value: "dealer",
    label: "Dealers & Trade Only",
    description: "Only users assigned a trade pricing tier (Dealer, Contractor, or Wholesale) can see pricing. Regular homeowner accounts and guests see a 'Request trade access' prompt.",
    icon: <Store className="h-5 w-5 text-amber-500" />,
    badge: "Trade",
    badgeVariant: "outline",
  },
  {
    value: "admin",
    label: "Admin Only",
    description: "Only you (the admin/owner) can see pricing. All other users — including logged-in dealers — see a contact prompt.",
    icon: <ShieldCheck className="h-5 w-5 text-purple-500" />,
    badge: "Admin",
    badgeVariant: "outline",
  },
  {
    value: "hidden",
    label: "Hidden (RFQ Mode)",
    description: "Pricing is completely hidden from everyone. All product pages show a 'Request a Quote' button instead of prices.",
    icon: <EyeOff className="h-5 w-5 text-red-500" />,
    badge: "Hidden",
    badgeVariant: "destructive",
  },
];

export function PricingAccessAdmin() {
  const { data: settings, isLoading, refetch } = trpc.siteSettings.getPublicSettings.useQuery();
  const updateMutation = trpc.siteSettings.updateSettings.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("Pricing visibility updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const [selected, setSelected] = useState<PricingVisibility | null>(null);
  const current = (selected ?? settings?.pricingVisibility ?? "public") as PricingVisibility;

  const handleSave = () => {
    if (!selected) return;
    updateMutation.mutate({ pricingVisibility: selected });
    setSelected(null);
  };

  const isDirty = selected !== null && selected !== settings?.pricingVisibility;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Pricing Visibility</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Control who can see product pricing on the storefront. This applies to all cabinet product
          pages, the catalog, and the Kitchen Designer.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map((opt) => {
          const isActive = current === opt.value;
          const isSaved = settings?.pricingVisibility === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSelected(opt.value)}
              className={`w-full text-left rounded-lg border-2 p-4 transition-all duration-150 ${
                isActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">{opt.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{opt.label}</span>
                    <Badge variant={opt.badgeVariant} className="text-xs">
                      {opt.badge}
                    </Badge>
                    {isSaved && (
                      <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <div className="shrink-0 mt-1">
                  <div
                    className={`w-4 h-4 rounded-full border-2 transition-all ${
                      isActive
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40"
                    }`}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {isDirty && (
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="min-w-[120px]"
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSelected(null)}
            disabled={updateMutation.isPending}
          >
            Cancel
          </Button>
          <span className="text-xs text-muted-foreground">
            Changing from{" "}
            <strong>{OPTIONS.find((o) => o.value === settings?.pricingVisibility)?.label}</strong>{" "}
            to <strong>{OPTIONS.find((o) => o.value === selected)?.label}</strong>
          </span>
        </div>
      )}

      <Card className="bg-muted/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Lock className="h-4 w-4" /> Admin always sees pricing
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CardDescription className="text-xs">
            Regardless of this setting, you (the admin) will always see all pricing tiers including
            wholesale cost and margin data when logged in.
          </CardDescription>
        </CardContent>
      </Card>
    </div>
  );
}
