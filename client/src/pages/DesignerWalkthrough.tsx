import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Compass,
  Grid3X3,
  Layers3,
  MapPinned,
  Palette,
  Ruler,
  Save,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSeo } from "@/hooks/useSeo";

type WalkthroughStep = {
  number: string;
  title: string;
  summary: string;
  detail: string;
  tip: string;
  icon: typeof Ruler;
  actionLabel: string;
  actionHref: string;
};

const WALKTHROUGH_STEPS: WalkthroughStep[] = [
  {
    number: "01",
    title: "Set your room size",
    summary: "Start with the space, not a single cabinet.",
    detail: "Open Floor Plan in the Designer workspace and enter the width and depth of the room you are planning.",
    tip: "You can return to Floor Plan whenever you need to refine the room dimensions.",
    icon: Ruler,
    actionLabel: "Open Designer",
    actionHref: "/design",
  },
  {
    number: "02",
    title: "Choose the kitchen direction",
    summary: "Begin with the complete kitchen look you want to create.",
    detail: "Use Catalog to select a cabinet line and door style, then keep the whole kitchen in mind as you make selections.",
    tip: "Kitchen Packages can provide a ready-to-customize starting point before you build the layout.",
    icon: Compass,
    actionLabel: "Explore Kitchen Packages",
    actionHref: "/kitchens",
  },
  {
    number: "03",
    title: "Build each wall run",
    summary: "Place lower cabinets before you build upward.",
    detail: "Choose a wall, add base cabinets, and continue the run along the room. The Designer helps cabinets snap into a clean sequence.",
    tip: "Select a different wall whenever you are ready to continue another side of the room.",
    icon: Layers3,
    actionLabel: "Open Designer",
    actionHref: "/design",
  },
  {
    number: "04",
    title: "Plan the working zones",
    summary: "Place appliances and fixtures where the kitchen will work best.",
    detail: "Add the refrigerator, range, sink base, and other fixtures as part of the complete layout—not as isolated cabinet selections.",
    tip: "Leave the clear working space you need before filling the remaining cabinet positions.",
    icon: MapPinned,
    actionLabel: "Open Designer",
    actionHref: "/design",
  },
  {
    number: "05",
    title: "Add the island if it fits",
    summary: "Use the Island zone for a separate work or seating area.",
    detail: "Turn on Island zone, set its size, then place cabinets on the front or back face as your kitchen plan needs them.",
    tip: "Keep the island as a complete assembly, including its countertop and any selected finishing options.",
    icon: Grid3X3,
    actionLabel: "Open Designer",
    actionHref: "/design",
  },
  {
    number: "06",
    title: "Finish the whole kitchen",
    summary: "Coordinate cabinets, surfaces, fixtures, and trim.",
    detail: "Use Surfaces and the cabinet settings to make your finish choices work together across the completed kitchen design.",
    tip: "You can keep the island finish separate when the project calls for a different look.",
    icon: Palette,
    actionLabel: "Explore Surfaces",
    actionHref: "/surfaces",
  },
  {
    number: "07",
    title: "Review the complete plan",
    summary: "Check layout, materials, and selections before you quote.",
    detail: "Use View to switch between the plan and 3D perspective. Then open Materials & Parts and Price & Cart to review the selected items.",
    tip: "A final room-level review makes it easier to catch a layout or selection before an order request begins.",
    icon: ClipboardList,
    actionLabel: "Open Designer",
    actionHref: "/design",
  },
  {
    number: "08",
    title: "Save and continue later",
    summary: "Keep the kitchen together as one working plan.",
    detail: "Use the Designer toolbar to save your plan. Return to My Designs when you are ready to keep refining the layout or review it with someone else.",
    tip: "Save the room layout before you begin the quote conversation for the complete project.",
    icon: Save,
    actionLabel: "Start My Kitchen Plan",
    actionHref: "/design",
  },
];

function publicOrigin(): string {
  return typeof window === "undefined" ? "https://www.cabinetdealz.com" : window.location.origin;
}

