/**
 * Before/after harness for the bathroom rear-deck rule.
 *
 * Renders the REAL Floor Plan (`PlanCanvas`) twice from the same design model:
 *
 *   before — the old behaviour: a 3" front setback and a red "REAR DECK TOO
 *            SHALLOW" blocking label for the same basin
 *   after  — the rule Tom asked for: a 2" front setback and a neutral
 *            "tight rear deck" advisory that never blocks the sink
 *
 * Both panes use the app's own `makeSinkForCabinet` / `nonApronSinkDeckPlacement`
 * geometry, so the basin, the setback, the faucet base and every dimension in the
 * capture are the ones the Designer computes. The "before" pane only re-applies
 * the two retired values locally; nothing in the app is switched to old behaviour.
 *
 * The design is the reported case: a 30" Pelican vanity basin on a 30" × 21"
 * vanity sink base between two 3VDB15 drawer bases.
 *
 * Dev-only: loaded from client/dev/sink-deck-shot.html, imported by nothing in the
 * app, and reachable at no route.
 */
import { createRoot } from "react-dom/client";
import { useState } from "react";
import "@/index.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import {
  FAUCET_REAR_DECK_BODY_OFFSET_IN,
  MINIMUM_FAUCET_REAR_DECK_IN,
  NON_APRON_SINK_FRONT_SETBACK,
  countertopDepthForCabinet,
  makeSinkForCabinet,
  nonApronSinkDeckPlacement,
  type PlacedCabinet,
  type RoomData,
  type SinkFixture,
} from "@/lib/design";
import { verifiedPelicanSinkProfile } from "@/lib/pelicanFixtureProfiles";

const ROOM: RoomData = { width: 84, depth: 60, ceilingHeight: 96 };

const cabinet = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "cab",
  cabinetId: 1,
  masterCode: "B24",
  description: '24" Base Cabinet',
  category: "Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 24,
  depth: 21,
  height: 34.5,
  rotation: 0,
  ...overrides,
} as PlacedCabinet);

/** The reported bathroom case: 3VDB15 · VS30 · 3VDB15 along the back wall. */
const CABINETS: PlacedCabinet[] = [
  cabinet({ uid: "left", cabinetId: 1, masterCode: "3VDB15", description: '15" W x 34-1/2" H x 21" D Vanity Drawer Base', subCategory: "Vanity Drawer Base", width: 15, x: 9 }),
  cabinet({ uid: "sink-base", cabinetId: 2, masterCode: "VS30", description: '30" W x 34-1/2" H x 21" D Vanity Sink Base — 2 Doors, False Drawer Front', subCategory: "Vanity Sink", width: 30, x: 24 }),
  cabinet({ uid: "right", cabinetId: 3, masterCode: "3VDB15", description: '15" W x 34-1/2" H x 21" D Vanity Drawer Base', subCategory: "Vanity Drawer Base", width: 15, x: 54 }),
];

const SINK_BASE = CABINETS[1]!;

/** The 30" Pelican undermount basin, from its published profile. */
const PROFILE = verifiedPelicanSinkProfile("PL-VS3018 18g")!;
const ENVELOPE = { width: PROFILE.exteriorWidthIn, depth: PROFILE.exteriorDepthIn };

const vanityTopDepth = countertopDepthForCabinet(SINK_BASE);

type Mode = "before" | "after" | "tight";

/** A deeper 19" basin, the case where the deck really is tight. */
const TIGHT_ENVELOPE = { width: 31, depth: 19 };

/**
 * The same basin under each rule:
 *   before — retired 3" setback, red blocking label
 *   after  — live rule for the reported 30" × 18" basin (2.5" deck, no advisory)
 *   tight  — live rule for a 19"-deep basin (1.5" deck, neutral advisory only)
 */
