import {
  pelicanVanityFaucetMountLabel,
  pelicanVanityFaucetProfile,
  pelicanVanitySinkMountLabel,
  pelicanVanitySinkProfile,
} from "@shared/pelicanBathroomFixtures";

/**
 * The source facts under a bathroom sink or faucet card: what the Pelican
 * specification sheet says about the mount, the bowl count, and the drilling.
 * Purely informative — it never changes the SKU that gets ordered.
 */
export function VanitySinkFacts({ code }: { code?: string | null }) {
  const profile = pelicanVanitySinkProfile(code);
  if (!profile) return null;
  const dims = `${trim(profile.widthIn)}″ × ${trim(profile.depthIn)}″ × ${trim(profile.heightIn)}″`;
  const drilling = profile.faucetHoles == null
    ? "No deck holes in the china"
    : profile.faucetHoles === 1
      ? "1 pre-drilled faucet hole"
      : `3 pre-drilled holes${profile.faucetSpreadIn ? ` · ${profile.faucetSpreadIn}″ spread` : " · spread not published"}`;
  return (
    <span className="block space-y-0.5 text-[10px] leading-snug text-muted-foreground" data-testid="vanity-sink-facts">
      <span className="block">{pelicanVanitySinkMountLabel(profile)} · single bowl</span>
      <span className="block">{dims} · {drilling}</span>
    </span>
  );
}

export function VanityFaucetFacts({ code }: { code?: string | null }) {
  const profile = pelicanVanityFaucetProfile(code);
  if (!profile) return null;
  return (
    <span className="block space-y-0.5 text-[10px] leading-snug text-muted-foreground" data-testid="vanity-faucet-facts">
      <span className="block">{pelicanVanityFaucetMountLabel(profile)}</span>
      <span className="block">
        {trim(profile.overallHeightIn)}″ high · {trim(profile.spoutLengthIn)}″ spout reach
      </span>
    </span>
  );
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}
