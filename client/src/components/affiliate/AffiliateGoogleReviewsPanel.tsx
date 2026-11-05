import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Loader2, MapPin, ShieldCheck, Star, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  GOOGLE_MAPS_ATTRIBUTION_TEXT,
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_REVIEWS_SOURCES,
  googleReadReviewsUrl,
  googleWriteReviewUrl,
  parseGooglePlaceInput,
} from "@shared/googleReviews";
import { useGoogleReviewsQuery } from "@/lib/googleReviewsProcedures";

type Props = {
  affiliateId: number;
  slug: string;
  googlePlaceId: string | null;
  isAdmin?: boolean;
  onSaved?: () => void;
};

const PLACE_ID_FINDER_URL = "https://developers.google.com/maps/documentation/places/web-service/place-id";

type UpdateStorefrontMutation = {
  mutate: (input: Record<string, unknown>, options?: { onSuccess?: () => void; onError?: (error: { message: string }) => void }) => void;
  isPending: boolean;
};

/**
 * The affiliate's Google reviews setting.
 *
 * The affiliate pastes a Place ID (or a Maps link that already carries one).
 * Nothing else is collected: no key, no business name, no review text. What the
 * storefront shows always comes from Google at request time.
 */
export function AffiliateGoogleReviewsPanel({ affiliateId, slug, googlePlaceId, isAdmin, onSaved }: Props) {
  const savedPlaceId = googlePlaceId?.trim() || "";
  const [value, setValue] = useState(savedPlaceId);
  const [syncKey, setSyncKey] = useState(savedPlaceId);

  // Re-sync when the server value changes after a save or a store switch.
  useEffect(() => {
    if (savedPlaceId !== syncKey) {
      setSyncKey(savedPlaceId);
      setValue(savedPlaceId);
    }
  }, [savedPlaceId, syncKey]);

  const parsed = useMemo(() => parseGooglePlaceInput(value), [value]);
  const trimmed = value.trim();
  const isUnchanged = trimmed === savedPlaceId || (parsed.ok && parsed.placeId === savedPlaceId);
  const dirty = trimmed.length > 0 ? !isUnchanged : savedPlaceId.length > 0;

  const api = trpc as unknown as {
    useUtils: () => { affiliates: { invalidate: () => Promise<void> | void } };
    affiliates: {
      updateMyStorefront: { useMutation: (options?: {
        onSuccess?: () => void;
        onError?: (error: { message: string }) => void;
      }) => UpdateStorefrontMutation };
    };
  };
  const utils = api.useUtils();
  const save = api.affiliates.updateMyStorefront.useMutation({
    onSuccess: () => {
      toast.success("Google reviews setting saved", {
        description: "Your storefront picks up the change on the next visit.",
      });
      utils.affiliates.invalidate();
      onSaved?.();
    },
    onError: (error) => toast.error("Could not save", { description: error.message }),
  });

  // Probe the public payload so the panel can say whether reviews will render.
  // A store that saved a place ID but has no server key sees the reason here.
  const probe = useGoogleReviewsQuery(slug, Boolean(savedPlaceId));

  function persist(nextPlaceId: string | null) {
    save.mutate({ ...(isAdmin ? { affiliateId } : {}), googlePlaceId: nextPlaceId });
  }

  function handleSave() {
    if (!parsed.ok) {
      toast.error("Check the Place ID first", { description: parsed.message });
      return;
    }
    persist(parsed.placeId);
  }

  function handleClear() {
    setValue("");
    persist(null);
  }

  const status = probe.data;
  const statusLine = !savedPlaceId
    ? null
    : probe.isLoading
      ? { tone: "muted" as const, text: "Checking Google for this place…" }
      : status?.status === "ok"
        ? {
            tone: "ok" as const,
            text: status.reviews.length > 0
              ? `${status.reviews.length} Google ${status.reviews.length === 1 ? "review" : "reviews"} ready to show.`
              : "Place found. Google has no reviews for it yet, so the tab links to Google.",
          }
        : status?.status === "not-configured"
          ? {
              tone: "warn" as const,
              text: "Place saved. The API server still needs GOOGLE_PLACES_API_KEY before reviews can load — the tab links to Google until then.",
            }
          : status?.status === "unavailable"
            ? { tone: "warn" as const, text: status.message }
            : { tone: "muted" as const, text: "Place saved. The review procedure is not deployed yet." };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5" data-testid="affiliate-google-reviews-panel">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Star className="h-4 w-4 text-primary" /> Google reviews
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Show your real Google reviews on your storefront. Paste your Google Place ID — or a Google Maps
          link that already contains it — and we display what Google returns, exactly as Google returns it.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="google-place-id">Google Place ID or Maps link</Label>
        <Input
          id="google-place-id"
          value={value}
          placeholder="ChIJ… or https://www.google.com/maps/…?query_place_id=ChIJ…"
          spellCheck={false}
          autoComplete="off"
          aria-describedby="google-place-help"
          aria-invalid={trimmed.length > 0 && !parsed.ok}
          onChange={(event) => setValue(event.target.value)}
        />
        <p id="google-place-help" className="text-xs text-muted-foreground">
          Find your Place ID with Google's{" "}
          <a
            href={PLACE_ID_FINDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Place ID finder <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
          </a>
          . It starts with “ChIJ”. A link copied from the address bar of a Google Maps place page usually
          does not contain it — use the finder.
        </p>
      </div>

      {trimmed.length > 0 && !parsed.ok ? (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{parsed.message}</span>
        </p>
      ) : null}

      {parsed.ok ? (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <p className="font-medium text-foreground">
            Place ID: <span className="font-mono">{parsed.placeId}</span>
          </p>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={googleReadReviewsUrl(parsed.placeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              Check this place on Google Maps
            </a>
            <a
              href={googleWriteReviewUrl(parsed.placeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              See the “write a review” link
            </a>
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={save.isPending || !parsed.ok || !dirty}
        >
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {savedPlaceId ? "Update Google place" : "Save Google place"}
        </Button>
        {savedPlaceId ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleClear}
            disabled={save.isPending}
          >
            <Trash2 className="mr-1.5 h-4 w-4" /> Remove from storefront
          </Button>
        ) : null}
      </div>

      {statusLine ? (
        <p
          className={`flex items-start gap-2 rounded-md px-3 py-2 text-xs ${
            statusLine.tone === "ok"
              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
              : statusLine.tone === "warn"
                ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {statusLine.tone === "ok" ? <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{statusLine.text}</span>
        </p>
      ) : null}

      <div className="space-y-2 rounded-lg border border-border p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> How this stays within Google's rules
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Reviews come from Google's Places API at request time. We keep only your Place ID; review text is never stored or cached beyond Google's terms.</li>
          <li>Up to five reviews, in Google's own order. We never filter out low ratings, edit the text, or reorder the list.</li>
          <li>Each review keeps its author's name, photo, and profile link, and links to that review on Google Maps.</li>
          <li>The Google Maps attribution is shown next to the content, unmodified.</li>
          <li>We cannot offer a Google reviews “badge” widget for a storefront: Google's Customer Reviews badge is a Merchant Center add-on for your own checkout feedback, not a widget for third-party sites.</li>
          <li>Never offer a discount or gift for a review, and never ask only happy customers. Google and the FTC both treat that as fake or misleading content.</li>
        </ul>
        <p className="pt-1">
          Display rules:{" "}
          <a href={GOOGLE_REVIEWS_SOURCES.placesPolicies} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
            Places API policies
          </a>{" "}
          ·{" "}
          <a href={GOOGLE_REVIEWS_SOURCES.mapsServiceTerms} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
            Maps service terms
          </a>{" "}
          ·{" "}
          <a href={GOOGLE_REVIEWS_SOURCES.ugcPolicy} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
            Maps content policy
          </a>
        </p>
        <p className="pt-1 font-mono text-[11px] text-muted-foreground/80">
          Server field mask: {GOOGLE_PLACES_FIELD_MASK} · attribution: “{GOOGLE_MAPS_ATTRIBUTION_TEXT}”
        </p>
      </div>
    </div>
  );
}
