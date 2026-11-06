import { useState, type ReactNode } from "react";
import {
  CUSTOMER_DESIGN_LINK_NOTE,
  NO_LINKED_DESIGN_COPY,
  designLinkSourceLabel,
  type DesignLinkKind,
} from "@shared/crmCustomerDesigns";

/**
 * One saved-design row that the API already narrowed to this customer.
 * `linkKind` says which stored link put it here, so the row never implies that
 * a design merely saved on the account belongs to the customer.
 */
export type CustomerLinkedDesignItem = {
  id: number;
  name: string;
  thumbnailUrl?: string | null;
  assistLabel?: string | null;
  linkKind?: DesignLinkKind;
  /** Where "Open in Designer" goes. Omitted for a design nobody can open. */
  href?: string | null;
};

export type AttachDesignOption = { id: number; name: string; storeName?: string | null };

export type AttachDesignControl = {
  /** Saved designs that can still be linked to this customer. */
  options: AttachDesignOption[];
  onSelect: (designId: number) => void;
  pending?: boolean;
  disabled?: boolean;
  label?: string;
  emptyCopy?: string;
};

export function CustomerLinkedDesigns({
  designs,
  loading = false,
  error = null,
  emptyCopy = NO_LINKED_DESIGN_COPY,
  attach = null,
  showLinkNote = true,
  showLinkSource = false,
  actions,
  testId = "customer-linked-designs",
}: {
  designs: CustomerLinkedDesignItem[];
  loading?: boolean;
  error?: string | null;
  emptyCopy?: string;
  /**
   * How to link one. Pass a picker when the caller can load saved designs; pass
   * an anchor when the picker lives elsewhere on the page. Rendered both in the
   * empty state and under the list, so "link one" is always reachable.
   */
  attach?: ({ href: string; label: string; onClick?: never } | AttachDesignControl) | null;
  showLinkNote?: boolean;
  showLinkSource?: boolean;
  actions?: (design: CustomerLinkedDesignItem) => ReactNode;
  testId?: string;
}) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading designs…</p>;
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  return (
    <div className="space-y-2" data-testid={testId} data-linked-design-count={designs.length}>
      {designs.length === 0 ? (
        <div className="space-y-1" data-testid="customer-design-empty">
          <p className="text-xs text-muted-foreground">{emptyCopy}</p>
        </div>
      ) : (
        designs.map((design) => (
          <div key={design.id} className="flex gap-2 text-sm" data-testid="customer-linked-design" data-design-id={design.id}>
            {design.thumbnailUrl ? (
              <img src={design.thumbnailUrl} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 rounded bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium">{design.name}</p>
              {design.assistLabel ? <p className="text-[11px] text-muted-foreground">{design.assistLabel}</p> : null}
              {showLinkSource && design.linkKind ? (
                <p className="text-[11px] text-muted-foreground" data-testid="customer-design-link-source">
                  {designLinkSourceLabel(design.linkKind)}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-x-2">
                {design.href ? (
                  <a className="text-xs text-primary underline" href={design.href}>Open in Designer</a>
                ) : null}
                {actions ? actions(design) : null}
              </div>
            </div>
          </div>
        ))
      )}
      {attach ? <AttachDesignAffordance attach={attach} empty={designs.length === 0} /> : null}
      {showLinkNote ? (
        <p className="text-[11px] text-muted-foreground" data-testid="customer-design-link-note">{CUSTOMER_DESIGN_LINK_NOTE}</p>
      ) : null}
    </div>
  );
}

function AttachDesignAffordance({
  attach,
  empty,
}: {
  attach: { href: string; label: string } | AttachDesignControl;
  empty: boolean;
}) {
  if ("href" in attach && typeof attach.href === "string") {
    return (
      <a className="inline-flex text-xs font-semibold text-primary underline underline-offset-2" href={attach.href} data-testid="customer-design-attach">
        {attach.label}
      </a>
    );
  }
  const control = attach as AttachDesignControl;
  return <AttachDesignPicker control={control} empty={empty} />;
}

function AttachDesignPicker({ control, empty }: { control: AttachDesignControl; empty: boolean }) {
  const [value, setValue] = useState("");
  const noOptions = control.options.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="customer-design-picker">
      <label className="sr-only" htmlFor="crm-design-to-link">{control.label ?? "Link a saved design"}</label>
      <select
        id="crm-design-to-link"
        className="h-8 flex-1 min-w-40 rounded-md border border-input bg-background px-2 text-xs"
        value={value}
        disabled={control.disabled || control.pending || noOptions}
        onChange={(event) => setValue(event.target.value)}
        data-testid="customer-design-picker-select"
      >
        <option value="">{noOptions ? (control.emptyCopy ?? "No saved designs available") : "Choose a saved design…"}</option>
        {control.options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.storeName ? `${option.name} · ${option.storeName}` : option.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="text-xs font-semibold text-primary underline underline-offset-2 disabled:opacity-50"
        disabled={!value || control.disabled || control.pending}
        onClick={() => {
          if (!value) return;
          control.onSelect(Number(value));
          setValue("");
        }}
        data-testid="customer-design-attach"
      >
        {control.label ?? (empty ? "Link a saved design" : "Link")}
      </button>
    </div>
  );
}
