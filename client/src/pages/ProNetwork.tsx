import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Hammer, Layers, ShieldCheck, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSeo } from "@/hooks/useSeo";

const TRADES: { value: "installation" | "countertop_fabrication"; label: string; icon: typeof Hammer }[] = [
  { value: "installation", label: "Cabinet Installation", icon: Hammer },
  { value: "countertop_fabrication", label: "Countertop Fabrication", icon: Layers },
];

const MATERIALS = [
  "Quartz",
  "Granite",
  "Marble",
  "Quartzite",
  "Laminate",
  "Butcher Block",
  "Solid Surface",
];

export default function ProNetwork() {
  const { t, lang } = useLanguage();
  useSeo({ title: t("seo_pro_t"), description: t("seo_pro_d"), lang });
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    baseZip: "",
    serviceZips: "",
    serviceRadiusMiles: "50",
    licenseNumber: "",
    yearsInBusiness: "",
    leadTimeDays: "",
    notes: "",
    insured: false,
  });
  const [trades, setTrades] = useState<("installation" | "countertop_fabrication")[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);

  const apply = trpc.pros.submitApplication.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application received — we'll be in touch.");
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const toggleTrade = (t: "installation" | "countertop_fabrication") =>
    setTrades((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const toggleMaterial = (m: string) =>
    setMaterials((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      toast.error("Company, contact name, and email are required.");
      return;
    }
    if (trades.length === 0) {
      toast.error("Select at least one trade.");
      return;
    }
    apply.mutate({
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone || undefined,
      website: form.website || undefined,
      trades,
      materials: materials.length ? materials : undefined,
      serviceZips: form.serviceZips
        ? form.serviceZips.split(/[\s,]+/).map((z) => z.trim()).filter(Boolean)
        : undefined,
      baseZip: form.baseZip || undefined,
      serviceRadiusMiles: form.serviceRadiusMiles ? Number(form.serviceRadiusMiles) : undefined,
      licenseNumber: form.licenseNumber || undefined,
      insured: form.insured,
      yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      notes: form.notes || undefined,
    });
  };

  if (submitted) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--color-gold)]" />
        <h1 className="font-serif text-3xl font-bold mt-6 mb-3">Application Received</h1>
        <p className="text-muted-foreground mb-8">
          Thanks for applying to the CabinetDealz Pro Network. Our team will review your
          credentials and reach out to confirm your service area and onboarding details.
        </p>
        <Button asChild variant="outline">
          <a href="/">Back to Home</a>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <section className="bg-[var(--color-navy)] text-white">
        <div className="container py-16 md:py-20">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1.5 text-sm font-medium">
              <span className="h-2 w-2 rounded-full bg-[var(--color-gold)]" />
              For Installers & Countertop Fabricators
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mt-6 leading-tight">
              Join Our <span className="text-[var(--color-gold)]">Pro Network</span>
            </h1>
            <p className="text-white/80 text-lg mt-4">
              Get matched with cabinet and countertop jobs from members across our supply
              network. We send you qualified leads in your service area — you do the work.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: MapPin, title: "Local Leads", desc: "Jobs routed by your service area" },
                { icon: ShieldCheck, title: "Vetted Members", desc: "Real projects, real budgets" },
                { icon: Layers, title: "Two Trades", desc: "Install or fabricate — or both" },
              ].map((b) => (
                <div key={b.title} className="rounded-lg bg-white/5 border border-white/10 p-4">
                  <b.icon className="h-5 w-5 text-[var(--color-gold)]" />
                  <div className="font-semibold mt-2">{b.title}</div>
                  <div className="text-sm text-white/60">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="container max-w-3xl py-12">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-2xl">Pro Application</CardTitle>
            <p className="text-sm text-muted-foreground">
              Fields marked with an asterisk are required.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <Input
                    id="companyName"
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name *</Label>
                  <Input
                    id="contactName"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    placeholder="https://"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                  />
                </div>
              </div>

              {/* Trades */}
              <div className="space-y-2">
                <Label>Trades Offered *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TRADES.map((t) => {
                    const active = trades.includes(t.value);
                    return (
                      <button
                        type="button"
                        key={t.value}
                        onClick={() => toggleTrade(t.value)}
                        className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-primary bg-primary/10"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        <t.icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-medium text-sm">{t.label}</span>
                        {active && <CheckCircle2 className="h-4 w-4 text-primary ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Materials (only relevant if fabrication) */}
              {trades.includes("countertop_fabrication") && (
                <div className="space-y-2">
                  <Label>Countertop Materials</Label>
                  <div className="flex flex-wrap gap-2">
                    {MATERIALS.map((m) => {
                      const active = materials.includes(m);
                      return (
                        <button
                          type="button"
                          key={m}
                          onClick={() => toggleMaterial(m)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Service area */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="baseZip">Base ZIP</Label>
                  <Input
                    id="baseZip"
                    value={form.baseZip}
                    onChange={(e) => setForm({ ...form, baseZip: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="serviceRadiusMiles">Service Radius (mi)</Label>
                  <Input
                    id="serviceRadiusMiles"
                    type="number"
                    value={form.serviceRadiusMiles}
                    onChange={(e) => setForm({ ...form, serviceRadiusMiles: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="leadTimeDays">Typical Lead Time (days)</Label>
                  <Input
                    id="leadTimeDays"
                    type="number"
                    value={form.leadTimeDays}
                    onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceZips">Specific Service ZIPs (optional)</Label>
                <Input
                  id="serviceZips"
                  placeholder="Comma or space separated, e.g. 30301, 30302, 30303"
                  value={form.serviceZips}
                  onChange={(e) => setForm({ ...form, serviceZips: e.target.value })}
                />
              </div>

              {/* Credentials */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="licenseNumber">License Number</Label>
                  <Input
                    id="licenseNumber"
                    value={form.licenseNumber}
                    onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="yearsInBusiness">Years in Business</Label>
                  <Input
                    id="yearsInBusiness"
                    type="number"
                    value={form.yearsInBusiness}
                    onChange={(e) => setForm({ ...form, yearsInBusiness: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="insured"
                  checked={form.insured}
                  onCheckedChange={(c) => setForm({ ...form, insured: Boolean(c) })}
                />
                <Label htmlFor="insured" className="cursor-pointer font-normal">
                  My business carries liability insurance
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Anything else we should know?</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <Button
                type="submit"
                disabled={apply.isPending}
                className="w-full bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90"
                size="lg"
              >
                {apply.isPending ? "Submitting…" : "Submit Application"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
