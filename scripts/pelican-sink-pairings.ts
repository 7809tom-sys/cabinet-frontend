/**
 * Sink-to-cabinet pairing table, printed as Markdown for the PR body.
 *
 * The pairings are not hand-authored: each one is produced by the same function
 * the auto-designer calls (sinkBasePairing / sinkBaseForProduct), so this report
 * cannot drift from what the Designer actually does.
 *
 *   npx tsx scripts/pelican-sink-pairings.ts
 */
import pelicanRows from "../client/src/lib/__fixtures__/pelicanCatalogRows.json";
import realCatalog from "../client/src/lib/__fixtures__/autoDesignRealCatalog.json";
import { sinkBasePairing, sinkBaseForProduct, type AutoDesignSinkProduct } from "../client/src/lib/autoDesignSink";
import { verifiedPelicanSinkProfile } from "../client/src/lib/pelicanFixtureProfiles";
import type { DesignCabinet } from "../client/src/lib/design";

type Row = { id: number; pelicanCode: string; name: string; description?: string; subCategory: string; size?: string | null };
const rows = (pelicanRows as unknown as Row[]).filter((row) => row.subCategory === "Sinks");
const real = realCatalog as unknown as Record<string, { base: unknown[] }>;

function product(row: Row): AutoDesignSinkProduct {
  return {
    id: row.id,
    pelicanCode: row.pelicanCode,
    name: row.name,
    description: row.description ?? null,
    subCategory: row.subCategory,
    size: row.size ?? null,
  };
}

const lines: string[] = [];
lines.push("| Sink SKU | Mount | Verified size (W × D) | Pairs with | In line 330011 | In line 540005 |");
lines.push("| --- | --- | --- | --- | --- | --- |");
for (const row of rows) {
  const entry = product(row);
  const pairing = sinkBasePairing(entry);
  if (pairing.kind === "vanity") continue;
  const profile = verifiedPelicanSinkProfile(entry.pelicanCode);
  const base330011 = sinkBaseForProduct((real["330011"]!.base as DesignCabinet[]), entry);
  const base540005 = sinkBaseForProduct((real["540005"]!.base as DesignCabinet[]), entry);
  const label = pairing.kind === "farmhouse"
    ? `Matching farmhouse base at ${pairing.minimumWidthIn ?? "?"}″ or wider`
    : `Smallest straight sink base at ${pairing.minimumWidthIn ?? "?"}″ or wider`;
  const verified = profile ? `${profile.exteriorWidthIn}″ × ${profile.exteriorDepthIn}″` : "not published";
  lines.push(`| ${entry.pelicanCode} | ${pairing.kind} | ${verified} | ${label} | ${base330011?.masterCode ?? "no base"} | ${base540005?.masterCode ?? "no base"} |`);
}
console.log(lines.join("\n"));
