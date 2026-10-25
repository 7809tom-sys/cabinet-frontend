import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  Upload,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  ImageIcon,
  ShoppingCart,
  Sparkles,
} from "lucide-react";

type MatchedFixture = {
  fixture: {
    type: string;
    description: string;
    brand: string;
    model: string;
    quantity: number;
  } | null;
  matched: boolean;
  confidence: "high" | "medium" | "low" | "none";
  reason: string;
  product: {
    id: number;
    pelicanCode: string;
    name: string;
    category: string;
    subCategory: string | null;
    size: string | null;
    imageUrl: string | null;
    sellPrice: number | null;
  } | null;
};

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

function fixtureTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sink: "Sink",
    faucet: "Faucet",
    bathtub: "Bathtub",
    shower: "Shower",
    toilet: "Toilet",
    bidet: "Bidet",
    shower_door: "Shower Door",
    shower_valve: "Shower Valve",
    other: "Fixture",
  };
  return labels[type] || "Fixture";
}

function confidenceBadge(confidence: string) {
  switch (confidence) {
    case "high":
      return <Badge className="bg-green-100 text-green-800 border-green-200">High match</Badge>;
    case "medium":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Likely match</Badge>;
    case "low":
      return <Badge variant="outline" className="text-xs">Possible match</Badge>;
    default:
      return null;
  }
}

