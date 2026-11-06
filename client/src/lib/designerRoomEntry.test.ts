import { describe, expect, it } from "vitest";
import { defaultPaletteTabForRoom, requestedDesignerRoom } from "./designerRoomEntry";

describe("Designer room entry from the URL", () => {
  it("opens the bathroom designer from a bathroom link", () => {
    expect(requestedDesignerRoom("?room=bathroom")).toBe("bathroom");
    expect(requestedDesignerRoom("?roomType=Bathroom")).toBe("bathroom");
    expect(requestedDesignerRoom("?room=vanity")).toBe("bathroom");
  });

  it("keeps every existing link on the kitchen when no room is named", () => {
    expect(requestedDesignerRoom("")).toBeNull();
    expect(requestedDesignerRoom("?affiliate=reaves-way-cabinet-shop")).toBeNull();
    expect(requestedDesignerRoom("?load=8190001")).toBeNull();
  });

  it("ignores a room it does not build", () => {
    expect(requestedDesignerRoom("?room=garage")).toBeNull();
    expect(requestedDesignerRoom("?room=")).toBeNull();
  });

  it("opens each room on the tab that room shops from", () => {
    expect(defaultPaletteTabForRoom("bathroom")).toBe("vanity");
    expect(defaultPaletteTabForRoom("closet")).toBe("closetparts");
    expect(defaultPaletteTabForRoom("laundry")).toBe("appliance");
    expect(defaultPaletteTabForRoom("kitchen")).toBe("base");
    expect(defaultPaletteTabForRoom("other")).toBe("base");
  });
});
