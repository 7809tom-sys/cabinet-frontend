import { Link } from "wouter";
import { useSeo } from "@/hooks/useSeo";
import {
  FAQ_ENTRIES,
  FAQ_SECTIONS,
  FAQ_SEO,
  buildFaqPageJsonLd,
} from "@/content/siteFaq";

export { FAQ_ENTRIES, FAQ_SECTIONS, FAQ_SEO };

export default function FaqPage() {
  const jsonLd = buildFaqPageJsonLd();
  useSeo({
    title: FAQ_SEO.title,
    description: FAQ_SEO.description,
    canonical: FAQ_SEO.canonical,
    jsonLd,
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="font-serif text-3xl font-bold text-[#1a2744]">{FAQ_SEO.h1}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{FAQ_SEO.intro}</p>
      {FAQ_SECTIONS.map((section) => (
        <section key={section.id} id={section.id} className="mt-8">
          <h2 className="border-b border-[#e5e0d6] pb-2 font-serif text-xl font-semibold text-[#1a2744]">
            {section.title}
          </h2>
          <div className="divide-y divide-[#e5e0d6]">
            {section.entries.map((entry) => (
              <details key={entry.question} className="group py-3" data-testid="faq-entry">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 text-[15px] font-semibold text-[#1a2744]">
                  <span>{entry.question}</span>
                  <span aria-hidden="true" className="shrink-0 text-[#a87f33] group-open:hidden">+</span>
                  <span aria-hidden="true" className="hidden shrink-0 text-[#a87f33] group-open:inline">-</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-slate-700">{entry.answer}</p>
                {entry.links && entry.links.length > 0 ? (
                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    {entry.links.map((link) => (
                      <Link
                        key={`${link.href}-${link.label}`}
                        href={link.href}
                        className="text-[#8a6a2f] underline-offset-2 hover:underline"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </p>
                ) : null}
              </details>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
