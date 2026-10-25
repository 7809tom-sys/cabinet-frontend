import { masterTracFinishColor, type MasterTracProduct } from "@/lib/closet";

/** Diagram, not a product photograph: an edge-banded ¾-inch board in the
 * matching brochure finish. Exact SKU dimensions are shown beside the preview. */
export function MasterTracPartPreview({ product }: { product: MasterTracProduct }) {
  if (!product.placeable) {
    return (
      <div aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-stone-100">
        <span className="text-[9px] font-semibold tracking-wide text-stone-600">SKU</span>
      </div>
    );
  }
  const finish = masterTracFinishColor(product.finish);
  const panel = product.shape === "panel";
  return (
    <div aria-label={`${product.finish} ${panel ? "vertical panel" : "horizontal shelf"} diagram`} role="img" className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-stone-50">
      <div
        className={panel ? "relative h-9 w-2.5 -skew-y-6 rounded-[1px] shadow-sm" : "relative h-2.5 w-9 -skew-x-6 rounded-[1px] shadow-sm"}
        style={{ backgroundColor: finish, boxShadow: "inset 0 0 0 1px #0002, 2px 2px 0 #0003" }}
      >
        <span className={panel ? "absolute right-0 top-0 h-full w-0.5 bg-white/30" : "absolute inset-x-0 bottom-0 h-0.5 bg-white/30"} />
      </div>
    </div>
  );
}
