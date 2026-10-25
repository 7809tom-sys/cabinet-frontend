import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./PlanCanvas.tsx", import.meta.url), "utf8");

describe("PlanCanvas wall snap success feedback", () => {
  it("tracks a true wall snap separately from cabinet and island magnet feedback", () => {
    expect(source).toContain("const [hoverSnapWall, setHoverSnapWall] = useState(false);");
    expect(source).toContain("setHoverSnapWall(Boolean(snapped.snappedWall));");
    expect(source).toContain("setHoverSnapWall(true);");
  });

  it("briefly confirms a released wall snap with an accessible green outline and label", () => {
    expect(source).toContain("if (snappedUid && hoverSnapWall) {");
    expect(source).toContain("setWallSnapSuccessUid(snappedUid);");
    expect(source).toContain("}, 1600);");
    expect(source).toContain('data-wall-snap-confirmed={showWallSnapSuccess ? "true" : undefined}');
    expect(source).toContain('data-testid="wall-snap-success-indicator"');
    expect(source).toContain("WALL SNAP");
    expect(source).toContain('"3px solid #16a34a"');
    expect(source).toContain('rgba(34,197,94,0.72)');
  });

  it("clears the transient confirmation before beginning a new drag", () => {
    expect(source).toContain("setWallSnapSuccessUid(null);");
    expect(source).toContain("clearTimeout(wallSnapSuccessTimeout.current);");
  });
});
