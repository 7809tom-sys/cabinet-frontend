import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2, Headphones, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export default function ElevenLabsOperationsAdmin() {
  const utils = trpc.useUtils();
  const status = trpc.operationsProviders.getElevenLabsStatus.useQuery(undefined, { refetchInterval: 30_000 });
  const check = trpc.operationsProviders.testElevenLabsConnection.useMutation({
    onSuccess: (result) => {
      void utils.operationsProviders.getElevenLabsStatus.invalidate();
      if (result.connected) toast.success(result.message);
      else toast.error(result.message);
    },
    onError: (error) => toast.error(error.message),
  });

  if (status.isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;

  const provider = status.data;
  const ready = provider?.connected === true;
  const configured = provider?.configured === true;
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
            <Headphones className="h-5 w-5 text-[#1a2744]" />
            <CardTitle className="text-base">ElevenLabs — Audio Operations</CardTitle>
            {badge}
          </div>
          <CardDescription>
            Server-only readiness for approved voice, transcription, and customer-audio workflows. The credential is never shown, returned, or sent to a browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}>
            {ready ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" /> : <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />}
            <div>
              <p className="font-semibold">{ready ? "ElevenLabs audio connection is available" : configured ? "ElevenLabs credentials are saved, but the connection needs attention" : "ElevenLabs has not been configured"}</p>
              <p className="mt-1 text-xs leading-relaxed">{ready ? "Audio work remains server-mediated and must use an approved product workflow." : "Add ELEVENLABS_API_KEY only to secure server configuration, then use Test connection. Never put an ElevenLabs key in browser code, a customer form, or a saved design."}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
            <p className="font-semibold text-[#1a2744]">Activation readiness</p>
            <p className="mt-1">ElevenLabs is an audio provider for narration, speech, transcription, dubbing, or voice workflows. It is <strong>not</strong> a customer kitchen-image generation provider, so it cannot be represented as an image alternative to the approved plan-locked image workflow.</p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-emerald-600" />Connection test returns only a safe status.</div>
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
