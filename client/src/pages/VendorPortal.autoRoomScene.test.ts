import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/VendorPortal.tsx"), "utf8");
const badgeSource = readFileSync(
  resolve(process.cwd(), "client/src/components/doorStyles/VendorAutoRoomSceneBadge.tsx"),
  "utf8",
);

describe("vendor door-style automatic room scenes", () => {
  it("shows a read-only status from featured styles or the vendor status query", () => {
    const doorStyles = source.slice(source.indexOf("function DoorStylesPage"), source.indexOf("type DoorMeasurementStyle"));
    const featured = source.slice(source.indexOf("function VendorFeaturedStylesPage"), source.indexOf("// ─── Shipping Page"));
    const editor = source.slice(source.indexOf("function VendorFeaturedStyleEditor"), source.indexOf("function VendorFeaturedStylesPage"));
    expect(source).toContain("VENDOR_AUTO_ROOM_SCENE_COPY");
    expect(readFileSync(resolve(process.cwd(), "client/src/lib/autoRoomScene.ts"), "utf8")).toContain(
      "CabinetDealz confirms your door and drawer photos before a room scene is generated.",
    );
    expect(doorStyles).toContain("<VendorAutoRoomSceneBadge styleId={style.id} distributorId={adminDistId} live />");
    expect(featured).toContain("snapshot={style.autoRoomScene ?? null}");
    expect(featured).toContain("drawerSampleVerified={style.drawerSampleVerified}");
    expect(featured).toContain("trpc.distributorPortal.featuredStyles.useQuery");
    expect(editor).toContain("sampleVerification?.autoRoomScene ?? style.autoRoomScene ?? null");
    expect(editor).toContain("showCopy");
    expect(badgeSource).toContain("doorStyleAutoRoomScene.useQuery");
    expect(badgeSource).toContain("distributorId != null ? { styleId, distributorId } : { styleId }");
  });

  it("does not give vendors verify, unverify, retry, or publish", () => {
    const doorStyles = source.slice(source.indexOf("function DoorStylesPage"), source.indexOf("// ─── Shipping Page"));
    expect(doorStyles).not.toContain("setSampleImageVerified");
    expect(doorStyles).not.toContain("retryAutoRoomScene");
    expect(doorStyles).not.toContain("updateRoomScene");
    expect(doorStyles).not.toContain("autoRoomSceneStatus");
    expect(badgeSource).not.toContain("setSampleImageVerified");
    expect(badgeSource).not.toContain("retryAutoRoomScene");
    expect(badgeSource).not.toContain("updateRoomScene");
    expect(badgeSource).not.toContain(">Retry<");
    expect(badgeSource).not.toContain("onChange");
  });
});
