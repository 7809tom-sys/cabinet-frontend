import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { SampleAvailableBadge } from "@/components/samples/SampleAvailableBadge";

export function VendorSamples(props: { distributorId?: number; approvedVendorLineId?: number }) {
  const access = trpc.vendorSamples.access.useQuery({
    distributorId: props.distributorId,
    approvedVendorLineId: props.approvedVendorLineId,
  });
  const scope = access.data?.scope ?? null;
  const offers = trpc.vendorSamples.listOffers.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const kits = trpc.vendorSamples.listKits.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const orders = trpc.vendorSamples.vendorOrders.useQuery({ scope: scope ?? "" }, { enabled: Boolean(scope) });
  const saveOffer = trpc.vendorSamples.saveOffer.useMutation({
    onSuccess: () => {
      toast.success("Sample flag saved");
      void offers.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const saveKit = trpc.vendorSamples.saveKit.useMutation({
    onSuccess: () => {
      toast.success("Sample kit saved");
      void kits.refetch();
    },
    onError: (error) => toast.error(error.message),
  });
  const [kit, setKit] = useState({ name: "", description: "", price: "", free: false, styleIds: "" });

  if (access.isLoading) return <Spinner />;
  if (!access.data?.enabled || !scope) {
    return <p className="text-sm text-muted-foreground">Samples are available to cabinet vendors when the samples feature is on.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Samples</h2>
        <p className="text-sm text-muted-foreground">
          Flag which of your door styles have a physical sample and build kits from those styles. Ordering happens in the admin and affiliate back office, not the public store. A sample SKU must already be an unpublished sample door on your line. Leaving the SKU blank links the existing sample door when one is on the line.
        </p>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1 text-left">Door</th>
              <th className="px-2 py-1 text-left">Available</th>
              <th className="px-2 py-1 text-left">SKU</th>
              <th className="px-2 py-1 text-left">Price</th>
              <th className="px-2 py-1 text-left">Lead</th>
            </tr>
          </thead>
          <tbody>
            {(offers.data?.styles ?? []).map((style) => (
              <OfferRow key={style.id} style={style} onSave={(input) => saveOffer.mutate({ scope, styleId: style.id, ...input })} />
            ))}
          </tbody>
        </table>
      </div>
      <form className="max-w-lg space-y-2" onSubmit={(event) => {
        event.preventDefault();
        const styleIds = kit.styleIds.split(",").map((item) => Number(item.trim())).filter((id) => id > 0);
        saveKit.mutate({
          scope,
          name: kit.name,
          description: kit.description,
          price: kit.price === "" ? null : Number(kit.price),
          isFree: kit.free,
          active: true,
          styleIds,
        });
      }}>
        <h3 className="font-semibold">New sample kit</h3>
        <Label className="text-xs">Name</Label>
        <Input value={kit.name} onChange={(event) => setKit({ ...kit, name: event.target.value })} />
        <Label className="text-xs">Description</Label>
        <Input value={kit.description} onChange={(event) => setKit({ ...kit, description: event.target.value })} />
        <Label className="text-xs">Price as charged, or mark free</Label>
        <Input value={kit.price} onChange={(event) => setKit({ ...kit, price: event.target.value })} />
        <label className="text-sm"><input type="checkbox" checked={kit.free} onChange={(event) => setKit({ ...kit, free: event.target.checked })} /> Free</label>
        <Label className="text-xs">Your door style ids, comma-separated</Label>
        <Input value={kit.styleIds} onChange={(event) => setKit({ ...kit, styleIds: event.target.value })} />
        <Button type="submit">Save kit</Button>
      </form>
      <ul className="space-y-1 text-sm">
        {(kits.data ?? []).map((item) => (
          <li key={item.id}>{item.name} — {item.isFree ? "Free" : `$${item.price}`} — {item.active ? "active" : "inactive"} — {item.items.length} doors</li>
        ))}
      </ul>
      <div>
        <h3 className="font-semibold">Sample orders for your products</h3>
        <ul className="mt-2 space-y-2 text-sm">
          {(orders.data ?? []).map((order) => (
            <li key={order.id} className="rounded-lg border p-3">
              <span className="font-mono">{order.requestNumber}</span> · {order.status} · {order.projectLabel || "No project"}
              <div className="text-xs text-muted-foreground">
                Ship to {order.shipTo.name}, {order.shipTo.line1}, {order.shipTo.city} {order.shipTo.state} {order.shipTo.zip}
              </div>
              <ul>
                {order.lines.map((line, index) => <li key={index}>{line.qty} × {line.description}</li>)}
              </ul>
            </li>
          ))}
          {orders.data?.length === 0 && <li className="text-muted-foreground">No sample orders for your line yet.</li>}
        </ul>
      </div>
    </div>
  );
}

function OfferRow({
  style,
  onSave,
}: {
  style: {
    id: number;
    name: string | null;
    styleCode: string | null;
    color: string | null;
    sampleAvailable: boolean;
    offer: { sampleSku: string | null; price: string | null; leadTimeDays: number | null; notes: string | null } | null;
  };
  onSave: (input: { available: boolean; sampleSku: string | null; price: number | null; leadTimeDays: number | null; notes: string | null }) => void;
}) {
  const [available, setAvailable] = useState(style.sampleAvailable);
  const [sku, setSku] = useState(style.offer?.sampleSku ?? "");
  const [price, setPrice] = useState(style.offer?.price ?? "");
  const [lead, setLead] = useState(style.offer?.leadTimeDays == null ? "" : String(style.offer.leadTimeDays));
  return (
    <tr className="border-t">
      <td className="px-2 py-1">
        <div className="flex items-center gap-2">
          {style.name || style.styleCode || style.id}
          {available && <SampleAvailableBadge />}
        </div>
        <div className="text-xs text-muted-foreground">{style.color} · id {style.id}</div>
      </td>
      <td className="px-2 py-1"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /></td>
      <td className="px-2 py-1"><Input className="h-8 w-24" value={sku} onChange={(event) => setSku(event.target.value)} /></td>
      <td className="px-2 py-1"><Input className="h-8 w-20" value={price ?? ""} onChange={(event) => setPrice(event.target.value)} /></td>
      <td className="px-2 py-1">
        <div className="flex gap-2">
          <Input className="h-8 w-16" value={lead} onChange={(event) => setLead(event.target.value)} />
          <Button size="sm" variant="outline" onClick={() => onSave({
            available,
            sampleSku: sku.trim() || null,
            price: price === "" ? null : Number(price),
            leadTimeDays: lead === "" ? null : Number(lead),
            notes: style.offer?.notes ?? null,
          })}>Save</Button>
        </div>
      </td>
    </tr>
  );
}
