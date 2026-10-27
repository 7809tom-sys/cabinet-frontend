import { describe, expect, it } from "vitest";
import {
  AUTO_ROOM_SCENE_POLL_MS,
  VENDOR_AUTO_ROOM_SCENE_COPY,
  autoRoomSceneBadgeLabel,
  isAutoRoomSceneStatus,
  nextAutoRoomScenePoll,
  shouldPollAutoRoomScene,
} from "./autoRoomScene";

describe("auto room scene status", () => {
  it("labels the four procedure statuses", () => {
    expect(autoRoomSceneBadgeLabel("pending")).toBe("Room scene pending");
    expect(autoRoomSceneBadgeLabel("generating")).toBe("Room scene generating");
    expect(autoRoomSceneBadgeLabel("ready")).toBe("Room scene ready");
    expect(autoRoomSceneBadgeLabel("failed")).toBe("Room scene failed");
    expect(isAutoRoomSceneStatus("ready")).toBe(true);
    expect(isAutoRoomSceneStatus("published")).toBe(false);
  });

  it("polls only while a scene is pending, generating, or just queued", () => {
    expect(shouldPollAutoRoomScene("pending")).toBe(true);
    expect(shouldPollAutoRoomScene("generating")).toBe(true);
    expect(shouldPollAutoRoomScene("ready")).toBe(false);
    expect(shouldPollAutoRoomScene("failed")).toBe(false);
    expect(shouldPollAutoRoomScene(null)).toBe(false);
    expect(nextAutoRoomScenePoll("pending", false)).toBe(AUTO_ROOM_SCENE_POLL_MS);
    expect(nextAutoRoomScenePoll("generating", false)).toBe(AUTO_ROOM_SCENE_POLL_MS);
    expect(nextAutoRoomScenePoll(undefined, true)).toBe(AUTO_ROOM_SCENE_POLL_MS);
    expect(nextAutoRoomScenePoll(null, true)).toBe(AUTO_ROOM_SCENE_POLL_MS);
    expect(nextAutoRoomScenePoll("ready", true)).toBe(false);
    expect(nextAutoRoomScenePoll("failed", false)).toBe(false);
    expect(nextAutoRoomScenePoll(null, false)).toBe(false);
  });

  it("tells vendors that CabinetDealz confirms both photos before generation", () => {
    expect(VENDOR_AUTO_ROOM_SCENE_COPY).toBe(
      "CabinetDealz confirms your door and drawer photos before a room scene is generated.",
    );
  });
});
