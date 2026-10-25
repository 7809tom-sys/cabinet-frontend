import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  CheckCircle2,
  Store,
  TrendingUp,
  Rocket,
  Handshake,
  PackageCheck,
  Image as ImageIcon,
  Tag,
} from "lucide-react";
import { useSeo } from "@/hooks/useSeo";

// The whole home-remodel experience — not just cabinets. Vendors can supply
// any of these categories.
const VENDOR_CATEGORIES = [
  "Cabinets",
  "Cabinet Hardware",
  "Countertops",
  "Appliances",
  "Flooring",
  "Tile & Backsplash",
  "Lighting",
  "Plumbing & Fixtures",
  "Doors & Trim",
  "Decor & Accessories",
  "Other",
] as const;

export default function BecomeVendor() {
  useSeo({
    title: "Become a Vendor Partner",
    description:
      "Partner with Cabinet Dealz to put your products in front of trade buyers inside our online design and ordering platform — cabinets, hardware, countertops, appliances, flooring, lighting, and everything for the kitchen and home remodel. Apply to become a founding vendor.",
  });

  const [submitted, setSubmitted] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    headquarters: "",
    productLines: "",
    doorStyleCount: "",
    leadTimeDays: "",
    message: "",
    hasCatalogImages: false,
    offersTradePricing: false,
  });

  const toggleCategory = (cat: string) =>
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );

  const apply = trpc.vendor.submitApplication.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success("Application received — we'll be in touch.");
    },
    onError: (err) => {
      toast.error(err.message || "Something went wrong. Please try again.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.companyName || !form.contactName || !form.email) {
      toast.error("Company, contact name, and email are required.");
      return;
    }
    if (categories.length === 0) {
      toast.error("Please pick at least one product category you supply.");
      return;
    }
    apply.mutate({
      companyName: form.companyName,
      contactName: form.contactName,
      email: form.email,
      phone: form.phone || undefined,
      website: form.website || undefined,
      headquarters: form.headquarters || undefined,
      categories,
      productLines: form.productLines || undefined,
      doorStyleCount: form.doorStyleCount ? Number(form.doorStyleCount) : undefined,
      leadTimeDays: form.leadTimeDays ? Number(form.leadTimeDays) : undefined,
      message: form.message || undefined,
      hasCatalogImages: form.hasCatalogImages,
      offersTradePricing: form.offersTradePricing,
    });
  };

  if (submitted) {
    return (
      <div className="container max-w-2xl py-20 text-center">
        <CheckCircle2 className="mx-auto h-16 w-16 text-[var(--color-gold)]" />
        <h1 className="font-serif text-3xl font-bold mt-6 mb-3">Application Received</h1>
        <p className="text-muted-foreground mb-8">
          Thanks for your interest in partnering with Cabinet Dealz. Our team will review your
          company and product categories and reach out to discuss onboarding and next steps.
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
              For Manufacturers, Suppliers & Brands
            </span>
            <h1 className="font-serif text-4xl md:text-5xl font-bold mt-6 leading-tight">
              Become a <span className="text-[var(--color-gold)]">Vendor Partner</span>
            </h1>
            <p className="text-white/80 text-lg mt-4">
              Cabinet Dealz isn't just cabinets — we're building the place where trade buyers design
              and order the whole kitchen and home remodel: cabinets, hardware, countertops,
              appliances, flooring, lighting and more. We're inviting a select group of founding
              vendors to grow with us.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Store, title: "Built-in Storefront", desc: "Your products inside our platform" },
                { icon: TrendingUp, title: "Buyers at Decision", desc: "Reach buyers as they spec" },
                { icon: Rocket, title: "Founding Vendor", desc: "Get in early as we grow" },
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

      {/* Categories we partner across */}
      <section className="container max-w-5xl pt-14">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl font-bold">Every part of the remodel</h2>
          <p className="text-muted-foreground mt-3">
            If it goes into a kitchen, bath, or home remodel, there's a place for it on the
            platform. We partner with vendors across all of these categories.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-8">
          {VENDOR_CATEGORIES.map((c) => (
            <span
              key={c}
              className="rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-foreground"
            >
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* Why partner */}
      <section className="container max-w-5xl py-14">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="font-serif text-3xl font-bold">Why partner with Cabinet Dealz</h2>
          <p className="text-muted-foreground mt-3">
            We handle the platform, the design experience, and buyer acquisition. You bring great
            products. Here's what partnering looks like.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
          {[
            {
              icon: Handshake,
              title: "A real growth partnership",
              desc: "We're early and moving fast. Founding vendors help shape the catalog and get priority placement as our buyer base grows.",
            },
            {
              icon: PackageCheck,
              title: "Orders, not just listings",
              desc: "Buyers design a project and submit an order in one place — your products are part of a working buying flow, not a static directory.",
            },
            {
              icon: ImageIcon,
              title: "We make your products shine",
              desc: "We optimize your product imagery so it loads fast and looks great on every device, including phones.",
            },
            {
              icon: Tag,
              title: "Trade-friendly pricing tools",
              desc: "Instant pricing and trade-focused workflows help your products get specified by pros and dealers without back-and-forth quoting.",
            },
          ].map((c) => (
            <Card key={c.title}>
              <CardContent className="p-6 flex gap-4">
                <div className="shrink-0 rounded-lg bg-[var(--color-navy)]/5 p-3 h-fit">
                  <c.icon className="h-6 w-6 text-[var(--color-navy)]" />
                </div>
                <div>
                  <div className="font-semibold">{c.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{c.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-8 max-w-2xl mx-auto">
          Cabinet Dealz is a growth-stage platform. We don't claim specific sales or membership
          numbers yet — the opportunity here is getting in early as a founding vendor.
        </p>
      </section>

      {/* Form */}
      <section className="bg-muted/40 border-t">
        <div className="container max-w-3xl py-12">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-2xl">Vendor Application</CardTitle>
              <p className="text-sm text-muted-foreground">
                Tell us about your company. Fields marked with an asterisk are required.
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
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      id="website"
                      placeholder="https://"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="headquarters">Headquarters / Ships From</Label>
                    <Input
                      id="headquarters"
                      placeholder="City, State"
                      value={form.headquarters}
                      onChange={(e) => setForm({ ...form, headquarters: e.target.value })}
                    />
                  </div>
                </div>

                {/* Category multi-select */}
                <div className="space-y-2">
                  <Label>What do you supply? * (select all that apply)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {VENDOR_CATEGORIES.map((cat) => {
                      const checked = categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          aria-pressed={checked}
                          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                            checked
                              ? "border-[var(--color-navy)] bg-[var(--color-navy)]/5 font-medium"
                              : "bg-card hover:bg-accent"
                          }`}
                        >
                          <Checkbox checked={checked} className="pointer-events-none" />
                          <span>{cat}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="productLines">Product Lines / Notable Brands</Label>
                  <Input
                    id="productLines"
                    placeholder="e.g. Shaker cabinets, quartz tops, LVP flooring"
                    value={form.productLines}
                    onChange={(e) => setForm({ ...form, productLines: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="doorStyleCount"># of SKUs / Styles (approx)</Label>
                    <Input
                      id="doorStyleCount"
                      type="number"
                      value={form.doorStyleCount}
                      onChange={(e) => setForm({ ...form, doorStyleCount: e.target.value })}
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

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="hasCatalogImages"
                      checked={form.hasCatalogImages}
                      onCheckedChange={(c) => setForm({ ...form, hasCatalogImages: Boolean(c) })}
                    />
                    <Label htmlFor="hasCatalogImages" className="cursor-pointer font-normal">
                      We can provide product images & specs
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="offersTradePricing"
                      checked={form.offersTradePricing}
                      onCheckedChange={(c) => setForm({ ...form, offersTradePricing: Boolean(c) })}
                    />
                    <Label htmlFor="offersTradePricing" className="cursor-pointer font-normal">
                      We offer trade / dealer pricing
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Anything else we should know?</Label>
                  <Textarea
                    id="message"
                    rows={3}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
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
        </div>
      </section>
    </div>
  );
}
