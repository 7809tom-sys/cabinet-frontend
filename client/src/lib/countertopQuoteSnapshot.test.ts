import { describe, expect, it } from "vitest";
import { quoteRoomSnapshot } from "./countertopQuoteSnapshot";
import { quoteFabricationInput } from "./countertopLineArt";

describe("countertop quote room snapshot", () => {
  it("sends the room unchanged without fabrication input", () => {
    const room = { width: 120, depth: 100 };
    expect(quoteRoomSnapshot(room, null)).toBe(room);
  });

  it("adds sinks, island and stone so the admin drawing can be rebuilt", () => {
    const room = { width: 120, depth: 100, persistedEntities: { openings: [{ uid: "w" }], furniture: [], sinks: [], island: null, ponyWalls: [] } };
    const snapshot = quoteRoomSnapshot(room, {
      room: room as never,
      placed: [],
      sinks: [{ uid: "s" } as never],
      island: { x: 1 } as never,
      selectedSurfaces: [{ name: "Calacatta" }],
      edgeProfileId: "eased",
    }) as Record<string, any>;
    expect(snapshot.persistedEntities.openings).toEqual([{ uid: "w" }]);
    expect(snapshot.persistedEntities.sinks).toHaveLength(1);
    expect(snapshot.quoteFabrication.edgeProfileId).toBe("eased");
    const input = quoteFabricationInput({ id: 3, roomData: snapshot, placedCabinets: [] })!;
    expect(input.sinks).toHaveLength(1);
    expect(input.island).toEqual({ x: 1 });
    expect(input.selectedSurfaces).toEqual([{ name: "Calacatta" }]);
    expect(input.edgeProfileId).toBe("eased");
  });
});
