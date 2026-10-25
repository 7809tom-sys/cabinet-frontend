import { useEffect, useState } from "react";
import { Ruler, Mail, User, Phone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export interface LeadContact {
  email: string;
  name?: string;
  phone?: string;
}

interface Props {
  // Called once a valid email is provided (with optional name + phone).
  onVerified: (contact: LeadContact) => void;
  brandName?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
}

// Lightweight contact gate before entering the design tool.
// Email is required (it gates entry). Name + phone are optional so we keep the
// gate low-friction, but capturing them gives reps real contact info to follow
// up on. If the user is already logged in, we skip straight through.
export function EmailGate({ onVerified, brandName, primaryColor, accentColor }: Props) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  // Logged-in users bypass the gate. Run as an effect (never during render)
  // to avoid "setState during render" warnings in the parent.
  useEffect(() => {
    if (user?.email) {
      onVerified({ email: user.email, name: user.name ?? undefined });
    }
  }, [user?.email, user?.name, onVerified]);

  // While we have a logged-in user, render nothing (the effect will verify).
  if (user?.email) {
    return null;
  }

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const primary = primaryColor || "#1a2744";
  const accent = accentColor || "#d4a75a";
  const subtitle = brandName
    ? "We'll use your email to save this design and materials list."
    : t("dt_gate_sub");

  const submit = () => {
    if (!valid) return;
    onVerified({
      email: email.trim(),
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-10" style={{ backgroundColor: primary }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex items-center justify-center h-14 w-14 rounded-xl mx-auto mb-5" style={{ backgroundColor: primary }}>
          <Ruler className="h-7 w-7" style={{ color: accent }} />
        </div>
        <h1 className="font-serif text-2xl font-bold text-center mb-2" style={{ color: primary }}>
          {t("dt_gate_title")}
        </h1>
        <p className="text-center text-sm text-muted-foreground mb-6">
          {subtitle}
        </p>

        <div className="space-y-4">
          <label className="block space-y-1.5 text-sm font-semibold" style={{ color: primary }}>
            Email address <span className="font-normal text-muted-foreground">(required)</span>
            <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="email"
              autoComplete="email"
              placeholder={t("dt_gate_email_ph")}
              className="pl-9"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            />
            </div>
          </label>

          <div className="border-t border-border pt-4">
            <p className="text-xs font-semibold text-foreground">Optional design help</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Add these details if you’d like a designer to help with your plan. They are not required to open the Designer.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Name (optional)
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    autoComplete="name"
                    placeholder={t("dt_gate_name_ph")}
                    className="pl-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                </div>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Phone (optional)
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="tel"
                    autoComplete="tel"
                    placeholder={t("dt_gate_phone_ph")}
                    className="pl-9"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  />
                </div>
              </label>
            </div>
          </div>

          {touched && !valid && (
            <p className="text-xs text-destructive">{t("dt_gate_invalid_email")}</p>
          )}
          <Button
            className="w-full text-white gap-2"
            style={{ backgroundColor: primary }}
            disabled={!valid}
            onClick={submit}
          >
            {t("dt_gate_launch")} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center mt-5">
          We’ll use this to save your design and materials list.
        </p>
      </div>
    </div>
  );
}
