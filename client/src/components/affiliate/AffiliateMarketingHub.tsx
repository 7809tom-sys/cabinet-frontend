import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { affiliateStorefrontUrl } from "@/lib/affiliateStorefrontUrl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Download, Copy, ExternalLink, QrCode, FileText,
  CreditCard, Megaphone, BookOpen, Youtube, CheckCircle2
} from "lucide-react";

const BASE_URL = window.location.origin;

function useQRCode(url: string) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    if (!url) return;
    import("qrcode").then((QRCode) => {
      QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: "#1a1a2e", light: "#ffffff" } })
        .then(setDataUrl)
        .catch(() => {});
    });
  }, [url]);
  return dataUrl;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button onClick={copy} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function LinkRow({ label, url }: { label: string; url: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-mono truncate">{url}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <CopyButton text={url} />
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

async function downloadBusinessCard(affiliate: { storeName: string; contactName: string | null; phone: string | null; slug: string }, qrDataUrl: string) {
  const { jsPDF } = await import("jspdf");
  const storefrontUrl = affiliateStorefrontUrl(affiliate.slug);
  // Standard business card: 3.5" x 2" at 72dpi = 252 x 144 pt
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [252, 144] });

  // Front side — branding
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 252, 144, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(affiliate.storeName || "My Cabinet Store", 20, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 180, 120);
  doc.text("Kitchen Cabinets — Contractor Pricing", 20, 56);
  doc.setTextColor(255, 255, 255);
  if (affiliate.contactName) doc.text(affiliate.contactName, 20, 80);
  if (affiliate.phone) doc.text(affiliate.phone, 20, 94);
  doc.setFontSize(8);
  doc.setTextColor(180, 180, 200);
  doc.text(storefrontUrl, 20, 112);

  // Back side
  doc.addPage([252, 144], "landscape");
  doc.setFillColor(248, 247, 244);
  doc.rect(0, 0, 252, 144, "F");
  doc.setTextColor(26, 26, 46);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Scan to Shop My Store", 126, 28, { align: "center" });
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 88, 36, 76, 76);
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 120);
  doc.text("Browse 60+ door styles · Free design tool · Competitive pricing", 126, 128, { align: "center" });

  doc.save(`${affiliate.slug}-business-card.pdf`);
  toast.success("Business card PDF downloaded");
}

async function downloadPhoneStrip(affiliate: { storeName: string; phone: string | null; slug: string }, qrDataUrl: string) {
  const { jsPDF } = await import("jspdf");
  // Phone strip: 2" x 8.5" = 144 x 612 pt
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [144, 612] });

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 144, 612, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  // Rotate text 90 degrees for vertical strip
  doc.text(affiliate.storeName || "My Cabinet Store", 72, 30, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 180, 120);
  doc.text("Kitchen Cabinets", 72, 48, { align: "center" });
  doc.text("Contractor Pricing", 72, 60, { align: "center" });
  if (affiliate.phone) {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(affiliate.phone, 72, 88, { align: "center" });
  }
  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", 24, 110, 96, 96);
  }
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(180, 180, 200);
  doc.text("Scan to shop", 72, 220, { align: "center" });

  // Tear-off tabs at bottom
  doc.setFontSize(6);
  doc.setTextColor(200, 180, 120);
  const tabWidth = 144 / 6;
  for (let i = 0; i < 6; i++) {
    const x = i * tabWidth + tabWidth / 2;
    doc.setDrawColor(100, 100, 150);
    doc.setLineDashPattern([2, 2], 0);
    doc.line(i * tabWidth, 260, i * tabWidth, 612);
    doc.text(affiliate.phone || "", x, 580, { align: "center", angle: 90 });
  }

  doc.save(`${affiliate.slug}-phone-strip.pdf`);
  toast.success("Phone strip PDF downloaded");
}

const YOUTUBE_CHANNELS = [
  { name: "Cabinet DIY", url: "https://www.youtube.com/@CabinetDIY", desc: "Cabinet installation tips and tutorials for homeowners and contractors." },
  { name: "Kitchen & Bath Design TV", url: "https://www.youtube.com/@KitchenBathDesignTV", desc: "Design inspiration, layout planning, and product reviews." },
  { name: "Home RenoVision DIY", url: "https://www.youtube.com/@HomeRenoVisionDIY", desc: "Practical home renovation guides including kitchen remodels." },
  { name: "April Wilkerson", url: "https://www.youtube.com/@AprilWilkerson", desc: "DIY builds and kitchen projects with detailed walkthroughs." },
  { name: "The Rehab Network", url: "https://www.youtube.com/@TheRehabNetwork", desc: "Real estate investing and renovation — great for contractor affiliates." },
  { name: "Sales Insights Lab", url: "https://www.youtube.com/@SalesInsightsLab", desc: "Sales training, prospecting, and closing techniques." },
  { name: "Grant Cardone", url: "https://www.youtube.com/@GrantCardone", desc: "Sales motivation, prospecting mindset, and closing strategies." },
  { name: "Jeremy Miner", url: "https://www.youtube.com/@JeremyMiner", desc: "Modern sales psychology and objection handling techniques." },
];

