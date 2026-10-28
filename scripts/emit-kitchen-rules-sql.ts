import { writeFileSync } from "node:fs";
import { KITCHEN_RULE_SEED } from "../client/src/lib/kitchenRulesCatalog";

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

const rows = KITCHEN_RULE_SEED.map((rule) => `(${[
  sqlString(rule.ruleCode),
  sqlString(rule.category),
  sqlString(rule.title),
  sqlString(rule.ruleDescription),
  sqlString(JSON.stringify(rule.parameters ?? {})),
  sqlString(rule.enforcementKind),
  sqlString(rule.sourceText),
  sqlString(rule.implementationStatus),
  "1",
  rule.notesText == null ? "NULL" : sqlString(rule.notesText),
  rule.readsParameters ? "1" : "0",
].join(", ")})`);

const sql = `-- TiDB SQL editor version. Numbered 0233. Run after 0232.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: CREATE TABLE IF NOT EXISTS and INSERT IGNORE.

-- 1
CREATE TABLE IF NOT EXISTS cabinet_dealz.kitchen_rules (
  id INT NOT NULL AUTO_INCREMENT,
  ruleCode VARCHAR(80) NOT NULL,
  category VARCHAR(80) NOT NULL,
  title VARCHAR(255) NOT NULL,
  ruleDescription TEXT NOT NULL,
  parameterJson TEXT NOT NULL,
  enforcementKind VARCHAR(32) NOT NULL,
  sourceText VARCHAR(512) NOT NULL,
  implementationStatus VARCHAR(32) NOT NULL,
  enabledFlag TINYINT(1) NOT NULL DEFAULT 1,
  notesText TEXT NULL,
  readsParameters TINYINT(1) NOT NULL DEFAULT 0,
  updatedByName VARCHAR(255) NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY kitchen_rules_rule_code_uq (ruleCode)
);

-- 2
INSERT IGNORE INTO cabinet_dealz.kitchen_rules (
  ruleCode,
  category,
  title,
  ruleDescription,
  parameterJson,
  enforcementKind,
  sourceText,
  implementationStatus,
  enabledFlag,
  notesText,
  readsParameters
) VALUES
${rows.join(",\n")};
`;

const targets = process.argv.slice(2);
if (!targets.length) throw new Error("Pass output paths");
for (const target of targets) writeFileSync(target, sql);
console.log(`Wrote ${KITCHEN_RULE_SEED.length} rules to ${targets.join(", ")}`);
