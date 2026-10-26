import { BODY_FONT_PRESETS, HEADING_FONT_PRESETS, WHITE_LABEL_RESET, contrastRatio, DEFAULT_BRAND_BACKGROUND, DEFAULT_BRAND_TEXT, DEFAULT_BRAND_PRIMARY } from "@shared/affiliateStorefrontControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type WhiteLabelForm = {
  logoDarkUrl: string;
  faviconUrl: string;
  backgroundColor: string;
  textColor: string;
  footerText: string;
  showPublicEmail: boolean;
  showPublicPhone: boolean;
  showPublicAddress: boolean;
  hidePlatformBranding: boolean;
  labelCatalog: string;
  labelSurfaces: string;
  labelCloset: string;
  labelDesigner: string;
  labelQuote: string;
  labelCart: string;
};

const LABEL_FIELDS: { key: keyof WhiteLabelForm; label: string }[] = [
  { key: "labelCatalog", label: "Catalog" },
  { key: "labelSurfaces", label: "Surfaces & fixtures" },
  { key: "labelCloset", label: "Closet Studio" },
  { key: "labelDesigner", label: "3D Designer" },
  { key: "labelQuote", label: "Quote" },
  { key: "labelCart", label: "Cart" },
];

export default function AffiliateWhiteLabelFields({
  form,
  set,
  primaryColor,
  onUpload,
  uploading,
  onReset,
}: {
  form: WhiteLabelForm;
  set: (key: keyof WhiteLabelForm, value: string | boolean) => void;
  primaryColor: string;
  onUpload: (kind: "logoDark" | "favicon", file: File) => void;
  uploading: boolean;
  onReset: () => void;
}) {
  const background = form.backgroundColor || DEFAULT_BRAND_BACKGROUND;
  const textContrast = contrastRatio(form.textColor || DEFAULT_BRAND_TEXT, background);
  const primaryContrast = contrastRatio(primaryColor || DEFAULT_BRAND_PRIMARY, background);
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-medium">White label</h3>
          <p className="text-sm text-muted-foreground">These choices apply on every customer-facing storefront page.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>Reset to default</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Background</Label>
          <Input value={form.backgroundColor} onChange={(event) => set("backgroundColor", event.target.value)} placeholder="#ffffff" />
        </div>
        <div>
          <Label>Text</Label>
          <Input value={form.textColor} onChange={(event) => set("textColor", event.target.value)} placeholder="#1a1a1a" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Text contrast {textContrast ? textContrast.toFixed(1) : "—"}:1 · Primary contrast {primaryContrast ? primaryContrast.toFixed(1) : "—"}:1
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Dark logo</Label>
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload("logoDark", file); }} />
        </div>
        <div>
          <Label>Favicon</Label>
          <Input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload("favicon", file); }} />
          <p className="mt-1 text-xs text-muted-foreground">512KB maximum.</p>
        </div>
      </div>
      <div>
        <Label>Footer text</Label>
        <Textarea value={form.footerText} onChange={(event) => set("footerText", event.target.value)} rows={3} />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Public contact</p>
        <p className="text-xs text-muted-foreground">Your account email and phone stay private until you turn a field on.</p>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Show public email</span><Switch checked={form.showPublicEmail} onCheckedChange={(value) => set("showPublicEmail", value)} /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Show public phone</span><Switch checked={form.showPublicPhone} onCheckedChange={(value) => set("showPublicPhone", value)} /></label>
        <label className="flex items-center justify-between gap-3 text-sm"><span>Show public address</span><Switch checked={form.showPublicAddress} onCheckedChange={(value) => set("showPublicAddress", value)} /></label>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Hide CabinetDealz branding on the storefront and designer</span>
        <Switch checked={form.hidePlatformBranding} onCheckedChange={(value) => set("hidePlatformBranding", value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {LABEL_FIELDS.map((field) => (
          <div key={field.key}>
            <Label>{field.label} label</Label>
            <Input value={String(form[field.key] ?? "")} onChange={(event) => set(field.key, event.target.value)} />
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Body fonts: {BODY_FONT_PRESETS.map((font) => font.value).join(", ")}. Heading fonts: {HEADING_FONT_PRESETS.map((font) => font.value).join(", ")}.
        Social links are added from Marketing Hub and render in the reserved footer slot.
      </p>
      <input type="hidden" value={WHITE_LABEL_RESET.buttonRadius} readOnly />
    </div>
  );
}
