import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  KBIS_BOOTH_COPY_LINES,
  KBIS_BOOTH_DOCUMENTS,
  KBIS_BOOTH_FEATURED_IMAGE,
  KBIS_BOOTH_FOLDER,
  KBIS_BOOTH_IMAGES,
  formatAssetSize,
  isBoothDocumentUrl,
  isBoothImageUrl,
} from "./kbisBoothAssets";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const sql = read("docs/sql/0249_kbis_2027_booth_assets.tidb.sql");
const panel = read("client/src/components/affiliate/KbisBoothAssetsPanel.tsx");
const hub = read("client/src/components/affiliate/AffiliateMarketingHub.tsx");

describe("KBIS 2027 booth asset manifest", () => {
  it("ships four concept renderings and marks the closets booth as the featured one", () => {
    expect(KBIS_BOOTH_IMAGES).toHaveLength(4);
    expect(KBIS_BOOTH_FEATURED_IMAGE.file).toBe("cabinetdealz-kbis-booth-closets.jpg");
    expect(KBIS_BOOTH_IMAGES.filter((image) => image.featured)).toHaveLength(1);
    for (const image of KBIS_BOOTH_IMAGES) expect(image.conceptRendering).toBe(true);
  });

  it("points every file at one that exists in the public folder", () => {
    for (const image of KBIS_BOOTH_IMAGES) {
      expect(image.url).toBe(`/marketing/kbis-2027/${image.file}`);
      expect(existsSync(resolve(root, "client/public", image.url.slice(1)))).toBe(true);
    }
    for (const document of KBIS_BOOTH_DOCUMENTS) {
      expect(document.url).toBe(`/marketing/kbis-2027/${document.file}`);
      expect(existsSync(resolve(root, "client/public", document.url.slice(1)))).toBe(true);
    }
  });

  it("keeps a static file extension so the SPA rewrite does not swallow the path", () => {
    const vercel = JSON.parse(read("vercel.json"));
    expect(vercel.rewrites.at(-1).source).toBe("/:path((?!assets/|api/|manus-storage/).*)");
    expect(vercel.rewrites.some((rule: { source: string }) => rule.source === "/store/:path*")).toBe(true);
    for (const image of KBIS_BOOTH_IMAGES) expect(isBoothImageUrl(image.url)).toBe(true);
    for (const document of KBIS_BOOTH_DOCUMENTS) {
      expect(isBoothDocumentUrl(document.url)).toBe(true);
      expect(isBoothImageUrl(document.url)).toBe(false);
    }
    expect(isBoothImageUrl("https://example.test/landing")).toBe(false);
    expect(isBoothDocumentUrl("https://example.test/landing")).toBe(false);
  });

  it("carries the three taglines the booth is printed with", () => {
    const texts = KBIS_BOOTH_COPY_LINES.map((line) => line.text);
    expect(texts).toContain("Be an affiliate. Be the face of Cabinetdealz.");
    expect(texts).toContain("Cabinetdealz purchasing power and technology for your local influence.");
    expect(texts).toContain(
      "Cabinetdealz covers closets the same way as kitchens: design, quote, order, all in one, with the same white-label affiliate model.",
    );
  });

  it("marks every image and the deck supplier-ready", () => {
    for (const image of KBIS_BOOTH_IMAGES) expect(image.supplierReady).toBe(true);
    for (const document of KBIS_BOOTH_DOCUMENTS) expect(document.supplierReady).toBe(true);
  });

  it("describes the deck as the 9-slide opportunity deck and reports its size", () => {
    const [deck] = KBIS_BOOTH_DOCUMENTS;
    expect(KBIS_BOOTH_DOCUMENTS).toHaveLength(1);
    expect(deck.title).toBe("KBIS 2027 Opportunity Deck");
    expect(deck.mimeType).toBe("application/pdf");
    expect(deck.pageCount).toBe(9);
    expect(formatAssetSize(deck.sizeBytes)).toBe("439 KB");
    expect(formatAssetSize(974508)).toBe("952 KB");
    expect(formatAssetSize(0)).toBe("—");
  });
});

