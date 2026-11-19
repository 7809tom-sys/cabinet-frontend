/**
 * Report damaged items (Tom, Nov 19 2026, PR 3).
 *
 * Rendered on the invoice page, which already proved invoice access, so the claim posts
 * with the same invoice number and key the lookup used. The server is the authority on
 * every rule (item ownership, quantity cap, photo type and size); this form mirrors them
 * so the customer reads a sentence instead of a rejection, and disables submit while a
 * request is in flight so a slow phone cannot post twice.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STAGES = ["During unloading", "Opening the box", "During installation", "After installation"] as const;
const MAX_PHOTOS = 8;
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MIN_DESCRIPTION = 12;

export type ClaimLine = { id: number; sku: string; name: string | null; quantity: number };
type Preview = { name: string; dataUrl: string; base64: string; type: string };

function readFile(file: File): Promise<Preview> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
      resolve({ name: file.name, dataUrl, base64, type: file.type });
    };
    reader.readAsDataURL(file);
  });
}

export default function DamageClaimForm(props: {
  invoiceNumber: string;
  emailOrZip: string;
  lines: ClaimLine[];
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<string>(STAGES[0]);
  const [photos, setPhotos] = useState<Preview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = Object.entries(quantities)
    .map(([id, quantity]) => ({ id: Number(id), quantity }))
    .filter((line) => line.quantity > 0);
  const canSubmit = chosen.length > 0 && description.trim().length >= MIN_DESCRIPTION && photos.length > 0 && !busy;

  function toggle(line: ClaimLine, checked: boolean) {
    setQuantities((current) => {
      const next = { ...current };
      if (checked) next[line.id] = 1;
      else delete next[line.id];
      return next;
    });
  }

  function setQuantity(line: ClaimLine, raw: string) {
    const parsed = Number.parseInt(raw, 10);
    const quantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), line.quantity) : 1;
    setQuantities((current) => ({ ...current, [line.id]: quantity }));
  }

  async function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    const room = Math.max(MAX_PHOTOS - photos.length, 0);
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length) setError("You can attach up to 8 photos.");
    const accepted: Preview[] = [];
    for (const file of picked) {
      if (!TYPES.includes(file.type)) { setError("Photos must be JPEG, PNG or WebP."); continue; }
      if (file.size > MAX_BYTES) { setError("Each photo must be under 8 MB."); continue; }
      accepted.push(await readFile(file));
    }
    setPhotos((current) => [...current, ...accepted].slice(0, MAX_PHOTOS));
  }

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/invoices/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: props.invoiceNumber,
          emailOrZip: props.emailOrZip,
          description,
          discoveredStage: stage,
          items: chosen.map((line) => ({ orderItemId: line.id, damagedQuantity: line.quantity })),
          photos: photos.map((photo) => ({ name: photo.name, type: photo.type, data: photo.base64 })),
        }),
      });
      const body = (await response.json()) as { ok: boolean; message?: string };
      if (!body.ok) { setError(body.message ?? "The claim could not be saved. Try again in a moment."); return; }
      props.onSubmitted();
    } catch {
      setError("The claim could not be saved. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-4" data-testid="damage-claim-form">
      <div>
        <p className="text-sm font-semibold text-[#1a2744]">Which items arrived damaged?</p>
        <ul className="mt-2 space-y-2">
          {props.lines.map((line) => {
            const quantity = quantities[line.id] ?? 0;
            return (
              <li key={line.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={quantity > 0}
                  onChange={(event) => toggle(line, event.target.checked)}
                  aria-label={line.sku + " damaged"}
                />
                <span className="flex-1">
                  <span className="font-mono text-xs">{line.sku}</span> {line.name ?? ""}
                  <span className="text-muted-foreground"> · {line.quantity} ordered</span>
                </span>
                <Input
                  className="w-16"
                  type="number"
                  min={1}
                  max={line.quantity}
                  value={quantity || ""}
                  disabled={quantity === 0}
                  onChange={(event) => setQuantity(line, event.target.value)}
                  aria-label={line.sku + " damaged quantity"}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1">
        <Label htmlFor="claim-stage">When did you notice it?</Label>
        <select
          id="claim-stage"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          {STAGES.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="claim-description">What happened?</Label>
        <textarea
          id="claim-description"
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Two wall doors arrived with crushed corners on the left side."
        />
        <p className="text-xs text-muted-foreground">
          {description.trim().length < MIN_DESCRIPTION
            ? "A sentence or two, at least " + MIN_DESCRIPTION + " characters."
            : "Thanks — that is enough detail."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="claim-photos">Photos of the damage</Label>
        <input
          id="claim-photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => void addFiles(event.target.files)}
          className="block w-full text-sm"
        />
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, index) => (
              <span key={photo.name + "-" + index} className="relative">
                <img src={photo.dataUrl} alt={photo.name} className="h-16 w-16 rounded border object-cover" />
                <button
                  type="button"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-[#1a2744] text-xs text-white"
                  onClick={() => setPhotos((current) => current.filter((_, at) => at !== index))}
                  aria-label={"Remove " + photo.name}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">Up to 8 photos, JPEG or PNG, under 8 MB each.</p>
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex gap-2">
        <Button onClick={() => void submit()} disabled={!canSubmit}>
          {busy ? "Submitting…" : "Submit claim"}
        </Button>
        <Button variant="outline" onClick={props.onCancel} disabled={busy}>Cancel</Button>
      </div>
    </div>
  );
}