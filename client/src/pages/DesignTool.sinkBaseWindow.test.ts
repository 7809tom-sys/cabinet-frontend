import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Design Tool sink-base window placement", () => {
  it("prioritizes an active-wall window for an ordinary sink-base catalog placement without overriding a direct drop", () => {
    expect(source).toContain("const wantsWindowCenteredSinkBase = accPlacement === \"base\"");
    expect(source).toContain("&& isSinkBaseCabinet(c)");
    expect(source).toContain("&& x == null");
    expect(source).toContain("&& y == null");
    expect(source).toContain("? sinkBaseWindowPlacement(activeWall, room, width, depth, height, prev, openings)");
    expect(source).toContain("const hasActiveWallWindow = wantsWindowCenteredSinkBase");
    expect(source).toContain("const sinkWindowFallbackSpot = hasActiveWallWindow && !sinkWindowSpot");
    expect(source).toContain("} else if (sinkWindowSpot) {");
    expect(source).toContain("spot = sinkWindowSpot;");
  });

  it("adds one centered default sink with faucet and replaces it when a verified fixture is selected", () => {
    expect(source).toContain("const defaultSink = makeDefaultSinkForCabinet(finalCab, room, defaultSinkType);");
    expect(source).toContain("fixtureBelongsToCabinet(sink, finalCab)");
    expect(source).toContain("...prevSinks.filter((existingSink) => !fixtureBelongsToCabinet(existingSink, cab))");
  });

  it("emits a short-lived canvas confirmation after the sink base is centered under its matched window", () => {
    expect(source).toContain("const [sinkWindowSnap, setSinkWindowSnap] = useState");
    expect(source).toContain("const showSinkWindowSnap = useCallback");
    expect(source).toContain("}, 2400);");
    expect(source).toContain("showSinkWindowSnap(finalCab.uid, sinkWindowPlacement.openingUid);");
    expect(source).toContain("sinkWindowSnap={sinkWindowSnap}");
  });
});
