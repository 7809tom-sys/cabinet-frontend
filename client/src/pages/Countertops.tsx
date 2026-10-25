import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Ruler, PencilRuler } from "lucide-react";
import { COUNTERTOP_MATERIALS, countertopMaterial } from "@/lib/design";
import { COUNTERTOP_INFO, countertopInfo } from "@shared/countertops";
import { useSeo } from "@/hooks/useSeo";
import { useLanguage } from "@/contexts/LanguageContext";

// A swatch tile rendering the real material fill/edge/speckle from design.ts so
// what shoppers see here matches the Design Tool render.
function Swatch({ id, selected, onSelect }: { id: string; selected: boolean; onSelect: () => void }) {
  const m = countertopMaterial(id);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative h-28 w-full overflow-hidden rounded-lg border-2 transition-all duration-150 active:scale-[0.98] ${
        selected ? "border-[var(--color-gold)] ring-2 ring-[var(--color-gold)]/30" : "border-border hover:border-foreground/30"
      }`}
      style={{ backgroundColor: m.fill }}
    >
      {/* front lip */}
      <span className="absolute inset-x-0 bottom-0 h-3" style={{ backgroundColor: m.edge }} />
      {/* speckle hint */}
      {m.speckle && (
        <span
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `radial-gradient(${m.speckle} 1px, transparent 1.5px)`,
            backgroundSize: "10px 10px",
          }}
        />
      )}
      {selected && (
        <CheckCircle2 className="absolute right-2 top-2 h-5 w-5 text-[var(--color-gold)] drop-shadow" />
      )}
    </button>
  );
}

export default function Countertops() {
  const { t, lang } = useLanguage();
  const [selectedId, setSelectedId] = useState<string>(COUNTERTOP_MATERIALS[0].id);
  const selectedInfo = useMemo(() => countertopInfo(selectedId), [selectedId]);

  useSeo({
    title: t("seo_countertops_t"),
    description: t("seo_countertops_d"),
    lang,
  });

  // Quote form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [zip, setZip] = useState("");
  const [material, setMaterial] = useState<string>(countertopMaterial(selectedId).name);
  const [sqft, setSqft] = useState("");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = trpc.design.requestCountertopQuote.useMutation({
    onSuccess: () => {
      setSubmitted(true);
      toast.success(t("ct_quote_sent_toast"));
    },
    onError: (e) => toast.error(e.message || t("ct_send_err")),
  });

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!emailValid) {
      toast.error(t("ct_valid_email_err"));
      return;
    }
    const sqftNum = Number(sqft);
    submit.mutate({
      contactName: name || undefined,
      contactEmail: email,
      contactPhone: phone || undefined,
      zip: zip || undefined,
      material: material || undefined,
      squareFeet: Number.isFinite(sqftNum) && sqftNum > 0 ? sqftNum : 0,
      linearFeet: 0,
      hasIsland: false,
      notes: notes || undefined,
    });
  }

  function pick(id: string) {
    setSelectedId(id);
    setMaterial(countertopMaterial(id).name);
  }

  return (
    <div className="bg-background">
      {/* Hero */}
      <section className="bg-[var(--color-navy)] text-white">
        <div className="container py-14 md:py-20">
          <p className="text-[var(--color-gold)] font-semibold tracking-wide uppercase text-sm">{t("ct_eyebrow")}</p>
          <h1 className="mt-2 font-serif text-3xl md:text-5xl font-bold max-w-3xl">
            {t("ct_hero_title")}
          </h1>
          <p className="mt-4 max-w-2xl text-white/80 text-lg">
            {t("ct_hero_sub")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90">
              <Link href="/design"><PencilRuler className="mr-2 h-4 w-4" /> {t("ct_measure_btn")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/40 text-white hover:bg-white/10">
              <a href="#quote"><Ruler className="mr-2 h-4 w-4" /> {t("ct_request_btn")}</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Material gallery */}
      <section className="container py-12 md:py-16">
        <h2 className="font-serif text-2xl md:text-3xl font-bold">{t("ct_materials_title")}</h2>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          {t("ct_materials_sub")}
        </p>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          {/* Swatch grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {COUNTERTOP_INFO.map((m) => (
              <div key={m.id} className="space-y-2">
                <Swatch id={m.id} selected={selectedId === m.id} onSelect={() => pick(m.id)} />
                <p className="text-sm font-medium">{m.name}</p>
              </div>
            ))}
          </div>

          {/* Selected material detail */}
          <Card className="self-start">
            <CardContent className="p-6">
              {selectedInfo ? (
                <>
                  <div
                    className="h-20 w-full rounded-md border border-border"
                    style={{ backgroundColor: countertopMaterial(selectedInfo.id).fill }}
                  />
                  <h3 className="mt-4 font-serif text-xl font-bold">{selectedInfo.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedInfo.blurb}</p>
                  <ul className="mt-4 space-y-2">
                    {selectedInfo.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-gold)]" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-5 w-full bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy)]/90">
                    <a href="#quote">{t("ct_get_quote_for")} {selectedInfo.name}</a>
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Quote form */}
      <section id="quote" className="border-t border-border bg-muted/30">
        <div className="container py-12 md:py-16">
          <div className="mx-auto max-w-xl">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-center">{t("ct_form_title")}</h2>
            <p className="mt-2 text-center text-muted-foreground">
              {t("ct_form_sub_a")} <Link href="/design" className="text-primary underline">{t("ct_form_sub_link")}</Link>.
            </p>

            <Card className="mt-8">
              <CardContent className="p-6">
                {submitted ? (
                  <div className="py-6 text-center space-y-3">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
                    <h3 className="font-serif text-xl font-bold">{t("ct_sent_title")}</h3>
                    <p className="text-muted-foreground">
                      {t("ct_sent_body_a")} {email} {t("ct_sent_body_b")}
                    </p>
                    <Button className="mt-2" onClick={() => setSubmitted(false)}>{t("ct_send_another")}</Button>
                  </div>
                ) : (
                  <form className="grid gap-4" onSubmit={handleSubmit}>
                    <div className="grid gap-1.5">
                      <Label htmlFor="ct-email">{t("ct_email")} *</Label>
                      <Input id="ct-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" required />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="ct-name">{t("ct_name")}</Label>
                        <Input id="ct-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ct_optional")} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="ct-phone">{t("ct_phone")}</Label>
                        <Input id="ct-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("ct_optional")} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="ct-zip">{t("ct_zip")}</Label>
                        <Input id="ct-zip" value={zip} onChange={(e) => setZip(e.target.value)} placeholder={t("ct_optional")} />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="ct-sqft">{t("ct_approx_sqft")}</Label>
                        <Input id="ct-sqft" inputMode="decimal" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="e.g. 45" />
                      </div>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="ct-material">{t("ct_material")}</Label>
                      <Select value={material} onValueChange={setMaterial}>
                        <SelectTrigger id="ct-material">
                          <SelectValue placeholder={t("ct_choose_material")} />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTERTOP_MATERIALS.map((m) => (
                            <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                          ))}
                          <SelectItem value="Not sure yet">{t("ct_not_sure")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="ct-notes">{t("ct_notes")}</Label>
                      <Textarea id="ct-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ct_notes_ph")} rows={3} />
                    </div>
                    <Button type="submit" disabled={submit.isPending} className="w-full bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold)]/90">
                      {submit.isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("ct_sending")}</>) : t("ct_request_quote")}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
