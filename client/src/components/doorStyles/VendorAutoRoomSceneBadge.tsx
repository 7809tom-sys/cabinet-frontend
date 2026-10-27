import { nextAutoRoomScenePoll, type AutoRoomScene } from "@/lib/autoRoomScene";
import { AutoRoomSceneStatus } from "./AutoRoomSceneStatus";
import { SamplePhotoVerification } from "./SamplePhotoVerification";
import { useAutoRoomSceneProcedures } from "./autoRoomSceneProcedures";

/** Read-only vendor status. Verification and retry stay on the admin procedures. */
export function VendorAutoRoomSceneBadge({
  styleId,
  distributorId,
  snapshot,
  doorSampleVerified,
  drawerSampleVerified,
  showCopy = false,
  live = false,
}: {
  styleId: number;
  distributorId?: number;
  /** Omit to load status from doorStyleAutoRoomScene. Null means the list confirmed there is no job. */
  snapshot?: AutoRoomScene | null;
  doorSampleVerified?: boolean;
  drawerSampleVerified?: boolean;
  showCopy?: boolean;
  live?: boolean;
}) {
  const api = useAutoRoomSceneProcedures();
  const known = snapshot !== undefined;
  const shouldFetch = live || !known || snapshot?.status === "pending" || snapshot?.status === "generating";
  const query = api.distributorPortal.doorStyleAutoRoomScene.useQuery(
    distributorId != null ? { styleId, distributorId } : { styleId },
    {
      enabled: shouldFetch,
      refetchInterval: (query) => nextAutoRoomScenePoll(
        query.state.data === undefined ? snapshot?.status : query.state.data?.status,
        false,
      ),
    },
  );
  const scene = query.data !== undefined ? query.data : (snapshot ?? null);
  const showDoor = typeof doorSampleVerified === "boolean";
  const showDrawer = typeof drawerSampleVerified === "boolean";
  if (!scene && !showCopy && !showDoor && !showDrawer) return null;
  return (
    <div className="mt-2 space-y-2" data-testid="vendor-auto-room-scene">
      {(showDoor || showDrawer) && (
        <div className="flex flex-wrap items-center gap-2">
          {showDoor && <SamplePhotoVerification image="door" verified={doorSampleVerified} />}
          {showDrawer && <SamplePhotoVerification image="drawer" verified={drawerSampleVerified} />}
        </div>
      )}
      <AutoRoomSceneStatus scene={scene} showCopy={showCopy} />
    </div>
  );
}
