import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { FabricationSheetEmailDialog } from "@/components/design/FabricationSheetEmailDialog";
import {
  buildCountertopFabricationSheet,
  type CountertopFabricationInput,
} from "@/lib/countertopFabricationSheet";
import { downloadFabricationSheetPdf } from "@/lib/countertopFabricationSheetPdf";

type Props = {
  /** Everything the sheet reads from the live design. Null disables the controls. */
  input: CountertopFabricationInput | null;
  /** Show the running totals above the buttons. */
  showSummary?: boolean;
  brandName?: string | null;
  className?: string;
};

/**
 * Countertop Fabrication Sheet controls for the Designer.
 *
 * Both actions work off one measurement pass over the current design, so the
 * downloaded PDF and the emailed PDF carry identical content. The sheet is only
 * offered when the design actually bears a countertop; a design with no run
 * reports that instead of producing an empty document.
 */
export function CountertopFabricationSheetActions({
  input,
  showSummary = true,
  brandName,
  className,
}: Props) {
  const { t } = useLanguage();
  const [downloading, setDownloading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const sheet = useMemo(
    () => (input ? buildCountertopFabricationSheet(input) : null),
    [input],
  );

  const ready = Boolean(sheet && !sheet.empty);

  async function handleDownload() {
    if (!sheet || sheet.empty) {
      toast.error(t("dt_fab_nothing"));
      return;
    }
    setDownloading(true);
    try {
      const fileName = await downloadFabricationSheetPdf(sheet, brandName);
      toast.success(t("dt_fab_downloaded"), { description: fileName });
    } catch (error) {
      toast.error(t("dt_fab_download_failed"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={className} data-testid="countertop-fabrication-actions">
      {showSummary && sheet && (
        <div className="mb-1.5 text-[10px] leading-snug text-muted-foreground" data-testid="countertop-fabrication-summary">
          {ready ? (
            <>
              <div className="font-semibold text-foreground">{t("dt_fab_summary_title")}</div>
              <div>
                {t("dt_fab_summary_runs", {
                  runs: sheet.totals.runCount,
                  sqft: sheet.totals.squareFeet,
                  linft: sheet.totals.linearFeet,
                })}
              </div>
              <div>
                {sheet.totals.cutoutCount > 0
                  ? t("dt_fab_summary_cutouts", { count: sheet.totals.cutoutCount })
                  : t("dt_fab_summary_no_cutouts")}
              </div>
              {sheet.unknowns.length > 0 && (
                <div className="mt-0.5 text-amber-700" data-testid="countertop-fabrication-unknowns">
                  {t("dt_fab_summary_unknowns", { count: sheet.unknowns.length })}
                </div>
              )}
            </>
          ) : (
            <span data-testid="countertop-fabrication-empty">{t("dt_fab_nothing")}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start gap-1.5 border-[#a87f33] text-[11px] text-[#7a5c24] hover:bg-[#a87f33]/10"
          data-testid="download-fabrication-sheet"
          onClick={() => void handleDownload()}
          disabled={!ready || downloading}
          title={ready ? t("dt_fab_download_title") : t("dt_fab_nothing")}
        >
          {downloading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Download className="h-3.5 w-3.5" />}
          {t("dt_fab_download")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start gap-1.5 border-[#1a2744] text-[11px] text-[#1a2744] hover:bg-[#1a2744]/10"
          data-testid="email-fabrication-sheet"
          onClick={() => setEmailOpen(true)}
          disabled={!ready}
          title={ready ? t("dt_fab_email_title") : t("dt_fab_nothing")}
        >
          <Mail className="h-3.5 w-3.5" />
          {t("dt_fab_email")}
        </Button>
      </div>
      <p className="mt-1 flex items-start gap-1 text-[9px] leading-snug text-muted-foreground">
        <FileText className="mt-[1px] h-2.5 w-2.5 shrink-0" />
        {t("dt_fab_disclaimer")}
      </p>
      <FabricationSheetEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        sheet={sheet}
        brandName={brandName}
      />
    </div>
  );
}
