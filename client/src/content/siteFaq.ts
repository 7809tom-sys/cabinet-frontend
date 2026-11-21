import siteFaq from "./siteFaq.json";

export type FaqLink = { label: string; href: string };

export type FaqEntry = {
  question: string;
  answer: string;
  links?: FaqLink[];
};

export type FaqSection = {
  id: string;
  title: string;
  entries: FaqEntry[];
};

export const FAQ_SEO = {
  title: siteFaq.title,
  description: siteFaq.description,
  canonical: siteFaq.canonical,
  h1: siteFaq.h1,
  intro: siteFaq.intro,
} as const;

export const FAQ_SECTIONS: readonly FaqSection[] = siteFaq.sections;

/** Flattened question list, in page order, for JSON-LD and tests. */
export const FAQ_ENTRIES: readonly FaqEntry[] = FAQ_SECTIONS.flatMap(
  (section) => section.entries,
);

export function answerWithLinks(entry: FaqEntry, origin = "https://www.cabinetdealz.com"): string {
  if (!entry.links?.length) return entry.answer;
  const seen = new Set<string>();
  const extras: string[] = [];
  for (const link of entry.links) {
    const href = link.href.startsWith("http") ? link.href : `${origin}${link.href}`;
    if (seen.has(href)) continue;
    seen.add(href);
    extras.push(`${link.label}: ${href}`);
  }
  return extras.length ? `${entry.answer} ${extras.join(" ")}` : entry.answer;
}

export function buildFaqPageJsonLd(origin = "https://www.cabinetdealz.com") {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ENTRIES.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerWithLinks(entry, origin),
      },
    })),
  };
}
