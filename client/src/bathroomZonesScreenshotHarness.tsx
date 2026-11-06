/**
 * Screenshot harness for the bathroom planner zone removal.
 *
 * It renders the REAL Floor Plan canvas (`PlanCanvas`) with the same saved-plan
 * furniture payload that a design created by the old "movable zones" starter
 * still carries: the three `bathroom-zone-*` rows plus sourced Pelican fixtures
 * that were dropped into them. On the previous build that payload draws the
 * dashed "Movable planning zone" boxes, their Attributes control and the red
 * "Different planning zone" warning. On this build the same payload draws only
 * the real cabinets and fixtures, and every one of them can be dragged freely.
 *
 * Loaded only by `dev/bathroom-zones-shot.html` during the screenshot run
 * (`e2e/bathroom-zones-screenshot.spec.ts`). Nothing in the app imports it.
 */
import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  type PlacedCabinet,
  type PlacedFurniture,
  type RoomData,
} from "@/lib/design";
import * as bathroomPlanning from "@/lib/bathroomPlanning";
import "@/index.css";

/**
 * The previous build exported the zone-overlap warning helper; this build does
 * not. The harness asks whichever build is being served for its own warning
 * rows, so the "before" screenshot shows the real warning the old code produced
 * and the "after" screenshot shows that the concept no longer exists.
 */
function zoneWarningsFor(furniture: PlacedFurniture[]) {
  const build = bathroomPlanning as unknown as {
    bathroomZoneOverlapWarnings?: (rows: readonly PlacedFurniture[]) => Array<{ fixtureUid: string }>;
  };
  if (!build.bathroomZoneOverlapWarnings) return undefined;
  const byFixture = new Map<string, unknown[]>();
  for (const warning of build.bathroomZoneOverlapWarnings(furniture)) {
    const existing = byFixture.get(warning.fixtureUid) ?? [];
    existing.push(warning);
    byFixture.set(warning.fixtureUid, existing);
  }
  return byFixture;
}

/**
 * The old build's PlanCanvas took the zone warning map and a zone Attributes
 * opener. This build's PlanCanvas does not, so the props are spread only when
 * the served build still supports them.
 */
function zoneProps(furniture: PlacedFurniture[]) {
  const warnings = zoneWarningsFor(furniture);
  return warnings
    ? {
        bathroomZoneWarningsByFixture: warnings,
        onOpenFurnitureAttributes: (uid: string) => {
          document.documentElement.dataset.zoneAttributesOpened = uid;
        },
      }
    : {};
}

const room = { width: 120, depth: 96, ceilingHeight: 96 } satisfies RoomData;

/**
 * The saved furniture list exactly as the old zones template persisted it, plus
 * a toilet dropped inside the vanity zone and a tub inside the tub zone.
 */
const legacyFurniture: PlacedFurniture[] = [
  { uid: "zone-vanity", defId: "bathroom-zone-vanity-60", x: 0, y: 0, rotation: 0 },
  { uid: "zone-toilet", defId: "bathroom-zone-toilet", x: 84, y: 12, rotation: 0 },
  { uid: "zone-tub", defId: "bathroom-zone-tub-60", x: 0, y: 60, rotation: 0 },
  { uid: "toilet", defId: "pelican-toilet-pl-12044", x: 12, y: 8, rotation: 0, pelicanCode: "PL-12044", pelicanProductId: 901, pelicanProductName: "PL-12044 Vortex Toilet", pelicanCategory: "Toilets", pelicanSellPrice: 388 },
  { uid: "tub", defId: "pelican-tub-pl-02146-59", x: 8, y: 64, rotation: 90, pelicanCode: 'PL-02146 59"', pelicanProductId: 902, pelicanProductName: "PL-02146 59-inch Freestanding Soaking Tub", pelicanCategory: "Shower & Bath", pelicanSellPrice: 1499 },
];

function cabinet(overrides: Partial<PlacedCabinet>): PlacedCabinet {
  return {
    uid: "cab",
    cabinetId: 1,
    masterCode: "B15",
    description: '15" Base Cabinet',
    placement: "base",
    x: 0,
    y: 0,
    width: 15,
    depth: 24,
    height: 34.5,
    rotation: 0,
    ...overrides,
  } as PlacedCabinet;
}

/** Two DB15 drawer bases with a sink base slid in between, plus a vanity run. */
const cabinets: PlacedCabinet[] = [
  cabinet({ uid: "db15-left", masterCode: "3DB15", description: '15" Three-Drawer Base', x: 0, y: 0, width: 15 }),
  cabinet({ uid: "sink-base", masterCode: "SB30", description: '30" Sink Base', x: 15, y: 0, width: 30 }),
  cabinet({ uid: "db15-right", masterCode: "3DB15", description: '15" Three-Drawer Base', x: 45, y: 0, width: 15 }),
  cabinet({ uid: "vanity-30", masterCode: "VS30", description: '30" Vanity Sink Base', subCategory: "Vanity", x: 90, y: 0, width: 30, depth: 21 }),
];

function Harness() {
  const [furniture, setFurniture] = useState<PlacedFurniture[]>(legacyFurniture);
  const [selectedFurnUid, setSelectedFurnUid] = useState<string | null>("toilet");
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [placedCabinets, setPlacedCabinets] = useState<PlacedCabinet[]>(cabinets);
  const extraZoneProps = useMemo(() => zoneProps(furniture), [furniture]);
  const caption = useMemo(() => {
    const zones = furniture.filter((item) => item.defId.startsWith("bathroom-zone-")).length;
    const fixtures = furniture.length - zones;
    return `${fixtures} fixtures and ${placedCabinets.length} cabinets on the plan · ${zones} zone rows left in the saved payload`;
  }, [furniture, placedCabinets]);

  return (
    <>
      <div id="caption">
        <strong>Bathroom plan · real Floor Plan canvas</strong>
        <div>{caption}</div>
        <div style={{ color: "#475569", fontSize: 12 }}>
          Same saved plan on both builds: a DB15 drawer base, a sink base and a second DB15 in one run, a vanity sink base on the back wall, a toilet and a freestanding tub.
        </div>
      </div>
      <div id="plan">
        <PlanCanvas
          room={room}
          cabinets={placedCabinets}
          selectedUid={selectedUid}
          onSelect={setSelectedUid}
          onMove={(uid, x, y) => setPlacedCabinets((previous) => previous.map((item) => item.uid === uid ? { ...item, x, y } : item))}
          showWallLayer
          furniture={furniture}
          selectedFurnUid={selectedFurnUid}
          onSelectFurn={setSelectedFurnUid}
          onMoveFurn={(uid, x, y) => setFurniture((previous) => previous.map((item) => item.uid === uid ? { ...item, x, y } : item))}
          onDeleteFurn={(uid) => setFurniture((previous) => previous.filter((item) => item.uid !== uid))}
          {...extraZoneProps}
        />
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <LanguageProvider>
    <Harness />
  </LanguageProvider>,
);
