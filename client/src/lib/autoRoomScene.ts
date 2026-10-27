/** Automatic door-style room scene, matching cabinet-backend#22. */

export const AUTO_ROOM_SCENE_STATUSES = ["pending", "generating", "ready", "failed"] as const;

export type AutoRoomSceneStatus = (typeof AUTO_ROOM_SCENE_STATUSES)[number];

export type AutoRoomScene = {
  styleId: number;
  status: AutoRoomSceneStatus;
  errorMessage: string | null;
  sceneId: number | null;
  imageUrl: string | null;
  doorImageUrl: string;
  drawerImageUrl: string;
  attemptCount: number;
  updatedAt: string | Date | null;
};

export const VENDOR_AUTO_ROOM_SCENE_COPY =
  "CabinetDealz confirms your door and drawer photos before a room scene is generated.";

export const AUTO_ROOM_SCENE_POLL_MS = 2000;

export function isAutoRoomSceneStatus(value: unknown): value is AutoRoomSceneStatus {
  return typeof value === "string" && (AUTO_ROOM_SCENE_STATUSES as readonly string[]).includes(value);
}

/** Badge text uses the procedure's status words: pending, generating, ready, failed. */
export function autoRoomSceneBadgeLabel(status: AutoRoomSceneStatus): string {
  return `Room scene ${status}`;
}

export function shouldPollAutoRoomScene(status: AutoRoomSceneStatus | null | undefined): boolean {
  return status === "pending" || status === "generating";
}

/**
 * Poll while a job is pending or generating. After verify or retry, keep polling
 * until the first status row appears.
 */
export function nextAutoRoomScenePoll(
  status: AutoRoomSceneStatus | null | undefined,
  watchingForJob: boolean,
): number | false {
  if (shouldPollAutoRoomScene(status) || (watchingForJob && status == null)) return AUTO_ROOM_SCENE_POLL_MS;
  return false;
}
