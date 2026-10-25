import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/admin/GeneratedDesignImagesAdmin.tsx"), "utf8");
const tabs = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");

describe("GeneratedDesignImagesAdmin", () => {
  it("shows generated-image provenance and asks an administrator to select a cabinet finish", () => {
    expect(source).toContain("Generated Design Images");
    expect(source).toContain("Cabinet finish");
    expect(source).toContain("Customer");
    expect(source).toContain("Originator");
    expect(source).toContain("Choose cabinet finish");
  });

  it("uses an explicit room-scene carousel approval switch", () => {
    expect(source).toContain("Room-scene carousel");
    expect(source).toContain("setRoomSceneCarousel.useMutation");
    expect(source).toContain("Private until approved");
    expect(source).toContain("Approved and active in the room-scene carousel.");
    expect(source).toContain("one exact kitchen image cannot appear as more than one cabinet finish");
  });

  it("is available from the grouped administration navigation", () => {
    expect(tabs).toContain('value: "generated-design-images"');
    expect(tabs).toContain('<GeneratedDesignImagesAdmin />');
  });
});
