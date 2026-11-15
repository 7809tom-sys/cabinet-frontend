/**
 * Customer FAQ (Tom, 14 Nov 2026: "make a frequent asked question page on the site").
 *
 * Ten answers, in the order a customer hits them: measure first, because every other
 * decision depends on it. Kept short on purpose - a FAQ that needs scrolling is not a
 * FAQ. Trade-only detail (DWP, panel tolerances) is deliberately left out.
 *
 * Content is inline so the page ships with the bundle and needs no loader, migration
 * or admin surface. FAQPage JSON-LD is emitted for rich results.
 */
type Entry = { question: string; answer: string };

export const FAQ_ENTRIES: readonly Entry[] = [
  { question: "How do I start designing my kitchen?", answer: "Measure the room first: each wall corner to corner, ceiling height, and where every window, door, outlet and water line sits. Then pick a layout - one wall, galley, L, U, or any of those with an island. Everything else follows from those two decisions." },
  { question: "How many inches do I need between my counters?", answer: "42 inches is the minimum for one cook; 48 if two people work at once. Measure from the front edge of the countertop, not the cabinet box - a standard 1.5 inch overhang on each side eats 3 inches of your aisle." },
  { question: "What is the work triangle, and does it matter?", answer: "It is the path between your sink, stove and refrigerator. Keep each leg between 4 and 9 feet, and do not let a walkway or island cut through it. It is the difference between a kitchen that flows and one you fight." },
  { question: "Where does the refrigerator go?", answer: "At the end of a run, never the middle - it is the biggest box and the one you open most. Leave at least 15 inches of counter on the handle side, and 2.5 inches beside a wall so the door opens past 90 degrees." },
  { question: "Why does the corner need a special cabinet?", answer: "Two cabinets cannot meet squarely in a corner - their doors and drawers would hit. The options are a lazy Susan (best access), a diagonal corner (easy reach, clean look), or a blind corner with a pull-out. Whichever you pick, it needs a 3 inch filler so the neighbouring drawers clear it." },
  { question: "What is a filler, and why is it on my quote?", answer: "A filler is a narrow matching strip that closes a gap - usually at a wall, or beside a corner so a drawer can open. It is a real part, cut to fit. If your plan has more than one in the middle of a run, that usually means the cabinet widths could be chosen better." },
  { question: "Why is my countertop 25.5 inches deep instead of 24?", answer: "Standard cabinets are 24 inches deep; the countertop adds a 1.5 inch overhang past the doors, for 25.5 finished. That is the number your tape measure will hit, and the number your aisle is measured against." },
  { question: "How do I pick a door colour when the screen lies?", answer: "Order a physical sample door and look at it in your own kitchen light. Screens are backlit and colour-managed; a supplier's own door photo is the closest thing to the truth, which is exactly what our Designer draws from." },
  { question: "Why is my door style 6-8 weeks when others are 2 days?", answer: "Lines marked special order are made for your job, not pulled from a warehouse. We show the lead time on the style so you can plan around it - if you are on a deadline, ask which stocked styles match your look." },
  { question: "Can I change the colour after I order?", answer: "Not once the order is released. That is why the last step before ordering is confirming the door style, the colour, and every cabinet in the list." },
];

function faqJsonLd() {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ENTRIES.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  });
}

export default function FaqPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
      <h1 className="font-serif text-3xl font-bold text-[#1a2744]">Kitchen design FAQ</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The questions customers ask most, answered plainly. If yours is not here, ask your designer - we would rather
        answer it before the order than after.
      </p>
      <div className="mt-6 divide-y divide-[#e5e0d6]">
        {FAQ_ENTRIES.map((entry) => (
          <details key={entry.question} className="group py-3" data-testid="faq-entry">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-semibold text-[#1a2744]">
              <span>{entry.question}</span>
              <span aria-hidden="true" className="shrink-0 text-[#a87f33] group-open:hidden">+</span>
              <span aria-hidden="true" className="hidden shrink-0 text-[#a87f33] group-open:inline">-</span>
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">{entry.answer}</p>
          </details>
        ))}
      </div>
    </main>
  );
}