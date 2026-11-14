/**
 * When a sink and faucet were picked in the designer-open pop-up, Auto Design
 * must apply those choices after the build and must not open the end-of-flow
 * questions again. The completion path and faucet auto-fill must not add a
 * second sink or faucet when one is already placed.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const designTool = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = source.indexOf(end, from);
  expect(to, `missing ${end}`).toBeGreaterThan(from);
  return source.slice(from, to);
}

describe("opening sink and faucet picks carry through Auto Design", () => {
  it("decides the post-build questions from the designer-open pick", () => {
    expect(designTool).toContain("postBuildFixturePrompts(openingPick)");
    expect(designTool).toContain("applyOpeningSinkAfterBuildRef.current(builtSinkBase, product)");
    expect(designTool).toContain("promptAutoDesignSinkAfterBuild(builtSinkBase)");
  });

  it("does not ask for a faucet again when one was already chosen at the start", () => {
    const remember = between(
      designTool,
      "const rememberAutoDesignSink = useCallback",
      "adoptAutoDesignSinkRef.current = rememberAutoDesignSink",
    );
    expect(remember).toContain("productFromOpeningPick(autoDesignFaucetProductsRef.current, fixturePickRef.current.faucetId)");
    expect(remember).toContain("applyChosenAutoDesignFaucet(result.sink, openingFaucet)");
    expect(remember.indexOf("openingFaucet")).toBeGreaterThan(-1);
    expect(remember.indexOf("queueAutoDesignFaucetPrompt")).toBeGreaterThan(remember.indexOf("openingFaucet"));
  });

  it("applies the opening faucet after a sink is placed instead of opening the faucet dialog", () => {
    expect(designTool).toContain("applyOpeningFaucetOrPrompt(placedSinkUid)");
    expect(designTool).toContain("applyOpeningFaucetOrPrompt(queuedUid)");
  });

  it("does not add a second sink or faucet in the completion path or the end-of-run auto-fill", () => {
    const complete = between(designTool, "const completeAutoDesignLayout = useCallback", "finishAutoDesignLayoutRef.current = completeAutoDesignLayout");
    expect(complete).toContain("not add a second sink or a second faucet");
    expect(complete).not.toContain("promptAutoDesignSinkAfterBuild");
    expect(complete).not.toContain("chooseAutoDesignSink");
    expect(designTool).toContain("faucetDefaultFillRanRef");
  });
});
