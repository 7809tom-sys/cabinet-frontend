import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
const welcomeSource = readFileSync(resolve(process.cwd(), "client/src/components/home/HomepageWelcomeBanner.tsx"), "utf8");

describe("B2B homepage hierarchy", () => {
  it("keeps complete-kitchen planning primary and uses Kitchen Packages as the single offering label", () => {
    expect(homeSource).toContain('Plan a Complete Kitchen');
    expect(homeSource).toContain('bg-[var(--color-gold)] text-[var(--color-navy)]');
    expect(homeSource).toContain('Kitchen Packages');
    expect(homeSource).not.toContain('Bundle Deals');
    expect(homeSource).toContain('variant="outline" className="border-white/80 text-white');
    expect(welcomeSource).toContain('variant="ghost"');
  });

  it("uses stronger secondary actions and concise complete-kitchen hero copy", () => {
    expect(homeSource).toContain('Surfaces & Fixtures');
    expect(homeSource).toContain("Plumber's Choice");
    expect(homeSource).toContain('border-white/80 text-white');
    expect(homeSource).toContain('Start with a complete kitchen idea, select a style and package, then customize the layout, surfaces, fixtures, and quote for your space.');
    expect(homeSource).toContain('font-serif text-4xl md:text-5xl lg:text-6xl font-bold');
  });

  it("presents the featured finish chooser as a customer-facing color line and keeps affiliate benefits in a responsive grid", () => {
    expect(homeSource).toContain('Choose Your Cabinet Color');
    expect(homeSource).toContain('DoorStyleSwatch');
    expect(homeSource).toContain('doorColorSpectrumGradient(orderedStyles)');
    expect(homeSource).toContain('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3');
    expect(homeSource).not.toContain('In Stock');
    expect(homeSource).not.toContain('Ships in');
  });

  it("orders actual door samples from light to deep and pages the front page in sets of six", () => {
    expect(homeSource).toContain('orderDoorStylesByColor(featured as FeaturedDoorStyle[])');
    expect(homeSource).toContain('DOOR_COLOR_SPECTRUM_PAGE_SIZE');
    expect(homeSource).toContain('Show next six cabinet color lines');
    expect(homeSource).toContain('six cabinet lines at a time');
    expect(homeSource).not.toContain('cabinetdealz:featured-room-scene:');
  });

  it("slides each six-door set in the requested direction while respecting reduced-motion preferences", () => {
    expect(homeSource).toContain('AnimatePresence');
    expect(homeSource).toContain('moveColorLine');
    expect(homeSource).toContain('slideDirection');
    expect(homeSource).toContain('useReducedMotion');
    expect(homeSource).toContain('onAnimationComplete');
  });

  it("keeps the color slider above the curated featured cabinet displays", () => {
    expect(homeSource).toContain('featuredCabinetDisplays');
    expect(homeSource).toContain('Featured cabinet displays');
    expect(homeSource).toContain('See the featured cabinets in a finished kitchen');
    expect(homeSource.indexOf('Choose Your Cabinet Color')).toBeLessThan(homeSource.indexOf('Featured cabinet displays'));
    expect(homeSource).toContain('style.roomScenes?.[0]?.imageUrl');
  });

  it("explains that the color line and cabinet display data are loading instead of leaving a blank section", () => {
    expect(homeSource).toContain('Loading cabinet colors and featured displays');
    expect(homeSource).toContain('Preparing the door samples and finished cabinet displays.');
    expect(homeSource).toContain('aria-busy="true"');
  });

  it("keeps public featured room scenes free of distributor identity", () => {
    expect(homeSource).not.toContain('distributorName');
  });
});
