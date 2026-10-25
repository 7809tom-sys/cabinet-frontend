/**
 * StyleRoomSceneCard
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable cabinet style display card that follows the site-wide rule:
 *   • Room scene photo is the PRIMARY image (full card hero)
 *   • A small door-icon button in the corner lets users toggle to the close-up
 *     door sample photo (or the color-accurate DoorStyleSwatch if no photo)
 *   • Clicking the card body triggers onSelect; the door-icon button is
 *     separate and does NOT trigger onSelect
 *
 * Usage:
 *   <StyleRoomSceneCard
 *     style={{ styleId, name, doorStyle, finish, color, woodSpecies,
 *              roomSceneImageUrl, doorSampleImageUrl, thumbnailImageUrl, styleCode }}
 *     onSelect={() => ...}
 *     badge={<Badge>Active</Badge>}
 *     footer={<p>$1,200</p>}
 *   />
 */

import { useState } from "react";
import { DoorStyleSwatch } from "@/components/DoorStyleSwatch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImageIcon, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StyleCardData {
  styleId?: number;
  name?: string | null;
  ourName?: string | null;
  styleCode?: string | null;
  doorStyle?: string | null;
  finish?: string | null;
  color?: string | null;
  woodSpecies?: string | null;
  roomSceneImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
}

interface StyleRoomSceneCardProps {
  style: StyleCardData;
  /** Called when the main card area is clicked */
  onSelect?: () => void;
  /** Optional badge(s) overlaid on the image (top-left) */
  badge?: React.ReactNode;
  /** Optional content rendered below the image in the card body */
  footer?: React.ReactNode;
  /** Extra classes for the outer wrapper */
  className?: string;
  /** Whether the card is in a selected/active state */
  selected?: boolean;
  /** Accent color for the selected ring */
  accentColor?: string;
}

export function StyleRoomSceneCard({
  style,
  onSelect,
  badge,
  footer,
  className,
  selected,
  accentColor,
}: StyleRoomSceneCardProps) {
  const [showDoor, setShowDoor] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [doorFailed, setDoorFailed] = useState(false);

  const displayName = style.name || style.ourName || style.styleCode || "Cabinet Style";
  const roomScene = style.roomSceneImageUrl;
  const doorSample = style.doorSampleImageUrl || style.thumbnailImageUrl;

  const swatchStyle = {
    styleCode: style.styleCode ?? "",
    ourName: displayName,
    name: displayName,
    doorStyle: style.doorStyle ?? undefined,
    color: style.color ?? undefined,
    finish: style.finish ?? undefined,
    woodSpecies: style.woodSpecies ?? undefined,
  };

  // What to show in the hero area
  const heroSrc = showDoor
    ? doorSample && !doorFailed ? doorSample : null
    : roomScene && !sceneFailed ? roomScene : null;

  const hasDoorView = !!(doorSample || true); // swatch always available as fallback

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all",
        onSelect && "cursor-pointer hover:shadow-md",
        selected && "ring-2 ring-offset-1",
        className
      )}
      style={selected && accentColor ? { ["--tw-ring-color" as string]: accentColor } : undefined}
      onClick={onSelect}
    >
      {/* ── Hero image area ── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {heroSrc ? (
          <img
            src={heroSrc}
            alt={showDoor ? `${displayName} door sample` : `${displayName} kitchen`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={() => showDoor ? setDoorFailed(true) : setSceneFailed(true)}
          />
        ) : (
          <DoorStyleSwatch style={swatchStyle} className="h-full w-full" />
        )}

        {/* Gradient for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* Top-left badge slot */}
        {badge && (
          <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
            {badge}
          </div>
        )}

        {/* Door toggle button — bottom-right */}
        {hasDoorView && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDoor((v) => !v);
                }}
                className={cn(
                  "absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-md transition-colors",
                  showDoor
                    ? "border-white bg-white text-foreground"
                    : "border-white/80 bg-black/40 text-white hover:bg-black/60"
                )}
                aria-label={showDoor ? "Show room scene" : "Show door close-up"}
              >
                {showDoor ? (
                  <Maximize2 className="h-3.5 w-3.5" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {showDoor ? "Show room scene" : "View door close-up"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* View-mode label */}
        <div className="absolute bottom-2.5 left-2.5">
          <span className="rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white/90">
            {showDoor ? "Door sample" : "Room scene"}
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-1 flex-col p-3">
        <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
        {(style.finish || style.color || style.doorStyle) && (
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {[style.doorStyle, style.finish, style.color].filter(Boolean).join(" · ")}
          </p>
        )}
        {footer && <div className="mt-2">{footer}</div>}
      </div>
    </div>
  );
}
