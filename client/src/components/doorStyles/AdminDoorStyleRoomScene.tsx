import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { AUTO_ROOM_SCENE_POLL_MS, nextAutoRoomScenePoll, type AutoRoomScene, type AutoRoomSceneStatus } from "@/lib/autoRoomScene";
import { AutoRoomSceneStatus as AutoRoomSceneStatusView } from "./AutoRoomSceneStatus";
import { SamplePhotoVerification } from "./SamplePhotoVerification";
import { useAutoRoomSceneProcedures } from "./autoRoomSceneProcedures";

const EMPTY_POLL_LIMIT = 8;

export function AdminSamplePhotoVerification({
  styleId,
  image,
  verified,
  hasSavedPhoto,
  onVerified,
}: {
  styleId: number;
  image: "door" | "drawer";
  verified: boolean;
  hasSavedPhoto: boolean;
  onVerified: () => void;
}) {
  const api = useAutoRoomSceneProcedures();
  const utils = trpc.useUtils();
  const liveUtils = api.useUtils();
  const mutation = api.doorStyles.setSampleImageVerified.useMutation({
    onSuccess: () => {
      toast.success(verified ? "Photo marked unverified" : "Photo verified");
      onVerified();
      void utils.doorStyles.listForAdmin.invalidate();
      void liveUtils.doorStyles.autoRoomSceneStatus.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <SamplePhotoVerification
      image={image}
      verified={verified}
      hasSavedPhoto={hasSavedPhoto}
      pending={mutation.isPending}
      onChange={(next) => mutation.mutate({ styleId, image, verified: next })}
    />
  );
}

export function AdminAutoRoomSceneActions({
  styleId,
  snapshot,
  watchGeneration,
  showIdleHint = false,
  selectedColorHex = null,
  doorSetup = null,
}: {
  styleId: number;
  snapshot: AutoRoomScene | null;
  /** Bumps after a verify action so polling starts before the job row is visible on the list. */
  watchGeneration: number;
  showIdleHint?: boolean;
  /** The color of record the editor is showing, so the prompt never describes a stale color. */
  selectedColorHex?: string | null;
  /** The live door/drawer setup in the form, so the reference matches the selected profile. */
  doorSetup?: { doorStyle?: string | null; panelConstruction?: string | null; doorSampleImageUrl?: string | null; drawerSampleImageUrl?: string | null } | null;
}) {
  const api = useAutoRoomSceneProcedures();
  const utils = trpc.useUtils();
  const liveUtils = api.useUtils();
  const [watching, setWatching] = useState(false);
  const emptyPolls = useRef(0);
  const countedAt = useRef(0);
  const sawActive = useRef(false);
  const reported = useRef<AutoRoomSceneStatus | null>(null);
  const polling = watching || snapshot?.status === "pending" || snapshot?.status === "generating";
  const statusQuery = api.doorStyles.autoRoomSceneStatus.useQuery(
    { styleId },
    {
      enabled: polling,
      refetchInterval: (query) => {
        if (watching) return AUTO_ROOM_SCENE_POLL_MS;
        const status = query.state.data === undefined ? snapshot?.status : query.state.data?.status;
        return nextAutoRoomScenePoll(status, false);
      },
    },
  );
  const scene = statusQuery.data !== undefined ? statusQuery.data : snapshot;

  useEffect(() => {
    if (watchGeneration > 0) {
      emptyPolls.current = 0;
      countedAt.current = 0;
      sawActive.current = false;
      setWatching(true);
    }
  }, [watchGeneration]);

  useEffect(() => {
    if (!watching) {
      emptyPolls.current = 0;
      countedAt.current = 0;
      sawActive.current = false;
      return;
    }
    const status = scene?.status;
    if (status === "pending" || status === "generating") {
      sawActive.current = true;
      emptyPolls.current = 0;
      return;
    }
    if (status === "ready" || (sawActive.current && status === "failed")) {
      setWatching(false);
      return;
    }
    const updatedAt = statusQuery.dataUpdatedAt;
    if (!updatedAt || updatedAt === countedAt.current) return;
    countedAt.current = updatedAt;
    emptyPolls.current += 1;
    if (emptyPolls.current >= EMPTY_POLL_LIMIT) setWatching(false);
  }, [watching, scene?.status, statusQuery.dataUpdatedAt]);

  useEffect(() => {
    const status = scene?.status ?? null;
    if (status === reported.current) return;
    const previous = reported.current;
    reported.current = status;
    if (previous && (status === "ready" || status === "failed")) {
      void utils.doorStyles.listForAdmin.invalidate();
    }
  }, [scene?.status, utils]);

  const retry = api.doorStyles.retryAutoRoomScene.useMutation({
    onSuccess: () => {
      toast.success("Room scene generation queued");
      emptyPolls.current = 0;
      countedAt.current = 0;
      sawActive.current = false;
      setWatching(true);
      void utils.doorStyles.listForAdmin.invalidate();
      void liveUtils.doorStyles.autoRoomSceneStatus.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const publish = trpc.doorStyles.updateRoomScene.useMutation({
    onSuccess: () => {
      toast.success("Draft room scene published");
      void utils.doorStyles.listForAdmin.invalidate();
      void utils.doorStyles.featured.invalidate();
      void utils.doorStyles.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div data-testid="admin-style-room-scene-controls-live" data-selected-color={selectedColorHex ?? undefined}>
      <AutoRoomSceneStatusView
        scene={scene}
        canManage
        showIdleHint={showIdleHint}
        retryPending={retry.isPending}
        publishPending={publish.isPending}
        selectedColorHex={selectedColorHex}
        doorSetup={doorSetup}
        onRetry={() => retry.mutate({ styleId })}
        onPublish={(sceneId) => publish.mutate({ id: sceneId, isVerified: true })}
      />
    </div>
  );
}

export function AdminStyleRoomSceneControls({
  style,
  showIdleHint = false,
  selectedColorHex = null,
  doorSetup = null,
}: {
  style: {
    id: number;
    doorSampleVerified: boolean;
    drawerSampleVerified?: boolean;
    doorSampleImageUrl: string | null;
    drawerSampleImageUrl: string | null;
    autoRoomScene?: AutoRoomScene | null;
  };
  showIdleHint?: boolean;
  /**
   * The color the editor is showing right now (the render hex of record), and
   * the door/drawer setup in the form. Passed through so the room-scene prompt
   * and its reference describe the selected finish instead of whatever the last
   * saved row held.
   */
  selectedColorHex?: string | null;
  doorSetup?: { doorStyle?: string | null; panelConstruction?: string | null; doorSampleImageUrl?: string | null; drawerSampleImageUrl?: string | null } | null;
}) {
  const [watchGeneration, setWatchGeneration] = useState(0);
  const watchForScene = () => setWatchGeneration((current) => current + 1);
  return (
    <div data-testid="admin-style-room-scene-controls" className="mt-2 min-w-0 space-y-2 rounded-md border border-border bg-background/70 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <AdminSamplePhotoVerification
          styleId={style.id}
          image="door"
          verified={style.doorSampleVerified}
          hasSavedPhoto={Boolean(style.doorSampleImageUrl?.trim())}
          onVerified={watchForScene}
        />
        <AdminSamplePhotoVerification
          styleId={style.id}
          image="drawer"
          verified={Boolean(style.drawerSampleVerified)}
          hasSavedPhoto={Boolean(style.drawerSampleImageUrl?.trim())}
          onVerified={watchForScene}
        />
      </div>
      <AdminAutoRoomSceneActions
        styleId={style.id}
        snapshot={style.autoRoomScene ?? null}
        watchGeneration={watchGeneration}
        showIdleHint={showIdleHint}
        selectedColorHex={selectedColorHex}
        doorSetup={doorSetup}
      />
    </div>
  );
}
