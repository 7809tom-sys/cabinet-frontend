import { HardHat, Store, UserRound } from "lucide-react";
import { useReferral, readReferralCode } from "@/hooks/useReferral";
import { portalSignInHref, type PortalChoice } from "@/lib/portalSignIn";

const CHOICES: Array<{ portal: PortalChoice; label: string; detail: string; icon: typeof Store }> = [
  { portal: "affiliate", label: "Affiliate", detail: "Your store and referrals", icon: Store },
  { portal: "contractor", label: "Contractor", detail: "Designs, customers, labor", icon: HardHat },
  { portal: "customer", label: "Customer", detail: "Saved designs and orders", icon: UserRound },
];

export function PortalSignInChooser({ active }: { active?: PortalChoice | null }) {
  useReferral();
  const pathname = typeof window === "undefined" ? "/" : window.location.pathname;
  const search = typeof window === "undefined" ? "" : window.location.search;

  return (
    <div className="mb-6">
      <p className="text-sm font-medium text-center mb-3">Sign in as</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {CHOICES.map((choice) => {
          const href = portalSignInHref({
            portal: choice.portal,
            pathname,
            search,
            storedRef: readReferralCode(),
          });
          const selected = active === choice.portal;
          const Icon = choice.icon;
          return (
            <a
              key={choice.portal}
              href={href}
              aria-current={selected ? "page" : undefined}
              className={`rounded-xl border px-3 py-3 text-left transition-colors ${
                selected
                  ? "border-[var(--color-navy,#1a2b4a)] bg-[var(--color-navy,#1a2b4a)] text-white"
                  : "border-border bg-card hover:border-[var(--color-navy,#1a2b4a)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <div className="mt-2 text-sm font-semibold">{choice.label}</div>
              <div className={`text-xs mt-0.5 ${selected ? "text-white/80" : "text-muted-foreground"}`}>{choice.detail}</div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
