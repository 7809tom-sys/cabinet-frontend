import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import {
  type DoorStyleBatchCandidate,
  type SpecBatchSelection,
  type SpecGroupId,
  SPEC_GROUPS,
  defaultSpecGroupIds,
  doorStyleVendorLabel,
  siblingDoorStyles,
  specGroupLabels,
  stylesWillChangeLabel,
  toggleSelectedId,
} from "./applyDoorStyleSpecs";

export type ApplySpecsHandle = {
  selection: () => SpecBatchSelection;
  confirm: () => Promise<SpecBatchSelection | null>;
};

type VendorStyle = DoorStyleBatchCandidate & {
  supplierBrandName?: string | null;
  supplierName?: string | null;
};

/**
 * Checklist modeled on the vendor portal's "Apply this same measured profile
 * to checked door styles" section. Other styles from the same distributor
 * start unchecked. Spec groups default on so the admin chooses styles, then
 * can drop a group before saving.
 */
export const ApplySpecsToOtherStyles = forwardRef<
  ApplySpecsHandle,
  {
    current: VendorStyle;
    styles: readonly VendorStyle[];
    locked?: boolean;
  }
>(function ApplySpecsToOtherStyles({ current, styles, locked = false }, ref) {
  const siblings = useMemo(
    () => siblingDoorStyles(styles, current),
    [styles, current],
  );
  const vendorLabel = doorStyleVendorLabel(current);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<SpecGroupId[]>(() =>
    defaultSpecGroupIds(),
  );
  const [pending, setPending] = useState<SpecBatchSelection | null>(null);
  const resolver = useRef<((value: SpecBatchSelection | null) => void) | null>(
    null,
  );
  const confirmRef = useRef<HTMLDivElement>(null);

  const selectionFrom = (
    ids: readonly number[],
    groups: readonly SpecGroupId[],
  ): SpecBatchSelection => {
    const available = new Set(siblings.map((style) => style.id));
    const chosen = siblings.filter(
      (style) => ids.includes(style.id) && available.has(style.id),
    );
    const groupSet = new Set(groups);
    return {
      styleIds: chosen.map((style) => style.id),
      groups: SPEC_GROUPS.filter((group) => groupSet.has(group.id)).map(
        (group) => group.id,
      ),
      styleNames: chosen.map((style) => style.ourName),
      vendorLabel,
    };
  };

  const settle = (value: SpecBatchSelection | null) => {
    const resolve = resolver.current;
    resolver.current = null;
    setPending(null);
    resolve?.(value);
  };

  useEffect(
    () => () => {
      resolver.current?.(null);
      resolver.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!pending) return;
    confirmRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [pending]);

  useImperativeHandle(
    ref,
    () => ({
      selection: () => selectionFrom(selectedIds, selectedGroups),
      confirm: () => {
        const selection = selectionFrom(selectedIds, selectedGroups);
        return new Promise((resolve) => {
          resolver.current = resolve;
          setPending(selection);
        });
      },
    }),
    [selectedIds, selectedGroups, siblings, vendorLabel],
  );

  const toggleGroup = (groupId: SpecGroupId, checked: boolean) => {
    setSelectedGroups((currentGroups) => {
      if (checked)
        return currentGroups.includes(groupId)
          ? currentGroups
          : [...currentGroups, groupId];
      return currentGroups.filter((id) => id !== groupId);
    });
  };

  return (
    <section
      data-testid="apply-specs-to-other-styles"
      aria-labelledby="apply-specs-heading"
      className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3"
    >
      <div>
        <h3 id="apply-specs-heading" className="text-sm font-semibold">
          Apply these specs to other styles
        </h3>
        <p className="text-xs text-muted-foreground">
          Other door styles from {vendorLabel}. Check only styles made with this
          same physical door profile. Saving writes this style first, then
          copies the checked spec groups onto each checked style.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {SPEC_GROUPS.map((group) => (
          <label
            key={group.id}
            className="flex items-start gap-2 rounded border border-sky-100 bg-background px-2.5 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="mt-0.5"
              data-testid={`apply-spec-group-${group.id}`}
              checked={selectedGroups.includes(group.id)}
              disabled={locked}
              onChange={(event) => toggleGroup(group.id, event.target.checked)}
            />
            <span>{group.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="apply-specs-select-all"
          disabled={locked || siblings.length === 0}
          onClick={() => setSelectedIds(siblings.map((style) => style.id))}
        >
          Select all
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          data-testid="apply-specs-clear"
          disabled={locked || selectedIds.length === 0}
          onClick={() => setSelectedIds([])}
        >
          Clear
        </Button>
        <span className="text-xs font-medium text-sky-800">
          {selectedIds.length} other style{selectedIds.length === 1 ? "" : "s"}{" "}
          selected.
        </span>
      </div>
      {siblings.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No other door styles from this distributor.
        </p>
      ) : (
        <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
          {siblings.map((candidate) => (
            <label
              key={candidate.id}
              className="flex items-center gap-2 rounded border border-sky-100 bg-background px-2.5 py-2 text-sm"
            >
              <input
                type="checkbox"
                data-testid={`apply-spec-style-${candidate.id}`}
                checked={selectedIds.includes(candidate.id)}
                disabled={locked}
                onChange={(event) =>
                  setSelectedIds((currentIds) =>
                    toggleSelectedId(
                      currentIds,
                      candidate.id,
                      event.target.checked,
                    ),
                  )
                }
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">
                  {candidate.ourName}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {[candidate.styleCode, candidate.doorStyle, candidate.color]
                    .filter(Boolean)
                    .join(" · ") || "Door style"}
                  {candidate.isActive === false ? " · Hidden" : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Names, colors, images, room scenes, pricing, SKUs, warehouse ZIPs,
        freight, and style-verified flags stay on each style.
      </p>
      {pending && (
        <div
          ref={confirmRef}
          data-testid="apply-specs-confirmation"
          className="pointer-events-auto space-y-2 rounded-md border-2 border-sky-700 bg-background p-3"
        >
          <p className="text-sm font-semibold">
            {stylesWillChangeLabel(pending.styleIds.length)} from{" "}
            {pending.vendorLabel}.
          </p>
          <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto pl-5 text-sm">
            {pending.styleIds.map((id, index) => (
              <li key={id}>{pending.styleNames[index]}</li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Spec groups: {specGroupLabels(pending.groups).join("; ")}
          </p>
          <p className="text-xs text-muted-foreground">
            This saves the style you are editing, then copies only those specs
            onto the styles listed above.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => settle(null)}
            >
              Back
            </Button>
            <Button
              type="button"
              className="bg-sky-700 text-white hover:bg-sky-800"
              onClick={() => settle(pending)}
            >
              Save and apply
            </Button>
          </div>
        </div>
      )}
    </section>
  );
});
