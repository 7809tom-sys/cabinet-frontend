import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "docs/sql/0275_hiring_packet.tidb.sql"), "utf8");

describe("hiring packet SQL", () => {
  it("only adds tables and read-only checks", () => {
    const statements = sql
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("--"));
    for (const statement of statements) {
      expect(/^(CREATE TABLE|SELECT)\b/.test(statement)).toBe(true);
      expect(/^(DELETE|DROP|TRUNCATE|UPDATE|ALTER|INSERT)\b/i.test(statement)).toBe(false);
    }
    expect(sql).toContain("cabinet_dealz.hiring_packets");
    expect(sql).toContain("cabinet_dealz.hiring_packet_documents");
    expect(sql).toContain("cabinet_dealz.hiring_packet_files");
    expect(sql).toContain("cabinet_dealz.hiring_packet_signatures");
    expect(sql).toContain("cabinet_dealz.hiring_settings");
    expect(sql).toContain("hiring-packets/");
    expect(sql).toContain("provider VARCHAR(16) NOT NULL DEFAULT 'typed-name'");
    expect(sql).toContain("Run this after 0274");
    expect(sql).toContain("workerType VARCHAR(32) NOT NULL DEFAULT 'contractor_1099'");
    expect(sql).toContain("workState VARCHAR(2) NULL");
    expect(sql).toContain("w9");
    expect(sql).not.toContain("IF NOT EXISTS");
    expect(sql).not.toMatch(/^-- Hiring and onboarding packets\. File number 0274/m);
  });
});
