import { createRoot } from "react-dom/client";
import type { CartItem } from "@/contexts/CartContext";
import type { SinkFixture } from "@/lib/design";
import { buildSurfaceCartLines } from "@/lib/surfaceCartLines";
import { fixtureQuantitiesFromPlacements } from "@/lib/designCartReconciliation";
import "@/index.css";

/**
 * Shows the reported cart against the reported design, under the old rule and the
 * new one.
 *
 * The design in the screenshot: one blue shaker vanity with a white countertop,
 * one basin, one gold faucet, one matte black toilet, one tall blue linen cabinet.
 *
 * What went wrong: the shopper picked several basins while choosing (a rectangular
 * one before settling on the round PL-3608), opened the popup a few times, and
 * deleted a fixture or two. Every pick stayed in `selectedSurfaces`, and only
 * verified toilet/tub/shower profiles were ever seeded to zero. A basin and a
 * faucet are fixtures but have no furniture profile, so they fell through to the
 * default quantity of one and stayed payable — that is the extra money in the cart.
 */

type Pick = {
  id: number;
  pelicanCode: string;
  name: string;
  category: string;
  subCategory: string;
  sellPrice: number;
};

// ── What the shopper actually ENDED UP with in the room ──────────────────────
const INSTALLED_BASIN: Pick = { id: 560, pelicanCode: "PL-3608", name: "PL-3608 Vanity Basin 18″ Undermount", category: "Sinks & Faucets", subCategory: "Sinks", sellPrice: 55.15 };
const INSTALLED_FAUCET: Pick = { id: 812, pelicanCode: "PL-8112 BN", name: "PL-8112 BN Vanity Faucet", category: "Sinks & Faucets", subCategory: "Faucets", sellPrice: 214.8 };
const INSTALLED_TOILET: Pick = { id: 12044, pelicanCode: "PL-12044 MB", name: "PL-12044 MB Porcelain Toilet", category: "Toilets & Bidets", subCategory: "Toilets & Bidets", sellPrice: 1771.31 };

// ── Leftovers the old rule kept billing ─────────────────────────────────────
const REPLACED_BASIN: Pick = { id: 557, pelicanCode: "PL-3609", name: "PL-3609 Rectangular Vanity Basin (replaced by PL-3608)", category: "Sinks & Faucets", subCategory: "Sinks", sellPrice: 61.4 };
const TRIAL_BASIN: Pick = { id: 552, pelicanCode: "PL-3099", name: "PL-3099 Undermount Basin (picked, never placed)", category: "Sinks & Faucets", subCategory: "Sinks", sellPrice: 72.56 };
const DEFAULT_FAUCET: Pick = { id: 833, pelicanCode: "PL-8162 CHR", name: "PL-8162 CHR Faucet (Designer default, never chosen)", category: "Sinks & Faucets", subCategory: "Faucets", sellPrice: 129.0 };
const DELETED_TOILET: Pick = { id: 12005, pelicanCode: "PL-12005 MB", name: "PL-12005 MB Smart Toilet (deleted from the plan)", category: "Toilets & Bidets", subCategory: "Toilets & Bidets", sellPrice: 1640.0 };

const designPick = [INSTALLED_BASIN, INSTALLED_FAUCET, INSTALLED_TOILET];
// The stale selection the old code carried, plus the real picks.
const staleSelection = [INSTALLED_BASIN, INSTALLED_FAUCET, INSTALLED_TOILET, REPLACED_BASIN, TRIAL_BASIN, DEFAULT_FAUCET, DELETED_TOILET];

// Placements that actually exist in the room. A sink placement carries BOTH ids:
// the basin it installed and the faucet the shopper mounted on it.
const sinks = [{
  pelicanProductId: INSTALLED_BASIN.id,
  pelicanFaucetProductId: INSTALLED_FAUCET.id,
}];
const furniture = [{ pelicanProductId: INSTALLED_TOILET.id }];

