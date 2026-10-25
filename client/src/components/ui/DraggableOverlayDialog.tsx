import * as React from "react";

import { cn } from "@/lib/utils";
import { clampPopupSessionPosition, popupSessionPositionKey, readPopupSessionPosition, writePopupSessionPosition } from "./popupSessionPosition";

type DraggableOverlayDialogProps = Omit<React.ComponentProps<"div">, "style" | "children"> & {
  children: React.ReactNode;
  contentClassName?: string;
  contentStyle?: React.CSSProperties;
  overlayClassName?: string;
  onBackdropClick?: () => void;
  /** Optional stable identity for remembering this popup’s position within the browser session. */
  popupPositionKey?: string;
};

/**
 * A small bridge for legacy Designer popups that were composed from plain divs
 * instead of the shared Dialog primitive. Only the shared dedicated grip
 * (`data-popup-drag-handle="true"`) starts a drag, so title text, buttons,
 * and form controls remain ordinary non-moving controls.
 */
export function DraggableOverlayDialog({
  children,
  className,
  contentClassName,
  contentStyle,
  overlayClassName,
  onBackdropClick,
  onPointerDownCapture,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDownCapture,
  popupPositionKey,
  ...contentProps
}: DraggableOverlayDialogProps) {
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const dragOffsetRef = React.useRef(dragOffset);
  const dragOriginRef = React.useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const suppressBackdropClickRef = React.useRef(false);
  const clearBackdropSuppressionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const contentAriaLabel = contentProps["aria-label"];

  const clampOffset = React.useCallback((position: { x: number; y: number }) => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height || typeof window === "undefined") return position;
    return clampPopupSessionPosition(position, rect.width, rect.height, window.innerWidth, window.innerHeight);
  }, []);

  const setRememberedOffset = React.useCallback((position: { x: number; y: number }) => {
    const clamped = clampOffset(position);
    dragOffsetRef.current = clamped;
    setDragOffset(clamped);
    return clamped;
  }, [clampOffset]);
  const popupStorageKey = React.useCallback(() => {
    const title = contentRef.current?.querySelector("h1, h2, h3, [role='heading']")?.textContent;
    return popupSessionPositionKey({
      kind: "overlay-dialog",
      explicitKey: popupPositionKey,
      testId: contentRef.current?.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
  }, [contentAriaLabel, popupPositionKey]);

  React.useLayoutEffect(() => {
    const title = contentRef.current?.querySelector("h1, h2, h3, [role='heading']")?.textContent;
    const key = popupSessionPositionKey({
      kind: "overlay-dialog",
      explicitKey: popupPositionKey,
      testId: contentRef.current?.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
    const remembered = readPopupSessionPosition(key);
    if (remembered) setRememberedOffset(remembered);
  }, [contentAriaLabel, popupPositionKey, setRememberedOffset]);

  const handlePointerDownCapture = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDownCapture?.(event);
    if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest("[data-popup-drag-handle='true']");
    if (!handle) return;
    dragOriginRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      startX: dragOffsetRef.current.x,
      startY: dragOffsetRef.current.y,
    };
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [onPointerDownCapture]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    // If pointerup was lost, a released pointer must never keep moving this
    // popup as the user merely hovers across the screen.
    if (event.buttons !== 1) {
      dragOriginRef.current = null;
      return;
    }
    setRememberedOffset({ x: origin.startX + event.clientX - origin.x, y: origin.startY + event.clientY - origin.y });
  }, [onPointerMove, setRememberedOffset]);

  const stopDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(event);
    if (dragOriginRef.current?.pointerId !== event.pointerId) return;
    dragOriginRef.current = null;
    writePopupSessionPosition(popupStorageKey(), dragOffsetRef.current);
    // Releasing a captured drag can synthesize a click at the release point.
    // Ignore only that same-turn click so it cannot be misread as an overlay
    // dismissal. A subsequent ordinary backdrop click still closes as usual.
    suppressBackdropClickRef.current = true;
    if (clearBackdropSuppressionTimerRef.current) clearTimeout(clearBackdropSuppressionTimerRef.current);
    clearBackdropSuppressionTimerRef.current = setTimeout(() => {
      suppressBackdropClickRef.current = false;
      clearBackdropSuppressionTimerRef.current = null;
    }, 0);
  }, [onPointerUp, popupStorageKey]);
  const cancelDragging = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerCancel?.(event);
    if (dragOriginRef.current?.pointerId === event.pointerId) dragOriginRef.current = null;
  }, [onPointerCancel]);
  const handleLostPointerCapture = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onLostPointerCapture?.(event);
    if (dragOriginRef.current?.pointerId === event.pointerId) dragOriginRef.current = null;
  }, [onLostPointerCapture]);
  const handleKeyDownCapture = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDownCapture?.(event);
    if (event.defaultPrevented || !(event.target instanceof Element) || !event.target.closest("[data-popup-drag-handle='true']")) return;
    const step = 16;
    const delta = event.key === "ArrowLeft" ? { x: -step, y: 0 }
      : event.key === "ArrowRight" ? { x: step, y: 0 }
      : event.key === "ArrowUp" ? { x: 0, y: -step }
      : event.key === "ArrowDown" ? { x: 0, y: step }
      : null;
    if (!delta) return;
    event.preventDefault();
    const next = setRememberedOffset({ x: dragOffsetRef.current.x + delta.x, y: dragOffsetRef.current.y + delta.y });
    writePopupSessionPosition(popupStorageKey(), next);
  }, [onKeyDownCapture, popupStorageKey, setRememberedOffset]);
  const handleBackdropClick = React.useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (suppressBackdropClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressBackdropClickRef.current = false;
      if (clearBackdropSuppressionTimerRef.current) {
        clearTimeout(clearBackdropSuppressionTimerRef.current);
        clearBackdropSuppressionTimerRef.current = null;
      }
      return;
    }
    onBackdropClick?.();
  }, [onBackdropClick]);

  React.useEffect(() => () => {
    if (clearBackdropSuppressionTimerRef.current) clearTimeout(clearBackdropSuppressionTimerRef.current);
  }, []);

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true">
      <div
        aria-hidden="true"
        className={cn("absolute inset-0 bg-black/50", overlayClassName)}
        onClick={handleBackdropClick}
      />
      <div
        ref={contentRef}
        {...contentProps}
        className={cn("fixed top-1/2 left-1/2", className, contentClassName)}
        style={{ ...contentStyle, translate: `calc(-50% + ${dragOffset.x}px) calc(-50% + ${dragOffset.y}px)` }}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={cancelDragging}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDownCapture={handleKeyDownCapture}
      >
        {children}
      </div>
    </div>
  );
}
