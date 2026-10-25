import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Image, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export default function GeminiImageProviderAdmin() {
  const utils = trpc.useUtils();
  const status = trpc.designPhotoRenders.getGeminiProviderStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const check = trpc.designPhotoRenders.testGeminiProvider.useMutation({
    onSuccess: (result) => {
      void utils.designPhotoRenders.getGeminiProviderStatus.invalidate();
      if (result.connected && result.modelAvailable) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (error) => toast.error(error.message),
  });

  if (status.isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  const provider = status.data;
  const ready = provider?.connected && provider.modelAvailable;
  const configured = provider?.configured;
  const badge = ready
    ? <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">Connected</Badge>
    : configured
      ? <Badge className="border-amber-200 bg-amber-100 text-amber-800">Needs attention</Badge>
      : <Badge className="border-slate-200 bg-slate-100 text-slate-600">Not configured</Badge>;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <Image className="h-5 w-5 text-[#1a2744]" />
            <CardTitle className="text-base">Gemini Nano Banana — Customer Image Provider</CardTitle>
            {badge}
          </div>
          <CardDescription>
            Secure server-side connection status only. The API key is never displayed or sent to the Designer browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            {ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
            <div>
              <p className="font-semibold">{ready ? "Gemini Nano Banana image model is available" : configured ? "Gemini credentials are saved, but image-model access needs attention" : "Gemini key has not been configured"}</p>
              <p className="mt-1 text-xs leading-relaxed">{ready ? "Connection access was confirmed server-side. Customer image generation remains limited to CabinetDealz’s approved exact-plan workflow." : "Use the secure GEMINI_API_KEY setting, then select Test connection. No key value or provider account detail is shown here."}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-[#1a2744]">Required customer safeguards</p>
            <p className="mt-1">A customer must save the current kitchen plan and verify a phone number before an image request. The stored request retains the immutable design revision, plan fingerprint, selected door, countertop, flooring, backsplash, faucet, and sink; qualified leads follow the existing CRM path. The saved plan and price remain authoritative.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" />Connection test returns only safe status.</div>
            <Button type="button" onClick={() => check.mutate()} disabled={check.isPending}>
              {check.isPending ? <Spinner className="mr-1.5 h-4 w-4" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
              Test connection
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
