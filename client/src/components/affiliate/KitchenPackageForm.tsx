import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PackageOpen } from "lucide-react";
import type { PackageLineItem } from "@shared/kitchenPackage";

export type KitchenPackageDraft = {
  name: string;
  description: string;
  layoutLabel: string;
  doorColor: string;
  priceOverride: string;
  discountAmount: string;
};

export function KitchenPackageForm({
  draft,
  onChange,
  placedCount,
  roomWidth,
  roomDepth,
  autoPrice,
  styleName,
  lineItems,
  pending,
  onSubmit,
  onCancel,
  submitLabel = "Create Kitchen Package",
}: {
  draft: KitchenPackageDraft;
  onChange: (next: KitchenPackageDraft) => void;
  placedCount: number;
  roomWidth: number;
  roomDepth: number;
  autoPrice: number;
  styleName?: string | null;
  lineItems: PackageLineItem[];
  pending?: boolean;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const override = draft.priceOverride.trim() === "" ? null : Number(draft.priceOverride);
  const discount = draft.discountAmount.trim() === "" ? 0 : Number(draft.discountAmount);
  const packagePrice = override != null && Number.isFinite(override)
    ? override
    : Math.max(0, autoPrice - (Number.isFinite(discount) ? discount : 0));
  return (
    <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <div className="space-y-1.5">
        <Label htmlFor="bundle-name">Kitchen Package Name <span className="text-destructive">*</span></Label>
        <Input
          id="bundle-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="e.g. Classic White Shaker 10×10 Kitchen"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bundle-desc">Description</Label>
        <textarea
          id="bundle-desc"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          placeholder="Describe this kitchen package for customers…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[72px] resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="bundle-layout">Room size / layout</Label>
          <Input id="bundle-layout" value={draft.layoutLabel} onChange={(event) => onChange({ ...draft, layoutLabel: event.target.value })} placeholder={`${roomWidth}" × ${roomDepth}"`} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-door">Door style / color</Label>
          <Input id="bundle-door" value={draft.doorColor} onChange={(event) => onChange({ ...draft, doorColor: event.target.value })} placeholder={styleName ?? "Door color"} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-override">Package price override</Label>
          <Input id="bundle-override" inputMode="decimal" value={draft.priceOverride} onChange={(event) => onChange({ ...draft, priceOverride: event.target.value })} placeholder="Optional" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bundle-discount">Discount</Label>
          <Input id="bundle-discount" inputMode="decimal" value={draft.discountAmount} onChange={(event) => onChange({ ...draft, discountAmount: event.target.value })} placeholder="Optional" />
        </div>
      </div>
      <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
        <div className="flex justify-between"><span>Cabinets:</span><span className="font-medium text-foreground">{placedCount}</span></div>
        <div className="flex justify-between"><span>Room size:</span><span className="font-medium text-foreground">{roomWidth}&quot; × {roomDepth}&quot;</span></div>
        {styleName && <div className="flex justify-between"><span>Style:</span><span className="font-medium text-foreground">{styleName}</span></div>}
        <div className="flex justify-between"><span>Auto-sum:</span><span className="font-medium text-foreground">${autoPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
        <div className="flex justify-between"><span>Package price:</span><span className="font-medium text-foreground">${packagePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
      </div>
      {lineItems.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1">Included items</p>
          <ul className="max-h-32 overflow-y-auto text-xs space-y-1">
            {lineItems.map((item) => (
              <li key={`${item.supplier}-${item.code}-${item.label}`} className="flex justify-between gap-2">
                <span>{item.qty}× {item.label} <span className="text-muted-foreground">({item.supplier})</span></span>
                <span>{item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : "Quote"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Prices are snapshotted now. The package is a copy, so the source design stays with the customer. Publish it from Kitchen Packages. The hero image is the design snapshot captured when you save.</p>
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={pending || !draft.name.trim()} className="gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <PackageOpen className={`h-4 w-4${pending ? " animate-spin" : ""}`} />
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
