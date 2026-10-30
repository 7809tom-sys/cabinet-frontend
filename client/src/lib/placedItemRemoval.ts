/** Confirmation copy for removing a cabinet, panel, filler, or appliance. Undo restores it. */
export function placedItemRemovalMessage(label: string): string {
  const name = label.trim() || "this item";
  return `Remove ${name} from the plan? You can undo this.`;
}

export function confirmPlacedItemRemoval(
  label: string,
  ask: (message: string) => boolean = (message) => typeof window !== "undefined" && window.confirm(message),
): boolean {
  return ask(placedItemRemovalMessage(label));
}
