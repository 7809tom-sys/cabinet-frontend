import { useMemo, useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Eye,
  Globe,
  Loader2,
  Play,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import {
  EMBED_CODE_MAX_LENGTH,
  validateEmbedCode,
  embedCodeHasErrors,
  embedCodeHosts,
} from "@shared/embedCode";

type Props = {
  affiliateId?: number;
  isAdmin?: boolean;
  embedCodeDraft?: string | null;
  embedEnabled?: boolean;
  storeName?: string | null;
  onSaved?: () => void;
};

/**
 * Editor + sandboxed preview for a third-party widget snippet.
 *
 * Safety model: the draft is rendered inside an iframe with a `sandbox`
 * attribute, using `srcdoc` so the markup never touches the dashboard's own
 * DOM. `allow-scripts` is required (widgets are scripts) but we deliberately
 * omit `allow-same-origin`, so the framed document is treated as a unique
 * opaque origin: it cannot read our cookies, localStorage, or session, and it
 * cannot reach into the parent page. Publishing is a separate action, so a
 * snippet that misbehaves in preview never reaches customers.
 */
export function AffiliateEmbedEditor({
  affiliateId,
  isAdmin,
  embedCodeDraft,
  embedEnabled,
  storeName,
  onSaved,
}: Props) {
  const [code, setCode] = useState(embedCodeDraft ?? "");
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const syncRef = useRef<string | null>(null);

  // Re-sync when the server value changes (e.g. after save or switching store),
  // without clobbering in-progress typing.
  const serverValue = embedCodeDraft ?? "";
  useEffect(() => {
    if (syncRef.current !== serverValue) {
      syncRef.current = serverValue;
      setCode(serverValue);
    }
  }, [serverValue]);

  const issues = useMemo(() => validateEmbedCode(code), [code]);
  const hasErrors = useMemo(() => embedCodeHasErrors(code), [code]);
  const hosts = useMemo(() => embedCodeHosts(code), [code]);
  const trimmed = code.trim();

  const utils = trpc.useUtils();
  const save = trpc.affiliates.updateMyStorefront.useMutation({
    onSuccess: () => {
      toast.success("Draft saved", {
        description: "Your customers still see the previously published version.",
      });
      utils.affiliates.invalidate();
      onSaved?.();
    },
    onError: (e) => toast.error("Could not save draft", { description: e.message }),
  });
  const publish = trpc.affiliates.publishEmbedCode.useMutation({
    onSuccess: () => {
      toast.success("Widget published", { description: "It is now live on your storefront." });
      utils.affiliates.invalidate();
      onSaved?.();
    },
    onError: (e) => toast.error("Could not publish", { description: e.message }),
  });
  const unpublish = trpc.affiliates.unpublishEmbedCode.useMutation({
    onSuccess: () => {
      toast.success("Widget removed from your storefront", {
        description: "Your draft is still saved here.",
      });
      utils.affiliates.invalidate();
      onSaved?.();
    },
    onError: (e) => toast.error("Could not unpublish", { description: e.message }),
  });

  const idArg = isAdmin && affiliateId ? { affiliateId } : {};

  const runPreview = () => {
    if (!trimmed) {
      toast.error("Paste a snippet first.");
      return;
    }
    if (hasErrors) {
      toast.error("Fix the errors before previewing.");
      return;
    }
    setPreviewCode(trimmed);
    setPreviewKey((k) => k + 1);
  };

  // Build the sandboxed document. A neutral light page so the widget is visible.
  const srcDoc = useMemo(() => {
    if (!previewCode) return "";
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;background:#fff;color:#111;}
  .cd-note{font-size:12px;color:#666;border-bottom:1px solid #eee;padding-bottom:8px;margin-bottom:12px;}
</style>
</head><body>
<div class="cd-note">Sandboxed preview${storeName ? ` — ${storeName}` : ""}. Widgets that require a verified domain may not fully load here.</div>
${previewCode}
</body></html>`;
  }, [previewCode, storeName]);

  const isPublished = Boolean(embedEnabled);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" /> Custom widget code
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Paste the embed snippet from any provider above, test it in the sandboxed preview, then
          publish it when it looks right. Saving a draft never changes your live storefront.
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium ${
            isPublished
              ? "bg-green-500/10 text-green-700 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {isPublished ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
          {isPublished ? "Live on your storefront" : "Not published"}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="embedCode">Embed snippet</Label>
          <span
            className={`text-xs ${
              code.length > EMBED_CODE_MAX_LENGTH ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {code.length.toLocaleString()} / {EMBED_CODE_MAX_LENGTH.toLocaleString()}
          </span>
        </div>
        <Textarea
          id="embedCode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={'<script src="https://static.elfsight.com/platform/platform.js" async></script>\n<div class="elfsight-app-xxxx"></div>'}
          className="font-mono text-xs min-h-[160px]"
          spellCheck={false}
        />
      </div>

      {/* Validation feedback */}
      {issues.length > 0 && (
        <div className="space-y-1.5">
          {issues.map((iss, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 text-xs rounded-md px-3 py-2 ${
                iss.severity === "error"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{iss.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Which third parties this snippet contacts */}
      {hosts.length > 0 && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
            <Globe className="h-3.5 w-3.5" /> This snippet loads code from:
          </div>
          <div className="flex flex-wrap gap-1">
            {hosts.map((h) => (
              <span key={h} className="rounded bg-background px-1.5 py-0.5 font-mono">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={runPreview} disabled={!trimmed || hasErrors}>
          <Play className="h-4 w-4 mr-1.5" /> Test in preview
        </Button>
        <Button
          type="button"
          variant="outline"
          className="bg-background"
          onClick={() => save.mutate({ ...idArg, embedCodeDraft: code })}
          disabled={save.isPending}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save draft
        </Button>
        <Button
          type="button"
          onClick={() => publish.mutate(idArg)}
          disabled={publish.isPending || hasErrors || !trimmed}
          title={hasErrors ? "Fix validation errors first" : undefined}
        >
          {publish.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
          )}
          Publish to storefront
        </Button>
        {isPublished && (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => unpublish.mutate(idArg)}
            disabled={unpublish.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1.5" /> Remove from storefront
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Publish uses your last <span className="font-medium">saved</span> draft, so save before
        publishing if you have just edited the code.
      </p>

      {/* Sandboxed preview */}
      {previewCode && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" /> Sandboxed preview
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewKey((k) => k + 1)}>
              Reload
            </Button>
          </div>
          <iframe
            key={previewKey}
            title="Widget preview"
            srcDoc={srcDoc}
            // allow-scripts is required for widgets to run. allow-same-origin is
            // deliberately omitted so the frame gets an opaque origin and cannot
            // read this dashboard's cookies, storage, or DOM.
            sandbox="allow-scripts allow-popups allow-forms"
            referrerPolicy="no-referrer"
            className="w-full h-[360px] rounded-lg border border-border bg-white"
          />
          <p className="text-xs text-muted-foreground">
            This preview is isolated from your dashboard for security. Some providers only serve
            widgets on an approved domain, so if nothing appears here, publish it and check your
            storefront.
          </p>
        </div>
      )}
    </div>
  );
}
