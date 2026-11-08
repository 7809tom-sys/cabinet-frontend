import { useSeo } from "@/hooks/useSeo";
import { ShowerBuilderWizard } from "@/components/shower/ShowerBuilderWizard";

/**
 * `/build-shower` — the Build Shower wizard.
 *
 * Every step is optional and every step picks its own wall; every card is a live,
 * priced Pelican catalog row.
 */
export default function BuildShower() {
  useSeo({
    title: "Build a Shower — pan, panels, heads, niches and door | CabinetDealz",
    description:
      "Pick a shower pan, wall panels, valve and head, niches and glass door from Pelican's live catalog. Every step is optional and each part goes on the wall you choose.",
  });

  return (
    <div className="container py-6" data-testid="build-shower-page">
      <ShowerBuilderWizard />
    </div>
  );
}
