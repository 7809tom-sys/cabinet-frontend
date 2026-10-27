import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { affiliateStorefrontUrl } from "@/lib/affiliateStorefrontUrl";
import { CredentialsPanel } from "@/components/affiliate/CredentialsPanel";
import { AffiliateResourceBrowser, type EducationResource } from "@/components/affiliate/AffiliateResourcesHub";
import { AffiliateSocialLinksPanel } from "@/components/affiliate/AffiliateSocialLinksPanel";
import {
  BookOpen, CreditCard, Download, FileText, HelpCircle, Megaphone, PlayCircle, Printer, QrCode, Search, Share2, Sparkles,
} from "lucide-react";

function useQRCode(url: string) {
  const [dataUrl, setDataUrl] = useState("");
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

async function downloadBusinessCard(affiliate: { storeName: string; contactName?: string | null; phone?: string | null; slug: string }, qrDataUrl: string) {
  const { jsPDF } = await import("jspdf");
  const storefrontUrl = affiliateStorefrontUrl(affiliate.slug);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: [252, 144] });
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 252, 144, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(affiliate.storeName || "My Cabinet Store", 20, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (affiliate.contactName) doc.text(affiliate.contactName, 20, 80);
  if (affiliate.phone) doc.text(affiliate.phone, 20, 94);
  doc.setFontSize(8);
  doc.text(storefrontUrl, 20, 112);
  doc.addPage([252, 144], "landscape");
  doc.setFillColor(248, 247, 244);
  doc.rect(0, 0, 252, 144, "F");
  doc.setTextColor(26, 26, 46);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Scan to Shop My Store", 126, 28, { align: "center" });
  if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", 88, 36, 76, 76);
  doc.save(`${affiliate.slug}-business-card.pdf`);
  toast.success("Business card PDF downloaded");
}

async function downloadPhoneStrip(affiliate: { storeName: string; phone?: string | null; slug: string }, qrDataUrl: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: [144, 612] });
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, 144, 612, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(affiliate.storeName || "My Cabinet Store", 72, 30, { align: "center" });
  if (affiliate.phone) doc.text(affiliate.phone, 72, 88, { align: "center" });
  if (qrDataUrl) doc.addImage(qrDataUrl, "PNG", 24, 110, 96, 96);
  doc.save(`${affiliate.slug}-phone-strip.pdf`);
  toast.success("Phone strip PDF downloaded");
}

export type MarketingAffiliate = {
  id: number;
  storeName: string;
  slug: string;
  referralCode: string;
  template?: string | null;
  email?: string | null;
  contactName?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
};

export default function AffiliateMarketingHub({ affiliate }: { affiliate: MarketingAffiliate }) {
  const [query, setQuery] = useState("");
  const resources = trpc.affiliateResources.published.useQuery();
  const literature = trpc.affiliateResources.publishedLiterature.useQuery();
  const progress = trpc.affiliateResources.myProgress.useQuery();
  const utils = trpc.useUtils();
  const saveProgress = trpc.affiliateResources.saveProgress.useMutation({
    onSuccess: () => utils.affiliateResources.myProgress.invalidate(),
    onError: (error) => toast.error(error.message),
  });
  const storefrontUrl = affiliateStorefrontUrl(affiliate.slug);
  const referralUrl = `${window.location.origin}?ref=${affiliate.referralCode}`;
  const qrDataUrl = useQRCode(storefrontUrl);
  const items = (resources.data ?? []) as EducationResource[];

  async function openFile(id: number, kind: "file" | "thumbnail") {
    return utils.affiliateResources.signedFile.fetch({ id, kind });
  }

  return (
    <div className="space-y-6 max-w-5xl" data-testid="marketing-hub">
      <div>
        <h2 className="text-xl font-bold">Marketing Hub</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Sales education, printed materials, and the links you use to promote your store.
        </p>
      </div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search published resources" className="pl-9" aria-label="Search resources" />
      </div>
      {resources.isLoading ? <div className="flex justify-center py-8"><Spinner className="h-6 w-6 text-primary" /></div> : null}
      {resources.error ? <p className="text-sm text-destructive">{resources.error.message}</p> : null}
      <Tabs defaultValue="start">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="start" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Start Here</TabsTrigger>
          <TabsTrigger value="scripts" className="gap-1.5"><Megaphone className="h-3.5 w-3.5" /> Sales Scripts</TabsTrigger>
          <TabsTrigger value="guides" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Training Guides</TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5"><PlayCircle className="h-3.5 w-3.5" /> Video Training</TabsTrigger>
          <TabsTrigger value="printed" className="gap-1.5"><Printer className="h-3.5 w-3.5" /> Printed Materials</TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /> Social Media</TabsTrigger>
          <TabsTrigger value="tips" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Tips & FAQ</TabsTrigger>
          <TabsTrigger value="share" className="gap-1.5"><QrCode className="h-3.5 w-3.5" /> Share & Promote</TabsTrigger>
          <TabsTrigger value="my-social" className="gap-1.5">My Social Links</TabsTrigger>
        </TabsList>
        {(["start", "scripts", "guides", "videos", "printed", "social", "tips"] as const).map((section) => (
          <TabsContent key={section} value={section} className="pt-4">
            <AffiliateResourceBrowser
              section={section}
              items={items}
              literature={literature.data ?? []}
              progress={progress.data ?? []}
              query={query}
              storeName={affiliate.storeName}
              logoUrl={affiliate.logoUrl ?? null}
              storefrontUrl={storefrontUrl}
              onToggleComplete={(resource, completed) => saveProgress.mutate({ resourceId: resource.id, completed, progressPercent: completed ? 100 : 0 })}
              onVideoProgress={(resource, progressPercent, completed) => saveProgress.mutate({ resourceId: resource.id, completed, progressPercent })}
              onRequestFile={openFile}
            />
          </TabsContent>
        ))}
        <TabsContent value="share" className="space-y-6 pt-4">
          <CredentialsPanel
            affiliate={affiliate}
            storeUrl={storefrontUrl}
            refLink={referralUrl}
            onCopy={(text, label) => {
              navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied`)).catch(() => toast.error("Could not copy"));
            }}
          />
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">QR code</h3>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Storefront QR code" className="h-40 w-40 rounded-xl border border-border bg-white p-2" />
              ) : <Spinner className="h-6 w-6 text-primary" />}
              {qrDataUrl ? (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                  const anchor = document.createElement("a");
                  anchor.href = qrDataUrl;
                  anchor.download = `${affiliate.slug}-qr-code.png`;
                  anchor.click();
                }}>
                  <Download className="h-3.5 w-3.5" /> Download QR code
                </Button>
              ) : null}
            </div>
            <div className="grid gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Business card</CardTitle></CardHeader>
                <CardContent>
                  <Button className="gap-1.5" disabled={!qrDataUrl} onClick={() => downloadBusinessCard(affiliate, qrDataUrl)}>
                    <Download className="h-4 w-4" /> Download business card PDF
                  </Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Phone strip</CardTitle></CardHeader>
                <CardContent>
                  <Button variant="outline" className="gap-1.5" disabled={!qrDataUrl} onClick={() => downloadPhoneStrip(affiliate, qrDataUrl)}>
                    <Download className="h-4 w-4" /> Download phone strip PDF
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="my-social" className="pt-4">
          <AffiliateSocialLinksPanel affiliateId={affiliate.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
