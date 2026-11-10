import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Spinner } from "@/components/ui/spinner";
import { useHiringPacketApi } from "@/lib/hiringPacketApi";
import { HiringPacketScreen } from "@/components/admin/HiringPacketScreen";
import {
  DEFAULT_WORKER_TYPE,
  EMPTY_HIRING_SETTINGS,
  HIRING_DOCUMENT_KINDS,
  isPublicStorageUrl,
  safeErrorMessage,
  toPublicDocument,
  type HiringDocumentKind,
  type HiringSettings,
  type PublicPacket,
} from "@shared/hiringPacket";

function completePacket(packet: PublicPacket): PublicPacket {
  const byKind = new Map(packet.documents.map((document) => [document.kind, document]));
  return {
    ...packet,
    workerType: packet.workerType ?? DEFAULT_WORKER_TYPE,
    workState: packet.workState ?? null,
    documents: HIRING_DOCUMENT_KINDS.map((kind) => byKind.get(kind) ?? toPublicDocument({
      kind,
      payload: {},
      signedAt: null,
      signedByName: null,
      reviewedAt: null,
      reviewedByName: null,
      files: [],
    })),
  };
}

async function fileBase64(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export default function JobBoard() {
  const { user, loading } = useAuth();
  const api = useHiringPacketApi();
  const isAdmin = user?.role === "admin";
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const utils = api.useUtils();
  const settingsQuery = api.hiringPacket.settings.get.useQuery();
  const mineQuery = api.hiringPacket.mine.useQuery(undefined, { enabled: Boolean(user) && !isAdmin });
  const listQuery = api.hiringPacket.list.useQuery(undefined, { enabled: Boolean(user) && isAdmin });
  const detailQuery = api.hiringPacket.get.useQuery({ packetId: selectedId ?? 0 }, { enabled: Boolean(isAdmin && selectedId) });

  const refresh = () => {
    void utils.hiringPacket.mine.invalidate();
    void utils.hiringPacket.list.invalidate();
    void utils.hiringPacket.get.invalidate();
    void utils.hiringPacket.settings.invalidate();
  };
  const onPacket = {
    onSuccess: () => {
      setNotice(null);
      refresh();
    },
    onError: (error: { message: string }) => setNotice(safeErrorMessage(new Error(error.message))),
  };
  const save = api.hiringPacket.save.useMutation(onPacket);
  const sign = api.hiringPacket.sign.useMutation(onPacket);
  const review = api.hiringPacket.review.useMutation(onPacket);
  const setProfile = api.hiringPacket.setProfile.useMutation(onPacket);
  const upload = api.hiringPacket.upload.useMutation(onPacket);
  const configure = api.hiringPacket.settings.set.useMutation(onPacket);
  const fileLink = api.hiringPacket.fileLink.useMutation({
    onSuccess: (result) => {
      if (isPublicStorageUrl(result.url)) {
        setNotice("That file is not available from a public link.");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    },
    onError: (error) => setNotice(safeErrorMessage(new Error(error.message))),
  });

  if (loading || !user) {
    return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  }

  const settings: HiringSettings = settingsQuery.data ?? EMPTY_HIRING_SETTINGS;
  const packet = isAdmin ? (selectedId ? detailQuery.data : null) : mineQuery.data;
  const waiting = settingsQuery.isLoading || (isAdmin ? listQuery.isLoading || (selectedId != null && detailQuery.isLoading) : mineQuery.isLoading);
  if (waiting && !packet && !(isAdmin && listQuery.data)) {
    return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  }

  const packetId = packet?.id ?? selectedId;
  const send = (kind: HiringDocumentKind, payload: Record<string, unknown>, mutate: typeof save.mutate) => {
    if (!packetId) return;
    mutate({ packetId, kind, payload });
  };

  return (
    <HiringPacketScreen
      viewer={{ userId: user.id, role: user.role, name: user.name ?? null, email: user.email ?? null }}
      settings={settings}
      summaries={listQuery.data ?? []}
      packet={packet ? completePacket(packet) : null}
      notice={notice ?? settingsQuery.error?.message ?? mineQuery.error?.message ?? listQuery.error?.message ?? null}
      onSelectPacket={setSelectedId}
      onSave={(kind, payload) => send(kind, payload, save.mutate)}
      onSign={(kind, payload) => send(kind, payload, sign.mutate)}
      onReview={(kind) => {
        if (packetId) review.mutate({ packetId, kind });
      }}
      onUpload={(kind, slot, file) => {
        if (!packetId) return;
        void fileBase64(file).then((encoded) => {
          upload.mutate({ packetId, kind, slot, filename: file.name, mimeType: file.type, fileBase64: encoded });
        }).catch((error: unknown) => setNotice(safeErrorMessage(error)));
      }}
      onOpenFile={(fileId) => fileLink.mutate({ fileId })}
      onConfigure={(next) => configure.mutate(next)}
      onWorkerType={(workerType) => {
        if (!packetId) return;
        setProfile.mutate({ packetId, workerType, workState: packet?.workState ?? null });
      }}
      onWorkState={(workState) => {
        if (!packetId) return;
        setProfile.mutate({ packetId, workerType: packet?.workerType ?? DEFAULT_WORKER_TYPE, workState });
      }}
    />
  );
}
