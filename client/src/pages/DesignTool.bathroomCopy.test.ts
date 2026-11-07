import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const designTool = readFileSync(resolve(process.cwd(), "client/src/pages/DesignTool.tsx"), "utf8");
const emailGate = readFileSync(resolve(process.cwd(), "client/src/components/design/EmailGate.tsx"), "utf8");
const designActions = readFileSync(resolve(process.cwd(), "client/src/components/design/DesignActions.tsx"), "utf8");
const attributesDialog = readFileSync(resolve(process.cwd(), "client/src/components/design/CabinetAttributesDialog.tsx"), "utf8");

describe("Bathroom Designer copy and gates", () => {
  it("never offers the measured kitchen Auto-Design in a non-kitchen room", () => {
    // The room gate is the ONLY gate on Auto-Design: any visitor, signed in or
    // not, gets it in a kitchen and nobody gets it in any other room.
    expect(designTool).not.toContain("autoDesignAudienceAllowed");
    expect(designTool).toContain('const autoDesignAvailable = roomType === "kitchen";');
    // The build explains the room rule instead of dying on a missing appliance palette.
    expect(designTool).toContain("Auto-Design builds a measured kitchen.");
    const buildAt = designTool.indexOf("const buildAutoDesignLayout = useCallback(");
    const roomGuard = designTool.indexOf('if (roomType !== "kitchen") {', buildAt);
    const emptyGuard = designTool.indexOf("canRunAutoDesign(", roomGuard);
    expect(roomGuard).toBeGreaterThan(buildAt);
    expect(emptyGuard).toBeGreaterThan(roomGuard);
  });

  it("names the room it is opening in the email gate instead of always promising a kitchen", () => {
    expect(emailGate).toContain("roomLabel?: string | null;");
    expect(emailGate).toContain("const title = roomLabel?.trim()");
    expect(emailGate).not.toContain("{t(\"dt_gate_title\")}\n        </h1>");
    expect(designTool).toContain("roomLabel={designerRoomLabel(roomType)}");
    expect(designTool).toContain("export function designerRoomLabel(roomType: RoomType): string {");
  });

  it("titles the Save dialog with the plan's own room", () => {
    expect(designActions).toContain('const planRoomLabel = roomType === "bathroom" ? "Bathroom"');
    expect(designActions).toContain("`Save ${planRoomLabel.toLowerCase()} design`");
  });

  it("does not print the CabinetDealz brand inside an affiliate plan's filler help", () => {
    expect(designTool).not.toContain("installed strip uses existing CabinetDealz filler stock");
    expect(attributesDialog).not.toContain("Short cuts use real CabinetDealz filler stock");
    expect(designTool).toContain("Each installed strip uses the selected line’s existing filler stock");
    expect(attributesDialog).toContain("Short cuts use real filler stock from the selected line.");
  });

  it("keeps the room-type row wide enough for the longest label", () => {
    // A five-column grid gave each cell ~40px, which clipped "Bathroom".
    expect(designTool).not.toContain('<div className="grid grid-cols-5 gap-0.5 rounded-lg border border-border p-0.5 bg-muted/30 mb-2">');
    expect(designTool).toContain('data-testid={`designer-room-type-${rt.value}`}');
    expect(designTool).toContain("min-w-0 shrink-0 whitespace-nowrap px-1.5 py-1.5");
  });

  it("reopens a restored bathroom plan on the Vanity tab, not the kitchen Base tab", () => {
    expect(designTool).toContain('if (restoredRoom === "bathroom") setPaletteType("vanity");');
    expect(designTool).toContain('if (savedRoom === "bathroom") setPaletteType("vanity");');
  });

  it("labels an in-flight price as pricing rather than unavailable", () => {
    expect(designTool).toContain("const cabinetPricingInFlight = pricePairs.length > 0");
    expect(designTool).toMatch(/: cabinetPricingInFlight\s*\n\s*\? "Pricing…"/);
    expect(designTool).toMatch(/: "Unavailable"\s*\n\s*: "—"/);
  });

  it("promises a door style, not a distributor, in the Bathroom Vanity tab", () => {
    expect(designTool).toContain('placeholder="Choose a door style"');
    expect(designTool).not.toContain('placeholder={catalogDistributorScopeId == null ? "Choose a distributor or door style" : "Choose a door style"}');
  });
});