export default function DesignerWalkthrough() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = WALKTHROUGH_STEPS[activeIndex];
  const ActiveIcon = active.icon;
  const canonical = `${publicOrigin()}/designer-guide`;
  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to design a complete kitchen with CabinetDealz Designer",
    description: "A step-by-step walkthrough for setting a room size, building a kitchen layout, reviewing selections, and saving a complete kitchen plan.",
    url: canonical,
    step: WALKTHROUGH_STEPS.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.detail,
      url: `${canonical}#step-${index + 1}`,
    })),
  }), [canonical]);

  useSeo({
    title: "How to Design a Complete Kitchen",
    description: "Follow the CabinetDealz Designer walkthrough to set room size, place cabinets, plan working zones, select finishes, and review your complete kitchen plan.",
    canonical,
    jsonLd,
  });

  const goPrevious = () => setActiveIndex((index) => (index === 0 ? WALKTHROUGH_STEPS.length - 1 : index - 1));
  const goNext = () => setActiveIndex((index) => (index === WALKTHROUGH_STEPS.length - 1 ? 0 : index + 1));

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#10263f]">
      <section className="border-b border-[#d9cfbc] bg-[#10263f] text-white">
        <div className="container grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:py-20">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#e7b55e]">
              <Sparkles className="h-4 w-4" aria-hidden="true" /> CabinetDealz Designer walkthrough
            </p>
            <h1 className="mt-4 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Build your complete kitchen, one clear step at a time.</h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-200 sm:text-lg">This guide follows the same order a kitchen comes together: room first, cabinet plan next, then finishes, review, and saved design.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/design">
                <Button size="lg" className="w-full gap-2 bg-[#e1ab53] font-semibold text-[#10263f] hover:bg-[#efbe6c] sm:w-auto">Open Kitchen Designer <ArrowRight className="h-4 w-4" /></Button>
              </Link>
              <Link href="/kitchens">
                <Button size="lg" variant="outline" className="w-full border-white/60 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto">Explore Kitchen Packages</Button>
              </Link>
            </div>
          </div>
          <div className="border border-white/15 bg-white/5 p-5 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#e7b55e]">The complete-kitchen order</p>
            <ol className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-4 lg:grid-cols-2">
              {WALKTHROUGH_STEPS.map((step) => (
                <li key={step.number} className="flex items-start gap-2 text-slate-100"><span className="font-serif text-lg text-[#e7b55e]">{step.number}</span><span className="pt-0.5 leading-snug">{step.title}</span></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <main className="container py-10 sm:py-14 lg:py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9b6f28]">Designer slideshow</p>
              <h2 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Follow the kitchen from room to review.</h2>
            </div>
            <p className="text-sm text-slate-600">Step {activeIndex + 1} of {WALKTHROUGH_STEPS.length}</p>
          </div>

          <article id={`step-${activeIndex + 1}`} className="grid overflow-hidden border border-[#d8cdbb] bg-white lg:grid-cols-[.88fr_1.12fr]">
            <div className="relative min-h-[280px] overflow-hidden bg-[#12305a] p-7 text-white sm:p-10">
              <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.24) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.24) 1px, transparent 1px)", backgroundSize: "28px 28px" }} aria-hidden="true" />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between">
                  <span className="font-serif text-7xl leading-none text-[#e7b55e]">{active.number}</span>
                  <span className="flex h-12 w-12 items-center justify-center border border-[#e7b55e]/60 bg-[#10263f]/35"><ActiveIcon className="h-6 w-6 text-[#f1c371]" aria-hidden="true" /></span>
                </div>
                <div className="mt-auto border-t border-[#e7b55e]/45 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#e7b55e]">Complete kitchen step</p>
                  <p className="mt-2 font-serif text-3xl font-bold leading-tight">{active.summary}</p>
                </div>
              </div>
            </div>
            <div className="flex min-h-[280px] flex-col p-7 sm:p-10">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9b6f28]">Step {active.number}</p>
              <h3 className="mt-2 font-serif text-3xl font-bold leading-tight sm:text-4xl">{active.title}</h3>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">{active.detail}</p>
              <div className="mt-6 border-l-2 border-[#e1ab53] bg-[#fbf7ee] px-4 py-3 text-sm leading-relaxed text-slate-700"><strong className="font-semibold text-[#825b1f]">Helpful tip: </strong>{active.tip}</div>
              <div className="mt-auto flex flex-col gap-3 pt-7 sm:flex-row sm:items-center sm:justify-between">
                <Link href={active.actionHref}><Button className="w-full gap-2 sm:w-auto">{active.actionLabel} <ArrowRight className="h-4 w-4" /></Button></Link>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="icon" aria-label="Previous walkthrough step" onClick={goPrevious}><ArrowLeft className="h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="icon" aria-label="Next walkthrough step" onClick={goNext}><ArrowRight className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          </article>

          <nav className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-8" aria-label="Designer walkthrough steps">
            {WALKTHROUGH_STEPS.map((step, index) => (
              <button key={step.number} type="button" onClick={() => setActiveIndex(index)} className={`min-h-[54px] border px-2 py-2 text-left text-xs font-semibold transition-colors ${index === activeIndex ? "border-[#10263f] bg-[#10263f] text-white" : "border-[#d8cdbb] bg-white text-slate-600 hover:border-[#9b6f28]"}`} aria-current={index === activeIndex ? "step" : undefined}>
                <span className={`block font-serif text-base ${index === activeIndex ? "text-[#e7b55e]" : "text-[#9b6f28]"}`}>{step.number}</span>
                <span className="mt-0.5 block truncate">{step.title.replace("your ", "")}</span>
              </button>
            ))}
          </nav>
        </div>
      </main>

      <section className="border-t border-[#d8cdbb] bg-[#ece5d8] py-10 sm:py-14">
        <div className="container flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#9b6f28]">Ready to begin?</p><h2 className="mt-2 font-serif text-3xl font-bold">Start with your room, then build the kitchen you want.</h2></div>
          <Link href="/design"><Button size="lg" className="gap-2">Start a Kitchen Design <Check className="h-4 w-4" /></Button></Link>
        </div>
      </section>
    </div>
  );
}
