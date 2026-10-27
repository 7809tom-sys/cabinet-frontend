import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const TYPES = ["", "inventory_sync", "low_stock", "price_increase", "out_of_stock"] as const;

export default function VendorUpdatesAdmin() {
  const [vendorScope, setVendorScope] = useState("");
  const [type, setType] = useState<(typeof TYPES)[number]>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const utils = trpc.useUtils();
  const inbox = trpc.vendorInventory.inbox.useQuery({
    vendorScope: vendorScope || undefined,
    type: type || undefined,
    unreadOnly,
  });
  const increases = trpc.vendorInventory.adminPriceIncreases.useQuery();
  const markRead = trpc.vendorInventory.markRead.useMutation({
    onSuccess: () => {
      void utils.vendorInventory.inbox.invalidate();
      void utils.vendorInventory.inboxCount.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const review = trpc.vendorInventory.reviewPriceIncrease.useMutation({
    onSuccess: () => {
      toast.success("Price update reviewed");
      void increases.refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold">Vendor Updates</h2>
        <p className="text-sm text-muted-foreground">Inventory syncs, low stock, out of stock, and upcoming wholesale increases. Applying an increase writes the vendor wholesale price. It does not change the price until you apply it.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Vendor scope, e.g. dist:12" value={vendorScope} onChange={(event) => setVendorScope(event.target.value)} />
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={type} onChange={(event) => setType(event.target.value as (typeof TYPES)[number])}>
          {TYPES.map((item) => <option key={item || "all"} value={item}>{item || "All types"}</option>)}
        </select>
        <Button variant={unreadOnly ? "default" : "outline"} size="sm" onClick={() => setUnreadOnly((value) => !value)}>Unread only</Button>
      </div>
      <ul className="space-y-2">
        {(inbox.data ?? []).map((item) => (
          <li key={item.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{item.type}</Badge>
              <span className="text-xs text-muted-foreground">{item.vendorScope}</span>
              {!item.readAt && <Badge>Unread</Badge>}
              <span className="font-medium">{item.title}</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
            <Button className="mt-2" size="sm" variant="outline" onClick={() => markRead.mutate({ id: item.id, acknowledge: true })}>Mark read</Button>
          </li>
        ))}
        {inbox.data?.length === 0 && <li className="text-sm text-muted-foreground">No vendor updates for this filter.</li>}
      </ul>

      <div>
        <h3 className="mb-2 font-semibold">Upcoming price increases</h3>
        <ul className="space-y-2">
          {(increases.data ?? []).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
              <span className="font-mono">{item.sku}</span>
              <span>{item.currentWholesale ?? "unset"} → {item.nextWholesale}</span>
              <span className="text-muted-foreground">{item.effectiveDate ?? "No date"}</span>
              <Badge variant="outline">{item.status}</Badge>
              {item.status === "pending" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => review.mutate({ id: item.id, action: "acknowledge" })}>Acknowledge</Button>
                  <Button size="sm" onClick={() => review.mutate({ id: item.id, action: "apply" })}>Apply</Button>
                  <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: item.id, action: "dismiss" })}>Dismiss</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
