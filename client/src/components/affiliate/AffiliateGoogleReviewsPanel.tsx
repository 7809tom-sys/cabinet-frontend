import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  ExternalLink,
  KeyRound,
  Loader2,
  MapPin,
  ShieldCheck,
  Star,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  GOOGLE_CREDENTIALS_HELP,
  GOOGLE_CREDENTIALS_LINKS,
  GOOGLE_MAPS_ATTRIBUTION_TEXT,
  GOOGLE_PLACES_FIELD_MASK,
  GOOGLE_REVIEWS_SOURCES,
  googleCredentialsSourceLabel,
  googleReadReviewsUrl,
  googleWriteReviewUrl,
  parseGooglePlaceInput,
  validateGoogleApiKeyInput,
  type GooglePlaceCredentialsStatus,
} from "@shared/googleReviews";
import { useGoogleReviewsQuery } from "@/lib/googleReviewsProcedures";
import {
  googleCredentialsPayload,
  googleCredentialsProceduresAvailable,
  useGoogleCredentialsQuery,
  useSaveGoogleCredentialsMutation,
} from "@/lib/googleReviewsCredentials";

type Props = {
  affiliateId: number;
  slug: string;
  googlePlaceId: string | null;
  /** Saved key state from the affiliate record; keys themselves are never fetched. */
  credentialHints?: {
    hasPlacesApiKey?: boolean;
    hasMapsEmbedApiKey?: boolean;
  };
  isAdmin?: boolean;
  onSaved?: () => void;
};

const EMPTY_STATUS: GooglePlaceCredentialsStatus = {
  placeId: null,
  hasPlacesApiKey: false,
  hasMapsEmbedApiKey: false,
  placesApiKeyUpdatedAt: null,
  mapsEmbedApiKeyUpdatedAt: null,
  credentialsSource: "none",
};

/**
 * Google reviews, connected with the AFFILIATE'S OWN Google account.
 *
 * Reviews are read with the affiliate's own Google Cloud project: their Place ID
 * and their own Places API key. The platform key is only a fallback for a store
 * that has connected nothing, which is stated in the status line rather than
 * hidden.
 *
 * The keys are write-only. The affiliate types one, it goes straight to the
 * server over tRPC, the field is cleared and the server answers with booleans.
 * Nothing is read back and nothing is kept in this browser.
 */
