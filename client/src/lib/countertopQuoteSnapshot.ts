import type { CountertopFabricationInput } from "@/lib/countertopFabricationSheet";
import type { QuoteFabricationExtras } from "@/lib/countertopLineArt";

/**
 * roomData saved with a countertop quote. With the Designer's fabrication input
 * it also carries the island, sinks and pony walls (under persistedEntities,
 * the same place a saved design keeps them) and the stone, edge and backsplash
 * (under quoteFabrication), so the admin can draw the quote's line drawing.
 * Without it, the room is sent exactly as before.
 */
export function quoteRoomSnapshot(roomData: unknown, fabricationInput?: CountertopFabricationInput | null): unknown {
  if (!fabricationInput) return roomData;
  const room = (roomData && typeof roomData === "object" && !Array.isArray(roomData) ? roomData : fabricationInput.room) as Record<string, unknown>;
  const persisted = (room.persistedEntities && typeof room.persistedEntities === "object" ? room.persistedEntities : {}) as Record<string, unknown>;
  const extras: QuoteFabricationExtras = {
    selectedSurfaces: fabricationInput.selectedSurfaces ?? [],
    edgeProfileId: fabricationInput.edgeProfileId ?? null,
    backsplash: fabricationInput.backsplash ?? null,
    job: fabricationInput.job ?? null,
  };
  return {
    ...room,
    persistedEntities: {
      openings: [],
      furniture: [],
      ...persisted,
      sinks: fabricationInput.sinks ?? [],
      island: fabricationInput.island ?? null,
      ponyWalls: fabricationInput.ponyWalls ?? [],
    },
    quoteFabrication: extras,
  };
}
