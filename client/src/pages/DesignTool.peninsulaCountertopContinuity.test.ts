import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");

describe("connected peninsula countertop continuity", () => {
	it("activates the perimeter countertop when any real base or corner support is placed", () => {
	  expect(source).toContain('bearsCountertop, bearsIslandCountertop');
	  expect(source).toContain('if (!requestedIslandFace && bearsCountertop(finalCab)) setCountertop(true);');
	  expect(source).toContain('() => !!island || placed.some((p) => bearsCountertop(p))');
	  expect(source).toContain('const countertopSupportCount = useMemo(');
	  expect(source).toContain('if (previousCountertopSupportCountRef.current === 0 && countertopSupportCount > 0)');
	});

	it("inherits the parent overhang for a new return and applies later overhang edits to the entire connected chain", () => {
	  expect(source).toContain("countertopSeatingOverhang: peninsulaCountertopSeatingOverhang(parent, room)");
	  expect(source).toContain("countertopPonyWallBarOverhang: peninsulaCountertopPonyWallBarOverhang(parent, room)");
	  expect(source).toContain("const rootId = rootIdFor(current);");
	  expect(source).toContain("if (rootIdFor(run) !== rootId) return run;");
	  expect(source).toContain("countertopPonyWallBarOverhang: draft.drywallBackPonyWall ? draft.countertopPonyWallBarOverhang : 0");
	  expect(source).toContain('data-testid="peninsula-pony-wall-bar-top"');
	  expect(source).toContain('aria-label="Bar countertop extension across drywall pony wall"');
	});
});
