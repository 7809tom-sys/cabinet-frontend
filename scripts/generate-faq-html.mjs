#!/usr/bin/env node
/**
 * Writes client/public/faq.html from client/src/content/siteFaq.json so
 * crawlers receive real FAQ text without running JavaScript.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(
  readFileSync(join(root, "client/src/content/siteFaq.json"), "utf8"),
);
const origin = "https://www.cabinetdealz.com";

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function answerText(entry) {
  if (!entry.links?.length) return entry.answer;
  const extras = [];
  const seen = new Set();
  for (const link of entry.links) {
    const href = link.href.startsWith("http") ? link.href : `${origin}${link.href}`;
    if (seen.has(href)) continue;
    seen.add(href);
    extras.push(`${link.label}: ${href}`);
  }
  return extras.length ? `${entry.answer} ${extras.join(" ")}` : entry.answer;
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: data.sections.flatMap((section) =>
    section.entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: answerText(entry) },
    })),
  ),
};

const sectionsHtml = data.sections
  .map((section) => {
    const items = section.entries
      .map((entry) => {
        const links = (entry.links || [])
          .map(
            (link) =>
              `<a href="${esc(link.href)}">${esc(link.label)}</a>`,
          )
          .join(" · ");
        const linkBlock = links
          ? `<p class="faq-links">${links}</p>`
          : "";
        return `<details>
          <summary>${esc(entry.question)}</summary>
          <p>${esc(entry.answer)}</p>
          ${linkBlock}
        </details>`;
      })
      .join("\n");
    return `<section id="${esc(section.id)}" class="faq-section">
        <h2>${esc(section.title)}</h2>
        ${items}
      </section>`;
  })
  .join("\n");

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(data.title)}</title>
  <meta name="description" content="${esc(data.description)}" />
  <link rel="canonical" href="${esc(data.canonical)}" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <meta property="og:site_name" content="CabinetDealz" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(data.title)}" />
  <meta property="og:description" content="${esc(data.description)}" />
  <meta property="og:url" content="${esc(data.canonical)}" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:image" content="https://www.cabinetdealz.com/og-image.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(data.title)}" />
  <meta name="twitter:description" content="${esc(data.description)}" />
  <meta name="twitter:image" content="https://www.cabinetdealz.com/og-image.jpg" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root { --navy: #0f1f3d; --gold: #c4a35a; --text: #1a2744; --muted: #4b5563; --line: #e5e0d6; --bg: #f8f6f1; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--text); background: var(--bg); line-height: 1.6; }
    a { color: #8a6a2f; }
    a:hover { color: var(--navy); }
    header { background: var(--navy); color: #fff; }
    header .bar, footer .inner, main { width: min(880px, calc(100% - 2rem)); margin: 0 auto; }
    header .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem 1.25rem; padding: 0.9rem 0; }
    .logo { color: #fff; text-decoration: none; font-weight: 700; font-size: 1.15rem; letter-spacing: 0.01em; }
    .logo span { color: var(--gold); }
    header nav { display: flex; flex-wrap: wrap; gap: 0.85rem 1.15rem; }
    header nav a { color: rgba(255,255,255,0.88); text-decoration: none; font-size: 0.92rem; }
    header nav a:hover { color: #fff; }
    main { padding: 2.25rem 0 3.5rem; }
    h1 { font-family: "Playfair Display", Georgia, serif; font-size: 2rem; line-height: 1.2; margin: 0 0 0.6rem; }
    .intro { color: var(--muted); margin: 0 0 2rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 0.4rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--line); }
    details { border-bottom: 1px solid var(--line); padding: 0.85rem 0; }
    summary { cursor: pointer; font-weight: 600; list-style: none; }
    summary::-webkit-details-marker { display: none; }
    details p { margin: 0.65rem 0 0; color: #334155; }
    .faq-links { font-size: 0.92rem; }
    footer { background: var(--navy); color: rgba(255,255,255,0.75); padding: 2rem 0; font-size: 0.92rem; }
    footer a { color: rgba(255,255,255,0.88); }
    footer .nap { margin: 0 0 0.85rem; }
    footer nav { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }
  </style>
</head>
<body>
  <header>
    <div class="bar">
      <a class="logo" href="/">Cabinet<span>Dealz</span></a>
      <nav aria-label="Primary">
        <a href="/kitchens">Kitchen Packages</a>
        <a href="/styles">Shop by Style</a>
        <a href="/catalog">All Cabinets</a>
        <a href="/design">3D Designer</a>
        <a href="/contact">Contact</a>
      </nav>
    </div>
  </header>
  <main>
    <h1>${esc(data.h1)}</h1>
    <p class="intro">${esc(data.intro)}</p>
    ${sectionsHtml}
  </main>
  <footer>
    <div class="inner">
      <p class="nap">CabinetDealz<br />470 N Tamiami Trail, Osprey, FL 34229<br /><a href="tel:+19418993288">(941) 899-3288</a> · <a href="mailto:sales@cabinetdealz.com">sales@cabinetdealz.com</a><br />Monday–Friday, 9:00 AM–5:00 PM ET · Saturday by appointment · Sunday closed</p>
      <nav aria-label="Footer">
        <a href="/about">About</a>
        <a href="/contact">Contact</a>
        <a href="/shipping-policy">Shipping Policy</a>
        <a href="/return-policy">Return Policy</a>
        <a href="/warranty">Warranty</a>
        <a href="/affiliate">Affiliate Program</a>
        <a href="/pro-network">Pro Network</a>
      </nav>
    </div>
  </footer>
</body>
</html>
`;

const out = join(root, "client/public/faq.html");
writeFileSync(out, html);
console.log(`Wrote ${out}`);
