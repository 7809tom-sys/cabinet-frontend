/**
 * HARD RULE wiring: the Designer places a faucet at the sink on every build and
 * every layout load, just as it places the bridge above the range.
 *
 * The behaviour itself is covered by `autoDesignFaucetMandatory.test.ts` (which
 * runs the real build). This file holds the parts only the source can prove: that
 * both build paths and the load pass call the mandatory pass, that the block
 * reaches the review/report surface, and that nothing removes an existing faucet.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");
const layoutSource = readFileSync(new URL("../lib/autoDesignLayout.ts", import.meta.url), "utf8");
const faucetSource = readFileSync(new URL("../lib/autoDesignFaucet.ts", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("a faucet is placed on every build path", () => {
  it("runs inside the auto-design engine build", () => {
    expect(layoutSource).toContain("ensureMandatorySinkFaucets(sinks, args.faucetCatalog ?? [])");
    // It runs before the build returns, and its notes reach the build's notes.
    const call = layoutSource.indexOf("ensureMandatorySinkFaucets(");
    expect(call).toBeGreaterThan(0);
    expect(call).toBeLessThan(layoutSource.indexOf("reviewFindings: buildDesignerReviewList"));
    expect(layoutSource).toContain("notes.push(...mandatoryFaucet.notes)");
    expect(layoutSource).toContain("everySinkHasFaucet:");
    expect(layoutSource).toContain("usedDefaultFaucet:");
  });

  it("feeds the faucet catalog into the engine build", () => {
    expect(designTool).toContain("faucetCatalog: autoDesignFaucetProducts");
  });

  it("runs as its own pass in the Designer, after build and on load", () => {
    const pass = between(designTool, "const faucetFillRanRef = useRef", "const product = defaultAutoDesignFaucet(autoDesignFaucetProducts);");
    // The fallback fixture must match the room and the BASE: a bathroom vanity
    // gets the verified vanity faucet, not the 26" kitchen pull-down, and a
    // farmhouse / apron-front base in that same bathroom still gets a kitchen one.
    expect(pass).toContain("ensureMandatorySinkFaucets(sinks, autoDesignFaucetProducts, {");
    expect(pass).toContain("bathroom: roomType === \"bathroom\",");
    expect(pass).toContain("bathroomForSink:");
    expect(pass).toContain("if (everySinkHasFaucet(sinks)) return;");
    expect(pass).toContain("setSinks(result.sinks)");
    // The pass runs once per plan, not on every unrelated render.
    expect(pass).toContain("faucetFillRanRef.current.has(fillKey)");
  });

  it("bumps the faucet pass on every build and every load", () => {
    expect(designTool).toContain("const [faucetEpoch, setFaucetEpoch] = useState(0)");
    const buildCommit = between(designTool, "setOverRangeEpoch((epoch) => epoch + 1);\n    // A freshly built plan", "const selectedWallCabinetHeight");
    expect(buildCommit).toContain("setFaucetEpoch((epoch) => epoch + 1)");
    const loadCommit = between(designTool, "// A freshly loaded plan is a new pass", "const persisted = d.room?.persistedEntities");
    expect(loadCommit).toContain("setFaucetEpoch((epoch) => epoch + 1)");
  });

  it("re-raises a sink window for a taller faucet, through the one shared rule", () => {
    expect(layoutSource).toContain("raiseWindowsForDeckFaucet({ sinks, room, openings: workingOpenings, wallLabels })");
    // The Designer's own pass goes through the same function, never its own copy.
    const pass = between(designTool, "const faucetFillRanRef = useRef", "const product = defaultAutoDesignFaucet(autoDesignFaucetProducts);");
    expect(pass).toContain("raiseWindowsForDeckFaucet({ sinks: result.sinks, room, openings, wallLabels: autoDesignWallLabelsRef.current })");
  });
});

describe("the faucet is add-only", () => {
  it("gates on a drawable faucet, so a bare flag still gets one", () => {
    // `makeSink` sets `faucet: true` before any faucet is chosen; a render gate on
    // the flag alone would leave the sink with nothing to draw.
    expect(faucetSource).toContain("sinkFaucetIsSatisfied");
    expect(faucetSource).toContain("sinkHasRenderableFaucet");
    expect(faucetSource).toContain("if (sinkFaucetIsSatisfied(sink)) {");
    expect(faucetSource).toContain('source = "existing";');
  });

  it("never filters, removes, or replaces a sink", () => {
    const ensure = between(faucetSource, "export function ensureMandatorySinkFaucets", "export function withDefaultFaucet");
    expect(ensure).not.toMatch(/\.filter\(/);
    expect(ensure).not.toMatch(/\.splice\(/);
    expect(ensure).not.toMatch(/\.slice\(0/);
    // One mapped result per sink, in order.
    expect(ensure).toContain("sinks.map((sink) => {");
  });

  it("reports the default fixture instead of substituting silently", () => {
    expect(faucetSource).toContain("usedDefault = true");
    expect(faucetSource).toContain("sells no faucet");
    expect(faucetSource).toContain("DEFAULT_PELICAN_KITCHEN_FAUCET");
    expect(faucetSource).toContain("DEFAULT_PELICAN_VANITY_FAUCET");
    // The fallback is chosen per SINK, so a bathroom with a vanity base and a
    // farmhouse base gives each the right fixture.
    expect(faucetSource).toContain("const fallback = attachedUids.some((uid) => {");
    expect(faucetSource).toContain("options.bathroomForSink");
  });
});

describe("the faucet is modelled on the sink record", () => {
  it("carries the published dimensions the 3D assembly is built from", () => {
    // A faucet is a SinkFixture property: the flag plus the form and the three
    // dimensions. `addSinkFixture` draws the assembly from exactly these.
    for (const field of ["faucetForm", "faucetOverallHeight", "faucetSpoutLength", "faucetSpoutHeight", "faucetFinish"]) {
      expect(faucetSource).toContain(field);
    }
    const renderer = readFileSync(new URL("../components/design/InteractiveRoom3D.tsx", import.meta.url), "utf8");
    expect(renderer).toContain("if (!sink.faucet) return;");
    expect(renderer).toContain("sink.faucetOverallHeight == null || sink.faucetSpoutLength == null || sink.faucetSpoutHeight == null || !sink.faucetForm");
    expect(renderer).toContain("sinkFaucetBase: true");
    expect(renderer).toContain("sinkFaucetSpout: true");
  });
});
