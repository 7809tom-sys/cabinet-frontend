import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Fields already stored on vendor and admin door-style cards. */
export type DoorStyleCardFields = {
  ourName?: string | null;
  aliasName?: string | null;
  featuredLabel?: string | null;
  styleCode?: string | null;
  distributorName?: string | null;
  supplierBrandName?: string | null;
  supplierName?: string | null;
  /** Profile type such as Shaker, shown only when it is not already the name. */
  detail?: string | null;
};

export type DoorStyleCardIdentity = {
  name: string;
  styleCode: string | null;
  extras: string[];
};

function clean(value: string | null | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

/**
 * The working door-style name stays the title. The style code, any distinct
 * customer label, and the supplier line are separate visible text.
 */
export function doorStyleCardIdentity(style: DoorStyleCardFields): DoorStyleCardIdentity {
  const ourName = clean(style.ourName);
  const aliasName = clean(style.aliasName);
  const featuredLabel = clean(style.featuredLabel);
  const styleCode = clean(style.styleCode);
  const detail = clean(style.detail);
  const supplierLine = clean(style.supplierBrandName) || clean(style.supplierName) || clean(style.distributorName);
  const name = ourName || aliasName || featuredLabel || styleCode || "Door style";
  const seen = new Set<string>([name.toLocaleLowerCase()]);
  const take = (value: string): string | null => {
    if (!value) return null;
    const key = value.toLocaleLowerCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return value;
  };

  const code = take(styleCode);
  const extras = [take(aliasName), take(featuredLabel), take(detail), take(supplierLine)].filter(
    (part): part is string => Boolean(part),
  );

  return { name, styleCode: code, extras };
}

/**
 * Visible door-style title for a row, card, or thumbnail caption.
 * Long names wrap; nothing here is truncated or hover-only.
 */
export function DoorStyleIdentity({
  style,
  nameAs = "p",
  nameClassName,
  className,
  trailing,
}: {
  style: DoorStyleCardFields;
  nameAs?: "p" | "h3";
  nameClassName?: string;
  className?: string;
  trailing?: ReactNode;
}) {
  const identity = doorStyleCardIdentity(style);
  const NameTag = nameAs;

  return (
    <div data-testid="door-style-identity" className={cn("min-w-0 max-w-full", className)}>
      <div className="flex max-w-full flex-wrap items-baseline gap-x-2 gap-y-1">
        <NameTag
          data-testid="door-style-name"
          className={cn(
            "min-w-0 max-w-full break-words text-base font-semibold leading-snug",
            nameClassName ?? "text-foreground",
          )}
        >
          {identity.name}
        </NameTag>
        {identity.styleCode && (
          <span
            data-testid="door-style-code"
            className="inline-flex max-w-full shrink-0 break-words rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold leading-none text-foreground"
          >
            {identity.styleCode}
          </span>
        )}
        {trailing}
      </div>
      {identity.extras.length > 0 && (
        <p data-testid="door-style-meta" className="mt-0.5 max-w-full break-words text-xs leading-snug text-muted-foreground">
          {identity.extras.join(" · ")}
        </p>
      )}
    </div>
  );
}
