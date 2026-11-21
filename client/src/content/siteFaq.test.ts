import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FAQ_ENTRIES,
  FAQ_SEO,
  FAQ_SECTIONS,
  buildFaqPageJsonLd,
} from "./siteFaq";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("site FAQ content", () => {
  it("has unique questions, non-empty answers, and grouped sections", () => {
    expect(FAQ_SECTIONS.length).toBeGreaterThanOrEqual(8);
    expect(FAQ_ENTRIES.length).toBeGreaterThanOrEqual(30);
    const questions = FAQ_ENTRIES.map((entry) => entry.question);
    expect(new Set(questions).size).toBe(questions.length);
    for (const entry of FAQ_ENTRIES) {
      expect(entry.question.trim().length).toBeGreaterThan(8);
      expect(entry.answer.trim().length).toBeGreaterThan(40);
    }
  });

  it("covers the requested topic groups", () => {
    const ids = FAQ_SECTIONS.map((section) => section.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "designer",
        "ordering",
        "pricing",
        "affiliates",
        "shipping",
        "customization",
        "assembly",
        "returns",
        "contact",
      ]),
    );
  });

  it("uses a unique title, description, and canonical", () => {
    expect(FAQ_SEO.title).toContain("Kitchen Cabinet FAQ");
    expect(FAQ_SEO.title).toContain("CabinetDealz");
    expect(FAQ_SEO.title).not.toBe("CabinetDealz — Professional Cabinet Platform");
    expect(FAQ_SEO.description.length).toBeGreaterThan(80);
    expect(FAQ_SEO.canonical).toBe("https://www.cabinetdealz.com/faq");
  });

  it("builds FAQPage JSON-LD from the same answers", () => {
    const jsonLd = buildFaqPageJsonLd();
    expect(jsonLd["@type"]).toBe("FAQPage");
    expect(jsonLd.mainEntity).toHaveLength(FAQ_ENTRIES.length);
    expect(jsonLd.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: FAQ_ENTRIES[0].question,
    });
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toContain(FAQ_ENTRIES[0].answer);
  });

  it("keeps the no-JS faq.html in sync with the same questions, title, and JSON-LD", () => {
    const html = readFileSync(join(root, "client/public/faq.html"), "utf8");
    const esc = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    expect(html).toContain(`<title>${esc(FAQ_SEO.title)}</title>`);
    expect(html).toContain(`<meta name="description" content="${esc(FAQ_SEO.description)}"`);
    expect(html).toContain(`<link rel="canonical" href="${esc(FAQ_SEO.canonical)}"`);
    expect(html).toContain('"@type":"FAQPage"');
    for (const entry of FAQ_ENTRIES) {
      expect(html).toContain(entry.question);
      expect(html).toContain(entry.answer);
    }
    expect(html.toLowerCase()).not.toContain("aggregateRating");
  });
});

describe("vercel FAQ rewrite", () => {
  it("serves faq.html before the SPA catch-all", () => {
    const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
      rewrites: { source: string; destination: string }[];
    };
    const sources = vercel.rewrites.map((rule) => rule.source);
    const faqIndex = sources.indexOf("/faq");
    const catchAll = sources.findIndex((source) => source.startsWith("/:path"));
    expect(faqIndex).toBeGreaterThanOrEqual(0);
    expect(vercel.rewrites[faqIndex].destination).toBe("/faq.html");
    expect(catchAll).toBeGreaterThan(faqIndex);
  });
});
