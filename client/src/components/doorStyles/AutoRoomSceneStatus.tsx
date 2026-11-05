import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  VENDOR_AUTO_ROOM_SCENE_COPY,
  autoRoomSceneBadgeLabel,
  type AutoRoomScene,
  type AutoRoomSceneStatus,
} from "@/lib/autoRoomScene";

function statusClass(status: AutoRoomSceneStatus): string {
  if (status === "ready") return "border-emerald-300 bg-emerald-50 text-emerald-800";
  if (status === "failed") return "border-red-300 bg-red-50 text-red-800";
  if (status === "generating") return "border-sky-300 bg-sky-50 text-sky-800";
  return "border-amber-300 bg-amber-50 text-amber-800";
}

export function AutoRoomSceneStatus({
  scene,
  canManage = false,
  showCopy = false,
  showIdleHint = false,
  retryPending = false,
  publishPending = false,
  selectedColorHex = null,
  doorSetup = null,
  onRetry,
  onPublish,
}: {
  scene: AutoRoomScene | null;
  /** Admins can retry a failure and publish a ready draft. Vendors stay read-only. */
  canManage?: boolean;
  showCopy?: boolean;
  showIdleHint?: boolean;
  retryPending?: boolean;
  publishPending?: boolean;
  /** The color of record the editor is showing, so the copy never names a stale color. */
  selectedColorHex?: string | null;
  /** The live door/drawer setup, so the copy describes the selected profile. */
  doorSetup?: { doorStyle?: string | null; panelConstruction?: string | null } | null;
  onRetry?: () => void;
  onPublish?: (sceneId: number) => void;
}) {
  if (!scene && !showCopy && !(canManage && showIdleHint)) return null;
  return (
    <div className="space-y-2" data-testid={canManage ? "admin-auto-room-scene" : "vendor-auto-room-scene-status"}>
      {showCopy && !canManage && (
        <p className="text-xs text-muted-foreground">{VENDOR_AUTO_ROOM_SCENE_COPY}</p>
      )}
      {canManage && showIdleHint && !scene && (
        <p className="text-xs text-muted-foreground" data-testid="auto-room-scene-idle-hint">
          A draft room scene is generated after the door photo and the drawer front are both verified.
        </p>
      )}
      {/* Says which finish the scene will be drawn in, read from the editor's live
          selection rather than the last saved row. */}
      {canManage && (selectedColorHex || doorSetup?.doorStyle) && (
        <p className="text-xs text-muted-foreground" data-testid="auto-room-scene-selected-finish">
          Room scene uses the selected finish
          {selectedColorHex ? ` ${selectedColorHex}` : ""}
          {doorSetup?.doorStyle ? ` · ${doorSetup.doorStyle}` : ""}.
        </p>
      )}
      {scene && (
        <Badge
          variant="outline"
          data-testid="auto-room-scene-status"
          data-status={scene.status}
          className={statusClass(scene.status)}
        >
          {autoRoomSceneBadgeLabel(scene.status)}
        </Badge>
      )}
      {canManage && scene?.status === "failed" && (
        <div className="space-y-1.5">
          {scene.errorMessage && (
            <p data-testid="auto-room-scene-error" className="text-xs text-destructive">{scene.errorMessage}</p>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="auto-room-scene-retry"
            disabled={retryPending}
            onClick={onRetry}
          >
            {retryPending ? "Retrying…" : "Retry"}
          </Button>
        </div>
      )}
      {canManage && scene?.status === "ready" && (
        <div className="space-y-2">
          {scene.imageUrl && (
            <img
              src={scene.imageUrl}
              alt="Generated draft room scene"
              data-testid="auto-room-scene-draft"
              className="h-28 w-full rounded border border-border object-cover"
            />
          )}
          <p className="text-xs text-muted-foreground">Draft room scene. Publish it to show the scene on the storefront.</p>
          <Button
            type="button"
            size="sm"
            data-testid="auto-room-scene-publish"
            disabled={publishPending || scene.sceneId == null}
            onClick={() => { if (scene.sceneId != null) onPublish?.(scene.sceneId); }}
          >
            {publishPending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      )}
    </div>
  );
}
