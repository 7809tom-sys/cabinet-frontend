import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EditableText } from "@/components/admin/EditableText";

export default function Contact() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-3">
          <EditableText pageKey="contact" field="title" defaultValue="Contact Us">
            {(v) => <>{v}</>}
          </EditableText>
        </h1>
        <p className="text-muted-foreground text-lg">
          <EditableText pageKey="contact" field="subtitle" defaultValue="We're here to help with cabinet orders, design questions, affiliate inquiries, and vendor partnerships." multiline>
            {(v) => <>{v}</>}
          </EditableText>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold)]/10 shrink-0">
                <Phone className="h-5 w-5 text-[var(--color-gold)]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Phone</h3>
                <a href="tel:+19418993288" className="text-[var(--color-gold)] hover:underline text-lg font-medium">
                  <EditableText pageKey="contact" field="phone" defaultValue="(941) 899-3288">
                    {(v) => <>{v}</>}
                  </EditableText>
                </a>
                <p className="text-sm text-muted-foreground mt-1">
                  <EditableText pageKey="contact" field="phone_note" defaultValue="Call or text during business hours">
                    {(v) => <>{v}</>}
                  </EditableText>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold)]/10 shrink-0">
                <Mail className="h-5 w-5 text-[var(--color-gold)]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Email</h3>
                <a href="mailto:sales@cabinetdealz.com" className="text-[var(--color-gold)] hover:underline text-lg font-medium">
                  <EditableText pageKey="contact" field="email" defaultValue="sales@cabinetdealz.com">
                    {(v) => <>{v}</>}
                  </EditableText>
                </a>
                <p className="text-sm text-muted-foreground mt-1">
                  <EditableText pageKey="contact" field="email_note" defaultValue="We respond within 1 business day">
                    {(v) => <>{v}</>}
                  </EditableText>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold)]/10 shrink-0">
                <MapPin className="h-5 w-5 text-[var(--color-gold)]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Address</h3>
                <p className="text-foreground font-medium">
                  <EditableText pageKey="contact" field="address_line1" defaultValue="470 N Tamiami Trail">
                    {(v) => <>{v}</>}
                  </EditableText>
                </p>
                <p className="text-foreground font-medium">
                  <EditableText pageKey="contact" field="address_line2" defaultValue="Osprey, FL 34229">
                    {(v) => <>{v}</>}
                  </EditableText>
                </p>
                <a
                  href="https://maps.google.com/?q=470+N+Tamiami+Trail+Osprey+FL+34229"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[var(--color-gold)] hover:underline mt-1 inline-block"
                >
                  Get directions →
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold)]/10 shrink-0">
                <Clock className="h-5 w-5 text-[var(--color-gold)]" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Business Hours</h3>
                <div className="text-sm space-y-1 text-foreground">
                  <div className="flex justify-between gap-6">
                    <span>Monday – Friday</span>
                    <span className="font-medium">
                      <EditableText pageKey="contact" field="hours_weekday" defaultValue="9:00 AM – 5:00 PM ET">
                        {(v) => <>{v}</>}
                      </EditableText>
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Saturday</span>
                    <span className="font-medium">
                      <EditableText pageKey="contact" field="hours_saturday" defaultValue="By appointment">
                        {(v) => <>{v}</>}
                      </EditableText>
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span>Sunday</span>
                    <span className="text-muted-foreground">Closed</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/40 rounded-xl p-6 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-2">
          <EditableText pageKey="contact" field="about_title" defaultValue="About Cabinet Dealz">
            {(v) => <>{v}</>}
          </EditableText>
        </p>
        <p>
          <EditableText pageKey="contact" field="about_body" defaultValue="Cabinet Dealz is the trade platform connecting cabinet professionals, contractors, interior designers, and homeowners with wholesale cabinet pricing and a full suite of design tools. We are based in Osprey, Florida and serve customers nationwide through our network of affiliate partners and distributor relationships." multiline>
            {(v) => <>{v}</>}
          </EditableText>
        </p>
      </div>
    </div>
  );
}
