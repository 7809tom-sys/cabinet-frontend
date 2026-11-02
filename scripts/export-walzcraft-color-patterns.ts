import { writeFileSync } from "node:fs";
import { WALZCRAFT_COLOR_PATTERNS, colorPatternsCsv } from "../shared/walzcraftColorPatterns";
const outDir = process.argv[2] ?? "/workspace/walz";
const by = new Map<string, typeof WALZCRAFT_COLOR_PATTERNS>();
for (const r of WALZCRAFT_COLOR_PATTERNS) by.set(r.distributor, [...(by.get(r.distributor) ?? []), r]);
for (const [dist, rows] of by) {
  const f = `${outDir}/ColorPatterns_${dist.replace(/\s+/g, "")}.csv`;
  writeFileSync(f, colorPatternsCsv(rows));
  console.log(f, rows.length);
}
