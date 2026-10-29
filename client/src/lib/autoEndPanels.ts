import { isFramelessDoorStyle, type DoorStyleFaceInput } from "@shared/doorFaceRecognition";

/**
 * Door-style fields the Designer already stores. Frameless is read the same
 * way as the rest of the app (box construction, frameless flag, distributor /
 * supplier line, USCD style code). Hickory is the species or a name that
 * contains Hickory, including Hickory skins.
 */
export type DoorStyleEndPanelInput = DoorStyleFaceInput & {
  id?: number | null;
  name?: string | null;
  woodSpecies?: string | null;
  doorStyle?: string | null;
  finish?: string | null;
  color?: string | null;
  isFrameless?: boolean | null;
  frameless?: boolean | null;
  constructionMethod?: string | null;
};

const FRAMELESS_TEXT = /frameless|altaeuro|alta euro|\baef\b|us cabinet depot/i;
const HICKORY_TEXT = /\bhickory\b/i;

function descriptiveText(style: DoorStyleEndPanelInput): string {
  return [
    style.ourName,
    style.name,
    style.aliasName,
    style.doorStyle,
    style.styleCode,
    style.woodSpecies,
    style.distributorName,
    style.supplierBrandName,
    style.supplierName,
    style.boxConstruction,
    style.overlayType,
    style.finish,
    style.color,
    style.constructionMethod,
  ]
    .filter((part) => part && String(part).trim())
    .join(" ");
}

/**
 * Frameless lines and Hickory lines get automatic end panels. Every other
 * door style keeps panels only when the customer chooses one.
 */
export function requiresAutoEndPanels(doorStyle: DoorStyleEndPanelInput | null | undefined): boolean {
  if (!doorStyle) return false;
  if (doorStyle.isFrameless === true || doorStyle.frameless === true) return true;
  if (isFramelessDoorStyle(doorStyle)) return true;
  const text = descriptiveText(doorStyle);
  return HICKORY_TEXT.test(text) || FRAMELESS_TEXT.test(text);
}
