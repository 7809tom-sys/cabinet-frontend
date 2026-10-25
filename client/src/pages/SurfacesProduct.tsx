import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/useSeo";
import {
  categorySlug,
  CATEGORY_GRADIENT,
  formatPrice,
  isPelicanDesignerPaletteAvailable,
  pelicanCategoryLabel,
  pelicanDisplayName,
  pelicanPricePresentation,
  pelicanProductType,
} from "@/lib/pelican";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePreferredProducts } from "@/contexts/PreferredProductsContext";
import { ArrowLeft, DollarSign, Minus, PencilRuler, Plus, ShoppingCart, Star, Waves } from "lucide-react";
import { toast } from "sonner";

export default function SurfacesProduct({ slug, affiliateSlug }: { slug: string; affiliateSlug?: string }) {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = trpc.pelican.bySlug.useQuery({ slug, affiliateSlug });
  const { addItem, setStorefrontSlug } = useCart();
  const { user } = useAuth();
  const { isPreferred, togglePreferred } = usePreferredProducts();
  const [qty, setQty] = useState(1);
  const displayName = data ? pelicanDisplayName(data) : "Product";
  const productType = data ? pelicanProductType(data) : "Pelican Product";

  useSeo({
    title: data
      ? `${displayName} — Surfaces & Fixtures | Cabinet Dealz`
      : "Product — Surfaces & Fixtures | Cabinet Dealz",
    description: data?.description?.slice(0, 160),
    type: "product",
    image: data?.imageUrl ?? undefined,
  });

  const handleAddToCart = () => {
    if (!data) return;
    if (affiliateSlug) setStorefrontSlug(affiliateSlug);
    const res = addItem({
      masterCode: data.pelicanCode,
      name: data.name,
      styleId: 0, // No style for pelican products
      styleLabel: data.category,
      distributorId: null, // Pelican products bypass distributor lock
      tier: "homeowner",
      unitPrice: data.sellPrice ?? null,
      priceLocked: true,
      productKind: "surface",
      pelicanProductId: data.id,
      qty,
      imageUrl: data.imageUrl ?? null,
      category: data.category,
    });
    if (res.ok) {
      toast.success(`Added ${qty}\u00d7 ${data.name} to cart`, {
        description: data.category,
        action: { label: "View Cart", onClick: () => navigate(affiliateSlug ? `/store/${affiliateSlug}/cart` : "/cart") },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="grid gap-8 md:grid-cols-2">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container py-16 text-center">
        <Waves className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">
          This item may no longer be available.
        </p>
        <Link href="/surfaces">
          <Button className="mt-5 gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Surfaces
          </Button>
        </Link>
      </div>
    );
  }

  const gradient = CATEGORY_GRADIENT[data.category] ?? "linear-gradient(135deg,#e5e7eb,#cbd5e1)";
  const preferred = isPreferred(data.id);
  const isDesignerPaletteAvailable = isPelicanDesignerPaletteAvailable({
    pelicanCode: data.pelicanCode,
    category: data.category,
    showInDesigner: data.showInDesigner,
    sellPrice: data.sellPrice,
  });

  // The configured sell price is the only public price. Internal cost and the
  // imported comparison value are kept in the administrator-only view.
  const sellPrice = data.sellPrice;
  const isOwner = user?.role === "admin";
  const { referencePrice, savingsPercent } = pelicanPricePresentation({
    sellPrice,
    msrp: data.msrp,
    isAdmin: isOwner,
  });
  // Cost breakdown - show our cost (yourCost or listPrice as fallback) only to admins.
  const ourCost = data.yourCost ? Number(data.yourCost) : (data.listPrice ? Number(data.listPrice) : null);
  const marginDollars = isOwner && ourCost != null && sellPrice != null ? Math.round((sellPrice - ourCost) * 100) / 100 : null;
  const marginPct = marginDollars != null && sellPrice != null && sellPrice > 0
    ? Math.round((marginDollars / sellPrice) * 1000) / 10
    : null;

  return (
    <div className="container py-8">
      <button
        onClick={() => navigate(`/surfaces/${categorySlug(data.category)}`)}
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {pelicanCategoryLabel(data.category)}
      </button>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Image */}
        <Card className="overflow-hidden">
          <div className="relative aspect-[4/3] w-full">
            {data.imageUrl ? (
              <img src={data.imageUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ background: gradient }}
              >
                <span className="text-sm font-medium uppercase tracking-wide text-black/40">
                  {data.category}
                </span>
              </div>
            )}
            {data.isPopular && (
              <Badge className="absolute left-3 top-3 gap-1 bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]">
                <Star className="h-3 w-3 fill-current" /> Featured
              </Badge>
            )}
          </div>
        </Card>

        {/* Details */}
        <div>
          <div className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            {productType}
          </div>
          <h1 className="mt-1 font-serif text-3xl font-bold">{displayName}</h1>

          {/* ─── Pricing Breakdown Card ─── */}
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Pricing</span>
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-3xl font-bold text-[var(--color-navy)] dark:text-foreground">
                {formatPrice(sellPrice)}
              </div>
              {referencePrice != null && (
                <div className="text-base text-muted-foreground line-through">
                  ${referencePrice.toFixed(2)}
                </div>
              )}
              {savingsPercent != null && savingsPercent > 0 && (
                <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                  Save {savingsPercent}%
                </Badge>
              )}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Trade member pricing · no hidden fees
            </div>

            {/* Owner-only cost breakdown */}
            {isOwner && ourCost != null && (
              <div className="mt-3 pt-3 border-t border-dashed border-amber-500/60 rounded-md bg-amber-500/5 px-3 py-2">
                <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-1">
                  <span>Owner view · not shown to customers</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">My Cost</div>
                    <div className="font-semibold text-foreground">${ourCost.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Sells At</div>
                    <div className="font-semibold text-foreground">
                      {sellPrice != null ? `$${sellPrice.toFixed(2)}` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Margin</div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {marginDollars != null
                        ? `$${marginDollars.toFixed(2)}${marginPct != null ? ` (${marginPct}%)` : ""}`
                        : "—"}
                    </div>
                  </div>
                </div>
                {referencePrice != null && (
                  <div className="mt-2 border-t border-amber-500/20 pt-2 text-xs text-muted-foreground">
                    Source reference price: ${referencePrice.toFixed(2)} · internal comparison only
                  </div>
                )}
              </div>
            )}
          </div>

          {data.size && (
            <div className="mt-3 text-sm text-muted-foreground">Size: {data.size}</div>
          )}

          {data.description && (
            <p className="mt-5 whitespace-pre-line leading-relaxed text-foreground/80">
              {data.description}
            </p>
          )}

          {/* Quantity + Add to Cart */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-border">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-sm font-medium">{qty}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setQty((q) => q + 1)}
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              onClick={handleAddToCart}
              className="gap-2"
              disabled={!data.sellPrice}
            >
              <ShoppingCart className="h-4 w-4" /> Add to Cart
            </Button>
            <Button
              variant={preferred ? "secondary" : "outline"}
              className="gap-2"
              onClick={() => togglePreferred(data)}
              aria-pressed={preferred}
            >
              <Star className={`h-4 w-4 ${preferred ? "fill-current" : ""}`} />
              {preferred ? "Preferred" : "Add to Preferred"}
            </Button>
            {isDesignerPaletteAvailable && (
              <Link href="/design">
                <Button variant="outline" className="gap-2" data-testid="open-designer-palette">
                  <PencilRuler className="h-4 w-4" /> View in Designer Palette
                </Button>
              </Link>
            )}
          </div>

          <div className="mt-6 space-y-1 text-xs text-muted-foreground">
            <div>Item code: {data.pelicanCode}</div>
            {displayName !== data.name && <div>Source name: {data.name}</div>}
          </div>
        </div>
      </div>

      {/* Complete this look: sink ↔ faucet pairing */}
      {(data.subCategory === "Faucets" || data.subCategory === "Sinks") && (
        <CompleteThisLook slug={slug} pairedType={data.subCategory === "Faucets" ? "Sinks" : "Faucets"} affiliateSlug={affiliateSlug} />
      )}
    </div>
  );
}

function CompleteThisLook({ slug, pairedType, affiliateSlug }: { slug: string; pairedType: string; affiliateSlug?: string }) {
  const [, navigate] = useLocation();
  const { addItem, setStorefrontSlug } = useCart();
  const { data: related, isLoading } = trpc.pelican.relatedProducts.useQuery(
    { slug, affiliateSlug, limit: 4 },
    { staleTime: 60_000 }
  );

  if (isLoading) return null;
  if (!related || related.length === 0) return null;

  const handleAddToCart = (product: any) => {
    if (!product.sellPrice) return;
    if (affiliateSlug) setStorefrontSlug(affiliateSlug);
    const res = addItem({
      masterCode: product.pelicanCode,
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

  return (
    <div className="border-t bg-muted/20 py-12">
      <div className="container">
        <h2 className="text-xl font-semibold mb-2">Complete This Look</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Pair with a matching {pairedType.toLowerCase().replace("s", "")} for a coordinated finish.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {related.map((product: any) => (
            <Link key={product.id} href={affiliateSlug ? `/store/${affiliateSlug}/surfaces/product/${product.slug}` : `/surfaces/product/${product.slug}`}>
              <Card className="group overflow-hidden border-border/70 hover:shadow-md transition-all duration-200 cursor-pointer">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={pelicanDisplayName(product)}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Waves className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {pelicanDisplayName(product)}
                  </p>
                  {product.pelicanCode && (
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">Item code: {product.pelicanCode}</p>
                  )}
                  {product.sellPrice && (
                    <p className="mt-1 text-sm font-semibold text-primary">{formatPrice(product.sellPrice)}</p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full text-xs h-7"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddToCart(product); }}
                  >
                    <ShoppingCart className="mr-1 h-3 w-3" /> Add to Cart
                  </Button>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