const GUIDES = [
  { title: "10 Steps to a Sale", icon: "🎯", desc: "Your complete sales playbook from prospect to referral. Follow this system and increase sales by 35%.", file: "10-steps-to-a-sale" },
  { title: "Kitchen Design Fundamentals", icon: "📐", desc: "How to measure, standard sizes, work triangle, layouts, and the 10×10 reference kitchen.", file: "kitchen-design-fundamentals" },
  { title: "How to Use Your CRM Effectively", icon: "📊", desc: "Turn your pipeline into predictable sales. The 5 stages, follow-up cadence, and weekly review.", file: "how-to-use-your-crm" },
  { title: "Marketing Scripts & Templates", icon: "✉️", desc: "Ready-to-use text, email, and social media templates. Copy, customize, and send.", file: "marketing-scripts-and-templates" },
];

export default function AffiliateMarketingHub() {
  const { data: affiliate, isLoading } = trpc.affiliates.myAffiliate.useQuery();
  const storefrontUrl = affiliate ? affiliateStorefrontUrl(affiliate.slug) : "";
  const digitalCardUrl = affiliate ? `${BASE_URL}/card/${affiliate.slug}` : "";
  const referralUrl = affiliate ? `${BASE_URL}?ref=${affiliate.referralCode}` : "";
  const qrDataUrl = useQRCode(storefrontUrl);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (!affiliate) return <p className="text-sm text-muted-foreground py-6">Could not load affiliate data.</p>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold">Marketing Hub</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Everything you need to market your store, train your skills, and grow your sales.
        </p>
      </div>

      <Tabs defaultValue="links">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="links" className="gap-1.5"><QrCode className="h-3.5 w-3.5" /> Links & QR</TabsTrigger>
          <TabsTrigger value="print" className="gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Print Materials</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Scripts</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Training Guides</TabsTrigger>
          <TabsTrigger value="youtube" className="gap-1.5"><Youtube className="h-3.5 w-3.5" /> YouTube Resources</TabsTrigger>
        </TabsList>

        {/* ── Links & QR ── */}
        <TabsContent value="links" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Your Shareable Links</h3>
              <LinkRow label="Your Storefront" url={storefrontUrl} />
              <LinkRow label="Referral Link (tracks commissions)" url={referralUrl} />
              <LinkRow label="Digital Business Card" url={digitalCardUrl} />
            </div>
            <div className="flex flex-col items-center gap-3">
              <h3 className="font-semibold text-sm self-start">Your QR Code</h3>
              {qrDataUrl ? (
                <div className="rounded-xl border border-border p-3 bg-white">
                  <img src={qrDataUrl} alt="QR code" className="w-40 h-40" />
                </div>
              ) : (
                <div className="w-40 h-40 rounded-xl border border-border flex items-center justify-center bg-muted">
                  <Spinner className="h-6 w-6 text-primary" />
                </div>
              )}
              <p className="text-xs text-muted-foreground text-center">Links to your storefront — use in print materials, email signatures, and social media</p>
              {qrDataUrl && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const a = document.createElement("a");
                  a.href = qrDataUrl;
                  a.download = `${affiliate.slug}-qr-code.png`;
                  a.click();
                  toast.success("QR code downloaded");
                }}>
                  <Download className="h-3.5 w-3.5" /> Download QR Code
                </Button>
              )}
            </div>
          </div>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-sm text-blue-800">
              <strong>Pro tip:</strong> Add your storefront link and QR code to your email signature, Google Business profile, Instagram bio, and Facebook page. Every place your name appears online should link to your store.
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Print Materials ── */}
        <TabsContent value="print" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Download print-ready PDFs branded with your store name, phone number, and QR code. Take them to a local print shop or order online.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Business Card
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Standard 3.5" × 2" business card. Front: your branding and contact info. Back: QR code linking to your storefront.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>✓ Print-ready PDF (300 DPI equivalent)</p>
                  <p>✓ Front + back included</p>
                  <p>✓ Your store name, phone, and QR code</p>
                </div>
                <Button
                  className="w-full gap-1.5"
                  onClick={() => downloadBusinessCard(affiliate, qrDataUrl)}
                  disabled={!qrDataUrl}
                >
                  <Download className="h-4 w-4" /> Download Business Card PDF
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Phone Strip
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  2" × 8.5" bulletin board strip with tear-off phone number tabs. Post at hardware stores, laundromats, community boards, and anywhere your customers gather.
                </p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>✓ Tear-off phone number tabs at bottom</p>
                  <p>✓ QR code in the center</p>
                  <p>✓ Your store name and phone number</p>
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-1.5"
                  onClick={() => downloadPhoneStrip(affiliate, qrDataUrl)}
                  disabled={!qrDataUrl}
                >
                  <Download className="h-4 w-4" /> Download Phone Strip PDF
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 text-sm text-amber-800">
              <strong>Where to post your phone strip:</strong> Hardware stores, lumber yards, home improvement stores, laundromats, community centers, church bulletin boards, apartment complex lobbies, and anywhere homeowners and contractors gather.
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Scripts ── */}
        <TabsContent value="scripts" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            Ready-to-use scripts for text messages, emails, and social media. Customize with your store name and link, then use immediately.
          </p>
          {[
            {
              title: "First Contact Text (Warm Lead)",
              text: `Hey [Name]! I just launched my own cabinet store — ${affiliate.storeName}. We carry beautiful kitchen cabinets at contractor pricing. If you or anyone you know is thinking about updating their kitchen, I'd love to help. Here's my store: ${storefrontUrl}`,
            },
            {
              title: "Follow-Up Text (Day 3)",
              text: `Hey [Name], just wanted to make sure you got my message! Here's my store link again: ${storefrontUrl}. We have a 3D Designer so you can plan your whole kitchen before you order. No pressure — just wanted you to have it.`,
            },
            {
              title: "Design Tool Invitation",
              text: `I wanted to share something cool — there's a free kitchen design tool on my site where you can lay out your whole kitchen and see different door styles. Takes about 10 minutes and gives you a real price. Want to try it? ${storefrontUrl}`,
            },
            {
              title: "Referral Request (After Delivery)",
              text: `Hey [Name]! Hope the kitchen is looking amazing! If you know anyone else thinking about updating their kitchen, I'd love an introduction. Just forward them my store link: ${storefrontUrl} — I'll take great care of them!`,
            },
            {
              title: "Facebook Post",
              text: `🏠 Thinking about updating your kitchen? I can help!\n\nI run ${affiliate.storeName} — a cabinet store offering beautiful, quality kitchen cabinets at prices most homeowners never see. We carry dozens of door styles and our free online design tool lets you plan your whole kitchen before you spend a dollar.\n\n👉 Browse styles and get a free quote: ${storefrontUrl}`,
            },
            {
              title: "Instagram Caption",
              text: `Kitchen goals 🤍 Browse our full selection of door styles — from classic shaker to sleek modern slab.\n\n📐 Free design tool on our site — plan your whole kitchen in 10 minutes.\n💰 Contractor pricing. No contractor required.\n\nLink in bio → ${storefrontUrl}\n\n#kitchenremodel #kitchencabinets #kitchendesign #homeimprovement`,
            },
          ].map((script) => (
            <Card key={script.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{script.title}</CardTitle>
                  <CopyButton text={script.text} />
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/40 rounded-lg p-3">
                  {script.text}
                </pre>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Training Guides ── */}
        <TabsContent value="training" className="space-y-4 pt-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <strong>Affiliates who follow the complete system report a 35% increase in sales.</strong> These guides are your playbook. Read them, apply them, and revisit them regularly.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {GUIDES.map((guide) => (
              <Card key={guide.file} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{guide.icon}</span>
                    <div>
                      <p className="font-semibold text-sm">{guide.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{guide.desc}</p>
                    </div>
                  </div>
                  <a
                    href={`/affiliate/guide/${guide.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <BookOpen className="h-3.5 w-3.5" /> Read Guide
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Welcome Guide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">Your complete onboarding guide — how your storefront works, how to use the dashboard, and how to get started.</p>
              <a
                href="/manus-storage/Cabinet-Dealz-Affiliate-Welcome-Guide.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download Welcome Guide PDF
              </a>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── YouTube Resources ── */}
        <TabsContent value="youtube" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">
            These YouTube channels cover cabinet installation, kitchen design, sales training, and business growth. Bookmark the ones relevant to your business and watch regularly.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {YOUTUBE_CHANNELS.map((ch) => (
              <a
                key={ch.name}
                href={ch.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/50 hover:bg-muted/30 transition-colors group"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <Youtube className="h-4 w-4 text-red-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm group-hover:text-primary transition-colors">{ch.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 text-sm text-blue-800">
              <strong>Recommendation:</strong> Watch at least one sales training video per week. The best cabinet affiliates are not just product experts — they are skilled salespeople. Invest 30 minutes a week in your sales education and it will pay for itself many times over.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
