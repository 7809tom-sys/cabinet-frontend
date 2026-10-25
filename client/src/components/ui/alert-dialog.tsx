import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { PopupDragGrip } from "./PopupDragGrip";
import { clampPopupSessionPosition, popupSessionPositionKey, readPopupSessionPosition, writePopupSessionPosition } from "./popupSessionPosition";

function AlertDialog({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />;
}

function AlertDialogTrigger({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Trigger>) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Portal>) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  style,
  onPointerDownCapture,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDownCapture,
  popupPositionKey,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Content> & {
  /** Optional stable identity for remembering this popup’s position within the browser session. */
  popupPositionKey?: string;
}) {
  const dragOriginRef = React.useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const dragOffsetRef = React.useRef(dragOffset);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentElement, setContentElement] = React.useState<HTMLDivElement | null>(null);
  const contentAriaLabel = props["aria-label"];
  const setContentRef = React.useCallback((element: HTMLDivElement | null) => {
    contentRef.current = element;
    setContentElement(element);
  }, []);
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
    const title = contentRef.current?.querySelector("[data-slot='alert-dialog-title']")?.textContent;
    return popupSessionPositionKey({
      kind: "alert-dialog",
      explicitKey: popupPositionKey,
      testId: contentRef.current?.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
  }, [contentAriaLabel, popupPositionKey]);

  React.useLayoutEffect(() => {
    if (!contentElement) return;
    const title = contentElement.querySelector("[data-slot='alert-dialog-title']")?.textContent;
    const key = popupSessionPositionKey({
      kind: "alert-dialog",
      explicitKey: popupPositionKey,
      testId: contentElement.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
    const remembered = readPopupSessionPosition(key);
    if (remembered) setRememberedOffset(remembered);
  }, [contentAriaLabel, contentElement, popupPositionKey, setRememberedOffset]);

  const handlePointerDownCapture = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDownCapture?.(event);
    if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest("[data-popup-drag-handle='true']");
    if (!handle) return;
    dragOriginRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: dragOffsetRef.current.x, startY: dragOffsetRef.current.y };
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [onPointerDownCapture]);
  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    // Do not let a missed pointerup turn ordinary hover movement into a drag.
    if (event.buttons !== 1) {
      dragOriginRef.current = null;
      return;
    }
    setRememberedOffset({ x: origin.startX + event.clientX - origin.x, y: origin.startY + event.clientY - origin.y });
  }, [onPointerMove, setRememberedOffset]);
  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerUp?.(event);
    if (dragOriginRef.current?.pointerId !== event.pointerId) return;
    dragOriginRef.current = null;
    writePopupSessionPosition(popupStorageKey(), dragOffsetRef.current);
  }, [onPointerUp, popupStorageKey]);
  const handlePointerCancel = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
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
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={setContentRef}
        data-slot="alert-dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        // Preserve the Tailwind centering translation while adding the title-bar
        // drag delta. Replacing it with raw pixels anchors the popup's top-left
        // corner at the viewport center after the first move.
        style={{ ...style, translate: `calc(-50% + ${dragOffset.x}px) calc(-50% + ${dragOffset.y}px)` }}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDownCapture={handleKeyDownCapture}
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("flex items-center gap-1.5 text-lg font-semibold", className)}
      {...props}
    >
      <PopupDragGrip />
      {children}
    </AlertDialogPrimitive.Title>
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogAction({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants(), className)}
      {...props}
    />
  );
}

function AlertDialogCancel({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: "outline" }), className)}
      {...props}
    />
  );
}

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