export function AffiliateGoogleReviewsPanel({
  affiliateId,
  slug,
  googlePlaceId,
  credentialHints,
  isAdmin,
  onSaved,
}: Props) {
  const savedPlaceId = googlePlaceId?.trim() || "";
  const proceduresAvailable = googleCredentialsProceduresAvailable();

  const [placeValue, setPlaceValue] = useState(savedPlaceId);
  const [syncKey, setSyncKey] = useState(savedPlaceId);
  const [placesKey, setPlacesKey] = useState("");
  const [embedKey, setEmbedKey] = useState("");
  const [replacePlacesKey, setReplacePlacesKey] = useState(false);
  const [replaceEmbedKey, setReplaceEmbedKey] = useState(false);
  const [showHelp, setShowHelp] = useState<"placeId" | "placesApiKey" | "mapsEmbedApiKey" | null>(null);

  // Re-sync the place field when the server value changes after a save or a
  // store switch. The key fields are deliberately NOT re-synced from the server:
  // there is nothing to sync, because a key never comes back.
  useEffect(() => {
    if (savedPlaceId !== syncKey) {
      setSyncKey(savedPlaceId);
      setPlaceValue(savedPlaceId);
    }
  }, [savedPlaceId, syncKey]);

  const credentialsQuery = useGoogleCredentialsQuery(affiliateId, proceduresAvailable);
  const status: GooglePlaceCredentialsStatus = {
    ...EMPTY_STATUS,
    ...(credentialsQuery.data ?? {}),
    // The affiliate record is the fallback source of truth until the status
    // procedure is deployed, and it only ever carries booleans.
    hasPlacesApiKey: credentialsQuery.data?.hasPlacesApiKey ?? Boolean(credentialHints?.hasPlacesApiKey),
    hasMapsEmbedApiKey: credentialsQuery.data?.hasMapsEmbedApiKey ?? Boolean(credentialHints?.hasMapsEmbedApiKey),
    placeId: credentialsQuery.data?.placeId ?? (savedPlaceId || null),
    credentialsSource:
      credentialsQuery.data?.credentialsSource
      ?? (credentialHints?.hasPlacesApiKey ? "affiliate" : savedPlaceId ? "platform" : "none"),
  };

  const saveCredentials = useSaveGoogleCredentialsMutation({
    onSuccess: (next) => {
      // The typed key is gone from state the moment the server accepts it.
      setPlacesKey("");
      setEmbedKey("");
      setReplacePlacesKey(false);
      setReplaceEmbedKey(false);
      toast.success("Google reviews connected", {
        description: next.hasPlacesApiKey
          ? "Your Google key is saved. Your storefront picks it up on the next visit."
          : "Saved. Add your Places API key so reviews can load.",
      });
      void credentialsQuery.refetch?.();
      onSaved?.();
    },
    onError: (error) => toast.error("Could not save Google keys", { description: error.message }),
  });

  const parsed = useMemo(() => parseGooglePlaceInput(placeValue), [placeValue]);
  const trimmedPlace = placeValue.trim();
  const placeUnchanged =
    trimmedPlace === savedPlaceId || (parsed.ok && parsed.placeId === savedPlaceId);
  const placeDirty = trimmedPlace.length > 0 ? !placeUnchanged : savedPlaceId.length > 0;

  const placesKeyCheck = useMemo(
    () => validateGoogleApiKeyInput(placesKey, "Your Places API key"),
    [placesKey],
  );
  const embedKeyCheck = useMemo(
    () => validateGoogleApiKeyInput(embedKey, "Your Maps Embed key"),
    [embedKey],
  );
  const keysDirty =
    (placesKeyCheck.ok && placesKeyCheck.key.length > 0)
    || (embedKeyCheck.ok && embedKeyCheck.key.length > 0);
  const anyDirty = placeDirty || keysDirty;
  const invalid =
    (trimmedPlace.length > 0 && !parsed.ok) || !placesKeyCheck.ok || !embedKeyCheck.ok;
  const saving = Boolean(saveCredentials?.isPending);

  // Probe the public payload so the panel can say whether the tab will render.
  const probe = useGoogleReviewsQuery(slug, Boolean(savedPlaceId));

  function handleSave() {
    if (trimmedPlace.length > 0 && !parsed.ok) {
      toast.error("Check the Place ID first", { description: parsed.message });
      return;
    }
    if (!placesKeyCheck.ok) {
      toast.error("Check your Places API key", { description: placesKeyCheck.message });
      return;
    }
    if (!embedKeyCheck.ok) {
      toast.error("Check your Maps Embed key", { description: embedKeyCheck.message });
      return;
    }
    if (!saveCredentials) {
      toast.error("Saving Google keys needs the API server update", {
        description: "The credential procedure is not deployed yet. Nothing was sent.",
      });
      return;
    }
    saveCredentials.mutate(
      googleCredentialsPayload({
        affiliateId: isAdmin ? affiliateId : undefined,
        placeId: parsed.ok ? parsed.placeId : savedPlaceId || null,
        placesApiKey: placesKeyCheck.ok ? placesKeyCheck.key : "",
        mapsEmbedApiKey: embedKeyCheck.ok ? embedKeyCheck.key : "",
      }),
    );
  }

  function handleRemoveKey(kind: "places" | "embed") {
    if (!saveCredentials) {
      toast.error("Removing a key needs the API server update");
      return;
    }
    saveCredentials.mutate(
      googleCredentialsPayload({
        affiliateId: isAdmin ? affiliateId : undefined,
        placeId: savedPlaceId || null,
        clearPlacesApiKey: kind === "places",
        clearMapsEmbedApiKey: kind === "embed",
      }),
    );
  }

  function handleRemovePlace() {
    setPlaceValue("");
    if (!saveCredentials) {
      toast.error("Removing the place needs the API server update");
      return;
    }
    saveCredentials.mutate(
      googleCredentialsPayload({ affiliateId: isAdmin ? affiliateId : undefined, placeId: null }),
    );
  }

  const statusLine = !savedPlaceId && !status.hasPlacesApiKey
    ? null
    : probe.isLoading
      ? { tone: "muted" as const, text: "Checking Google for this place…" }
      : probe.data?.status === "ok"
        ? {
            tone: "ok" as const,
            text: probe.data.reviews.length > 0
              ? `${probe.data.reviews.length} Google ${probe.data.reviews.length === 1 ? "review" : "reviews"} ready to show.`
              : "Place found. Google has no reviews for it yet, so the tab links to Google.",
          }
        : probe.data?.status === "unavailable"
          ? { tone: "warn" as const, text: probe.data.message }
          : savedPlaceId && !status.hasPlacesApiKey
            ? {
                tone: "warn" as const,
                text: status.credentialsSource === "platform"
                  ? "Place saved. No key of your own yet, so this store is using the platform's Google project as a fallback."
                  : "Place saved. Add your own Places API key so reviews can load.",
              }
            : { tone: "muted" as const, text: "Saved. Your storefront shows this on its next visit." };

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5" data-testid="affiliate-google-reviews-panel">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Star className="h-4 w-4 text-primary" /> Google reviews
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Show your own Google reviews on your storefront. Connect your Google account below — your Place
          ID and your own Google API key — and your storefront fills in with the reviews Google returns,
          exactly as Google returns them.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          These are <span className="font-medium">your</span> Google credentials, from your own Google
          account and your own Google Cloud billing. We only ever store the key so we can call Google for
          you, and we never show it back. Do not paste anyone else's key.
        </p>
      </div>

      {/* ── Place ID ─────────────────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="google-place-id">Your Google Place ID or Maps link</Label>
          <HelpToggle
            id="placeId"
            open={showHelp === "placeId"}
            onToggle={setShowHelp}
            label="Where do I find it?"
          />
        </div>
        <Input
          id="google-place-id"
          value={placeValue}
          placeholder="ChIJ… or https://www.google.com/maps/…?query_place_id=ChIJ…"
          spellCheck={false}
          autoComplete="off"
          aria-describedby="google-place-help"
          aria-invalid={trimmedPlace.length > 0 && !parsed.ok}
          onChange={(event) => setPlaceValue(event.target.value)}
        />
        <p id="google-place-help" className="text-xs text-muted-foreground">
          It starts with “ChIJ”. A link copied from the address bar of a Google Maps place page usually does
          not contain it — use the{" "}
          <a
            href={GOOGLE_CREDENTIALS_LINKS.placeIdFinder}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Place ID finder <ExternalLink className="inline h-3 w-3" aria-hidden="true" />
          </a>
          .
        </p>
        {showHelp === "placeId" ? (
          <StepList
            id="placeId"
            title={GOOGLE_CREDENTIALS_HELP.placeId.title}
            steps={GOOGLE_CREDENTIALS_HELP.placeId.steps}
            finderUrl={GOOGLE_CREDENTIALS_LINKS.placeIdFinder}
            finderLabel="Open the Place ID Finder"
          />
        ) : null}
        {trimmedPlace.length > 0 && !parsed.ok ? (
          <InlineWarn>{parsed.message}</InlineWarn>
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
      </div>

      {/* ── Keys (write-only) ────────────────────────────────────────────── */}
      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-start gap-2">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Your own Google API keys</p>
            <p className="text-xs text-muted-foreground">
              Write-only: once saved, a key is never shown again. Replace it by typing a new one, or remove
              it with the button beside it.
            </p>
          </div>
        </div>

        <WriteOnlyKeyField
          id="google-places-key"
          label="Places API key"
          required
          saved={status.hasPlacesApiKey}
          savedAt={status.placesApiKeyUpdatedAt}
          replacing={replacePlacesKey}
          value={placesKey}
          onStartReplace={() => {
            setReplacePlacesKey(true);
            setPlacesKey("");
          }}
          onCancelReplace={() => {
            setReplacePlacesKey(false);
            setPlacesKey("");
          }}
          onChange={setPlacesKey}
          onRemove={() => handleRemoveKey("places")}
          removeDisabled={saving || !status.hasPlacesApiKey}
          invalid={!placesKeyCheck.ok}
          error={placesKeyCheck.ok ? null : placesKeyCheck.message}
          helpOpen={showHelp === "placesApiKey"}
          onToggleHelp={() => setShowHelp(showHelp === "placesApiKey" ? null : "placesApiKey")}
          help={GOOGLE_CREDENTIALS_HELP.placesApiKey}
        />

        <WriteOnlyKeyField
          id="google-embed-key"
          label="Maps Embed key"
          saved={status.hasMapsEmbedApiKey}
          savedAt={status.mapsEmbedApiKeyUpdatedAt}
          replacing={replaceEmbedKey}
          value={embedKey}
          onStartReplace={() => {
            setReplaceEmbedKey(true);
            setEmbedKey("");
          }}
          onCancelReplace={() => {
            setReplaceEmbedKey(false);
            setEmbedKey("");
          }}
          onChange={setEmbedKey}
          onRemove={() => handleRemoveKey("embed")}
          removeDisabled={saving || !status.hasMapsEmbedApiKey}
          invalid={!embedKeyCheck.ok}
          error={embedKeyCheck.ok ? null : embedKeyCheck.message}
          helpOpen={showHelp === "mapsEmbedApiKey"}
          onToggleHelp={() => setShowHelp(showHelp === "mapsEmbedApiKey" ? null : "mapsEmbedApiKey")}
          help={GOOGLE_CREDENTIALS_HELP.mapsEmbedApiKey}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || invalid || !anyDirty}
          data-testid="google-reviews-save"
        >
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {savedPlaceId || status.hasPlacesApiKey ? "Save changes" : "Connect Google"}
        </Button>
        {savedPlaceId ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleRemovePlace}
            disabled={saving}
          >
            Remove place from storefront
          </Button>
        ) : null}
        {!proceduresAvailable ? (
          <span className="text-xs text-muted-foreground">
            Saving needs the API server update; the credential procedure is not deployed yet.
          </span>
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
          data-testid="google-reviews-status"
        >
          {statusLine.tone === "ok" ? (
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span>{statusLine.text}</span>
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{googleCredentialsSourceLabel(status.credentialsSource)}</p>

      <div className="space-y-2 rounded-lg border border-border p-4 text-xs leading-relaxed text-muted-foreground">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" /> How this stays within Google's rules
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>Reviews come from Google's Places API at request time. We keep only your Place ID and your own key; review text is never stored or cached beyond Google's terms.</li>
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

// ─── Small pieces ────────────────────────────────────────────────────────────

function InlineWarn({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

function HelpToggle({
  id,
  open,
  onToggle,
  label,
}: {
  id: string;
  open: boolean;
  onToggle: (next: "placeId" | "placesApiKey" | "mapsEmbedApiKey" | null) => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 gap-1 px-2 text-xs"
      aria-expanded={open}
      aria-controls={`google-help-${id}`}
      onClick={() => onToggle(open ? null : (id as "placeId" | "placesApiKey" | "mapsEmbedApiKey"))}
    >
      {label} <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
    </Button>
  );
}

function StepList({
  id,
  title,
  steps,
  finderUrl,
  finderLabel,
}: {
  id: string;
  title: string;
  steps: readonly string[];
  finderUrl: string;
  finderLabel: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed" id={`google-help-${id}`}>
      <p className="font-medium text-foreground">{title}</p>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <a
        href={finderUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
      >
        {finderLabel} <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}

function WriteOnlyKeyField({
  id,
  label,
  required,
  saved,
  savedAt,
  replacing,
  value,
  onStartReplace,
  onCancelReplace,
  onChange,
  onRemove,
  removeDisabled,
  invalid,
  error,
  helpOpen,
  onToggleHelp,
  help,
}: {
  id: string;
  label: string;
  required?: boolean;
  saved: boolean;
  savedAt: string | null;
  replacing: boolean;
  value: string;
  onStartReplace: () => void;
  onCancelReplace: () => void;
  onChange: (next: string) => void;
  onRemove: () => void;
  removeDisabled: boolean;
  invalid: boolean;
  error: string | null;
  helpOpen: boolean;
  onToggleHelp: () => void;
  help: { title: string; steps: readonly string[] };
}) {
  const showInput = !saved || replacing;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          <span className="ml-1 font-normal text-muted-foreground">
            {required ? "(required for reviews)" : "(optional — for the map)"}
          </span>
        </Label>
        <HelpToggle id={id} open={helpOpen} onToggle={() => onToggleHelp()} label="How to get this key" />
      </div>

      {saved && !replacing ? (
        <div className="flex flex-wrap items-center gap-2" data-testid={`${id}-saved`}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
            <Check className="h-3.5 w-3.5" aria-hidden="true" /> Key saved
          </span>
          {/* No masked value, no last four characters: there is nothing to show. */}
          {savedAt ? (
            <span className="text-xs text-muted-foreground">
              {new Date(savedAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
            </span>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={onStartReplace}>
            Replace
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={onRemove}
            disabled={removeDisabled}
          >
            Remove
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            id={id}
            type="password"
            value={value}
            placeholder="AIza… (39 characters)"
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            // Never let the browser or a password manager offer to save it.
            name={`google-${id}-${replacing ? "replace" : "new"}`}
            data-lpignore="true"
            data-1p-ignore="true"
            aria-invalid={invalid}
            aria-describedby={`${id}-help`}
            onChange={(event) => onChange(event.target.value)}
          />
          <p id={`${id}-help`} className="text-xs text-muted-foreground">
            Sent once to our server and never shown again. Pasting is the only way it is read — nothing on
            this page can display it afterwards.
          </p>
          {replacing ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancelReplace}>
              Cancel
            </Button>
          ) : null}
        </div>
      )}

      {invalid && showInput && error ? <InlineWarn>{error}</InlineWarn> : null}

      {helpOpen ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed" id={`google-help-${id}`}>
          <p className="font-medium text-foreground">{help.title}</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-muted-foreground">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <a href={GOOGLE_CREDENTIALS_LINKS.cloudConsole} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              Open Google Cloud Console <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a href={GOOGLE_CREDENTIALS_LINKS.credentials} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              Open Credentials <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a href={GOOGLE_CREDENTIALS_LINKS.billing} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
              Billing <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