// ── OLD RULE: only verified toilet/tub/shower profiles are seeded at zero ────
function oldRuleQuantities(): Map<number, number> {
  const quantities = new Map<number, number>();
  // What the old code did: seed verified fixture PROFILES only.
  for (const pick of staleSelection) {
    if (/^PL-12044|^PL-12005|^PL-02138|^PL-02849/.test(pick.pelicanCode)) quantities.set(pick.id, 0);
  }
  for (const fixture of furniture) {
    quantities.set(fixture.pelicanProductId, (quantities.get(fixture.pelicanProductId) ?? 0) + 1);
  }
  // Basins and faucets were never seeded, so nothing suppressed them.
  return quantities;
}

const tier = "homeowner" as const;
const oldLines = buildSurfaceCartLines(staleSelection as never, tier, null, oldRuleQuantities()) as CartItem[];

// ── NEW RULE: every fixture pick starts at zero, only a placement bills ─────
const newQuantities = fixtureQuantitiesFromPlacements({
  selected: staleSelection,
  furniture,
  sinks: sinks as unknown as SinkFixture[],
});
const newLines = buildSurfaceCartLines(staleSelection as never, tier, null, newQuantities) as CartItem[];

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lineTotal = (lines: CartItem[]) => lines.reduce((sum, line) => sum + (line.unitPrice ?? 0) * line.qty, 0);

function Table({ lines, stale, title, tone }: { lines: CartItem[]; stale?: readonly Pick[]; title: string; tone: "bad" | "good" }) {
  const keptIds = new Set(lines.map((line) => line.pelicanProductId));
  return (
    <div className="card">
      <div className={`head ${tone}`}>{title}</div>
      <table>
        <thead>
          <tr><th>Line</th><th>Status</th><th style={{ textAlign: "right" }}>Qty</th><th style={{ textAlign: "right" }}>Total</th></tr>
        </thead>
        <tbody>
          {(stale ?? []).map((pick) => {
            const line = lines.find((candidate) => candidate.pelicanProductId === pick.id);
            const kept = keptIds.has(pick.id);
            const billed = line && line.qty > 0;
            return (
              <tr key={pick.id} className={billed ? "keep" : "orphan"}>
                <td>{pick.name}</td>
                <td><span className={`tag ${billed ? "keep" : "orphan"}`}>{billed ? "BILLED" : kept ? "kept" : "removed"}</span></td>
                <td style={{ textAlign: "right" }}>{billed ? line!.qty : "—"}</td>
                <td style={{ textAlign: "right" }}>{billed ? money((line!.unitPrice ?? 0) * line!.qty) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="foot">
        {lines.length} line{lines.length === 1 ? "" : "s"} · <b>{money(lineTotal(lines))}</b>
      </div>
    </div>
  );
}

function App() {
  return (
    <>
      <h1>Cart matches the design</h1>
      <p className="lede">
        One blue vanity with a white countertop, one basin, one gold faucet, one matte black toilet and one tall
        linen cabinet. Left: what the cart billed under the old rule, where a basin or faucet picked in the popup
        billed from the selection alone and never stopped billing when it was replaced or deleted. Right: the same
        design under the new rule, where a fixture bills only while a placement owns it.
      </p>
      <div className="cols">
        <Table lines={oldLines} stale={staleSelection} title={`BEFORE — ${oldLines.length} lines`} tone="bad" />
        <Table lines={newLines} stale={staleSelection} title={`AFTER — ${newLines.length} lines`} tone="good" />
      </div>
      <div className="design">
        <h2>What is actually in the drawing</h2>
        <ul>
          <li>Blue shaker vanity (3 sections) + white countertop — cabinet lines, not shown here</li>
          <li>PL-3608 round undermount basin — installed</li>
          <li>Gold vanity faucet — chosen</li>
          <li>Matte black toilet — installed</li>
          <li>Tall blue linen cabinet — cabinet line, not shown here</li>
        </ul>
        <div className="note">
          Removed: the rectangular basin that PL-3608 replaced, a basin picked but never placed, a default faucet
          the Designer filled in, and a smart toilet deleted from the plan.
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
document.body.dataset.harnessReady = "yes";
