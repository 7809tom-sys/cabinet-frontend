import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  storeAccountPath,
  storeAdminPath,
  storeCornerKind,
  storeSignInPath,
} from "@/lib/storeCornerMenu";

/**
 * Store header corner. Signed-out visitors get Sign in and Create account on
 * this store. This store's affiliate, and every admin, get Store admin.
 * A signed-in customer or contractor gets Account.
 */
export function StoreCornerMenu({
  slug,
  storeId,
  className = "",
  stacked = false,
}: {
  slug: string;
  storeId: number | null | undefined;
  className?: string;
  stacked?: boolean;
}) {
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";
  const mine = trpc.affiliates.myReferrals.useQuery(undefined, {
    enabled: !!user && !isAdmin,
    retry: false,
  });

  if (loading) return null;
  if (user && !isAdmin && mine.isLoading) return null;

  const kind = storeCornerKind({
    signedIn: !!user,
    role: user?.role,
    storeId,
    ownedAffiliateId: mine.data?.affiliate?.id ?? null,
  });

  const itemClass = stacked
    ? "text-sm font-medium text-foreground hover:underline"
    : `hover:text-foreground ${className}`;

  if (kind === "signed-out") {
    return (
      <span data-testid="store-corner-menu" className={stacked ? "flex flex-col gap-3" : "inline-flex items-center gap-3"}>
        <a href={storeSignInPath(slug)} className={itemClass} data-testid="store-sign-in">Sign in</a>
        <a href={storeSignInPath(slug, { createAccount: true })} className={itemClass} data-testid="store-create-account">Create account</a>
      </span>
    );
  }

  if (kind === "store-admin") {
    if (storeId == null) return null;
    return (
      <span data-testid="store-corner-menu">
        <a href={storeAdminPath(storeId)} className={itemClass} data-testid="store-admin">Store admin</a>
      </span>
    );
  }

  return (
    <span data-testid="store-corner-menu">
      <a href={storeAccountPath(slug)} className={itemClass} data-testid="store-account">Account</a>
    </span>
  );
}
