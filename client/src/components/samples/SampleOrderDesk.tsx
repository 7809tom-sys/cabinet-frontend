import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SampleAvailableBadge } from "@/components/samples/SampleAvailableBadge";
import { toast } from "sonner";

type CartLine = { key: string; offerId?: number; kitId?: number; label: string; price: number; qty: number };

const emptyShip = {
  customerName: "",
  customerEmail: "",
  projectLabel: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
  affiliateId: "",
};

export function SampleOrderDesk({ mode }: { mode: "admin" | "affiliate" }) {
  const utils = trpc.useUtils();
  const catalog = trpc.vendorSamples.catalogForOrdering.useQuery();
  const mine = trpc.vendorSamples.myOrders.useQuery(undefined, { enabled: mode === "affiliate" });
  const admin = trpc.vendorSamples.adminOrders.useQuery(undefined, { enabled: mode === "admin" });
  const place = trpc.vendorSamples.placeOrder.useMutation({
    onSuccess: () => {
      toast.success("Sample order submitted");
      setCart([]);
      void utils.vendorSamples.myOrders.invalidate();
      void utils.vendorSamples.adminOrders.invalidate();
      void utils.orders.adminListWithPoSkus.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ship, setShip] = useState(emptyShip);

  function add(line: CartLine) {
    setCart((current) => {
      const existing = current.find((item) => item.key === line.key);
      if (!existing) return [...current, line];
      return current.map((item) => item.key === line.key ? { ...item, qty: item.qty + 1 } : item);
    });
  }

  const orders = mode === "admin" ? admin.data ?? [] : mine.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{mode === "admin" ? "Sample orders" : "Order samples"}</h2>
        <p className="text-sm text-muted-foreground">
          Samples and kits are ordered here, in the back office. They are not on the public catalog or the customer cart. The price is the amount entered for the kit or sample, including free.
        </p>
      </div>
      {catalog.error && <p className="text-sm text-destructive">{catalog.error.message}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="font-medium">Door samples</h3>
          {(catalog.data?.offers ?? []).map((offer) => (
            <div key={offer.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{offer.styleName || offer.styleCode || `Style ${offer.styleId}`}</span>
                  <SampleAvailableBadge />
                </div>
                <p className="text-xs text-muted-foreground">{offer.color || "Color not set"} · ${Number(offer.price ?? 0).toFixed(2)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => add({ key: `o${offer.id}`, offerId: offer.id, label: offer.styleName || "Door sample", price: Number(offer.price ?? 0), qty: 1 })}>Add</Button>
            </div>
          ))}
          <h3 className="font-medium">Kits</h3>
          {(catalog.data?.kits ?? []).map((kit) => (
            <div key={kit.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium">{kit.name}</p>
                <p className="text-xs text-muted-foreground">{kit.isFree ? "Free" : `$${Number(kit.price).toFixed(2)}`} · {kit.items.length} doors</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => add({ key: `k${kit.id}`, kitId: kit.id, label: kit.name, price: kit.isFree ? 0 : Number(kit.price), qty: 1 })}>Add</Button>
            </div>
          ))}
        </div>
        <form className="space-y-3" onSubmit={(event) => {
          event.preventDefault();
          if (cart.length === 0) {
            toast.error("Add a sample or a kit");
            return;
          }
          place.mutate({
            customerName: ship.customerName,
            customerEmail: ship.customerEmail || undefined,
            projectLabel: ship.projectLabel || undefined,
            addressLine1: ship.addressLine1,
            addressLine2: ship.addressLine2 || undefined,
            city: ship.city,
            state: ship.state,
            zip: ship.zip,
            affiliateId: mode === "admin" && ship.affiliateId ? Number(ship.affiliateId) : undefined,
            lines: cart.map((line) => ({ offerId: line.offerId, kitId: line.kitId, qty: line.qty })),
          });
        }}>
          <h3 className="font-medium">Ship to</h3>
          {([
            ["customerName", "Customer or showroom"],
            ["customerEmail", "Email"],
            ["projectLabel", "Project"],
            ["addressLine1", "Address"],
            ["addressLine2", "Address line 2"],
            ["city", "City"],
            ["state", "State"],
            ["zip", "ZIP"],
          ] as const).map(([key, label]) => (
            <div key={key}>
              <Label className="text-xs">{label}</Label>
              <Input value={ship[key]} onChange={(event) => setShip({ ...ship, [key]: event.target.value })} />
            </div>
          ))}
          {mode === "admin" && (
            <div>
              <Label className="text-xs">Affiliate id, if this order is theirs</Label>
              <Input value={ship.affiliateId} onChange={(event) => setShip({ ...ship, affiliateId: event.target.value })} />
            </div>
          )}
          <ul className="space-y-1 text-sm">
            {cart.map((line) => <li key={line.key}>{line.qty} × {line.label} — ${line.price.toFixed(2)}</li>)}
          </ul>
          <Button type="submit" disabled={place.isPending}>Submit sample order</Button>
        </form>
      </div>
      <div>
        <h3 className="mb-2 font-medium">{mode === "affiliate" ? "Your sample orders" : "All sample orders"}</h3>
        <ul className="space-y-2 text-sm">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border p-3">
              <span className="font-mono">{order.requestNumber}</span> · {order.status} · ${order.totalAmount ?? "0.00"} · {order.projectLabel || "No project"}
              <div className="text-xs text-muted-foreground">{order.originatorName} · {order.shippingCity}, {order.shippingState} {order.zip}</div>
            </li>
          ))}
          {orders.length === 0 && <li className="text-muted-foreground">No sample orders yet.</li>}
        </ul>
      </div>
    </div>
  );
}
