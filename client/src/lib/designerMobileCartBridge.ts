type DesignerCartCountListener = (count: number) => void;

let currentDesignerCartCount = 0;
let openDesignerCart: (() => void) | null = null;
const countListeners = new Set<DesignerCartCountListener>();

export function designerMobileCartCount(): number {
  return currentDesignerCartCount;
}

export function publishDesignerMobileCartCount(count: number): void {
  currentDesignerCartCount = Math.max(0, Math.floor(Number(count) || 0));
  Array.from(countListeners).forEach((listener) => listener(currentDesignerCartCount));
}

export function subscribeDesignerMobileCartCount(listener: DesignerCartCountListener): () => void {
  countListeners.add(listener);
  listener(currentDesignerCartCount);
  return () => countListeners.delete(listener);
}

export function registerDesignerMobileCartOpener(opener: () => void): () => void {
  openDesignerCart = opener;
  return () => {
    if (openDesignerCart === opener) openDesignerCart = null;
  };
}

export function requestDesignerMobileCartOpen(): boolean {
  if (!openDesignerCart) return false;
  openDesignerCart();
  return true;
}

export function preventMobileRoomSheetAutoFocus(event: { preventDefault: () => void }): void {
  event.preventDefault();
}
