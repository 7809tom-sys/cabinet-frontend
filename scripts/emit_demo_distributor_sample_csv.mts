// Writes client/public/demo/distributor-catalog-sample.csv: a sample price
// list for the demo spreadsheet import. Codes, sizes and groups come from the
// demo catalog (derived from the real catalog snapshots); prices are the demo
// placeholder prices. Run: npx tsx scripts/emit_demo_distributor_sample_csv.mts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEMO_LINES, DEMO_LINE_DOOR_STYLES, productsForLine } from "../client/src/lib/demoDistributor";
import { SAMPLE_CSV_CODES, SAMPLE_CSV_COLUMNS, toCsvLine } from "../client/src/lib/demoCatalogImport";

const COLORS: Record<string, string> = { "white-shaker": "White", "gray-shaker": "Gray", "raised-panel": "White" };
const lines = [SAMPLE_CSV_COLUMNS.join(",")];
for (const line of DEMO_LINES) {
  const style = DEMO_LINE_DOOR_STYLES[line.id];
  const products = new Map(productsForLine(line.id).map((p) => [p.sku, p]));
  for (const code of SAMPLE_CSV_CODES) {
    const p = products.get(code);
    if (!p) throw new Error(`sample code ${code} is not in the demo catalog`);
    lines.push(toCsvLine([line.name, style.styleName, style.styleCode, COLORS[line.id], p.sku, p.name, p.widthIn ?? "", p.heightIn ?? "", p.depthIn ?? "", p.group, p.category, (p.priceCents / 100).toFixed(2)]));
  }
}
const out = resolve(import.meta.dirname, "../client/public/demo/distributor-catalog-sample.csv");
writeFileSync(out, lines.join("\n") + "\n");
console.log(`wrote ${lines.length - 1} rows to ${out}`);
