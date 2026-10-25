import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeo } from "@/hooks/useSeo";
import { formatPrice } from "@/lib/pelican";
import { requestSurfaceHandoff } from "@/lib/surfaceSelection";
import { toast } from "sonner";
import { Droplets, ShowerHead, ChefHat, ArrowRight, Sparkles, PaintBucket, ShoppingCart } from "lucide-react";
import { EditableText } from "@/components/admin/EditableText";
import { useCart } from "@/contexts/CartContext";

const HERO_KITCHEN = "/manus-storage/legacy-cdn/stonecreek-kitchen-hero-GNgNkcBRXKeBwSEoXrBMBg.webp";
const HERO_BATH = "/manus-storage/legacy-cdn/stonecreek-bath-hero-fCp9GA4H5XXQNmpgUdMiWg.webp";
const HERO_DETAIL = "/manus-storage/legacy-cdn/stonecreek-lifestyle-detail-ksbNiy4yt4dWyBSzZDyKV4.webp";

type FaucetTab = "kitchen" | "bathroom" | "sinks";
const FINISHES = ["All", "Matte Black", "Brushed Nickel", "Chrome", "Brushed Gold", "Oil Rubbed Bronze"] as const;
type Finish = (typeof FINISHES)[number];

function finishFromName(name: string): string {
  if (name.includes("Matte Black")) return "Matte Black";
  if (name.includes("Brushed Nickel")) return "Brushed Nickel";
  if (name.includes("Chrome")) return "Chrome";
  if (name.includes("Brushed Gold")) return "Brushed Gold";
  if (name.includes("Oil Rubbed Bronze")) return "Oil Rubbed Bronze";
  return "Other";
}

function seriesFromName(name: string): string {
  // Extract the series name between "StoneCreek " and the next word that's a faucet type
  const match = name.match(/StoneCreek\s+(\w+)/);
  return match?.[1] ?? "";
}

