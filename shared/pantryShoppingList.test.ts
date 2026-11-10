import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { PantryShoppingCard } from "../client/src/components/pantry/PantryShoppingCard";
import { PANTRY_MASTER_CODES } from "./pantryMasterCodes";
import { pantryElevationSvg } from "./pantryElevationSvg";
import { pantryShoppingList, PANTRY_PRICE_PENDING } from "./pantryShoppingList";

describe("pantry shopping list", () => {
  it("shows the 1876 stack with a pending price when a component has none", () => {
    const list = pantryShoppingList("1876", { "3DB18": 120.5, W184224: null });
    expect(list).toMatchObject({
      masterCode: "1876",
      description: '18" three-drawer base, 34.5" H, with the 42" stacker W184224 on top, 76.5" total, for confined spaces',
      diagramPath: "/pantry/1876.svg",
      total: null,
    });
    expect(list?.lines).toEqual([
      { code: "3DB18", description: '18" 3 Drawer Base Cabinet', qty: 1, price: 120.5, priceLabel: "$120.50" },
      { code: "W184224", description: '18" x 42" x 24" Wall Cabinet', qty: 1, price: null, priceLabel: PANTRY_PRICE_PENDING },
    ]);
  });

  it("sums a complete 1884 list and builds a list for every pantry master", () => {
    const list = pantryShoppingList("1884", { UCB1854: 200, W183024: 80.25 });
    expect(list?.total).toBe(280.25);
    expect(list?.lines.every((line) => line.qty === 1 && line.priceLabel !== PANTRY_PRICE_PENDING)).toBe(true);
    for (const master of PANTRY_MASTER_CODES) {
      const built = pantryShoppingList(master.masterCode, {});
      expect(built?.diagramPath).toBe(`/pantry/${master.masterCode}.svg`);
      expect(built?.lines.map((line) => line.code)).toEqual(master.components.map((part) => part.code));
      expect(built?.total).toBeNull();
    }
  });

  it("draws the 1876 elevation with the drawer base on the bottom", () => {
    const svg = pantryElevationSvg(PANTRY_MASTER_CODES.find((master) => master.masterCode === "1876")!);
    const file = readFileSync(resolve(__dirname, "../client/public/pantry/1876.svg"), "utf8");
    expect(file).toBe(svg);
    expect(svg).toContain("3DB18");
    expect(svg).toContain("W184224");
    expect(svg).toContain("34.5&quot;");
    expect(svg).toContain("42&quot;");
    expect(svg).toContain("76.5&quot;");
    expect(svg).toContain("18&quot; W");
    const labelY = (code: string) => {
      const before = svg.slice(0, svg.indexOf(`>${code}<`));
      const marks = [...before.matchAll(/y="([\d.]+)"/g)];
      return Number(marks.at(-1)?.[1]);
    };
    expect(labelY("3DB18")).toBeGreaterThan(labelY("W184224"));
    for (const code of ["1884", "1890", "1896"]) {
      const master = PANTRY_MASTER_CODES.find((item) => item.masterCode === code)!;
      expect(readFileSync(resolve(__dirname, `../client/public/pantry/${code}.svg`), "utf8")).toBe(pantryElevationSvg(master));
    }
  });

  it("renders the preload card without being wired into the designer", () => {
    const list = pantryShoppingList("1876", { "3DB18": null, W184224: null })!;
    const html = renderToStaticMarkup(createElement(PantryShoppingCard, { list }));
    expect(html).toContain('src="/pantry/1876.svg"');
    expect(html).toContain("for confined spaces");
    expect(html).toContain("3DB18");
    expect(html).toContain(PANTRY_PRICE_PENDING);
    const frozen = [
      "../client/src/pages/DesignTool.tsx",
      "../client/src/components/design/InteractiveRoom3D.tsx",
      "../client/src/components/design/WallBuilder.tsx",
    ];
    for (const path of frozen) {
      const source = readFileSync(resolve(__dirname, path), "utf8");
      expect(source).not.toContain("pantryShoppingList");
      expect(source).not.toContain("PantryShoppingCard");
    }
  });
});
