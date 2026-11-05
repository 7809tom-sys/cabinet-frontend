import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import AdminOrderDetailPage from "@/components/admin/AdminOrderDetailPage";
import type { AdminOrderRow } from "@/lib/adminOrderRow";

/** Back target: the Incoming Orders tab the order was opened from. */
function backToOrders() {
  const tab = new URLSearchParams(window.location.search).get("tab") || "orders";
  return `/admin?tab=${encodeURIComponent(tab)}`;
}

export default function AdminOrderPage({ orderId }: { orderId: number }) {
  const [, navigate] = useLocation();
  const { user, loading } = useAuth();
  const isAdmin = user?.role === "admin";

  // The list endpoint is the same one the dialog read, so the page shows exactly
  // the same values with no new backend procedure.
  const { data: orders, isLoading, error, refetch } = trpc.orders.adminListWithPoSkus.useQuery(
    undefined,
    { enabled: isAdmin && Number.isFinite(orderId), refetchOnWindowFocus: true },
  );

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      navigate("/admin?tab=orders");
    }
  }, [loading, user, isAdmin, navigate]);

  const goBack = () => navigate(backToOrders());

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="mb-3 font-serif text-2xl font-bold">Admin Sign In Required</h1>
        <p className="mb-6 text-muted-foreground">Please sign in with an admin account.</p>
        <a href={getLoginUrl()}>
          <Button className="bg-[var(--color-navy)] text-white">Sign In</Button>
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="mb-3 font-serif text-2xl font-bold">Access Restricted</h1>
        <p className="text-muted-foreground">This area is for platform administrators only.</p>
        <Button variant="outline" className="mt-4" onClick={goBack}>Back to Incoming Orders</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>Failed to load this order.</p>
        <div className="mt-3 flex justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
          <Button variant="outline" size="sm" onClick={goBack}>Back to Incoming Orders</Button>
        </div>
      </div>
    );
  }

  const order = ((orders ?? []) as AdminOrderRow[]).find((row) => row.id === orderId);

  if (!order) {
    return (
      <div className="py-20 text-center text-muted-foreground" data-testid="admin-order-not-found">
        <p>Order #{Number.isFinite(orderId) ? orderId : "—"} was not found.</p>
        <p className="mt-1 text-sm">
          It may have been deleted, or the list filter may not include it.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={goBack}>Back to Incoming Orders</Button>
      </div>
    );
  }

  return <AdminOrderDetailPage order={order} onBack={goBack} />;
}
