import type { ReactNode } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useCustomerOfferings } from "@/lib/useCustomerOfferings";

/** Customers get a plain unavailable note. Admins still see the page. */
export function CustomerOfferingGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const offerings = useCustomerOfferings();
  if (user?.role === "admin" || offerings.visible) return children;
  return (
    <p className="container py-16 text-sm text-muted-foreground" data-testid="customer-offering-hidden">
      This section is not available.
    </p>
  );
}
