import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OUTREACH_TIP_IDS } from "./outreachTips";

const panel = readFileSync(new URL("./OutreachPanel.tsx", import.meta.url), "utf8");

describe("Outreach tips wiring", () => {
  it("places every tip in the Outreach panel", () => {
    for (const id of OUTREACH_TIP_IDS) {
      expect(panel.includes(`tip="${id}"`) || panel.includes(`<OutreachTip id="${id}" />`), id).toBe(true);
    }
  });

  it("shows first-contact and follow-up tips once, on steps 1 and 2", () => {
    expect(panel).toContain('{index === 0 && <OutreachTip id="firstContact" />}{index === 1 && <OutreachTip id="followUp" />}');
    expect(panel).toContain('{index === 0 && <OutreachTip id="offer" />}');
  });
});
