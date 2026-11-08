import {
  isPelicanVanityFaucetSku,
  isPelicanVanitySinkSku,
} from "@shared/pelicanBathroomFixtures";
import { isPelicanBathroomFixtureProfileVerified } from "./pelicanBathroomFixtureProfiles";
import { surfaceRole } from "./pelican";

/**
 * Is this selected catalog row a bathroom FIXTURE (a discrete object you place in
 * the room) rather than an area material?
 *
 * The distinction decides how the cart is priced. A flooring, backsplash or
 * countertop pick is legitimately bought from the selection alone: you choose a
 * tile and the quantity comes from the measured area. A mirror, toilet, basin or
 * faucet is not — it is only real when it is installed in the plan. So a fixture
 * pick must contribute **zero** to the cart until a placement owns it.
 *
 * Only verified fixture profiles (toilet, bidet, tub, shower door/wall, floor tub
 * filler) were treated that way. Vanity basins and vanity faucets were not: a basin
 * lives on a `SinkFixture` and a faucet is a property of that basin, so neither has
 * a furniture profile, and a basin that was picked and then replaced or deleted
 * kept billing at the default quantity of one.
 */
export type BathroomFixtureSurfacePick = {
  pelicanCode?: string | null;
  name?: string | null;
  category?: string | null;
  subCategory?: string | null;
  sellPrice?: number | null;
};

/** Area products are bought by measurement, so they are not fixtures. */
function isAreaMaterial(pick: BathroomFixtureSurfacePick): boolean {
  // `surfaceRole` is the single source the designer and cart already use to split
  // flooring / backsplash / countertop from everything else. Only those three are
  // bought by measurement; every other role — including "sink" and "faucet" — is a
  // discrete fixture that must be placed before it can bill.
  const role = surfaceRole(pick);
  if (role === "flooring" || role === "backsplash" || role === "countertop") return true;
  const text = `${pick.category ?? ""} ${pick.subCategory ?? ""}`.toLowerCase();
  return /\b(?:flooring|floor tile|tile & mosaic|mosaic|backsplash|quartz|slab|countertop)\b/.test(text);
}

/**
 * True when the pick is a bathroom fixture, so its cart quantity must come only
 * from a real placement.
 */
export function isCartableBathroomFixtureSurface(pick: BathroomFixtureSurfacePick): boolean {
  const code = (pick.pelicanCode ?? "").trim();
  if (isPelicanBathroomFixtureProfileVerified(code)) return true;
  if (isPelicanVanitySinkSku(code)) return true;
  if (isPelicanVanityFaucetSku(code)) return true;
  if (isAreaMaterial(pick)) return false;
  // A bathroom fixture row that has no verified profile yet (a toilet still waiting
  // on a technical sheet, for example) is still a fixture: it must not bill from a
  // pick alone.
  const text = `${pick.name ?? ""} ${pick.category ?? ""} ${pick.subCategory ?? ""}`.toLowerCase();
  if (/\btoilet|bidet|bathtub|tub\b|shower|vanity sink|basin|faucet\b/.test(text)) return true;
  // A bare basin SKU whose row carries no descriptive text: the catalog's sink
  // family is PL-3xxx / PL-16xx / PL-R/O#### (cultured marble). Any of those is a
  // basin, never an area material, so it must be seeded at zero rather than billed
  // from a stale pick. This is the gap that let PL-3609 and PL-3099 keep billing
  // after they were replaced.
  if (isPelicanSinkFamilyCode(code)) return true;
  return false;
}

/**
 * A catalog SKU in Pelican's sink model ranges: `PL-3xxx` (porcelain basins),
 * `PL-16xx` (Pearl/Sandbar basins), and `PL-R####` / `PL-O####` (cultured marble
 * vanity tops). Finish suffixes such as "White" or "Bone" are allowed.
 */
export function isPelicanSinkFamilyCode(code: string | null | undefined): boolean {
  const normalized = (code ?? "").trim().toUpperCase();
  return /^PL-(?:3\d{3}|16\d{2}|[RO]\d{4})(?:\s|$)/.test(normalized);
}
