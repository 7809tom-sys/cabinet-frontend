import { describe, expect, it } from "vitest";
import { affiliateStyleName } from "./affiliateStyleName";

const hickory = { id: 330007, ourName: "Hickory Shaker", aliasName: "Silva Shaker (Ashford)", styleCode: "HS" };

describe("affiliateStyleName", () => {
  it("uses a door name override only for the affiliate that supplies it", () => {
    expect(affiliateStyleName(hickory, { 330007: "Rustic Hickory" })).toBe("Rustic Hickory");
    expect(affiliateStyleName(hickory)).toBe("Silva Shaker (Ashford)");
    expect(affiliateStyleName(hickory, {})).toBe("Silva Shaker (Ashford)");
  });

  it("does not alter the shared master style object", () => {
    affiliateStyleName(hickory, { 330007: "Rustic Hickory" });
    expect(hickory.ourName).toBe("Hickory Shaker");
    expect(hickory.aliasName).toBe("Silva Shaker (Ashford)");
  });
});
