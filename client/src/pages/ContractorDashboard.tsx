import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CrmBoard } from "@/components/crm/CrmBoard";
import {
  HardHat,
  ClipboardList,
  Users,
  Layers,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

/**
 * Contractor dashboard.
 *
 * A lightweight, self-serve role. Any signed-in member can classify themselves
 * as a contractor and, in return, gets exactly one thing: their own CRM board
 * showing the customers / room plans they've saved (deals they own). The
 * distributor (platform owner) also sees these deals on the house board.
 *
 * States:
 *  - not signed in       → prompt to sign in
 *  - signed in as "user" → onboarding CTA that calls becomeContractor
 *  - signed in as        → CRM-only board
 *    "contractor"
 *  - other roles (admin, → they already have richer CRM access elsewhere; we
 *    partner, designer)     still show the board (their own-scope view) with a
 *                           hint to use their main dashboard.
 */

const BENEFITS = [
  {
    icon: ClipboardList,
    title: "Track every job",
    desc: "Each plan you save becomes a deal on your board — organized by stage from new to won.",
  },
  {
    icon: Users,
    title: "One customer, many rooms",
    desc: "Group a whole project (kitchen, master bath, laundry) under one customer/house.",
  },
  {
    icon: Layers,
    title: "Shared with your distributor",
    desc: "Your saved plans also reach the Cabinet Dealz team, so pricing and follow-up move fast.",
  },
];

export default function ContractorDashboard() {
  const { user, loading, isAuthenticated, refresh } = useAuth();
  const [, navigate] = useLocation();
  const [justUpgraded, setJustUpgraded] = useState(false);

  const become = trpc.customers.becomeContractor.useMutation({
    onSuccess: async () => {
      setJustUpgraded(true);
      toast.success("You're set up as a contractor.");
      await refresh();
    },
    onError: (e) => toast.error(e.message || "Couldn't complete that. Please try again."),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  // ── Not signed in ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="container py-16 max-w-3xl">
        <ContractorHero />
        <div className="mt-8 rounded-xl border border-border bg-muted/40 p-6 md:p-8 text-center">
          <h2 className="font-serif text-2xl font-bold">Sign in to get started</h2>
          <p className="text-muted-foreground mt-2 mb-6">
            Sign in (or create a free account) and you can turn on your contractor CRM in one click.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href={getLoginUrl()}>
              <Button size="lg" className="bg-[var(--color-navy,#1a2b4a)] text-white">
                Sign in
              </Button>
            </a>
            <Link href="/design">
              <Button size="lg" variant="outline">
                Try the 3D Designer
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const role = user?.role ?? "user";
  const isContractor = role === "contractor";
  // Roles that already carry their own CRM home. We nudge them there instead of
  // self-classifying (becomeContractor would refuse anyway).
  const hasOtherCrmHome = ["admin", "designer", "partner", "sales_rep", "distributor"].includes(role);

  // ── Signed in, plain member → onboarding CTA ────────────────────────────────
  if (!isContractor && !hasOtherCrmHome) {
    return (
      <div className="container py-16 max-w-3xl">
        <ContractorHero />
        <div className="mt-8 rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="grid gap-4 sm:grid-cols-3 mb-6">
            {BENEFITS.map((b) => (
              <div key={b.title} className="rounded-lg border border-border p-4">
                <b.icon className="h-5 w-5 text-[var(--color-navy,#1a2b4a)]" />
                <div className="font-semibold text-sm mt-2">{b.title}</div>
                <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Free — it just switches on your CRM board. No fees, no storefront.
            </p>
            <Button
              size="lg"
              className="bg-[var(--color-navy,#1a2b4a)] text-white"
              disabled={become.isPending}
              onClick={() => become.mutate()}
            >
              {become.isPending ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <HardHat className="h-4 w-4 mr-2" />
              )}
              I'm a contractor — turn on my CRM
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Signed in, another CRM-capable role → point them home ───────────────────
  if (!isContractor && hasOtherCrmHome) {
    return (
      <div className="container py-16 max-w-2xl text-center">
        <HardHat className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h1 className="font-serif text-2xl font-bold mb-2">You already have CRM access</h1>
        <p className="text-muted-foreground mb-6">
          Your account role includes a CRM in its own dashboard. The contractor screen is for
          front-door members who want a simple pipeline of their saved plans.
        </p>
        <div className="flex items-center justify-center gap-3">
          {role === "admin" || role === "designer" || role === "sales_rep" ? (
            <Button onClick={() => navigate("/admin")} className="bg-[var(--color-navy,#1a2b4a)] text-white">
              Go to admin CRM <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : role === "partner" ? (
            <Button onClick={() => navigate("/affiliate")} className="bg-[var(--color-navy,#1a2b4a)] text-white">
              Go to affiliate dashboard <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => navigate("/distributor")} className="bg-[var(--color-navy,#1a2b4a)] text-white">
              Go to distributor portal <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Contractor → CRM-only board ─────────────────────────────────────────────
  return (
    <div className="container py-10 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <HardHat className="h-6 w-6 text-[var(--color-navy,#1a2b4a)]" />
            <h1 className="font-serif text-3xl font-bold">Contractor CRM</h1>
          </div>
          <p className="text-muted-foreground">
            Your customers and saved plans, organized as a sales pipeline.
          </p>
        </div>
        <Link href="/design">
          <Button variant="outline" className="gap-2">
            <ClipboardList className="h-4 w-4" /> New plan in designer
          </Button>
        </Link>
      </div>

      {justUpgraded && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-400/50 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/30">
          <CheckCircle2 className="h-4 w-4" />
          You're now a contractor. Save plans in the designer and they'll appear here.
        </div>
      )}

      <CrmBoard lang="en" />
    </div>
  );
}

function ContractorHero() {
  return (
    <div>
      <span className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-1.5 text-sm font-medium">
        <HardHat className="h-4 w-4 text-[var(--color-navy,#1a2b4a)]" />
        For contractors &amp; remodelers
      </span>
      <h1 className="font-serif text-4xl md:text-5xl font-bold mt-6 leading-tight">
        A simple CRM for the plans you save
      </h1>
      <p className="text-muted-foreground text-lg mt-4 max-w-2xl">
        Design a kitchen, save it under a customer, and it lands on your own pipeline board.
        Group multiple rooms under one house, and follow each job from lead to won.
      </p>
    </div>
  );
}
