import type React from "react";
import {
  customerPageLinkWantsNewTab,
  isCustomerPageLinkActivationKey,
  openCustomerPage,
} from "@/lib/crmCustomerPageLink";

const LINK_LABEL = "Open customer page";
const LINK_CLASS = "text-primary underline cursor-pointer rounded-sm hover:text-primary/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/**
 * While the pointer is pressed on the link, switch off the draggable card it
 * sits in, so a press that wobbles a few pixels opens the customer instead of
 * starting a stage drag. The card is draggable again right after release.
 */
function suspendAncestorDrag(event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>) {
  event.stopPropagation();
  const card = event.currentTarget.closest<HTMLElement>('[draggable="true"]');
  if (!card) return;
  card.draggable = false;
  const restore = () => {
    window.removeEventListener("pointerup", restore, true);
    window.removeEventListener("pointercancel", restore, true);
    window.removeEventListener("mouseup", restore, true);
    window.setTimeout(() => { card.draggable = true; }, 0);
  };
  window.addEventListener("pointerup", restore, true);
  window.addEventListener("pointercancel", restore, true);
  window.addEventListener("mouseup", restore, true);
}

/** Link-like control for use inside the draggable deal card <button>. */
function NestedCustomerPageLink({ href }: { href: string }) {
  return (
    <span
      role="link"
      tabIndex={0}
      title={href}
      data-href={href}
      data-testid="open-customer-page"
      className={LINK_CLASS}
      onPointerDown={suspendAncestorDrag}
      onMouseDown={suspendAncestorDrag}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        openCustomerPage(href, { newTab: customerPageLinkWantsNewTab(event) });
      }}
      onAuxClick={(event) => {
        // Middle click opens a new tab, like a real link.
        if (event.button !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        openCustomerPage(href, { newTab: true });
      }}
      onKeyDown={(event) => {
        if (!isCustomerPageLinkActivationKey(event.key)) return;
        // Keep Enter/Space from reaching the card button (which opens the deal)
        // and Space from scrolling the board.
        event.preventDefault();
        event.stopPropagation();
        openCustomerPage(href, { newTab: customerPageLinkWantsNewTab(event) });
      }}
      onKeyUp={(event) => {
        if (isCustomerPageLinkActivationKey(event.key)) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {LINK_LABEL}
    </span>
  );
}

export function CustomerActivityLine({ text, href, nested = false }: { text: string; href: string; nested?: boolean }) {
  const hasHref = Boolean(href && href.trim());
  return (
    <div className="mt-2 text-[11px] leading-snug text-muted-foreground" data-testid="customer-activity-summary">
      <p>{text}</p>
      {!hasHref ? null : nested ? (
        <NestedCustomerPageLink href={href} />
      ) : (
        // Outside a button (the deal drawer) this is a real link, so the
        // browser's own click, Ctrl/Cmd-click, middle click and "Open in new
        // tab" all work.
        <a className={LINK_CLASS} href={href} data-testid="open-customer-page" onClick={(event) => event.stopPropagation()}>
          {LINK_LABEL}
        </a>
      )}
    </div>
  );
}