export default function StoneCreekCollection() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<FaucetTab>("kitchen");
  const [finish, setFinish] = useState<Finish>("All");

  const handleAddToDesign = (product: any) => {
    requestSurfaceHandoff({
      v: 1,
      savedAt: Date.now(),
      picks: {
        faucet: {
          id: product.id,
          slug: product.slug,
          name: product.name,
          category: product.category,
          subCategory: product.subCategory ?? null,
          size: product.size ?? null,
          imageUrl: product.imageUrl ?? null,
          sellPrice: product.sellPrice ?? null,
          role: "faucet",
        },
      },
      layout: "l-shape",
    });
    toast.success(`${product.name} will be added to your design`);
    navigate("/design");
  };

  useSeo({
    title: "StoneCreek Collection — Premium Sinks & Faucets | Cabinet Dealz",
    description:
      "Discover the StoneCreek collection of premium kitchen and bathroom faucets. Solid brass construction, ceramic cartridges, lifetime warranty. Available in 5 finishes.",
  });

  // Query faucets from the Sinks & Faucets category, subCategory = Faucets
  const { data, isLoading } = trpc.pelican.byCategory.useQuery(
    {
      category: "Sinks & Faucets" as any,
      scope: "catalog",
      subCategory: "Faucets",
      limit: 200,
      offset: 0,
    },
    { staleTime: 60_000 }
  );

  // Query sinks
  const { data: sinksData, isLoading: sinksLoading } = trpc.pelican.byCategory.useQuery(
    {
      category: "Sinks & Faucets" as any,
      scope: "catalog",
      subCategory: "Sinks",
      limit: 200,
      offset: 0,
    },
    { staleTime: 60_000 }
  );

  const allFaucets = useMemo(() => {
    if (!data?.items) return [];
    // Only show StoneCreek branded faucets (those with the new names)
    return data.items.filter((p: any) => p.name?.startsWith("StoneCreek"));
  }, [data]);

  const allSinks = useMemo(() => {
    if (!sinksData?.items) return [];
    return sinksData.items.filter((p: any) => p.name?.startsWith("StoneCreek"));
  }, [sinksData]);

  const filtered = useMemo(() => {
    if (tab === "sinks") {
      // Sinks don't use the finish filter (they use color names in the name)
      return allSinks;
    }
    let items = allFaucets;
    // Filter by tab (kitchen vs bathroom)
    if (tab === "kitchen") {
      items = items.filter((p: any) => p.name?.includes("Kitchen"));
    } else {
      items = items.filter(
        (p: any) => p.name?.includes("Vanity") || p.name?.includes("Vessel") || p.name?.includes("Widespread") || p.name?.includes("Bathroom")
      );
    }
    // Filter by finish
    if (finish !== "All") {
      items = items.filter((p: any) => p.name?.includes(finish));
    }
    return items;
  }, [allFaucets, allSinks, tab, finish]);

  // Group by series for display
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of filtered) {
      const series = seriesFromName(item.name ?? "");
      if (!map.has(series)) map.set(series, []);
      map.get(series)!.push(item);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={tab === "kitchen" ? HERO_KITCHEN : HERO_BATH}
            alt="StoneCreek Collection"
            className="h-full w-full object-cover transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
        <div className="container relative z-10 flex h-full flex-col justify-center">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-4 bg-white/10 text-white backdrop-blur-sm border-white/20">
              <Sparkles className="mr-1 h-3 w-3" /> Exclusive Collection
            </Badge>
            <h1 className="text-5xl font-bold tracking-tight text-white md:text-6xl">
              <EditableText pageKey="stonecreek" field="hero_title" defaultValue="StoneCreek">
                {(v) => <>{v}</>}
              </EditableText>
            </h1>
            <p className="mt-2 text-lg text-white/80 font-light">
              <EditableText pageKey="stonecreek" field="hero_tagline" defaultValue="Premium Sinks & Faucets">
                {(v) => <>{v}</>}
              </EditableText>
            </p>
            <p className="mt-4 text-base text-white/70 max-w-md leading-relaxed">
              <EditableText pageKey="stonecreek" field="hero_subtitle" defaultValue="Solid brass construction. Precision ceramic cartridges. Lead-free and backed by a lifetime warranty. Designed for kitchens and bathrooms that demand more." multiline>
                {(v) => <>{v}</>}
              </EditableText>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button
                size="lg"
                variant={tab === "kitchen" ? "default" : "outline"}
                onClick={() => setTab("kitchen")}
                className={tab === "kitchen" ? "" : "border-white/30 text-white hover:bg-white/10"}
              >
                <ChefHat className="mr-2 h-4 w-4" /> Kitchen Faucets
              </Button>
              <Button
                size="lg"
                variant={tab === "bathroom" ? "default" : "outline"}
                onClick={() => setTab("bathroom")}
                className={tab === "bathroom" ? "" : "border-white/30 text-white hover:bg-white/10"}
              >
                <ShowerHead className="mr-2 h-4 w-4" /> Bathroom Faucets
              </Button>
              <Button
                size="lg"
                variant={tab === "sinks" ? "default" : "outline"}
                onClick={() => setTab("sinks")}
                className={tab === "sinks" ? "" : "border-white/30 text-white hover:bg-white/10"}
              >
                <Droplets className="mr-2 h-4 w-4" /> Sinks
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Strip */}
      <section className="border-b bg-muted/30 py-6">
        <div className="container flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>Solid Brass Construction</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>Ceramic Disc Cartridge</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>Lead-Free Certified</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>Lifetime Warranty</span>
          </div>
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-primary" />
            <span>5 Premium Finishes</span>
          </div>
        </div>
      </section>

      {/* Finish Filter */}
      <section className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-sm py-4">
        <div className="container">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap mr-2">Finish:</span>
            {FINISHES.map((f) => (
              <Button
                key={f}
                size="sm"
                variant={finish === f ? "default" : "outline"}
                onClick={() => setFinish(f)}
                className="whitespace-nowrap"
              >
                {f}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Product Grid */}
      <section className="py-12">
        <div className="container">
          {(isLoading || sinksLoading) ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <Droplets className="mx-auto h-12 w-12 text-muted-foreground/40" />
              <p className="mt-4 text-muted-foreground">
                {tab === "sinks" ? "No sinks available." : "No faucets match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-16">
              {grouped.map(([series, items]) => (
                <div key={series}>
                  <div className="mb-6 flex items-baseline gap-3">
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {series} {tab === "sinks" ? "Sink Collection" : "Series"}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                      {items.length} {items.length === 1 ? "option" : "options"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {items.map((product: any) => (
                      <StoneCreekCard key={product.id} product={product} onAddToDesign={handleAddToDesign} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lifestyle Detail Section */}
      <section className="border-t bg-muted/20 py-16">
        <div className="container grid gap-8 md:grid-cols-2 items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Built for the Way You Live
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Every StoneCreek faucet is engineered from solid brass with precision ceramic disc
              cartridges for smooth, drip-free operation that lasts a lifetime. Our finishes are
              applied using advanced PVD coating technology, resisting tarnish, corrosion, and
              fingerprints day after day.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Available in Matte Black, Brushed Nickel, Chrome, Brushed Gold, and Oil Rubbed
              Bronze — each finish is designed to complement your cabinet hardware and countertop
              selections seamlessly.
            </p>
            <Link href="/design">
              <Button className="mt-6" size="lg">
                Add to Your Design <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl shadow-xl">
            <img
              src={HERO_DETAIL}
              alt="StoneCreek faucet in use"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}

function StoneCreekCard({ product, onAddToDesign }: { product: any; onAddToDesign: (p: any) => void }) {
  const finish = finishFromName(product.name ?? "");
  const { addItem } = useCart();
  const [, navigate] = useLocation();

  // Pricing breakdown
  const msrp = product.msrp ? Number(product.msrp) : null;
  const listPriceNum = product.listPrice ? Number(product.listPrice) : null;
  const compareAt = msrp && msrp > (product.sellPrice ?? 0)
    ? msrp
    : listPriceNum && listPriceNum > (product.sellPrice ?? 0)
      ? listPriceNum
      : null;
  const savePct = compareAt && product.sellPrice && compareAt > product.sellPrice
    ? Math.round(((compareAt - product.sellPrice) / compareAt) * 100)
    : null;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.sellPrice) return;
    const res = addItem({
      masterCode: product.pelicanCode ?? product.slug ?? `SC-${product.id}`,
      name: product.name,
      styleId: 0,
      styleLabel: "StoneCreek",
      distributorId: null,
      tier: "homeowner",
      unitPrice: product.sellPrice ?? null,
      qty: 1,
      imageUrl: product.imageUrl ?? null,
      category: product.category ?? "Sinks & Faucets",
    });
    if (res.ok) {
      toast.success(`Added ${product.name} to cart`, {
        action: { label: "View Cart", onClick: () => navigate("/cart") },
      });
    }
  };

  return (
    <Link href={`/surfaces/product/${product.slug}`}>
      <Card className="group h-full overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-stone-100 to-stone-200">
              <Droplets className="h-12 w-12 text-stone-400" />
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-black/70 text-white text-[10px] backdrop-blur-sm">
            {finish}
          </Badge>
          {savePct != null && savePct > 0 && (
            <Badge className="absolute right-2 top-2 bg-emerald-600 text-white hover:bg-emerald-600 text-[10px]">
              Save {savePct}%
            </Badge>
          )}
        </div>
        <div className="p-4">
          <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {product.name?.replace("StoneCreek ", "")}
          </p>
          {product.description && (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between">
            {product.sellPrice ? (
              <div className="min-w-0">
                <span className="text-base font-semibold text-primary">
                  {formatPrice(product.sellPrice)}
                </span>
                {compareAt != null && (
                  <span className="ml-1.5 text-xs text-muted-foreground line-through">
                    ${compareAt.toFixed(2)}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Contact for pricing</span>
            )}
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 px-2"
                onClick={handleAddToCart}
                disabled={!product.sellPrice}
                title="Add to Cart"
              >
                <ShoppingCart className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="default"
                className="text-xs h-7 px-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddToDesign(product);
                }}
              >
                <PaintBucket className="mr-1 h-3 w-3" /> Design
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
