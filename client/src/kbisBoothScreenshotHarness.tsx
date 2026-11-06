/**
 * Screenshot harness: the real KBIS 2027 booth panel from the affiliate
 * Marketing Hub, with no affiliate rows published yet, so the screenshot shows
 * exactly what the shipped manifest renders on its own.
 *
 * Loaded only by `dev/kbis-booth-shot.html` during the screenshot run
 * (`e2e/kbis-booth-panel.spec.ts`). It is not part of the app bundle: nothing
 * imports it, and no route points at it.
 */
import { createRoot } from "react-dom/client";
import "@/index.css";
import { KbisBoothAssetsPanel } from "@/components/affiliate/KbisBoothAssetsPanel";

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<KbisBoothAssetsPanel resources={[]} query="" />);
}