function sinkFor(mode: Mode): SinkFixture {
  if (mode === "after") {
    return {
      ...makeSinkForCabinet("single", SINK_BASE, ROOM, ENVELOPE),
      uid: "pelican-vanity-basin",
      faucet: true,
      pelicanProductName: PROFILE.name,
    };
  }
  if (mode === "tight") {
    return {
      ...makeSinkForCabinet("single", SINK_BASE, ROOM, TIGHT_ENVELOPE),
      uid: "pelican-vanity-basin",
      faucet: true,
      pelicanProductName: "31″ × 19″ Pelican vanity basin",
    };
  }
  const setback = 3;
  const layout = nonApronSinkDeckPlacement(SINK_BASE, ROOM, ENVELOPE, setback);
  const legacyDeck = vanityTopDepth - setback - ENVELOPE.depth;
  return {
    ...makeSinkForCabinet("single", SINK_BASE, ROOM, ENVELOPE, { frontSetbackIn: setback }),
    uid: "pelican-vanity-basin",
    faucet: true,
    pelicanProductName: PROFILE.name,
    // Retired behaviour, reproduced here only so the panes can be compared.
    faucetDeckAdvisory: undefined,
    faucetDeckConflict: legacyDeck < MINIMUM_FAUCET_REAR_DECK_IN ? "shallow-countertop-deck" : undefined,
    faucetRearDeckOffsetIn: Math.max(0, Math.min(layout.rearDeckIn / 2, FAUCET_REAR_DECK_BODY_OFFSET_IN)),
  } as SinkFixture;
}

function Pane({ mode }: { mode: Mode }) {
  const [selected] = useState<string | null>(null);
  const sink = sinkFor(mode);
  const envelope = mode === "tight" ? TIGHT_ENVELOPE : ENVELOPE;
  const rearDeck = vanityTopDepth - (sink.frontSetbackIn ?? 0) - envelope.depth;
  const setbackIn = sink.frontSetbackIn ?? 0;
  const basinRearEdge = sink.y;

  return (
    <div className="pane">
      <div className="tag" data-testid={`pane-tag-${mode}`}>
        {mode === "before"
          ? "BEFORE — red blocking label"
          : mode === "after"
            ? "AFTER — reported 30″ basin, placed"
            : "AFTER — tight deck, advisory only"}
      </div>
      <div className="facts" data-testid={`pane-facts-${mode}`}>
        <div><b>Vanity top</b> {vanityTopDepth}″ deep (21″ base + 1½″ front overhang)</div>
        <div><b>Basin</b> {envelope.width}″ × {envelope.depth}″ ({mode === "tight" ? "deeper basin" : PROFILE.pelicanCode})</div>
        <div><b>Front setback</b> {setbackIn}″</div>
        <div><b>Rear deck</b> {rearDeck.toFixed(2)}″ = {vanityTopDepth} − {setbackIn} − {envelope.depth}</div>
        <div><b>Basin rear edge</b> {basinRearEdge.toFixed(2)}″ from the wall</div>
        <div className={mode === "before" ? "bad" : "ok"}>
          {mode === "before"
            ? "Blocked: “REAR DECK TOO SHALLOW”"
            : rearDeck + 0.02 >= MINIMUM_FAUCET_REAR_DECK_IN
              ? "Placed. No advisory needed."
              : "Placed. Neutral advisory only."}
        </div>
      </div>
      <div className="plan-wrap">
        <PlanCanvas
          room={ROOM}
          cabinets={CABINETS}
          countertopMaterialId="pelican-quartz"
          sinks={[sink]}
          selectedSinkUid={selected}
          onSelectSink={() => undefined}
          showWallLayer
          activeWall="top"
          layoutLocked
          conflictUids={new Set<string>()}
          missingPriceUids={new Set<string>()}
        />
        {/*
          The retired red badge is no longer a render path in the app, so the
          BEFORE pane reproduces it here, centred on the real basin, purely so
          the two states can be compared in one screenshot.
        */}
        {mode === "before" && (
          <div className="badge-before" data-testid="legacy-rear-deck-badge">
            REAR DECK TOO SHALLOW
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <LanguageProvider>
      <div className="shell">
        <Pane mode="before" />
        <Pane mode="after" />
        <Pane mode="tight" />
      </div>
    </LanguageProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
