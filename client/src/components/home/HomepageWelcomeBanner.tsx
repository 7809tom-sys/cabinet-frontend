import { UserRound } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { homepageWelcomeName, type HomepageWelcomeUser } from "@/lib/homepageWelcome";

export function HomepageWelcomeBanner({ user }: { user: HomepageWelcomeUser | null }) {
  if (!user) return null;

  const displayName = homepageWelcomeName(user);

  return (
    <section
      aria-live="polite"
      aria-label={`Welcome back, ${displayName}`}
      className="border-b border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-amber-50/70 px-4 py-3 text-[var(--color-navy)] dark:border-amber-900/60 dark:from-amber-950/30 dark:via-background dark:to-amber-950/20"
    >
      <div className="container flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-navy)] text-white shadow-sm">
            <UserRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-lg font-bold leading-tight sm:text-xl">
              Welcome back, <span className="text-amber-700 dark:text-amber-300">{displayName}</span>
            </p>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Your saved designs, account tools, and current pricing are ready.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2 pl-[3.25rem] sm:pl-0">
          <Link href="/design">
            <Button size="sm" variant="ghost" className="text-[var(--color-navy)] hover:bg-amber-100/80 dark:text-amber-100 dark:hover:bg-amber-950/60">
              Continue designing
            </Button>
          </Link>
          <Link href="/account">
            <Button size="sm" variant="outline" className="border-amber-300 bg-white/80 text-[var(--color-navy)] hover:bg-amber-50 dark:bg-background/80">
              My account
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
