import { describe, expect, it } from "vitest";
import { isWallWineRackCabinet, withWallWineRacks } from "./wallWineRack";

describe("wall wine rack classification", () => {
  it("recognizes the supplier category names and the WRC/WXR/WWC/LWR codes", () => {
    expect(isWallWineRackCabinet({ masterCode: "WRC3015", category: "Wall Wine Rack", subCategory: "Wine Rack / Open Display" })).toBe(true);
    expect(isWallWineRackCabinet({ masterCode: "WRC-30-15", category: "Specialty", subCategory: "Wine Rack" })).toBe(true);
    expect(isWallWineRackCabinet({ masterCode: "WXR3018", category: "Wall", subCategory: "Wine Rack" })).toBe(true);
    expect(isWallWineRackCabinet({ masterCode: "WWC630", category: "Wall", subCategory: "Wine Rack" })).toBe(true);
    expect(isWallWineRackCabinet({ masterCode: "LWR3015", category: "Accessories", subCategory: "Wine Storage" })).toBe(true);
    expect(isWallWineRackCabinet({ masterCode: "WRC3018", category: "Wall", subCategory: "Wine Rack / Open Display", description: '30"X 18" Wall Wine Rack Cabinet' })).toBe(true);
    expect(isWallWineRackCabinet({ category: "Specialty", subCategory: "Wine Rack" })).toBe(true);
    expect(isWallWineRackCabinet({ category: "Wall Wine Rack" })).toBe(true);
  });

  it("leaves refrigerator walls, ordinary uppers, and other specialty boxes alone", () => {
    expect(isWallWineRackCabinet({ masterCode: "WR3624", category: "Wall", subCategory: "Refrigerator Wall", description: "Refrigerator wall cabinet" })).toBe(false);
    expect(isWallWineRackCabinet({ masterCode: "W3018", category: "Wall", subCategory: "Bridge / Stacker" })).toBe(false);
    expect(isWallWineRackCabinet({ masterCode: "PR3015", category: "Wall", subCategory: "Bridge / Stacker", description: "Wall Plate Rack Cabinet" })).toBe(false);
    expect(isWallWineRackCabinet({ category: "Specialty", subCategory: "Spice Pull-Out" })).toBe(false);
    expect(isWallWineRackCabinet({ category: "Accessory", subCategory: "Filler" })).toBe(false);
  });

  it("puts a wine rack filed under Accessories onto the wall list without duplicating one already there", () => {
    const wall = [{ id: 1, masterCode: "W3018", category: "Wall", placement: "wall" }];
    const accessories = [
      { id: 2, masterCode: "LWR3015", category: "Accessories", subCategory: "Wine Storage", placement: "accessory" },
      { id: 1, masterCode: "W3018", category: "Wall", placement: "accessory" },
    ];
    expect(withWallWineRacks(wall, accessories)).toEqual([
      wall[0],
      { id: 2, masterCode: "LWR3015", category: "Accessories", subCategory: "Wine Storage", placement: "wall" },
    ]);
  });
});
