import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AutoRoomSceneStatus } from "./AutoRoomSceneStatus";
import { SamplePhotoVerification } from "./SamplePhotoVerification";
import type { AutoRoomScene } from "@/lib/autoRoomScene";

const scene = (overrides: Partial<AutoRoomScene> = {}): AutoRoomScene => ({
  styleId: 7,
  status: "ready",
  errorMessage: null,
  sceneId: 42,
  imageUrl: "https://cdn.example/draft.jpg",
  doorImageUrl: "https://cdn.example/door.jpg",
  drawerImageUrl: "https://cdn.example/drawer.jpg",
  attemptCount: 1,
  updatedAt: "2026-10-27T00:00:00.000Z",
  ...overrides,
});

describe("sample photo verification badges", () => {
  it("gives admins separate door and drawer-front verify controls", () => {
    const html = renderToStaticMarkup(
      <>
        <SamplePhotoVerification image="door" verified={false} hasSavedPhoto onChange={() => undefined} />
        <SamplePhotoVerification image="drawer" verified hasSavedPhoto onChange={() => undefined} />
      </>,
    );
    expect(html).toContain("Door verified");
    expect(html).toContain("Drawer front verified");
    expect(html).toContain("Verify door photo");
    expect(html).toContain("Unverify drawer front");
    expect(html).toContain('data-verified="false"');
    expect(html).toContain('data-verified="true"');
  });

  it("keeps vendor badges read-only", () => {
    const html = renderToStaticMarkup(
      <>
        <SamplePhotoVerification image="door" verified={false} />
        <SamplePhotoVerification image="drawer" verified />
      </>,
    );
    expect(html).toContain("Door verified");
    expect(html).toContain("Drawer front verified");
    expect(html).not.toContain(">Verify<");
    expect(html).not.toContain(">Unverify<");
  });

  it("blocks verify until a photo is saved", () => {
    const html = renderToStaticMarkup(
      <SamplePhotoVerification image="door" verified={false} hasSavedPhoto={false} onChange={() => undefined} />,
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Upload the photo before verifying it.");
  });
});

describe("auto room scene status", () => {
  it("shows a failed job's error and a retry control for admins", () => {
    const html = renderToStaticMarkup(
      <AutoRoomSceneStatus
        scene={scene({ status: "failed", errorMessage: "GEMINI_API_KEY is not configured", imageUrl: null, sceneId: null })}
        canManage
        onRetry={() => undefined}
      />,
    );
    expect(html).toContain("Room scene failed");
    expect(html).toContain('data-status="failed"');
    expect(html).toContain("GEMINI_API_KEY is not configured");
    expect(html).toContain(">Retry<");
    expect(html).not.toContain(">Publish<");
  });

  it("shows the generated draft and a publish control when the scene is ready", () => {
    const html = renderToStaticMarkup(
      <AutoRoomSceneStatus scene={scene()} canManage onPublish={() => undefined} />,
    );
    expect(html).toContain("Room scene ready");
    expect(html).toContain('data-testid="auto-room-scene-draft"');
    expect(html).toContain("https://cdn.example/draft.jpg");
    expect(html).toContain(">Publish<");
    expect(html).not.toContain(">Retry<");
  });

  it("shows pending and generating without admin actions", () => {
    const pending = renderToStaticMarkup(<AutoRoomSceneStatus scene={scene({ status: "pending", imageUrl: null, sceneId: null })} canManage />);
    const generating = renderToStaticMarkup(<AutoRoomSceneStatus scene={scene({ status: "generating", imageUrl: null, sceneId: null })} canManage />);
    expect(pending).toContain("Room scene pending");
    expect(generating).toContain("Room scene generating");
    expect(pending).not.toContain(">Retry<");
    expect(generating).not.toContain(">Publish<");
  });

  it("gives vendors the status and confirmation copy without retry or publish", () => {
    const html = renderToStaticMarkup(
      <AutoRoomSceneStatus
        scene={scene({ status: "failed", errorMessage: "provider exploded" })}
        showCopy
      />,
    );
    expect(html).toContain("Room scene failed");
    expect(html).toContain("CabinetDealz confirms your door and drawer photos before a room scene is generated.");
    expect(html).not.toContain("provider exploded");
    expect(html).not.toContain(">Retry<");
    expect(html).not.toContain(">Publish<");
    expect(html).not.toContain("auto-room-scene-draft");
  });
});

describe("procedure wiring", () => {
  const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

  it("casts the new procedures and calls them with the backend input shapes", () => {
    const procedures = source("client/src/components/doorStyles/autoRoomSceneProcedures.ts");
    const admin = source("client/src/components/doorStyles/AdminDoorStyleRoomScene.tsx");
    const vendor = source("client/src/components/doorStyles/VendorAutoRoomSceneBadge.tsx");
    expect(procedures).toContain("Cast until AppRouter includes them");
    expect(procedures).toContain("setSampleImageVerified");
    expect(procedures).toContain('image: "door" | "drawer"');
    expect(procedures).toContain("autoRoomSceneStatus");
    expect(procedures).toContain("retryAutoRoomScene");
    expect(procedures).toContain("doorStyleAutoRoomScene");
    expect(admin).toContain("mutation.mutate({ styleId, image, verified: next })");
    expect(admin).toContain("api.doorStyles.autoRoomSceneStatus.useQuery");
    expect(admin).toContain("nextAutoRoomScenePoll");
    expect(admin).toContain("onVerified={watchForScene}");
    expect(admin).toContain("retry.mutate({ styleId })");
    expect(admin).toContain("publish.mutate({ id: sceneId, isVerified: true })");
    expect(admin).toContain("trpc.doorStyles.updateRoomScene.useMutation");
    expect(vendor).toContain("api.distributorPortal.doorStyleAutoRoomScene.useQuery");
    expect(vendor).toContain("distributorId != null ? { styleId, distributorId } : { styleId }");
    expect(vendor).not.toContain("setSampleImageVerified");
    expect(vendor).not.toContain("retryAutoRoomScene");
    expect(vendor).not.toContain("updateRoomScene");
  });
});
