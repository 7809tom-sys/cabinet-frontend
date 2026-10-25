import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  CalendarPlus,
  Trash2,
  Video,
  Phone,
  MapPin,
  Link2,
  Copy,
  Check,
  X,
  CheckCircle2,
} from "lucide-react";

const MODE_ICON: Record<string, React.ReactNode> = {
  video: <Video className="h-3.5 w-3.5" />,
  phone: <Phone className="h-3.5 w-3.5" />,
  in_person: <MapPin className="h-3.5 w-3.5" />,
};

function fmt(d: Date | string | number) {
  return new Date(d).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Convert a datetime-local input value (local wall time) to epoch ms.
function localToEpoch(v: string): number {
  return new Date(v).getTime();
}

function statusVariant(s: string): "default" | "secondary" | "destructive" | "outline" {
  if (s === "confirmed" || s === "completed") return "default";
  if (s === "cancelled") return "destructive";
  return "outline";
}

function AvailabilityManager() {
  const utils = trpc.useUtils();
  const { data: slots, isLoading } = trpc.consultations.myAvailability.useQuery();
  const [start, setStart] = useState("");
  const [durationMin, setDurationMin] = useState("45");
  const [mode, setMode] = useState<"video" | "phone" | "in_person">("video");

  const addSlot = trpc.consultations.addSlot.useMutation({
    onSuccess: () => {
      utils.consultations.myAvailability.invalidate();
      utils.consultations.openSlots.invalidate();
      setStart("");
      toast.success("Slot added");
    },
    onError: (e) => toast.error(e.message),
  });
  const removeSlot = trpc.consultations.removeSlot.useMutation({
    onSuccess: () => {
      utils.consultations.myAvailability.invalidate();
      utils.consultations.openSlots.invalidate();
      toast.success("Slot removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const upcoming = useMemo(
    () => (slots ?? []).filter((s) => new Date(s.startAt).getTime() > Date.now()),
    [slots],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Start time</Label>
            <Input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-56"
            />
          </div>
          <div>
            <Label className="text-xs">Duration</Label>
            <Select value={durationMin} onValueChange={setDurationMin}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 min</SelectItem>
                <SelectItem value="45">45 min</SelectItem>
                <SelectItem value="60">60 min</SelectItem>
                <SelectItem value="90">90 min</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video call</SelectItem>
                <SelectItem value="phone">Phone call</SelectItem>
                <SelectItem value="in_person">In person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="gap-2"
            disabled={!start || addSlot.isPending}
            onClick={() => {
              const startMs = localToEpoch(start);
              if (Number.isNaN(startMs)) return toast.error("Pick a valid start time");
              if (startMs <= Date.now()) return toast.error("Pick a future time");
              addSlot.mutate({
                startAt: startMs,
                endAt: startMs + Number(durationMin) * 60_000,
                mode,
              });
            }}
          >
            <CalendarPlus className="h-4 w-4" /> Add slot
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 text-primary" />
          </div>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No upcoming open slots. Add a few times above so customers can book you.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm"
              >
                <span className="text-muted-foreground">{MODE_ICON[s.mode]}</span>
                <span>{fmt(s.startAt)}</span>
                <Badge variant={s.status === "open" ? "outline" : "secondary"} className="capitalize">
                  {s.status}
                </Badge>
                {s.status === "open" && (
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    title="Remove slot"
                    onClick={() => removeSlot.mutate({ id: s.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShareControls({
  consultationId,
  shareToken,
  meetingUrl,
}: {
  consultationId: number;
  shareToken: string | null;
  meetingUrl: string | null;
}) {
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const [meeting, setMeeting] = useState(meetingUrl ?? "");

  const update = trpc.consultations.updateMeeting.useMutation({
    onSuccess: () => {
      utils.consultations.myConsultations.invalidate();
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const shareUrl = shareToken
    ? `${window.location.origin}/design/session/${shareToken}`
    : null;

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={meeting}
          onChange={(e) => setMeeting(e.target.value)}
          placeholder="Paste Google Meet / Zoom / phone link (for voice)"
          className="flex-1 min-w-[220px] bg-background"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: consultationId, meetingUrl: meeting, ensureShare: true })}
        >
          Save
        </Button>
      </div>

      {shareUrl ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link2 className="h-4 w-4 text-[#a87f33]" />
          <span className="truncate max-w-[260px] text-muted-foreground">{shareUrl}</span>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1"
            onClick={() => {
              navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy share link"}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: consultationId, ensureShare: true })}
        >
          <Link2 className="h-3.5 w-3.5" /> Create customer share link
        </Button>
      )}
      <p className="text-xs text-muted-foreground">
        The share link lets the customer watch the attached design update live (view-only). Use the
        meeting link above for voice/video.
      </p>
    </div>
  );
}

function ConsultationsList() {
  const utils = trpc.useUtils();
  const { data: list, isLoading } = trpc.consultations.myConsultations.useQuery({ status: "all" });

  const setStatus = trpc.consultations.setConsultationStatus.useMutation({
    onSuccess: () => {
      utils.consultations.myConsultations.invalidate();
      utils.consultations.myAvailability.invalidate();
      toast.success("Updated");
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    );
  }

  if (!list || list.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        No consultations booked yet. Add availability above and they'll appear here once customers book.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {list.map((c) => (
        <Card key={c.id}>
          <CardContent className="pt-6 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{c.customerName}</span>
                  <Badge variant={statusVariant(c.status)} className="capitalize">
                    {c.status}
                  </Badge>
                  <span className="text-muted-foreground">{MODE_ICON[c.mode]}</span>
                </div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{fmt(c.startAt)}</span>
                  <span>{c.customerEmail}</span>
                  {c.customerPhone && <span>{c.customerPhone}</span>}
                  {c.designName && <span>Design: {c.designName}</span>}
                </div>
                {c.topic && <p className="text-sm">{c.topic}</p>}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {c.status !== "confirmed" && c.status !== "completed" && c.status !== "cancelled" && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: c.id, status: "confirmed" })}
                  >
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </Button>
                )}
                {c.status !== "completed" && c.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: c.id, status: "completed" })}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                  </Button>
                )}
                {c.status !== "cancelled" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-destructive"
                    disabled={setStatus.isPending}
                    onClick={() => setStatus.mutate({ id: c.id, status: "cancelled" })}
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                )}
              </div>
            </div>

            {c.status !== "cancelled" && (
              <ShareControls
                consultationId={c.id}
                shareToken={c.shareToken ?? null}
                meetingUrl={c.meetingUrl ?? null}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ConsultationsAdmin() {
  return (
    <div className="space-y-6">
      <AvailabilityManager />
      <ConsultationsList />
    </div>
  );
}