export default function FixturePhotoToCart() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { addItem } = useCart();
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview, setPreview] = useState<string | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [matches, setMatches] = useState<MatchedFixture[] | null>(null);

  const identifyMut = trpc.fixturePhoto.identifyAndMatch.useMutation({
    onSuccess: (res) => {
      setMatches(res.matches as MatchedFixture[]);
      const { identified, matched, unmatched } = res.summary;
      if (identified === 0) {
        toast.error("No plumbing fixtures recognized", {
          description: "Try a clearer photo of a sink, faucet, bathtub, shower, or toilet.",
        });
      } else {
        toast.success(`Identified ${identified} fixture${identified === 1 ? "" : "s"}`, {
          description: matched > 0
            ? `${matched} matched to our catalog${unmatched > 0 ? `, ${unmatched} need review` : ""}`
            : "No exact matches found — browse our catalog for similar items",
        });
      }
    },
    onError: (err) => {
      toast.error("Couldn't analyze the image", { description: err.message });
    },
  });

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image is too large", { description: "Max 8MB. Try a smaller photo." });
      return;
    }
    const url = await readFileAsDataUrl(file);
    setPreview(url);
    setDataUrl(url);
    setFilename(file.name);
    setMatches(null);
  }

  function runIdentification() {
    if (!dataUrl) return;
    identifyMut.mutate({ imageDataUrl: dataUrl, filename: filename || undefined });
  }

  function removeMatch(idx: number) {
    setMatches((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  const matched = matches?.filter((m) => m.matched) ?? [];
  const unmatched = matches?.filter((m) => !m.matched) ?? [];

  function addToCart(match: MatchedFixture) {
    if (!match.product || !match.product.sellPrice) {
      toast.error("This product doesn't have pricing yet.");
      return;
    }
    const res = addItem({
      masterCode: match.product.pelicanCode || `PEL-${match.product.id}`,
      name: match.product.name,
      styleId: 0,
      styleLabel: match.product.category,
      distributorId: null,
      tier: "homeowner",
      unitPrice: match.product.sellPrice,
      qty: match.fixture?.quantity ?? 1,
      imageUrl: match.product.imageUrl ?? null,
      category: match.product.category,
    });
    if (res.ok) {
      toast.success(`Added ${match.product.name} to cart`, {
        action: { label: "View Cart", onClick: () => navigate("/cart") },
      });
    }
  }

  function addAllToCart() {
    let added = 0;
    for (const m of matched) {
      if (m.product && m.product.sellPrice) {
        const res = addItem({
          masterCode: m.product.pelicanCode || `PEL-${m.product.id}`,
          name: m.product.name,
          styleId: 0,
          styleLabel: m.product.category,
          distributorId: null,
          tier: "homeowner",
          unitPrice: m.product.sellPrice,
          qty: m.fixture?.quantity ?? 1,
          imageUrl: m.product.imageUrl ?? null,
          category: m.product.category,
        });
        if (res.ok) added++;
      }
    }
    if (added > 0) {
      toast.success(`Added ${added} item${added === 1 ? "" : "s"} to cart`, {
        action: { label: "View Cart", onClick: () => navigate("/cart") },
      });
    }
  }

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <Camera className="h-12 w-12 mx-auto mb-4 text-primary" />
        <h1 className="font-serif text-3xl font-bold mb-2">Fixture Photo Match</h1>
        <p className="text-muted-foreground mb-6">
          Sign in to upload a photo of a plumbing fixture and find matching products in our catalog.
        </p>
        <Button onClick={() => (window.location.href = getLoginUrl())}>Sign in to continue</Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold flex items-center gap-2">
          <Camera className="h-7 w-7 text-primary" />
          Fixture Photo Match
        </h1>
        <p className="text-muted-foreground mt-1">
          Snap a photo of any plumbing fixture — sink, faucet, bathtub, shower, or toilet — and
          we'll find matching products from our Pelican catalog.
        </p>
      </div>

      {/* Upload */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            1. Upload a fixture photo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0])}
          />
          {!preview ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center justify-center gap-3 hover:border-primary/60 hover:bg-muted/40 transition-colors"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Take a photo or choose from gallery (JPG/PNG, max 8MB)
              </span>
              <span className="text-xs text-muted-foreground">
                Works best with clear, well-lit photos of individual fixtures
              </span>
            </button>
          ) : (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border bg-muted/30">
                <img src={preview} alt="Uploaded fixture" className="max-h-80 w-full object-contain" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => fileRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-1.5" /> Choose another
                </Button>
                <Button onClick={runIdentification} disabled={identifyMut.isPending}>
                  {identifyMut.isPending ? (
                    <>
                      <Spinner className="h-4 w-4 mr-1.5" /> Identifying…
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-1.5" /> Find matching products
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {matches && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>2. Matching products</span>
              <span className="text-sm font-normal text-muted-foreground">
                {matched.length} matched · {unmatched.length} unmatched
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {matched.length > 0 && (
              <div className="space-y-3">
                {matched.map((m, i) => (
                  <div
                    key={`match-${i}`}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    {m.product?.imageUrl && (
                      <img
                        src={m.product.imageUrl}
                        alt={m.product.name}
                        className="h-16 w-16 rounded-md object-contain bg-muted/30 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        <span className="font-medium text-sm truncate">
                          {m.product?.name || "Unknown"}
                        </span>
                        {confidenceBadge(m.confidence)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {m.fixture && (
                          <span className="mr-2">
                            Identified as: {fixtureTypeLabel(m.fixture.type)}
                          </span>
                        )}
                        {m.product?.subCategory && (
                          <span>· {m.product.subCategory}</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 italic">
                        {m.reason}
                      </div>
                      {m.product?.sellPrice && (
                        <div className="text-sm font-semibold mt-1">
                          ${m.product.sellPrice.toFixed(2)}
                          {m.fixture && m.fixture.quantity > 1 && (
                            <span className="text-xs font-normal text-muted-foreground ml-1">
                              × {m.fixture.quantity}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" onClick={() => addToCart(m)}>
                        <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMatch(matches.indexOf(m))}
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unmatched.length > 0 && (
              <div className="space-y-2 mt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                  No exact match found — browse our catalog for similar items
                </div>
                {unmatched.map((m, i) => (
                  <div
                    key={`unmatched-${i}`}
                    className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">
                        {m.fixture ? fixtureTypeLabel(m.fixture.type) : "Unknown fixture"}
                      </span>
                      {m.fixture && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {m.fixture.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground italic mt-0.5">{m.reason}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/plumbers-choice")}
                    >
                      Browse catalog
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMatch(matches.indexOf(m))}
                      aria-label="Dismiss"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {matched.length === 0 && unmatched.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No fixtures detected. Try a clearer photo.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add all to cart */}
      {matched.length > 1 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Add all {matched.length} matched fixtures to your cart at once
              </p>
              <Button onClick={addAllToCart}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add all to cart
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
