import { trpc } from "@/lib/trpc";
import type { AutoRoomScene } from "@/lib/autoRoomScene";

type SceneQueryOptions = {
  enabled?: boolean;
  refetchInterval?:
    | number
    | false
    | ((query: { state: { data?: AutoRoomScene | null } }) => number | false);
};

type SceneQuery = {
  data?: AutoRoomScene | null;
  dataUpdatedAt: number;
};

// setSampleImageVerified, autoRoomSceneStatus, retryAutoRoomScene, and
// doorStyleAutoRoomScene ship in cabinet-backend#22. Cast until AppRouter includes them.
export function useAutoRoomSceneProcedures() {
  return trpc as unknown as {
    doorStyles: {
      setSampleImageVerified: {
        useMutation: (options?: {
          onSuccess?: () => void;
          onError?: (error: { message: string }) => void;
        }) => {
          mutate: (input: { styleId: number; image: "door" | "drawer"; verified: boolean }) => void;
          isPending: boolean;
        };
      };
      autoRoomSceneStatus: {
        useQuery: (input: { styleId: number }, options?: SceneQueryOptions) => SceneQuery;
      };
      retryAutoRoomScene: {
        useMutation: (options?: {
          onSuccess?: () => void;
          onError?: (error: { message: string }) => void;
        }) => {
          mutate: (input: { styleId: number }) => void;
          isPending: boolean;
        };
      };
    };
    distributorPortal: {
      doorStyleAutoRoomScene: {
        useQuery: (
          input: { styleId: number; distributorId?: number },
          options?: SceneQueryOptions,
        ) => SceneQuery;
      };
    };
    useUtils: () => {
      doorStyles: { autoRoomSceneStatus: { invalidate: () => Promise<void> } };
      distributorPortal: { doorStyleAutoRoomScene: { invalidate: () => Promise<void> } };
    };
  };
}
