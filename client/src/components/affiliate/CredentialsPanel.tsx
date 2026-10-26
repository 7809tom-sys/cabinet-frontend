import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { affiliateDesignerPath } from "@/lib/affiliateStorefrontUrl";
import { AFFILIATE_STOREFRONT_TEMPLATES } from "@shared/affiliateStorefrontTemplates";
import { Copy, ExternalLink, Globe, Palette, PencilRuler, Send, Shield, Store, TrendingUp } from "lucide-react";

// ─── Credentials Panel ─────────────────────────────────────────────────────────
type CredentialsPanelProps = {
  affiliate: {
    storeName: string;
    slug: string;
    referralCode: string;
    template?: string | null;
    email?: string | null;
    contactName?: string | null;
  };
  storeUrl: string;
  refLink: string;
  onCopy: (text: string, label: string) => void;
};

export function CredentialsPanel({ affiliate, storeUrl, refLink, onCopy }: CredentialsPanelProps) {
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/affiliate` : "/affiliate";
  const templateName = affiliate.template
    ? affiliate.template.charAt(0).toUpperCase() + affiliate.template.slice(1)
    : "Classic";
  const previewUrl = `/store-preview/${affiliate.template ?? "classic"}`;

  return (
    <div className="space-y-6">
      {/* Access credentials */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" /> Your Access Credentials
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Affiliate Portal Login</Label>
            <div className="flex gap-2">
              <Input readOnly value={loginUrl} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(loginUrl, "Login URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Sign in with your CabinetDealz account to access this dashboard.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Referral Code</Label>
            <div className="flex gap-2">
              <Input readOnly value={affiliate.referralCode} className="font-mono text-sm font-bold tracking-widest" />
              <Button variant="outline" size="icon" onClick={() => onCopy(affiliate.referralCode, "Referral code")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Embed this code in any link to tag orders to your account.</p>
          </div>
        </div>
      </div>

      {/* Storefront links */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" /> Your Storefront Links
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Branded Storefront URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={storeUrl} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(storeUrl, "Storefront URL")}>
                <Copy className="h-4 w-4" />
              </Button>
              <a href={storeUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" size="icon"><ExternalLink className="h-4 w-4" /></Button>
              </a>
            </div>
            <p className="text-xs text-muted-foreground">Share this link with customers — it's your fully branded cabinet store.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quick Referral Link (tags any order)</Label>
            <div className="flex gap-2">
              <Input readOnly value={refLink} className="font-mono text-sm" />
              <Button variant="outline" size="icon" onClick={() => onCopy(refLink, "Referral link")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Use this on social media or email — any order placed through it earns you commission.</p>
          </div>
        </div>
      </div>

      {/* Template */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Storefront Template
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Current:</span>
            <span className="font-semibold text-sm">{templateName}</span>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Preview
              </Button>
            </a>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          To change your template, go to the <strong>Customize</strong> tab. You can preview all eight templates before choosing.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {AFFILIATE_STOREFRONT_TEMPLATES.map(({ id: t, name }) => (
            <a key={t} href={`/store-preview/${t}`} target="_blank" rel="noreferrer"
              className={`rounded-lg border p-3 text-center text-sm hover:border-primary transition-colors cursor-pointer ${
                (affiliate.template ?? "classic") === t ? "border-primary bg-primary/5 font-semibold" : "border-border"
              }`}>
              {name}
              {(affiliate.template ?? "classic") === t && (
                <span className="ml-1 text-xs text-primary">(active)</span>
              )}
            </a>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <a href={storeUrl} target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2">
              <Store className="h-4 w-4" /> View My Storefront
            </Button>
          </a>
          <a href={affiliateDesignerPath(affiliate.slug)}>
            <Button variant="outline" className="gap-2">
              <PencilRuler className="h-4 w-4" /> Open 3D Designer
            </Button>
          </a>
          <Button variant="outline" className="gap-2" onClick={() => {
            const text = `Your affiliate credentials:\n\nStorefront: ${storeUrl}\nReferral link: ${refLink}\nReferral code: ${affiliate.referralCode}\nLogin: ${loginUrl}`;
            onCopy(text, "All credentials");
          }}>
            <Copy className="h-4 w-4" /> Copy All Credentials
          </Button>
          <a href="/manus-storage/Cabinet-Dealz-Affiliate-Welcome-Guide_f17152cc.pdf" target="_blank" rel="noreferrer">
            <Button variant="outline" className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
              <Send className="h-4 w-4" /> Download Welcome Guide
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}

