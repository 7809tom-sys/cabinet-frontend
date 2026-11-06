import { ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useHistoryNavigation } from "@/lib/browserHistoryNav";

type DesignerHistoryNavProps = {
  /**
   * Where Back goes when this tab has no previous entry — a direct link, a
   * bookmark, or the tab's first page. Defaults to the CabinetDealz front page.
   */
  fallbackHref?: string;
};

/**
 * Browser-style Back and Forward for the Designer header. One shared control, so
 * the kitchen and bathroom workspaces always match (they are the same page, with
 * the room type chosen inside it).
 *
 * Back returns to the previous page. When the tab has no previous page to return
 * to, it goes to `fallbackHref` instead, so a direct link is never a dead end.
 * Forward undoes a Back exactly like the browser's own button, and is disabled
 * whenever there is nothing ahead to return to.
 */
export default function DesignerHistoryNav({ fallbackHref = "/" }: DesignerHistoryNavProps) {
  const { t } = useLanguage();
  const [, navigate] = useLocation();
  const { canGoBack, canGoForward } = useHistoryNavigation();

  const goBack = () => {
    if (canGoBack) {
      window.history.back();
      return;
    }
    // No entry behind this page. Replace it so the front page does not keep a
    // dead designer entry on its own Back stack.
    navigate(fallbackHref, { replace: true });
  };

  const buttonClass = "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-[#1a2744] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a2744]/40 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background";

  return (
    <div
      data-testid="designer-history-nav"
      className="flex shrink-0 items-center gap-1.5 border-b border-border bg-card px-2 py-1"
      role="group"
      aria-label={t("dt_nav_history_group")}
    >
      <button
        type="button"
        data-testid="designer-history-back"
        onClick={goBack}
        title={canGoBack ? t("dt_nav_back_title") : t("dt_nav_back_home_title")}
        aria-label={t("dt_nav_back")}
        className={buttonClass}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>{t("dt_nav_back")}</span>
      </button>
      <button
        type="button"
        data-testid="designer-history-forward"
        onClick={() => window.history.forward()}
        disabled={!canGoForward}
        aria-disabled={!canGoForward}
        title={canGoForward ? t("dt_nav_forward_title") : t("dt_nav_forward_none")}
        aria-label={t("dt_nav_forward")}
        className={buttonClass}
      >
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
        <span>{t("dt_nav_forward")}</span>
      </button>
    </div>
  );
}
