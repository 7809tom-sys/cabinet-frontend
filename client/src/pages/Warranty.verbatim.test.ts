import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sentences = [
  "Vendor warrants to the original consumer purchaser",
  "Forevermark Cabinetry offers a limited warranty",
  "This limited warranty is governed by the laws of the State of New Jersey.",
];

describe("warranty page migration", () => {
  const returns = readFileSync(resolve(import.meta.dirname, "ReturnPolicy.tsx"), "utf8");
  const warranty = readFileSync(resolve(import.meta.dirname, "Warranty.tsx"), "utf8");

  it("copies warranty sentences verbatim and leaves the return page in place", () => {
    for (const sentence of sentences) {
      expect(returns).toContain(sentence);
      expect(warranty).toContain(sentence);
    }
  });
});
