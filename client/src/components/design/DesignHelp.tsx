import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  HelpCircle,
  X,
  MousePointerClick,
  Move,
  Ruler,
  PencilLine,
  PanelsTopLeft,
  RotateCw,
  Presentation,
} from "lucide-react";

const DISMISS_KEY = "cd_design_tip_dismissed_v1";

/** Keys for the short rotating one-liners shown in the tip strip above the canvas. */
const TIP_KEYS = [
  "dt_help_tip1",
  "dt_help_tip2",
  "dt_help_tip3",
  "dt_help_tip4",
  "dt_help_tip5",
] as const;

/** A single step in the Help guide. */
function HelpStep({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#1a2744] text-[#e0b56e]">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/**
 * On-page help for the design tool: a dismissable rotating tip strip plus a
 * "?" button that opens a full step-by-step guide dialog.
 */
export function DesignHelp() {
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(true);
  const [tipIndex, setTipIndex] = useState(0);

  // Read first-time dismissal state from localStorage on mount.
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  // Rotate the tip every few seconds while the strip is visible.
  useEffect(() => {
    if (dismissed) return;
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % TIP_KEYS.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [dismissed]);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore storage errors */
    }
  };

  const helpButton = useMemo(
    () => (
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 bg-background"
          >
            <HelpCircle className="h-4 w-4" />
            {t("dt_help_btn")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dt_help_title")}</DialogTitle>
            <DialogDescription>
              {t("dt_help_desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <HelpStep icon={<PanelsTopLeft className="h-4 w-4" />} title={t("dt_help_s1_title")}>
              {t("dt_help_tip1")}
            </HelpStep>
            <HelpStep icon={<MousePointerClick className="h-4 w-4" />} title={t("dt_help_s2_title")}>
              {t("dt_help_s2_body")}
            </HelpStep>
            <HelpStep icon={<Move className="h-4 w-4" />} title={t("dt_help_s3_title")}>
              {t("dt_help_s3_body")}
            </HelpStep>
            <HelpStep icon={<Ruler className="h-4 w-4" />} title={t("dt_help_s4_title")}>
              {t("dt_help_tip3")}
            </HelpStep>
            <HelpStep icon={<PencilLine className="h-4 w-4" />} title={t("dt_help_s5_title")}>
              {t("dt_help_tip2")}
            </HelpStep>
            <HelpStep icon={<RotateCw className="h-4 w-4" />} title={t("dt_help_s6_title")}>
              {t("dt_help_tip4")}
            </HelpStep>
          </div>
          <Link href="/designer-guide" className="block">
            <Button type="button" className="w-full gap-2">
              <Presentation className="h-4 w-4" aria-hidden="true" />
              Open complete Designer walkthrough
            </Button>
          </Link>
        </DialogContent>
      </Dialog>
    ),
    [t]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!dismissed && (
        <div className="flex min-w-0 items-center gap-2 rounded-md border border-[#e0b56e]/40 bg-[#e0b56e]/10 px-3 py-1.5">
          <HelpCircle className="h-4 w-4 shrink-0 text-[#e0b56e]" />
          <p
            key={tipIndex}
            className="truncate text-xs text-foreground/90 animate-in fade-in duration-300"
          >
            {t(TIP_KEYS[tipIndex])}
          </p>
          <button
            type="button"
            onClick={dismiss}
            aria-label={t("dt_help_dismiss")}
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {helpButton}
    </div>
  );
}
