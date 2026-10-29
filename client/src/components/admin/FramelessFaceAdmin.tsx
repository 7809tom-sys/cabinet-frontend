import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Scissors, Upload } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  classifyFaceSource,
  detectHorizontalReveal,
  isDoorStyleVerified,
  isFramelessDoorStyle,
  parseUscdManifest,
  parseUscdManifestCsv,
  planFramelessSplit,
  planUscdManifestImport,
  resolveCabinetFaceImages,
  rowLuminanceFromImageData,
  type CatalogFaceStyle,
  type DoorStyleFaceInput,
  type FaceImportRow,
  type ManifestImportPlan,
  type RevealDetection,
} from "@shared/doorFaceRecognition";

export type FramelessAdminStyle = DoorStyleFaceInput & {
  id: number;
  ourName: string;
  doorSampleImageUrl: string | null;
  drawerSampleImageUrl: string | null;
  thumbnailImageUrl?: string | null;
  color?: string | null;
};

type LoadedFace = {
  width: number;
  height: number;
  image: HTMLImageElement;
  detection: RevealDetection;
};

type SplitPreview = {
  styleId: number;
  name: string;
  code: string | null;
  action: "ready" | "skip" | "manual-review";
  reason: string;
  doorDataUrl?: string;
  drawerDataUrl?: string;
};

const EDGE_TRIM = 2;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

async function loadFace(url: string): Promise<LoadedFace | null> {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.crossOrigin = "anonymous";
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("image"));
      element.src = url;
    });
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, width, height);
    return {
      width,
      height,
      image,
      detection: detectHorizontalReveal(rowLuminanceFromImageData(pixels.data, width, height)),
    };
  } catch {
    return null;
  }
}

