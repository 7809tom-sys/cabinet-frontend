import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CATEGORY_GRADIENT, formatPrice, pelicanDisplayName, pelicanProductType } from "@/lib/pelican";
import { useCart } from "@/contexts/CartContext";
import { ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import { usePreferredProducts } from "@/contexts/PreferredProductsContext";

export type PelicanCardProduct = {
  id: number;
  slug: string;
  name: string;
  category: string;
  subCategory?: string | null;
  size?: string | null;
  imageUrl?: string | null;
  sellPrice: number | null;
  isPopular?: boolean;
  pelicanCode?: string;
  msrp?: string | null;
  listPrice?: string | null;
};

export function PelicanProductCard({ product, affiliateSlug }: { product: PelicanCardProduct; affiliateSlug?: string }) {
  const gradient = CATEGORY_GRADIENT[product.category] ?? "linear-gradient(135deg,#e5e7eb,#cbd5e1)";
  const displayName = pelicanDisplayName(product);
  const productType = pelicanProductType(product);
  const { addItem, setStorefrontSlug } = useCart();
  const [, navigate] = useLocation();
  const { isPreferred, togglePreferred } = usePreferredProducts();
  const preferred = isPreferred(product.id);

  // Pricing breakdown
  const msrp = product.msrp ? Number(product.msrp) : null;
  const listPrice = product.listPrice ? Number(product.listPrice) : null;
  const hasSellPrice = product.sellPrice != null && product.sellPrice > 0;
  // An official public reference can keep a current SKU discoverable as a
  // quote-only product, but it is not a customer sale/compare-at price.
  const compareAt = hasSellPrice && msrp && msrp > (product.sellPrice ?? 0)
    ? msrp
    : hasSellPrice && listPrice && listPrice > (product.sellPrice ?? 0)
      ? listPrice
      : null;
  const savePct = compareAt && product.sellPrice && compareAt > product.sellPrice
    ? Math.round(((compareAt - product.sellPrice) / compareAt) * 100)
    : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.sellPrice) return;
    if (affiliateSlug) setStorefrontSlug(affiliateSlug);
    const res = addItem({
      masterCode: product.pelicanCode ?? product.slug ?? `PEL-${product.id}`,
      name: product.name,
      styleId: 0,
      styleLabel: product.category,
      distributorId: null,
      tier: "homeowner",
      unitPrice: product.sellPrice,
      priceLocked: true,
      productKind: "surface",
      pelicanProductId: product.id,
      qty: 1,
      imageUrl: product.imageUrl ?? null,
      category: product.category,
    });
    if (res.ok) {
      toast.success(`Added ${product.name} to cart`, {
        action: { label: "View Cart", onClick: () => navigate(affiliateSlug ? `/store/${affiliateSlug}/cart` : "/cart") },
      });
    }
  };

  const handlePreferred = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePreferred(product);
  };

  return (
    <Link href={affiliateSlug ? `/store/${affiliateSlug}/surfaces/product/${product.slug}` : `/surfaces/product/${product.slug}`}>
      <Card className="group h-full overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative aspect-[4/3] w-full overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={displayName}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{ background: gradient }}
            >
              <span className="px-3 text-center text-xs font-medium uppercase tracking-wide text-black/45">
                {product.category}
              </span>
            </div>
          )}
          {product.isPopular && (
            <Badge className="absolute left-2 top-2 gap-1 bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]">
              <Star className="h-3 w-3 fill-current" /> Featured
            </Badge>
          )}
          {savePct != null && savePct > 0 && (
            <Badge className="absolute right-2 top-2 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]">
              Save {savePct}%
            </Badge>
          )}
        </div>
        <div className="space-y-1 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {productType}
          </div>
          <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-snug">
            {displayName}
          </div>
          {product.size && (
            <div className="text-xs text-muted-foreground">{product.size}</div>
          )}
          {product.pelicanCode && (
            <div className="text-[11px] font-medium text-muted-foreground">Item code: {product.pelicanCode}</div>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <span className="text-base font-bold text-[var(--color-navy)] dark:text-foreground">
                {formatPrice(product.sellPrice)}
              </span>
              {compareAt != null && (
                <span className="ml-1.5 text-xs text-muted-foreground line-through">
                  ${compareAt.toFixed(2)}
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant={preferred ? "secondary" : "outline"} className="h-7 gap-1 px-2 text-[10px]" onClick={handlePreferred} aria-pressed={preferred} title={preferred ? "Remove from Preferred" : "Add to Preferred"}>
                <Star className={`h-3.5 w-3.5 ${preferred ? "fill-current" : ""}`} /> {preferred ? "Preferred" : "Add to Preferred"}
              </Button>
              {product.sellPrice && (
                <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={handleAddToCart} title="Add to Cart">
                  <ShoppingCart className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
