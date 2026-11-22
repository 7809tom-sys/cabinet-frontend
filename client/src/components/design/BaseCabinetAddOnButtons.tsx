import { Droplets, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { resolveTierPrice, type PricingTier, type TierPrices } from "@shared/pricingTier";
import { isCornerCabinet, type PlacedCabinet } from "@/lib/design";
import {
  isBaseCabinetAttributeAddOnEligible,
  maxRollOutTraysForCabinet,
  type BaseCabinetAddOnTarget,
} from "@/lib/baseCabinetAttributeAddOns";

export function attributeAddOnTarget(cabinet: PlacedCabinet): BaseCabinetAddOnTarget {
  return {
    placement: cabinet.placement,
    category: cabinet.category,
    subCategory: cabinet.subCategory,
    masterCode: cabinet.masterCode,
    description: cabinet.description,
    isCornerCabinet: isCornerCabinet(cabinet.masterCode, cabinet.description, cabinet.cornerType),
    cornerType: cabinet.cornerType,
    nominalWidth: cabinet.nominalWidth ?? null,
    width: cabinet.width,
    height: cabinet.height,
    numberOfDrawers: cabinet.numberOfDrawers,
  };
}

export type AttributeTrayChoice = TierPrices & {
  masterCode: string;
  description?: string | null;
  width: number;
  height?: number | null;
  heightIn?: number | null;
};

/**
 * Visible Add roll-out tray / Add sink & faucet controls.
 * The tray SKU is resolved by the existing same-line picker; this component
 * only displays it. No catalog code or price is invented here.
 */
export function BaseCabinetAddOnButtons({
  cabinet,
  qty,
  tray,
  checking,
  missingLine,
  pricingTier,
  onSetQty,
  onAddSinkAndFaucet,
}: {
  cabinet: PlacedCabinet;
  qty: number;
  tray: AttributeTrayChoice | null;
  checking: boolean;
  missingLine: boolean;
  pricingTier: PricingTier;
  onSetQty: (qty: number) => void;
  onAddSinkAndFaucet?: (uid: string) => void;
}) {
  const { t } = useLanguage();
  if (!isBaseCabinetAttributeAddOnEligible(attributeAddOnTarget(cabinet))) return null;
  const maxQty = maxRollOutTraysForCabinet({
    height: cabinet.height,
    numberOfDrawers: cabinet.numberOfDrawers,
    trayHeightIn: typeof tray?.height === "number" ? tray.height : typeof tray?.heightIn === "number" ? tray.heightIn : null,
  });
  const safeQty = Math.max(0, Math.min(maxQty, Math.floor(Number(qty) || 0)));
  const missingSku = !checking && !missingLine && !tray;
  const tooShort = Boolean(tray) && maxQty <= 0;
  const atMax = Boolean(tray) && maxQty > 0 && safeQty >= maxQty;
  const disabledReason = missingLine
    ? t("dt_ca_rollout_need_line")
    : checking
      ? t("dt_ca_rollout_checking")
      : missingSku
        ? t("dt_ca_rollout_none_size")
        : tooShort
          ? t("dt_ca_rollout_height_cap", { max: maxQty })
          : "";
  const trayDisabled = missingLine || checking || missingSku || tooShort || atMax;
  const eachNum = tray ? resolveTierPrice(pricingTier, tray) : null;

  return (
    <section className="space-y-2 border-t border-border pt-4" data-testid="base-cabinet-add-ons">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <PackagePlus className="h-4 w-4 text-muted-foreground" />
        {t("dt_ca_addons")}
      </h4>
      <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            data-testid="add-rollout-tray"
            disabled={trayDisabled}
            onClick={() => onSetQty(Math.min(maxQty, safeQty + 1))}
          >
            {t("dt_ca_add_rollout_tray")}
          </Button>
          {tray && (
            <span className="font-mono text-[11px] text-muted-foreground" data-testid="rollout-tray-sku">
              {tray.masterCode}
              {eachNum != null && Number.isFinite(eachNum) ? ` · $${eachNum.toFixed(2)} ${t("dt_ca_rollout_each")}` : ""}
            </span>
          )}
        </div>
        {disabledReason !== "" && (
          <p className="text-[11px] text-muted-foreground" data-testid="rollout-tray-disabled-reason">{disabledReason}</p>
        )}
        {tray && !tooShort && (
          <p className="text-[11px] text-muted-foreground" data-testid="rollout-tray-height-cap">
            {t("dt_ca_rollout_height_cap", { max: maxQty })}
          </p>
        )}
        {tray && maxQty > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1 text-[11px] text-muted-foreground">{t("dt_ca_rollout_qty")}</span>
            {Array.from({ length: maxQty }, (_, index) => index + 1).map((count) => (
              <Button
                key={count}
                type="button"
                size="sm"
                variant={safeQty === count ? "default" : "outline"}
                className="h-8 w-8 p-0"
                aria-label={`${t("dt_ca_rollout_qty")} ${count}`}
                data-testid={`rollout-qty-${count}`}
                onClick={() => onSetQty(count)}
              >
                {count}
              </Button>
            ))}
            {safeQty > 0 && (
              <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => onSetQty(0)}>
                {t("dt_ca_rollout_remove")}
              </Button>
            )}
          </div>
        )}
        {onAddSinkAndFaucet && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="add-sink-and-faucet"
            onClick={() => onAddSinkAndFaucet(cabinet.uid)}
          >
            <Droplets className="mr-1.5 h-3.5 w-3.5" />
            {t("dt_bs_add_sink")}
          </Button>
        )}
      </div>
    </section>
  );
}
