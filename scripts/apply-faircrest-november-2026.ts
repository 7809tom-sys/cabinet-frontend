/**
 * Write the November 2026 Faircrest reconciliation into the catalog fixture.
 *
 * Corrections land on the existing base, wall, and accessory rows. SKUs the
 * guide adds go in `november2026Additions`, which the kitchen designer and
 * storefront can read. Auto Design's pick lists stay the same set of codes,
 * so its layout rules are unchanged. Safe to re-run.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { reconcileFaircrestCatalog, type FaircrestCatalogRow } from "../shared/faircrestNovember2026";

const ADDITIONS = "november2026Additions";
const fixturePath = new URL("../client/src/lib/__fixtures__/autoDesignRealCatalog.json", import.meta.url);
const catalog = JSON.parse(readFileSync(fixturePath, "utf8")) as Record<string, Record<string, FaircrestCatalogRow[]>>;
const pack = catalog["330011"];
const pick = ["base", "wall", "accessory"] as const;
const existing = [...pick.flatMap((bucket) => pack[bucket] ?? []), ...(pack[ADDITIONS] ?? []), ...(pack.tall ?? [])];
const home = new Map<string, string>();
for (const bucket of pick) {
  for (const row of pack[bucket] ?? []) home.set(row.masterCode, bucket);
}
for (const row of pack[ADDITIONS] ?? []) home.set(row.masterCode, ADDITIONS);
for (const row of pack.tall ?? []) home.set(row.masterCode, ADDITIONS);

const report = reconcileFaircrestCatalog(existing);
const byCode = new Map(report.rows.map((row) => [row.masterCode, row]));
for (const bucket of pick) {
  pack[bucket] = (pack[bucket] ?? []).map((row) => byCode.get(row.masterCode) ?? row);
}
const additions: FaircrestCatalogRow[] = [];
for (const row of report.rows) {
  const bucket = home.get(row.masterCode);
  if (bucket === ADDITIONS || bucket == null) additions.push(byCode.get(row.masterCode) ?? row);
}
pack[ADDITIONS] = additions;
delete pack.tall;

writeFileSync(fixturePath, JSON.stringify(catalog));
console.log(JSON.stringify({
  added: report.added.length,
  corrected: report.corrected.length,
  unchanged: report.unchanged.length,
  absentFromGuide: report.absentFromGuide,
  unpricedAdded: report.unpricedAdded,
  notOfferedInRusticHickory: report.notOfferedInRusticHickory,
  vanityDifferences: report.vanityDifferences,
  additions: additions.length,
}, null, 2));
