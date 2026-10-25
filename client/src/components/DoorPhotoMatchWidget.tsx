import { useRef, useState } from "react";
import { Link } from "wouter";
import { Camera, Loader2, Sparkles, ArrowRight, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import { fileToDataUrl } from "@/components/admin/DoorPhotoCorrectButton";

interface RankedMatch {
  id: number;
  styleCode: string;
  ourName: string | null;
  doorStyle: string | null;
  color: string | null;
  finish: string | null;
  doorSampleImageUrl: string | null;
  thumbnailImageUrl: string | null;
  roomSceneImageUrl: string | null;
  confidence: number;
  reasoning: string;
}

function matchThumb(m: RankedMatch): string | null {
  return m.doorSampleImageUrl || m.thumbnailImageUrl || m.roomSceneImageUrl || null;
}

export default function DoorPhotoMatchWidget() {
  const { t } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [matches, setMatches] = useState<RankedMatch[] | null>(null);

  const match = trpc.doorStyles.matchFromPhoto.useMutation({
    onSuccess: (res) => {
      const ranked = (res.matches ?? []) as RankedMatch[];
      setMatches(ranked);
      if (ranked.length === 0) {
        toast.message(t("dpm_none_toast_title"), {
          description: t("dpm_none_toast_desc"),
        });
      }
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setBusy(false),
  });

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("dpm_choose_image_err"));
      return;
    }
    setBusy(true);
    setMatches(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreview(dataUrl);
      match.mutate({ imageDataUrl: dataUrl, filename: file.name });
    } catch (err) {
      setBusy(false);
      toast.error(err instanceof Error ? err.message : t("dpm_process_err"));
    }
  }

  function reset() {
    setPreview(null);
    setMatches(null);
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/5 to-card p-5">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-serif text-lg font-bold text-foreground">{t("dpm_title")}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {t("dpm_sub")}
            </p>
          </div>
        </div>
        <Button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          <span className="ml-2">{matches ? t("dpm_try_another") : t("dpm_upload")}</span>
        </Button>
      </div>

      {(preview || matches) && (
        <div className="mt-5 border-t border-border pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {busy ? t("dpm_comparing") : t("dpm_closest")}
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={reset}>
              <X className="h-3.5 w-3.5 mr-1" /> {t("dpm_clear")}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            {preview && (
              <div className="hidden sm:block">
                <p className="text-[11px] text-muted-foreground mb-1.5">{t("dpm_your_photo")}</p>
                <img
                  src={preview}
                  alt="Your uploaded door"
                  className="h-28 w-28 rounded-lg object-cover ring-1 ring-border"
                />
              </div>
            )}

            <div>
              {busy ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                  <Loader2 className="h-4 w-4 animate-spin" /> {t("dpm_analyzing")}
                </div>
              ) : matches && matches.length > 0 ? (
                <ul className="space-y-2.5">
                  {matches.map((m, i) => (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
                    >
                      {matchThumb(m) ? (
                        <img
                          src={matchThumb(m)!}
                          alt={m.ourName ?? m.styleCode}
                          className="h-14 w-14 rounded object-cover ring-1 ring-border shrink-0"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded bg-muted shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{m.ourName || m.styleCode}</p>
                          {i === 0 && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {t("dpm_best")}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {[m.doorStyle, m.color].filter(Boolean).join(" · ")}
                          {" · "}
                          <span className="text-foreground/70">{Math.round(m.confidence * 100)}% {t("dpm_match_pct")}</span>
                        </p>
                      </div>
                      <Link href={`/family/${m.styleCode}`}>
                        <Button size="sm" variant="outline" className="h-8 shrink-0">
                          {t("dpm_shop")} <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground py-6">
                  {t("dpm_none")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
