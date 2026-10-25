import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Tag, Power } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type DisplayMode = "neutral" | "branded" | "series";

const MODE_HELP: Record<DisplayMode, string> = {
  neutral: "Hide the supplier. Members see a plain neutral label (e.g. \"Line A\").",
  branded: "Show the supplier's real brand name and initials to members.",
  series: "Present this line as a Cabinet Dealz series (e.g. \"Madison Series\"); supplier stays hidden.",
};

const MODE_LABEL_FIELD: Record<DisplayMode, string> = {
  neutral: "Neutral label",
  branded: "Brand name",
  series: "Series name",
};

/**
 * White-label a cabinet line by typing the public-facing name — no direct DB
 * edits. Writes distributors.displayMode + the matching label/brand/series
 * fields via distributorAdmin.setBranding.
 */
export default function LineBrandingEditor() {
  const utils = trpc.useUtils();
  const { data: dists, isLoading } = trpc.distributorAdmin.adminList.useQuery();

  const [selectedId, setSelectedId] = useState<string>("");
  const [mode, setMode] = useState<DisplayMode>("neutral");
  const [label, setLabel] = useState<string>("");
  const [initials, setInitials] = useState<string>("");

  const selected = useMemo(
    () => dists?.find((d) => String(d.id) === selectedId),
    [dists, selectedId],
  );

  // When a line is picked, seed the form from its current presentation.
  function pickLine(id: string) {
    setSelectedId(id);
    const d = dists?.find((x) => String(x.id) === id);
    if (!d) return;
    const m = (d.displayMode as DisplayMode) ?? "neutral";
    setMode(m);
    if (m === "branded") {
      setLabel(d.brandName ?? "");
      setInitials(d.brandInitials ?? "");
    } else if (m === "series") {
      setLabel(d.seriesName ?? "");
      setInitials("");
    } else {
      setLabel(d.name ?? "");
      setInitials(d.initials ?? "");
    }
  }

  const setBranding = trpc.distributorAdmin.setBranding.useMutation({
    onSuccess: () => {
      toast.success("Line branding updated. Members will see the new label.");
      utils.distributorAdmin.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not update branding"),
  });

  const setActive = trpc.distributorAdmin.setActive.useMutation({
    onSuccess: (res) => {
      toast.success(res.isActive ? "Cabinet line is now ONLINE." : "Cabinet line is now OFFLINE — hidden from storefront.");
      utils.distributorAdmin.adminList.invalidate();
    },
    onError: (e) => toast.error(e.message || "Could not update line status"),
  });

  function currentPublicLabel(d: NonNullable<typeof selected>): string {
    const m = (d.displayMode as DisplayMode) ?? "neutral";
    if (m === "branded") return d.brandName || d.name;
    if (m === "series") return d.seriesName || d.name;
    return d.name;
  }

  const canSave = Boolean(selectedId) && label.trim().length > 0 && !setBranding.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" /> Cabinet line branding (white-label)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Choose how each supplier line is presented to members. Type the
          public-facing name here — no database editing required.
        </p>

        {/* ── Line on/off status table ── */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
            <Power className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Line status</span>
            <span className="text-xs text-muted-foreground ml-1">— toggle a line off to hide all its SKUs from the storefront instantly</span>
          </div>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-3">
              <Spinner className="h-4 w-4" /> Loading…
            </div>
          ) : (
            <div className="divide-y">
              {dists?.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={d.isActive ? "default" : "secondary"} className="w-16 justify-center">
                      {d.isActive ? "Online" : "Offline"}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{currentPublicLabel(d)}</p>
                      <p className="text-xs text-muted-foreground">{d.code}</p>
                    </div>
                  </div>
                  <Switch
                    checked={d.isActive ?? true}
                    disabled={setActive.isPending}
                    onCheckedChange={(checked) =>
                      setActive.mutate({ distributorId: d.id, isActive: checked })
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="h-4 w-4" /> Loading lines…
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Cabinet line</Label>
                <Select value={selectedId} onValueChange={pickLine}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a line…" />
                  </SelectTrigger>
                  <SelectContent>
                    {dists?.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.code} — {currentPublicLabel(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected && (
                  <p className="text-xs text-muted-foreground">
                    Currently shown as{" "}
                    <Badge variant="outline" className="ml-1">
                      {currentPublicLabel(selected)}
                    </Badge>{" "}
                    ({(selected.displayMode as string) ?? "neutral"})
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Presentation</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as DisplayMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="neutral">Neutral label</SelectItem>
                    <SelectItem value="branded">Real brand</SelectItem>
                    <SelectItem value="series">Cabinet Dealz series</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{MODE_HELP[mode]}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{MODE_LABEL_FIELD[mode]}</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={
                    mode === "series" ? "Madison Series" : mode === "branded" ? "ACME Cabinetry" : "Line A"
                  }
                  maxLength={128}
                  disabled={!selectedId}
                />
              </div>
              {mode !== "series" && (
                <div className="space-y-1.5">
                  <Label>Initials (badge)</Label>
                  <Input
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.toUpperCase())}
                    placeholder="Auto from name"
                    maxLength={8}
                    disabled={!selectedId}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                disabled={!canSave}
                onClick={() =>
                  setBranding.mutate({
                    distributorId: Number(selectedId),
                    displayMode: mode,
                    label: label.trim(),
                    initials: initials.trim() || undefined,
                  })
                }
              >
                {setBranding.isPending && <Spinner className="mr-2 h-4 w-4" />}
                Save branding
              </Button>
              {selected && (
                <span className="text-xs text-muted-foreground">
                  Will display to members as{" "}
                  <strong className="text-foreground">{label.trim() || "—"}</strong>
                </span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
