// hiringPacket is added on the cabinet-backend hiring branch and is not on
// this repo's AppRouter yet. Cast the client the same way vendor onboarding does.
import { trpc } from "@/lib/trpc";
import type { HiringDocumentKind, HiringSettings, PacketSummary, PublicPacket } from "@shared/hiringPacket";

export type HiringTrpcError = { message: string };

type QueryResult<T> = {
  data?: T;
  isLoading: boolean;
  error: HiringTrpcError | null;
  refetch: () => Promise<unknown>;
};

type Mutation<TInput> = {
  mutate: (input: TInput) => void;
  isPending: boolean;
};

export type HiringPacketApi = {
  useUtils: () => {
    hiringPacket: {
      mine: { invalidate: () => Promise<void> };
      list: { invalidate: () => Promise<void> };
      get: { invalidate: () => Promise<void> };
      settings: { invalidate: () => Promise<void> };
    };
  };
  hiringPacket: {
    settings: {
      get: { useQuery: () => QueryResult<HiringSettings> };
      set: { useMutation: (options?: { onSuccess?: () => void; onError?: (error: HiringTrpcError) => void }) => Mutation<HiringSettings> };
    };
    mine: { useQuery: (input: undefined, options?: { enabled?: boolean }) => QueryResult<PublicPacket> };
    list: { useQuery: (input: undefined, options?: { enabled?: boolean }) => QueryResult<PacketSummary[]> };
    get: { useQuery: (input: { packetId: number }, options?: { enabled?: boolean }) => QueryResult<PublicPacket> };
    save: { useMutation: (options?: { onSuccess?: (packet: PublicPacket) => void; onError?: (error: HiringTrpcError) => void }) => Mutation<{ packetId: number; kind: HiringDocumentKind; payload: Record<string, unknown> }> };
    sign: { useMutation: (options?: { onSuccess?: (packet: PublicPacket) => void; onError?: (error: HiringTrpcError) => void }) => Mutation<{ packetId: number; kind: HiringDocumentKind; payload: Record<string, unknown> }> };
    review: { useMutation: (options?: { onSuccess?: (packet: PublicPacket) => void; onError?: (error: HiringTrpcError) => void }) => Mutation<{ packetId: number; kind: HiringDocumentKind }> };
    upload: { useMutation: (options?: { onSuccess?: (packet: PublicPacket) => void; onError?: (error: HiringTrpcError) => void }) => Mutation<{ packetId: number; kind: HiringDocumentKind; slot: string; filename: string; mimeType: string; fileBase64: string }> };
    fileLink: { useMutation: (options?: { onSuccess?: (result: { url: string; expiresInSeconds: number }) => void; onError?: (error: HiringTrpcError) => void }) => Mutation<{ fileId: number }> };
  };
};

export function useHiringPacketApi(): HiringPacketApi {
  return trpc as unknown as HiringPacketApi;
}
