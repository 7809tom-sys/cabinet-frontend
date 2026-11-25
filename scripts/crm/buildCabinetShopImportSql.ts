// Builds the TiDB import SQL for one affiliate library "Cabinet Shops in
// <State>" CSV, using the same row rules as the CRM "Upload shops" button
// (shared/crmCabinetShopImport.ts). Writes SQL to stdout; runs nothing.
//
//   npx tsx scripts/crm/buildCabinetShopImportSql.ts <file.csv> <marker> <defaultState> "<source doc>" > docs/sql/NNNN_x.tidb.sql
import { readFileSync } from "node:fs";
import { parseCsvRecords } from "../../shared/crmCustomerListImport";
import {
  guessCabinetShopColumnMapping,
  mapCabinetShopRows,
  planCabinetShopImport,
  shopWebsiteKey,
} from "../../shared/crmCabinetShopImport";

const [file, marker, defaultState, sourceDoc] = process.argv.slice(2);
if (!file || !marker || !defaultState || !sourceDoc) throw new Error("usage: <file.csv> <marker> <defaultState> <sourceDoc>");

const records = parseCsvRecords(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const [header, ...body] = records;
const rows = mapCabinetShopRows(body, guessCabinetShopColumnMapping((header ?? []).map((h) => String(h ?? ""))));
const plan = planCabinetShopImport(rows, [], { marker, sourceDoc, defaultState });

const q = (value: string | null) => (value == null ? "NULL" : `'${value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\r?\n/g, "\\n")}'`);
const BATCH = 100;
const out: string[] = [];
const states = plan.byState.map((s) => `${s.state} ${s.toImport}`).join(", ");
out.push(
  `-- TiDB SQL editor. NOT RUN. Add-only, safe to run twice.`,
  `-- Cabinet shops from the affiliate library list "${sourceDoc}" -> house Sales CRM.`,
  `-- ${plan.toInsert.length} shops (${states}). Each becomes a house CRM contact: affiliateId NULL,`,
  `-- ownerUserId NULL (master/house, same as the distributor import), stage new, priority medium,`,
  `-- source manual, company '${"Cabinet shop prospect"}', notes starting with the marker ${marker}.`,
  `-- They appear under CRM -> Cabinet Shops (master only). No site scores are written unless the`,
  `-- list has them, so cards show "not measured / not assessed" until a shop is scouted.`,
  `-- Rows left out by the builder: ${plan.skipped.length} (${plan.skipped.map((s) => s.reason).join(", ") || "none"}); ${plan.duplicates.length} in-file duplicates (same name+state or same website).`,
  `-- A shop is skipped when a house cabinet shop row with the same name and state, or the same`,
  `-- website, is already in the CRM. Nothing is updated or deleted.`,
  `-- Run order: block 0 (read-only preview), blocks 1-${Math.ceil(plan.toInsert.length / BATCH)} (inserts, in order), last block (read-only verify).`,
  ``,
  `USE cabinet_dealz;`,
  ``,
  `-- 0. Preview (read-only): cabinet shop rows already in the house CRM, by state.`,
  `SELECT LEFT(SUBSTRING_INDEX(notes, 'State: ', -1), 2) AS state, COUNT(*) AS alreadyInCrm`,
  `FROM cabinet_dealz.crm_deals`,
  `WHERE affiliateId IS NULL AND (company LIKE 'Cabinet shop prospect%' OR notes LIKE '%cabinet_shop_list_%')`,
  `GROUP BY state;`,
  ``,
);
for (let i = 0; i < plan.toInsert.length; i += BATCH) {
  const chunk = plan.toInsert.slice(i, i + BATCH);
  out.push(`-- ${i / BATCH + 1}. Insert shops ${i + 1}-${i + chunk.length}.`);
  out.push(`INSERT INTO cabinet_dealz.crm_deals (affiliateId, ownerUserId, title, stage, priority, contactName, contactPhone, contactEmail, company, location, source, notes)`);
  out.push(`SELECT NULL, NULL, v.title, 'new', 'medium', v.contactName, v.contactPhone, v.contactEmail, v.company, v.location, 'manual', v.notes`);
  out.push(`FROM (`);
  chunk.forEach((deal, j) => {
    const host = shopWebsiteKey(/\bWebsite:\s*(\S+)/.exec(deal.notes)?.[1]);
    const cols = [
      `${q(deal.title)} AS title`, `${q(deal.contactName)} AS contactName`, `${q(deal.contactPhone)} AS contactPhone`,
      `${q(deal.contactEmail)} AS contactEmail`, `${q(deal.company)} AS company`, `${q(deal.location)} AS location`,
      `${q(deal.state)} AS state`, `${q(host)} AS siteHost`, `${q(deal.notes)} AS notes`,
    ];
    out.push(`  ${j === 0 ? "SELECT" : "UNION ALL SELECT"} ${cols.join(", ")}`);
  });
  out.push(`) AS v`);
  out.push(`WHERE NOT EXISTS (`);
  out.push(`  SELECT 1 FROM cabinet_dealz.crm_deals d`);
  out.push(`  WHERE d.affiliateId IS NULL`);
  out.push(`    AND (d.company LIKE 'Cabinet shop prospect%' OR d.notes LIKE '%cabinet_shop_list_%')`);
  out.push(`    AND (`);
  out.push(`      (LOWER(TRIM(d.contactName)) = LOWER(v.contactName) AND d.notes LIKE CONCAT('%State: ', v.state, '%'))`);
  out.push(`      OR (v.siteHost IS NOT NULL AND (d.notes LIKE CONCAT('%://', v.siteHost, '/%') OR d.notes LIKE CONCAT('%://www.', v.siteHost, '/%')))`);
  out.push(`    )`);
  out.push(`);`);
  out.push(``);
}
out.push(
  `-- Verify (read-only): rows from this list by state. Expected after the inserts: ${states}`,
  `-- (minus any shop that was already in the CRM).`,
  `SELECT LEFT(SUBSTRING_INDEX(notes, 'State: ', -1), 2) AS state, COUNT(*) AS shops,`,
  `       SUM(notes LIKE '%Website: http%') AS withWebsite, SUM(contactPhone IS NOT NULL) AS withPhone`,
  `FROM cabinet_dealz.crm_deals`,
  `WHERE affiliateId IS NULL AND notes LIKE '%${marker}%'`,
  `GROUP BY state;`,
  ``,
);
process.stdout.write(out.join("\n"));
process.stderr.write(JSON.stringify({ toInsert: plan.toInsert.length, byState: plan.byState, skipped: plan.skipped, duplicates: plan.duplicates }, null, 1));
