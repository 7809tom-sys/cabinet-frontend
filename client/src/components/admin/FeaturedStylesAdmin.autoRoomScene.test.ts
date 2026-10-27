import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const adminSource = readFileSync(
  resolve(process.cwd(), "client/src/components/admin/FeaturedStylesAdmin.tsx"),
  "utf8",
);
const controlsSource = readFileSync(
  resolve(process.cwd(), "client/src/components/doorStyles/AdminDoorStyleRoomScene.tsx"),
  "utf8",
);

describe("FeaturedStylesAdmin automatic room scenes", () => {
  it("shows separate door and drawer-front verification on the door-style editor and lists", () => {
    expect(adminSource).toContain("drawerSampleVerified?: boolean");
    expect(adminSource).toContain("autoRoomScene?: AutoRoomScene | null");
    expect(adminSource).toContain("<AdminStyleRoomSceneControls style={style} showIdleHint />");
    expect(adminSource.match(/<AdminStyleRoomSceneControls style=\{s\} \/>/g)?.length).toBe(3);
    expect(controlsSource).toContain('image="door"');
    expect(controlsSource).toContain('image="drawer"');
    const badges = readFileSync(resolve(process.cwd(), "client/src/components/doorStyles/SamplePhotoVerification.tsx"), "utf8");
    expect(badges).toContain("Door verified");
    expect(badges).toContain("Drawer front verified");
    expect(badges).toContain("Unverify");
    expect(badges).toContain("Verify");
  });

  it("verifies photos, polls while a scene is in progress, retries failures, and publishes the draft", () => {
    expect(controlsSource).toContain("doorStyles.setSampleImageVerified.useMutation");
    expect(controlsSource).toContain("mutation.mutate({ styleId, image, verified: next })");
    expect(controlsSource).toContain("doorStyles.autoRoomSceneStatus.useQuery");
    expect(controlsSource).toContain("{ styleId }");
    expect(controlsSource).toContain("doorStyles.retryAutoRoomScene.useMutation");
    expect(controlsSource).toContain("retry.mutate({ styleId })");
    expect(controlsSource).toContain("trpc.doorStyles.updateRoomScene.useMutation");
    expect(controlsSource).toContain("publish.mutate({ id: sceneId, isVerified: true })");
    expect(controlsSource).toContain("nextAutoRoomScenePoll");
  });
});