describe("KBIS 2027 booth SQL the owner runs", () => {
  it("writes only to the two libraries it belongs in, with every table prefixed", () => {
    expect(sql).toContain("INSERT INTO cabinet_dealz.media_images");
    expect(sql).toContain("INSERT INTO cabinet_dealz.affiliate_resources");
    expect(sql).not.toMatch(/\bAS (count|order|key|value|status|table|type)\b/i);
    expect(sql).not.toMatch(/statement-breakpoint/);
    const writes = sql.match(/^\s*(INSERT INTO|UPDATE|DELETE FROM|ALTER TABLE|CREATE TABLE)\s+\S+/gim) ?? [];
    expect(writes).toHaveLength(13);
    for (const write of writes) expect(write).toMatch(/^(INSERT INTO|ALTER TABLE|CREATE TABLE) cabinet_dealz\./);
  });

  it("keeps one statement per numbered block and ends with a semicolon", () => {
    const blocks = sql.split(/\n-- \d+\./).slice(1);
    expect(blocks.length).toBe(19);
    for (const block of blocks) {
      const statements = block
        .split(";")
        .map((part) => part.replace(/--[^\n]*/g, "").trim())
        .filter(Boolean);
      expect(statements).toHaveLength(1);
    }
    expect(sql.trimEnd().endsWith(";")).toBe(true);
  });

  it("registers the same paths the manifest serves and flags them supplier-ready", () => {
    for (const image of KBIS_BOOTH_IMAGES) {
      expect(sql).toContain(image.url);
      expect(sql).toContain(image.file);
    }
    for (const document of KBIS_BOOTH_DOCUMENTS) {
      expect(sql).toContain(document.url);
      expect(sql).toContain(document.file);
    }
    expect(sql).toContain(`'${KBIS_BOOTH_FOLDER}'`);
    expect(sql).toContain("'kbis-2027-booth'");
    expect(sql.match(/"conceptRendering": true/g)).toHaveLength(KBIS_BOOTH_IMAGES.length);
    expect(sql.match(/"supplierReady": true/g)).toHaveLength(KBIS_BOOTH_IMAGES.length + 4);
    for (const line of KBIS_BOOTH_COPY_LINES) expect(sql).toContain(line.text.replace(/'/g, "''"));
    expect(sql).toContain("'KBIS 2027 Opportunity Deck'");
  });

  it("is re-runnable: every insert is guarded by NOT EXISTS", () => {
    const inserts = sql.match(/INSERT INTO cabinet_dealz\.\w+/g) ?? [];
    const guards = sql.match(/WHERE NOT EXISTS \(SELECT 1 FROM/g) ?? [];
    expect(inserts).toHaveLength(13);
    expect(guards).toHaveLength(inserts.length);
    expect(sql).not.toMatch(/\bDROP\b|\bTRUNCATE\b/);
  });

  it("sets no settings, credentials, or DNS rows", () => {
    expect(sql).not.toMatch(/password|secret|api_?key|token|dns|nameserver/i);
  });
});

describe("KBIS 2027 booth placement on the site", () => {
  it("renders inside the affiliate Marketing Hub behind its own tab", () => {
    expect(hub).toContain('import { KbisBoothAssetsPanel } from "@/components/affiliate/KbisBoothAssetsPanel"');
    expect(hub).toContain('<TabsTrigger value="booth"');
    expect(hub).toContain('data-testid="kbis-booth-tab"');
    expect(hub).toContain('<TabsContent value="booth"');
    expect(hub).toContain("<KbisBoothAssetsPanel resources={items} query={query} />");
  });

  it("gives the deck a visible supplier-ready badge and a filterable tag", () => {
    expect(panel).toContain('data-testid="kbis-booth-documents"');
    expect(panel).toContain('data-testid="kbis-booth-document"');
    expect(panel).toContain('data-testid="kbis-booth-filters"');
    expect(panel).toContain('id: "supplier-ready"');
    expect(panel).toContain("KBIS_BOOTH_TAGS.supplierReady");
  });

  it("shows the featured image first and labels every image a concept rendering", () => {
    expect(panel).toContain('data-testid="kbis-booth-featured"');
    expect(panel).toContain("KBIS_BOOTH_TAGS.conceptRendering");
    expect(panel).toContain("(concept rendering)");
  });

  it("publishes the deck file byte-for-byte unchanged", () => {
    const [deck] = KBIS_BOOTH_DOCUMENTS;
    const published = readFileSync(resolve(root, "client/public", deck.url.slice(1)));
    expect(published.length).toBe(deck.sizeBytes);
    expect(createHash("md5").update(published).digest("hex")).toBe("07ec756ec42faefac7eac49b5e63dc89");
    expect(published.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