function crop(image: HTMLImageElement, x: number, y: number, width: number, height: number): string | null {
  if (width < 8 || height < 8) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

function clipsFromDetection(face: LoadedFace): { doorDataUrl: string; drawerDataUrl: string } | null {
  if (!face.detection.detected) return null;
  const x = EDGE_TRIM;
  const width = face.width - EDGE_TRIM * 2;
  const drawerHeight = face.detection.drawerLastRow - EDGE_TRIM;
  const doorY = face.detection.doorStartRow;
  const doorHeight = face.height - EDGE_TRIM - doorY;
  const drawerDataUrl = crop(face.image, x, EDGE_TRIM, width, drawerHeight);
  const doorDataUrl = crop(face.image, x, doorY, width, doorHeight);
  if (!drawerDataUrl || !doorDataUrl) return null;
  return { doorDataUrl, drawerDataUrl };
}

function WallPreview({ style }: { style: FramelessAdminStyle }) {
  const plan = resolveCabinetFaceImages(style, "wall");
  const finish = style.color?.trim() || "#d8d2c8";
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-24 w-16 rounded border border-border"
        style={plan.doorUrl
          ? plan.sourceKind === "combined"
            ? { backgroundImage: `url(${plan.doorUrl})`, backgroundSize: "100% 140%", backgroundPosition: "center bottom" }
            : { backgroundImage: `url(${plan.doorUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: finish }}
        aria-label="Wall cabinet preview"
      />
      <p className="text-xs text-muted-foreground max-w-xs">
        Wall preview uses the DOOR image only, as one solid face.
        {plan.sourceKind === "combined" ? " This style still has one combined swatch. The wall shows the lower door band until a door-only photo is stored." : ""}
      </p>
    </div>
  );
}

export function FramelessFaceAdmin({ styles, onApplied }: { styles: FramelessAdminStyle[]; onApplied: () => void }) {
  const upload = trpc.mediaLibrary.upload.useMutation();
  const update = trpc.doorStyles.adminUpdateDoorStyle.useMutation();
  const [splitRows, setSplitRows] = useState<SplitPreview[] | null>(null);
  const [splitBusy, setSplitBusy] = useState(false);
  const [confirmSplit, setConfirmSplit] = useState(false);
  const [manifestRows, setManifestRows] = useState<FaceImportRow[] | null>(null);
  const [manifestErrors, setManifestErrors] = useState<string[]>([]);
  const [files, setFiles] = useState<Map<string, File>>(new Map());
  const [importPlan, setImportPlan] = useState<ManifestImportPlan | null>(null);
  const [confirmImport, setConfirmImport] = useState(false);
  const [importBusy, setImportBusy] = useState(false);

  const frameless = useMemo(() => styles.filter((style) => isFramelessDoorStyle(style)), [styles]);
  const readySplits = splitRows?.filter((row) => row.action === "ready") ?? [];

  async function reviewSplits() {
    setSplitBusy(true);
    try {
      const rows: SplitPreview[] = [];
      for (const style of frameless) {
        const source = style.doorSampleImageUrl || style.thumbnailImageUrl || "";
        const loaded = source && classifyFaceSource(style) !== "split" ? await loadFace(source) : null;
        const plan = planFramelessSplit(style, loaded?.detection ?? null);
        const clips = loaded ? clipsFromDetection(loaded) : null;
        rows.push({
          styleId: style.id,
          name: plan.name,
          code: plan.styleCode,
          action: plan.action === "ready" && !clips ? "manual-review" : plan.action,
          reason: plan.action === "ready" && !clips ? "The image could not be cropped." : loaded || plan.reason !== "undetected"
            ? plan.reason
            : "Image could not be loaded. Review it manually.",
          doorDataUrl: clips?.doorDataUrl,
          drawerDataUrl: clips?.drawerDataUrl,
        });
      }
      setSplitRows(rows);
      const manual = rows.filter((row) => row.action === "manual-review").length;
      toast.success(`Reviewed ${rows.length} frameless styles. ${manual} need a manual look. Nothing was saved.`);
    } finally {
      setSplitBusy(false);
    }
  }

  async function applySplits() {
    setImportBusy(true);
    setSplitBusy(true);
    let saved = 0;
    try {
      for (const row of readySplits) {
        if (!row.doorDataUrl || !row.drawerDataUrl) continue;
        const style = styles.find((item) => item.id === row.styleId);
        const door = await upload.mutateAsync({ label: `${row.code ?? row.styleId} door`, dataBase64: row.doorDataUrl, contentType: "image/png" });
        const drawer = await upload.mutateAsync({ label: `${row.code ?? row.styleId} drawer front`, dataBase64: row.drawerDataUrl, contentType: "image/png" });
        await update.mutateAsync({
          id: row.styleId,
          doorSampleImageUrl: door.url,
          drawerSampleImageUrl: drawer.url,
          combinedSourceImageUrl: style?.doorSampleImageUrl ?? style?.thumbnailImageUrl ?? null,
        } as { id: number; doorSampleImageUrl: string; drawerSampleImageUrl: string });
        saved += 1;
      }
      toast.success(`Stored door and drawer-front photos for ${saved} styles.`);
      setSplitRows(null);
      onApplied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The split was not saved.");
    } finally {
      setSplitBusy(false);
      setImportBusy(false);
      setConfirmSplit(false);
    }
  }

  async function readManifest(file: File) {
    const text = await file.text();
    const parsed = file.name.toLowerCase().endsWith(".csv") ? parseUscdManifestCsv(text) : parseUscdManifest(JSON.parse(text) as unknown);
    setManifestRows(parsed.rows);
    setManifestErrors(parsed.errors);
    setImportPlan(null);
    if (parsed.errors.length > 0) toast.error(parsed.errors[0] ?? "Manifest needs attention.");
    else toast.success(`Read ${parsed.rows.length} styles. Run the dry run before anything is uploaded.`);
  }

  function rememberFiles(list: FileList | null) {
    const next = new Map<string, File>();
    for (const file of Array.from(list ?? [])) {
      const relative = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
      next.set(relative, file);
      next.set(file.name, file);
    }
    setFiles(next);
    setImportPlan(null);
  }

  function dryRun() {
    if (!manifestRows) {
      toast.error("Choose the manifest first.");
      return;
    }
    const catalog: CatalogFaceStyle[] = styles.map((style) => ({
      id: style.id,
      styleCode: style.styleCode,
      ourName: style.ourName,
      aliasName: style.aliasName,
      doorSampleImageUrl: style.doorSampleImageUrl,
    }));
    const plan = planUscdManifestImport(manifestRows, catalog, new Set(files.keys()));
    setImportPlan(plan);
    toast.success(`${plan.ready.length} ready, ${plan.unmatched.length} unmatched, ${plan.missingFiles.length} missing files, ${plan.ambiguous.length} ambiguous.`);
  }

  function fileFor(path: string): File | undefined {
    const wanted = path.replace(/\\/g, "/").toLowerCase();
    for (const [key, file] of files) {
      const normal = key.replace(/\\/g, "/").toLowerCase();
      if (normal === wanted || normal.endsWith(`/${wanted}`)) return file;
    }
    return undefined;
  }

  async function applyImport() {
    if (!importPlan) return;
    setImportBusy(true);
    let saved = 0;
    try {
      for (const match of importPlan.ready) {
        const doorFile = fileFor(match.row.doorFile);
        const drawerFile = fileFor(match.row.drawerFile);
        if (!doorFile || !drawerFile) continue;
        const door = await upload.mutateAsync({
          label: `${match.row.code} door`,
          dataBase64: await fileToDataUrl(doorFile),
          contentType: doorFile.type || "image/png",
        });
        const drawer = await upload.mutateAsync({
          label: `${match.row.code} drawer front`,
          dataBase64: await fileToDataUrl(drawerFile),
          contentType: drawerFile.type || "image/png",
        });
        await update.mutateAsync({
          id: match.styleId,
          doorSampleImageUrl: door.url,
          drawerSampleImageUrl: drawer.url,
          combinedSourceImageUrl: match.previousDoorUrl,
          styleSourceNote: match.row.sourceNote,
        } as { id: number; doorSampleImageUrl: string; drawerSampleImageUrl: string });
        saved += 1;
      }
      toast.success(`Imported door and drawer-front photos for ${saved} styles.`);
      setImportPlan(null);
      onApplied();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The import was not saved.");
    } finally {
      setImportBusy(false);
      setConfirmImport(false);
    }
  }

  const sample = styles.find((style) => isFramelessDoorStyle(style)) ?? styles[0];

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Scissors className="h-4 w-4" /> Frameless door and drawer faces</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Each frameless style keeps a DOOR photo and a DRAWER_FRONT photo in the existing sample fields.
            Nothing here runs on its own. Review a split or a manifest, then confirm before any photo is uploaded.
            {frameless.length} frameless styles are in this list. {styles.filter((style) => !isDoorStyleVerified(style)).length} are unverified.
          </p>
        </div>
      </div>
      {sample ? <WallPreview style={sample} /> : null}

      <div className="rounded-md border border-dashed border-border p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" disabled={splitBusy} onClick={() => void reviewSplits()}>
            Review frameless splits
          </Button>
          <Button type="button" size="sm" disabled={splitBusy || readySplits.length === 0} onClick={() => setConfirmSplit(true)}>
            Apply {readySplits.length} detected splits
          </Button>
        </div>
        {splitRows ? (
          <ul className="max-h-64 space-y-1 overflow-auto text-sm">
            {splitRows.filter((row) => row.action !== "skip").map((row) => (
              <li key={row.styleId} className="flex flex-wrap items-center gap-2">
                <Badge variant={row.action === "ready" ? "secondary" : "outline"}>{row.action === "ready" ? "Ready" : "Manual review"}</Badge>
                <span>{row.code ? `${row.code} · ` : ""}{row.name}</span>
                <span className="text-xs text-muted-foreground">{row.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-md border border-dashed border-border p-3 space-y-3">
        <p className="text-sm font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> USCD manifest import</p>
        <p className="text-xs text-muted-foreground">
          Manifest fields: code, name, collection, PDF page, door file, drawer file. Matched to existing styles by code, then by name. The dry run lists matches, unmatched codes, missing files, and ambiguous codes.
        </p>
        <div className="flex flex-wrap gap-2">
          <label className="text-sm">
            <span className="sr-only">Manifest file</span>
            <input type="file" accept="application/json,.json,text/csv,.csv" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readManifest(file).catch(() => toast.error("That manifest could not be read."));
            }} />
          </label>
          <label className="text-sm">
            <span className="sr-only">Style image folder</span>
            <input
              type="file"
              multiple
              ref={(node) => node?.setAttribute("webkitdirectory", "")}
              onChange={(event) => rememberFiles(event.target.files)}
            />
          </label>
          <Button type="button" size="sm" variant="outline" disabled={!manifestRows} onClick={dryRun}>Dry run</Button>
          <Button type="button" size="sm" disabled={!importPlan || importPlan.ready.length === 0 || importBusy} onClick={() => setConfirmImport(true)}>
            Import {importPlan?.ready.length ?? 0} matches
          </Button>
        </div>
        {manifestErrors.length > 0 ? <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{manifestErrors[0]}</p> : null}
        {importPlan ? (
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {importPlan.ready.length} matched and ready</p>
            <p>{importPlan.unmatched.length} unmatched codes{importPlan.unmatched.slice(0, 8).map((row) => ` ${row.code}`).join(",")}</p>
            <p>{importPlan.missingFiles.length} missing door or drawer files{importPlan.missingFiles.slice(0, 6).map((item) => ` ${item.row.code}`).join(",")}</p>
            <p>{importPlan.ambiguous.length} ambiguous codes{importPlan.ambiguous.slice(0, 6).map((item) => ` ${item.row.code}`).join(",")}</p>
          </div>
        ) : null}
      </div>

      <AlertDialog open={confirmSplit} onOpenChange={setConfirmSplit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Store {readySplits.length} door and drawer-front clips?</AlertDialogTitle>
            <AlertDialogDescription>
              This uploads the clips and writes them to the existing door and drawer sample photos. The current door photo is kept as the combined source. Styles whose reveal was not detected are left unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applySplits()}>Apply splits</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={confirmImport} onOpenChange={setConfirmImport}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import {importPlan?.ready.length ?? 0} prepared styles?</AlertDialogTitle>
            <AlertDialogDescription>
              Only unique code matches with both files present are uploaded. Unmatched, missing, and ambiguous rows are skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyImport()}>Import matches</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
