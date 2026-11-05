import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Repo-wide guard for the affiliate Marketing Hub dead links. These addresses
 * were removed from the app but kept resurfacing in older panels and copy, so a
 * source scan is the only way to catch a reintroduction.
 *
 * Tests are excluded: a regression test has to spell out the dead address it
 * forbids, which would otherwise match itself.
 */
const ROOT = process.cwd();
const SCAN_DIRS = ["client", "shared", "scripts", "docs", "data"];
const SCAN_FILES = ["package.json", "vercel.json", "vite.config.ts", "README.md", "DEPLOY.md"];
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "test-artifacts", ".pnpm-store"]);
const TEXT_FILE = /\.(?:[cm]?[jt]sx?|json|md|css|html|svg|txt|yml|yaml)$/;
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SELF = "client/src/lib/affiliateLinkHealth.test.ts";

type Hit = { file: string; line: number; text: string };

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      walk(join(dir, entry.name), files);
    } else if (TEXT_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

function sourceFiles(): string[] {
  return [
    ...SCAN_DIRS.flatMap((dir) => {
      const absolute = join(ROOT, dir);
      return statSync(absolute, { throwIfNoEntry: false })?.isDirectory() ? walk(absolute) : [];
    }),
    ...SCAN_FILES.map((file) => join(ROOT, file)).filter((file) => statSync(file, { throwIfNoEntry: false })?.isFile()),
  ].filter((file) => relative(ROOT, file) !== SELF);
}

function scan(pattern: RegExp): Hit[] {
  return sourceFiles().flatMap((file) =>
    readFileSync(file, "utf8")
      .split("\n")
      .map((text, index) => ({ file: relative(ROOT, file), line: index + 1, text }))
      .filter((row) => pattern.test(row.text)),
  );
}

describe("affiliate link health", () => {
  it("never links the unhashed Welcome Guide PDF key, which returns 404", () => {
    expect(scan(/Cabinet-Dealz-Affiliate-Welcome-Guide\.pdf/)).toEqual([]);
  });

  it("keeps the hashed Welcome Guide PDF as the only published address", () => {
    const hits = scan(/Cabinet-Dealz-Affiliate-Welcome-Guide_f17152cc\.pdf/);
    expect(hits.map((hit) => hit.file)).toContain("client/src/lib/affiliateWelcomeGuide.ts");
    for (const hit of hits) {
      expect(hit.text, `${hit.file}:${hit.line}`).toContain("_f17152cc.pdf");
      expect(hit.text).not.toMatch(/Guide\.pdf/);
    }
  });

  it("has no references to the retired YouTube handles or Houzz handle", () => {
    expect(scan(/kitchenbathdesigntv/i)).toEqual([]);
    expect(scan(/salesinsightslab/i)).toEqual([]);
    expect(scan(/youtube\.com\/@Houzz/i)).toEqual([]);
  });

  it("builds every affiliate referral link from the canonical storefront order path", () => {
    expect(scan(/origin\}\?ref=\$\{/)).toEqual([]);
  });
});
