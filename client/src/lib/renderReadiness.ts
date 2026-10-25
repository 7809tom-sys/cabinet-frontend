/**
 * Gating logic for the AI 3D render / "3D View".
 *
 * The customer can only generate a 3D view once the room has the four things
 * that make a render look complete and truthful: at least one placed cabinet,
 * a flooring, a countertop, and a sink WITH a faucet. Each requirement can be
 * satisfied by EITHER the built-in Designer toggles OR a real Pelican Surfaces
 * & Fixtures pick, so a customer using either path can proceed.
 */

export type RenderReadinessInput = {
  /** Number of non-appliance cabinets placed on the canvas. */
  cabinetCount: number;
  /** Built-in flooring material chosen in the Designer (null if none). */
  builtInFlooringId: string | null;
  /** A Pelican flooring product was picked in Surfaces & Fixtures. */
  hasSurfaceFlooring: boolean;
  /** Built-in countertop toggle is on. */
  builtInCountertop: boolean;
  /** A Pelican countertop product was picked in Surfaces & Fixtures. */
  hasSurfaceCountertop: boolean;
  /** A sink is placed on the counter AND has a faucet. */
  hasSinkWithFaucet: boolean;
  /** A Pelican sink product was picked. */
  hasSurfaceSink: boolean;
  /** A Pelican faucet product was picked. */
  hasSurfaceFaucet: boolean;
};

export type RenderReadiness = {
  ready: boolean;
  /** Human-readable names of what's still missing, in display order. */
  missing: string[];
  /** A single sentence prompting the user; empty when ready. */
  message: string;
};

export function computeRenderReadiness(input: RenderReadinessInput): RenderReadiness {
  const missing: string[] = [];

  if (input.cabinetCount === 0) missing.push("at least one cabinet");

  const hasFlooring = !!input.builtInFlooringId || input.hasSurfaceFlooring;
  if (!hasFlooring) missing.push("flooring");

  const hasCountertop = input.builtInCountertop || input.hasSurfaceCountertop;
  if (!hasCountertop) missing.push("a countertop");

  // A sink+faucet is satisfied by a placed sink that has a faucet, OR by a
  // Pelican sink pick paired with a Pelican faucet pick.
  const hasSinkAndFaucet =
    input.hasSinkWithFaucet || (input.hasSurfaceSink && input.hasSurfaceFaucet);
  if (!hasSinkAndFaucet) missing.push("a sink & faucet");

  const ready = missing.length === 0;
  return {
    ready,
    missing,
    message: ready ? "" : `Add ${joinList(missing)} to generate your 3D view.`,
  };
}

/** Join a list with commas and a trailing "and": [a,b,c] -> "a, b, and c". */
function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}
