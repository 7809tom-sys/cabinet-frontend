import { useEffect, useState, type ReactNode } from "react";
import { preferredDoorReferenceUrl } from "@/lib/approvedDoorReference";
import {
  assessDoorSample,
  assessDrawerSample,
  distinctDrawerSampleUrl,
  formatSampleImageFlag,
  sampleAspectCss,
  type SampleMeasurement,
  type SampleStyleImages,
} from "@/lib/sampleImageQa";

export type SampleFinish = {
  face: string;
  edge: string;
  label: string;
};

export type KnownSampleSize = { width: number; height: number } | "error";

const NEUTRAL_FACE = "#d6d3d1";
const NEUTRAL_EDGE = "#a8a29e";
const NEUTRAL_LABEL = "#292524";

/**
 * One drawer front, tinted with the style finish. Shown when the style has
 * no drawer photo of its own, or that photo fails the client image check.
 */
export function DrawerFrontDiagram({
  face,
  edge,
  label,
  title,
}: {
  face: string;
  edge: string;
  label: string;
  title: string;
}) {
  const fill = face || NEUTRAL_FACE;
  const stroke = edge || NEUTRAL_EDGE;
  const pull = label || NEUTRAL_LABEL;
  return (
    <svg
      viewBox="0 0 400 100"
      role="img"
      aria-label={title}
      data-testid="drawer-front-diagram"
      data-face={fill}
      data-edge={stroke}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x="1.5" y="1.5" width="397" height="97" rx="8" fill={fill} stroke={stroke} strokeWidth="3" />
      <rect x="16" y="14" width="368" height="72" rx="4" fill="none" stroke={stroke} strokeWidth="1.25" opacity="0.55" />
      <rect data-testid="drawer-front-pull" x="168" y="44" width="64" height="10" rx="5" fill={pull} />
    </svg>
  );
}

function SampleFrame({
  role,
  className,
  busy = false,
  children,
}: {
  role: "door" | "drawer";
  className?: string;
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      data-testid={role === "door" ? "door-sample-tile" : "drawer-sample-tile"}
      data-sample-shape={role}
      data-aspect={sampleAspectCss(role)}
      aria-busy={busy || undefined}
      style={{ aspectRatio: sampleAspectCss(role) }}
      className={`flex w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-neutral-100 ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

function SamplePhoto({ url, alt, onMeasured }: { url: string; alt: string; onMeasured?: (size: { width: number; height: number } | "error") => void }) {
  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="h-full w-full object-contain"
      onLoad={(event) => {
        const img = event.currentTarget;
        onMeasured?.({ width: img.naturalWidth, height: img.naturalHeight });
      }}
      onError={() => onMeasured?.("error")}
    />
  );
}

function AdminImageFlag({ role, text }: { role: "door" | "drawer"; text: string }) {
  if (!text) return null;
  return (
    <p
      data-testid={`sample-image-admin-flag-${role}`}
      className="mt-1 text-[10px] leading-snug text-amber-900/80"
      title={text}
    >
      Image check: {text}
    </p>
  );
}

function useDrawerMeasurement(
  url: string | null,
  known: KnownSampleSize | undefined,
  controlled: boolean,
): SampleMeasurement {
  const [loaded, setLoaded] = useState<{ url: string; size: KnownSampleSize } | null>(null);
  useEffect(() => {
    if (controlled || !url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLoaded({ url, size: { width: img.naturalWidth, height: img.naturalHeight } });
    };
    img.onerror = () => {
      if (!cancelled) setLoaded({ url, size: "error" });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [controlled, url]);

  if (!url) return null;
  if (controlled) return known ?? "pending";
  if (!loaded || loaded.url !== url) return "pending";
  return loaded.size;
}

export function StyleSamplePreview({
  style,
  styleName,
  finish,
  showImageCheck = false,
  className,
  knownSize,
}: {
  style: SampleStyleImages | null | undefined;
  styleName?: string | null;
  finish: SampleFinish;
  /** Admins see the image-check line. Customers do not. */
  showImageCheck?: boolean;
  className?: string;
  /** Skips network measurement. Tests pass decoded pixel sizes here. */
  knownSize?: {
    door?: KnownSampleSize;
    drawer?: KnownSampleSize;
  };
}) {
  const controlled = knownSize !== undefined;
  const doorUrl = preferredDoorReferenceUrl(style);
  const drawerCandidate = distinctDrawerSampleUrl(style);
  const [doorReported, setDoorReported] = useState<{ url: string; size: KnownSampleSize } | null>(null);
  const drawerMeasurement = useDrawerMeasurement(drawerCandidate, knownSize?.drawer, controlled);

  const doorMeasurement: SampleMeasurement = !doorUrl
    ? null
    : controlled
      ? (knownSize?.door ?? "pending")
      : !doorReported || doorReported.url !== doorUrl
        ? "pending"
        : doorReported.size;

  const doorIssues = assessDoorSample(style, doorMeasurement);
  const drawer = assessDrawerSample(style, drawerMeasurement);
  const name = styleName?.trim() || "Door";
  const doorFlag = formatSampleImageFlag(doorIssues, doorMeasurement === "error");
  const drawerFlag = formatSampleImageFlag(drawer.issues, drawer.loadFailed);

  return (
    <div data-testid="style-sample-preview" className={`flex flex-wrap items-end gap-4 ${className ?? ""}`}>
      <div className="w-36 shrink-0">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Door</p>
        <SampleFrame role="door">
          {doorUrl && doorMeasurement !== "error" ? (
            <SamplePhoto
              url={doorUrl}
              alt={`${name} door sample`}
              onMeasured={(size) => {
                if (!controlled) setDoorReported({ url: doorUrl, size });
              }}
            />
          ) : (
            <span className="px-2 text-center text-[10px] font-medium text-neutral-500">No photo</span>
          )}
        </SampleFrame>
        {showImageCheck ? <AdminImageFlag role="door" text={doorFlag} /> : null}
      </div>
      <div className="w-[min(100%,18rem)] shrink-0" data-drawer-source={drawer.useDrawing ? "drawing" : drawer.pending ? "pending" : "photo"}>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Drawer</p>
        <SampleFrame role="drawer" busy={drawer.pending} className={drawer.pending ? "animate-pulse" : undefined}>
          {drawer.useDrawing ? (
            <DrawerFrontDiagram face={finish.face} edge={finish.edge} label={finish.label} title={`${name} drawer front`} />
          ) : drawer.photoUrl && !drawer.pending ? (
            <SamplePhoto url={drawer.photoUrl} alt={`${name} drawer sample`} />
          ) : (
            <span className="sr-only">Checking drawer picture</span>
          )}
        </SampleFrame>
        {showImageCheck ? <AdminImageFlag role="drawer" text={drawerFlag} /> : null}
      </div>
    </div>
  );
}
