import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { makeQrDataUrl } from "@/lib/qr";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";

/**
 * Printable graph-paper design sheet.
 *
 * A self-contained, print-optimized page (no app chrome) that a customer or
 * salesperson can print and sketch a kitchen layout on by hand, then snap a
 * photo / scan the QR to submit it through the online Design Tool.
 *
 * Design choices:
 * - 1/4" grid (every square = 3 real inches at the printed scale key), with a
 *   bolder line every 4 squares (= 1 ft) so it reads like architect's paper.
 * - Header carries the CabinetDealz brand mark + project / customer / date
 *   fields and a scale key, plus a QR to the live Design Tool.
 * - A dedicated print stylesheet hides the on-screen controls and fits one
 *   sheet to a US-Letter page.
 */

// Grid geometry (screen px). 24px per 1/4" square -> 96px per foot.
const SQUARE_PX = 24;
const FEET_COLS = 11; // ~11 ft wide drawing area
const FEET_ROWS = 8; // ~8 ft tall drawing area
const COLS = FEET_COLS * 4;
const ROWS = FEET_ROWS * 4;
const W = COLS * SQUARE_PX;
const H = ROWS * SQUARE_PX;

export default function PlanSheet() {
  const [qr, setQr] = useState<string>("");
  const { t, lang } = useLanguage();
  useSeo({ title: t("seo_plansheet_t"), description: t("seo_plansheet_d"), lang });

  const designUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://cabinetdealz.com/design";
    return `${window.location.origin}/design`;
  }, []);

  useEffect(() => {
    let cancelled = false;
    makeQrDataUrl(designUrl, { size: 240 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        /* QR is a nice-to-have; sheet still prints without it */
      });
    return () => {
      cancelled = true;
    };
  }, [designUrl]);

  return (
    <div className="min-h-screen bg-muted/40 print:bg-white">
      {/* Print-only stylesheet */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.5in; }
          .no-print { display: none !important; }
          .plan-sheet { box-shadow: none !important; margin: 0 !important; border: none !important; }
          html, body { background: #fff !important; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/design">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            {t("ps_back")}
          </Link>
        </Button>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {t("ps_screen_hint")}
        </p>
        <Button
          size="sm"
          onClick={() => window.print()}
          className="bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
        >
          <Printer className="mr-1.5 h-4 w-4" />
          {t("ps_print")}
        </Button>
      </div>

      {/* The sheet */}
      <div className="mx-auto max-w-[8.5in] p-4 print:p-0">
        <div className="plan-sheet rounded-lg border border-border bg-white p-6 shadow-sm print:rounded-none print:p-0 print:shadow-none">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b-2 border-[var(--color-navy)] pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded bg-[var(--color-navy)] text-sm font-bold text-white">
                  CD
                </div>
                <span className="font-serif text-2xl font-bold text-[var(--color-navy)]">
                  Cabinet<span className="text-[var(--color-gold)]">Dealz</span>
                </span>
              </div>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t("ps_worksheet")}
              </p>
            </div>

            <div className="flex flex-col items-center">
              {qr ? (
                <img src={qr} alt={t("ps_scan_alt")} className="h-20 w-20" />
              ) : (
                <div className="h-20 w-20 rounded border border-dashed border-border" />
              )}
              <span className="mt-1 max-w-[7rem] text-center text-[10px] leading-tight text-muted-foreground">
                {t("ps_scan_caption")}
              </span>
            </div>
          </div>

          {/* Project fields */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-4 text-sm">
            <Field label={t("ps_field_name")} />
            <Field label={t("ps_field_date")} />
            <Field label={t("ps_field_phone")} />
            <Field label={t("ps_field_email")} />
            <Field label={t("ps_field_project")} className="col-span-2" />
          </div>

          {/* Scale key */}
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{t("ps_scale")}</span>
            <span>{t("ps_drawing_area", { cols: FEET_COLS, rows: FEET_ROWS })}</span>
          </div>

          {/* Graph paper grid */}
          <GraphGrid label={t("ps_grid_alt")} />

          {/* Footer notes */}
          <div className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">{t("ps_tips_title")}</p>
            <p>
              {t("ps_tips_body", { url: designUrl.replace(/^https?:\/\//, "") })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`flex items-end gap-2 ${className}`}>
      <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-5 flex-1 border-b border-dotted border-foreground/40" />
    </div>
  );
}

function GraphGrid({ label }: { label: string }) {
  // Build the grid as an inline SVG so it renders identically on screen and in print.
  const lines: React.ReactNode[] = [];
  for (let c = 0; c <= COLS; c++) {
    const x = c * SQUARE_PX;
    const bold = c % 4 === 0;
    lines.push(
      <line
        key={`v${c}`}
        x1={x}
        y1={0}
        x2={x}
        y2={H}
        stroke={bold ? "#94a3b8" : "#dbe3ec"}
        strokeWidth={bold ? 1 : 0.5}
      />,
    );
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = r * SQUARE_PX;
    const bold = r % 4 === 0;
    lines.push(
      <line
        key={`h${r}`}
        x1={0}
        y1={y}
        x2={W}
        y2={y}
        stroke={bold ? "#94a3b8" : "#dbe3ec"}
        strokeWidth={bold ? 1 : 0.5}
      />,
    );
  }

  return (
    <div className="w-full overflow-hidden rounded border border-[var(--color-navy)]/30">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={label}
      >
        <rect x={0} y={0} width={W} height={H} fill="#ffffff" />
        {lines}
      </svg>
    </div>
  );
}
