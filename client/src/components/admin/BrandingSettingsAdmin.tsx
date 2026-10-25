import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Palette, ShieldCheck, Globe } from "lucide-react";

interface Form {
  siteName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
}

const DEFAULT: Form = {
  siteName: "Cabinet Dealz",
  logoUrl: "",
  faviconUrl: "",
  primaryColor: "#1a2b4a",
  accentColor: "#c9a227",
  tagline: "",
  supportEmail: "",
  supportPhone: "",
};

export default function BrandingSettingsAdmin() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.emailSettings.getBrandingSettings.useQuery();
  const [form, setForm] = useState<Form>(DEFAULT);

  useEffect(() => {
    if (data) {
      setForm({
        siteName: data.siteName ?? "Cabinet Dealz",
        logoUrl: data.logoUrl ?? "",
        faviconUrl: data.faviconUrl ?? "",
        primaryColor: data.primaryColor ?? "#1a2b4a",
        accentColor: data.accentColor ?? "#c9a227",
        tagline: data.tagline ?? "",
        supportEmail: data.supportEmail ?? "",
        supportPhone: data.supportPhone ?? "",
      });
    }
  }, [data]);

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const save = trpc.emailSettings.saveBrandingSettings.useMutation({
    onSuccess: () => {
      toast.success("Branding settings saved");
      utils.emailSettings.getBrandingSettings.invalidate();
    },
    onError: (e) => toast.error("Could not save", { description: e.message }),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Identity */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Site Identity</CardTitle>
          </div>
          <CardDescription>
            Core brand identity shown across the site, affiliate storefronts, and emails.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Site Name</Label>
              <Input
                value={form.siteName}
                onChange={(e) => set({ siteName: e.target.value })}
                placeholder="Cabinet Dealz"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tagline</Label>
              <Input
                value={form.tagline}
                onChange={(e) => set({ tagline: e.target.value })}
                placeholder="The Trade Platform for Cabinet Professionals"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Support Email</Label>
              <Input
                type="email"
                value={form.supportEmail}
                onChange={(e) => set({ supportEmail: e.target.value })}
                placeholder="info@cabinetdealz.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Support Phone</Label>
              <Input
                value={form.supportPhone}
                onChange={(e) => set({ supportPhone: e.target.value })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo & Favicon */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Logo & Favicon</CardTitle>
          </div>
          <CardDescription>
            Paste a public URL for your logo and favicon. Upload images via the file storage tool first,
            then paste the returned URL here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Logo URL</Label>
              <Input
                value={form.logoUrl}
                onChange={(e) => set({ logoUrl: e.target.value })}
                placeholder="https://..."
              />
              {form.logoUrl && (
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="mt-2 h-12 object-contain rounded border p-1 bg-white"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Favicon URL</Label>
              <Input
                value={form.faviconUrl}
                onChange={(e) => set({ faviconUrl: e.target.value })}
                placeholder="https://..."
              />
              {form.faviconUrl && (
                <img
                  src={form.faviconUrl}
                  alt="Favicon preview"
                  className="mt-2 h-8 w-8 object-contain rounded border p-1 bg-white"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Colors */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Brand Colors</CardTitle>
          </div>
          <CardDescription>
            Primary and accent colors used across the platform. Changes take effect after the next
            deployment or page refresh.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => set({ primaryColor: e.target.value })}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => set({ primaryColor: e.target.value })}
                  placeholder="#1a2b4a"
                  className="font-mono"
                />
              </div>
              <div
                className="h-10 rounded-md border"
                style={{ backgroundColor: form.primaryColor }}
              />
            </div>
            <div className="space-y-2">
              <Label>Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => set({ accentColor: e.target.value })}
                  className="h-10 w-14 rounded border cursor-pointer"
                />
                <Input
                  value={form.accentColor}
                  onChange={(e) => set({ accentColor: e.target.value })}
                  placeholder="#c9a227"
                  className="font-mono"
                />
              </div>
              <div
                className="h-10 rounded-md border"
                style={{ backgroundColor: form.accentColor }}
              />
            </div>
          </div>

          {/* Preview swatch */}
          <div
            className="rounded-lg p-4 flex items-center justify-between"
            style={{ backgroundColor: form.primaryColor }}
          >
            <span className="text-white font-semibold text-sm">{form.siteName || "Cabinet Dealz"}</span>
            <button
              className="px-4 py-1.5 rounded text-sm font-medium"
              style={{ backgroundColor: form.accentColor, color: form.primaryColor }}
            >
              Shop Now
            </button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
          {save.isPending ? <Spinner className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
          Save Branding
        </Button>
      </div>
    </div>
  );
}
