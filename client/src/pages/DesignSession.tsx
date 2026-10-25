import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlacedCabinet, RoomData } from "@/lib/design";
import { Video, Phone, MapPin, ExternalLink, Eye } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  sharedDesignAutoRefreshQueryOptions,
  sharedDesignRefreshLabel,
} from "@/lib/designSessionRefresh";

export default function DesignSession() {
  const params = useParams();
  const token = (params as { token?: string }).token ?? "";
  const { t } = useLanguage();
  const isRemoteDesignToken = token.includes(".");

  const MODE_META: Record<string, { icon: React.ReactNode; label: string }> = {
    video: { icon: <Video className="h-4 w-4" />, label: t("ds_mode_video") },
    phone: { icon: <Phone className="h-4 w-4" />, label: t("ds_mode_phone") },
    in_person: { icon: <MapPin className="h-4 w-4" />, label: t("ds_mode_in_person") },
  };

  // Viewers only receive the server-confirmed saved design. The query keeps
  // refreshing in the background and catches up again on focus, so a shared
  // page never needs a manual reload to follow the designer's saved updates.
  const consultationQuery = trpc.consultations.sharedSession.useQuery(
    { token },
    { enabled: token.length >= 8 && !isRemoteDesignToken, ...sharedDesignAutoRefreshQueryOptions },
  );
  const remoteDesignQuery = trpc.design.remoteSharedDesign.useQuery(
    { token },
    { enabled: token.length >= 8 && isRemoteDesignToken, ...sharedDesignAutoRefreshQueryOptions },
  );

  if (token.length < 8) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-2">{t("ds_invalid_title")}</h1>
        <p className="text-muted-foreground">{t("ds_invalid_body")}</p>
      </div>
    );
  }

  const isLoading = isRemoteDesignToken ? remoteDesignQuery.isLoading : consultationQuery.isLoading;
  const error = isRemoteDesignToken ? remoteDesignQuery.error : consultationQuery.error;
  const remoteData = remoteDesignQuery.data;
  const consultationData = consultationQuery.data;
  const activeQuery = isRemoteDesignToken ? remoteDesignQuery : consultationQuery;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Spinner className="h-7 w-7 text-primary" />
        <p className="text-sm text-muted-foreground">{t("ds_connecting")}</p>
      </div>
    );
  }

  if (error || (!remoteData && !consultationData)) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-2">{t("ds_notfound_title")}</h1>
        <p className="text-muted-foreground">
          {error?.message ?? t("ds_notfound_body")}
        </p>
      </div>
    );
  }

  const consultation = consultationData?.consultation ?? null;
  const design = isRemoteDesignToken ? remoteData?.design : consultationData?.design;
  const mode = consultation ? (MODE_META[consultation.mode] ?? MODE_META.video) : null;
  const room = (design?.roomData ?? null) as RoomData | null;
  const cabinets = (design?.placedCabinets ?? []) as PlacedCabinet[];
  const designTitle = consultation?.designName || design?.name || t("ds_your_design");

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="border-b border-border bg-background">
        <div className="container py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#a87f33]" />
              <h1 className="font-serif text-xl font-bold">
                {isRemoteDesignToken ? "Remote shared design" : t("ds_live_title")}
              </h1>
              <Badge variant="outline" className="capitalize">
                {consultation?.status ?? remoteData?.session.status ?? "live"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {consultation
                ? `${t("ds_with", { name: consultation.designerName ?? t("ds_default_designer") })} · ${new Date(consultation.startAt).toLocaleString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : "Your designer can save updates while you follow the same plan from anywhere."}
            </p>
          </div>
          {consultation && mode && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                {mode.icon} {mode.label}
              </span>
              {consultation.meetingUrl && (
                <a href={consultation.meetingUrl} target="_blank" rel="noreferrer">
                  <Button size="sm" className="gap-1 bg-[#a87f33] hover:bg-[#946e2b]">
                    {t("ds_join_call")} <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">
            {designTitle}
          </p>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t("ds_live_updates")}
          </span>
        </div>

        {room && cabinets.length >= 0 ? (
          <div className="rounded-xl border border-border bg-background p-2 overflow-auto">
            <PlanCanvas
              room={room}
              cabinets={cabinets}
              selectedUid={null}
              onSelect={() => {}}
              onMove={() => {}}
              showWallLayer
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-background py-20 text-center text-muted-foreground">
            {t("ds_no_layout")}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-muted-foreground">
          <p>
            {isRemoteDesignToken
              ? "Read-only shared view. The page refreshes automatically after your designer saves an update."
              : t("ds_viewonly")}
          </p>
          <span aria-live="polite" className="font-medium text-foreground/75">
            {sharedDesignRefreshLabel(activeQuery.isFetching && !isLoading, activeQuery.dataUpdatedAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
