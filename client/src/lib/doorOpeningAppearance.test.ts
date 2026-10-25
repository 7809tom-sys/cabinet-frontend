import { describe, expect, it } from "vitest";
import { doorOpeningAppearance, applyDoorOpeningAttributes } from "./doorOpeningAppearance";
import { makeOpening, OPENINGS, type WallOpening } from "./design";

const room = { width: 120, depth: 96, ceilingHeight: 96 };
const door = makeOpening(OPENINGS.find((item) => item.key === "interior-door")!, "left", room);

describe("room door attributes", () => {
  it("renders old and new standard room doors white at 25% planning opacity", () => {
    expect(doorOpeningAppearance(door)).toEqual({ color: "#ffffff", opacity: 0.25 });
    expect(doorOpeningAppearance({ ...door, doorColor: "bad", doorOpacity: NaN })).toEqual({ color: "#ffffff", opacity: 0.25 });
  });
  it("saves hinge and open state and rejects single-leaf swing for a sliding door", () => {
    const patch = { width:30, height:80, color:"#ffffff", opacity:.25, openAngle:90 as const, hinge:"right" as const };
    const result = applyDoorOpeningAttributes(door,patch,room);
    expect(result.ok).toBe(true);
    if (result.ok) expect(JSON.parse(JSON.stringify(result.item))).toMatchObject({doorOpenAngle:90,doorHinge:"right"});
    expect(applyDoorOpeningAttributes({...door,label:"Patio / Sliding 72"},patch,room).ok).toBe(false);
    expect(applyDoorOpeningAttributes({...door,doorStyle:"bifold"},patch,room).ok).toBe(false);
  });
  it("keeps the separate legacy closet bifold defaults", () => {
    expect(doorOpeningAppearance({ ...door, doorStyle: "bifold" })).toEqual({ color: "#ad8059", opacity: 0.38 });
  });
  it("preserves identity and exact dimensions/color/transparency through save and restore", () => {
    const before = JSON.stringify(door);
    const result = applyDoorOpeningAttributes(door, { width: 32.5, height: 84, color: "#AABBCC", opacity: 0.15 }, room);
    expect(result.ok).toBe(true);
    if (!result.ok) throw Error(result.error);
    expect(result.item).toMatchObject({ uid: door.uid, side: "left", offset: door.offset, width: 32.5, height: 84, doorColor: "#aabbcc", doorOpacity: 0.15 });
    expect(doorOpeningAppearance(JSON.parse(JSON.stringify(result.item)))).toEqual({ color: "#aabbcc", opacity: 0.15 });
    expect(JSON.stringify(door)).toBe(before);
  });
  it.each([{ width: 999 }, { height: 999 }, { width: NaN }, { height: -1 }, { opacity: 1.1 }, { color: "brown" }])("rejects invalid edits without mutating source (%j)", (invalid) => {
    const before = JSON.stringify(door);
    expect(applyDoorOpeningAttributes(door, { width: 32, height: 84, color: "#ffffff", opacity: .25, ...invalid }, room).ok).toBe(false);
    expect(JSON.stringify(door)).toBe(before);
  });
  it("respects the actual per-wall ceiling and rejects non-door edits", () => {
    const patch = { width: 30, height: 90, color: "#ffffff", opacity: .25 };
    expect(applyDoorOpeningAttributes(door, patch, { ...room, wallCeilings: { left: { high:96, low:84 } } }).ok).toBe(false);
    expect(applyDoorOpeningAttributes({ ...door, kind: "window" } as WallOpening, patch, room).ok).toBe(false);
  });
});
