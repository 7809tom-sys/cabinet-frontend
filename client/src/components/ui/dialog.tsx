import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { PopupDragGrip } from "./PopupDragGrip";
import { clampPopupSessionPosition, popupSessionPositionKey, readPopupSessionPosition, writePopupSessionPosition } from "./popupSessionPosition";

// Context to track composition state across dialog children
const DialogCompositionContext = React.createContext<{
  isComposing: () => boolean;
  setComposing: (composing: boolean) => void;
  justEndedComposing: () => boolean;
  markCompositionEnd: () => void;
}>({
  isComposing: () => false,
  setComposing: () => {},
  justEndedComposing: () => false,
  markCompositionEnd: () => {},
});

export const useDialogComposition = () =>
  React.useContext(DialogCompositionContext);

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const composingRef = React.useRef(false);
  const justEndedRef = React.useRef(false);
  const endTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const contextValue = React.useMemo(
    () => ({
      isComposing: () => composingRef.current,
      setComposing: (composing: boolean) => {
        composingRef.current = composing;
      },
      justEndedComposing: () => justEndedRef.current,
      markCompositionEnd: () => {
        justEndedRef.current = true;
        if (endTimerRef.current) {
          clearTimeout(endTimerRef.current);
        }
        endTimerRef.current = setTimeout(() => {
          justEndedRef.current = false;
        }, 150);
      },
    }),
    []
  );

  return (
    <DialogCompositionContext.Provider value={contextValue}>
      <DialogPrimitive.Root data-slot="dialog" {...props} />
    </DialogCompositionContext.Provider>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  );
}

DialogOverlay.displayName = "DialogOverlay";

function DialogContent({
  className,
  children,
  showCloseButton = true,
  hideOverlay = false,
  onEscapeKeyDown,
  style,
  onPointerDownCapture,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onLostPointerCapture,
  onKeyDownCapture,
  onPointerDownOutside,
  onInteractOutside,
  popupPositionKey,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /** Use only for explicitly non-modal tools that must leave an underlying workspace interactive. */
  hideOverlay?: boolean;
  /** Optional stable identity for remembering this popup’s position within the browser session. */
  popupPositionKey?: string;
}) {
  const { isComposing } = useDialogComposition();
  const dragOriginRef = React.useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 });
  const dragOffsetRef = React.useRef(dragOffset);
  const suppressOutsideDismissRef = React.useRef(false);
  const clearOutsideDismissTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const title = contentRef.current?.querySelector("[data-slot='dialog-title']")?.textContent;
    return popupSessionPositionKey({
      kind: "dialog",
      explicitKey: popupPositionKey,
      testId: contentRef.current?.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
  }, [contentAriaLabel, popupPositionKey]);

  React.useLayoutEffect(() => {
    if (!contentElement) return;
    const title = contentElement.querySelector("[data-slot='dialog-title']")?.textContent;
    const key = popupSessionPositionKey({
      kind: "dialog",
      explicitKey: popupPositionKey,
      testId: contentElement.getAttribute("data-testid"),
      ariaLabel: typeof contentAriaLabel === "string" ? contentAriaLabel : null,
      title,
    });
    const remembered = readPopupSessionPosition(key);
    if (remembered) setRememberedOffset(remembered);
  }, [contentAriaLabel, contentElement, popupPositionKey, setRememberedOffset]);

  const handleEscapeKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      // Check both the native isComposing property and our context state
      // This handles Safari's timing issues with composition events
      const isCurrentlyComposing = (e as any).isComposing || isComposing();

      // If IME is composing, prevent dialog from closing
      if (isCurrentlyComposing) {
        e.preventDefault();
        return;
      }

      // Call user's onEscapeKeyDown if provided
      onEscapeKeyDown?.(e);
    },
    [isComposing, onEscapeKeyDown]
  );

  const handlePointerDownCapture = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerDownCapture?.(event);
    if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
    const handle = event.target.closest("[data-popup-drag-handle='true']");
    if (!handle) return;
    dragOriginRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: dragOffsetRef.current.x, startY: dragOffsetRef.current.y };
    // Pointer Capture keeps the drag alive when the pointer leaves the popup.
    // It is unavailable in a few embedded/web-test environments, where normal
    // bubbling still supplies the move events we can use safely.
    if (typeof event.currentTarget.setPointerCapture === "function") {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
  }, [onPointerDownCapture]);

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    onPointerMove?.(event);
    const origin = dragOriginRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    // A missed pointerup must never leave a popup attached to ordinary hover
    // movement. Pointer events report no pressed buttons once a mouse/finger
    // is released, so abandon the drag rather than moving the popup.
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
    suppressOutsideDismissRef.current = true;
    if (clearOutsideDismissTimerRef.current) clearTimeout(clearOutsideDismissTimerRef.current);
    clearOutsideDismissTimerRef.current = setTimeout(() => {
      suppressOutsideDismissRef.current = false;
      clearOutsideDismissTimerRef.current = null;
    }, 0);
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
  const handlePointerDownOutside = React.useCallback((event: Parameters<NonNullable<typeof onPointerDownOutside>>[0]) => {
    onPointerDownOutside?.(event);
    if (suppressOutsideDismissRef.current) event.preventDefault();
  }, [onPointerDownOutside]);
  const handleInteractOutside = React.useCallback((event: Parameters<NonNullable<typeof onInteractOutside>>[0]) => {
    onInteractOutside?.(event);
    if (suppressOutsideDismissRef.current) event.preventDefault();
  }, [onInteractOutside]);

  React.useEffect(() => () => {
    if (clearOutsideDismissTimerRef.current) clearTimeout(clearOutsideDismissTimerRef.current);
  }, []);

  return (
    <DialogPortal data-slot="dialog-portal">
      {!hideOverlay && <DialogOverlay />}
      <DialogPrimitive.Content
        ref={setContentRef}
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
	        // Tailwind v4 implements the centering utilities through the individual
	        // CSS translate property. Preserve that -50% center offset while adding
	        // a drag delta; replacing it with only pixel values made every dialog
	        // open with its top-left corner at the screen center.
	        style={{ ...style, translate: `calc(-50% + ${dragOffset.x}px) calc(-50% + ${dragOffset.y}px)` }}
        onEscapeKeyDown={handleEscapeKeyDown}
        onPointerDownCapture={handlePointerDownCapture}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onKeyDownCapture={handleKeyDownCapture}
        onPointerDownOutside={handlePointerDownOutside}
        onInteractOutside={handleInteractOutside}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  );
}

function DialogTitle({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("flex items-center gap-1.5 text-lg leading-none font-semibold", className)}
      {...props}
    >
      <PopupDragGrip />
      {children}
    </DialogPrimitive.Title>
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger
};
