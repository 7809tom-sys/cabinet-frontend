// ─── Demo distributor: My designs (no login; this browser only) ──────────────

import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { FolderOpen, Pencil, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DEMO_DISTRIBUTOR, DEMO_LINES, demoLineScene } from "@/lib/demoDistributor";
import {
  MY_DESIGNS_ROUTE,
  deleteSavedDesign,
  listSavedDesigns,
  loadSavedDesignIntoDesigner,
  openSavedDesignHref,
  renameSavedDesign,
  saveCurrentDesign,
  type DemoSavedDesign,
} from "@/lib/demoSavedDesigns";

export const MY_DESIGNS_COPY = {
  title: "My designs",
  intro: "Designs you saved in this browser. No account needed. Click one to keep working on it.",
  empty: "No saved designs yet. Open the designer, plan a kitchen and press “Save design”.",
  save: "Save design",
  saveTitle: "Save this design",
  saveHelp: "Saved in this browser only, so you can reopen it later from My designs.",
  nothingToSave: "Nothing to save yet. Add a room or a cabinet first.",
  saved: (name: string) => `Saved “${name}”.`,
  open: "Open",
  rename: "Rename",
  delete: "Delete",
} as const;

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

function useSavedDesigns(): [DemoSavedDesign[], () => void] {
  const [list, setList] = useState<DemoSavedDesign[]>([]);
  const refresh = () => {
    const s = storage();
    setList(s ? listSavedDesigns(s) : []);
  };
  useEffect(refresh, []);
  return [list, refresh];
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function MyDesignsList({ compact = false }: { compact?: boolean }) {
  const [list, refresh] = useSavedDesigns();
  const [editing, setEditing] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  if (list.length === 0) return <p className="text-sm text-muted-foreground">{MY_DESIGNS_COPY.empty}</p>;
  return (
    <ul className={compact ? "space-y-2" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
      {list.map((d) => {
        const line = DEMO_LINES.find((l) => l.id === d.lineId) ?? null;
        const openHref = `${MY_DESIGNS_ROUTE}?open=${d.id}`;
        return (
          <li key={d.id} data-design-id={d.id} className="overflow-hidden rounded-lg border bg-white">
            {!compact && (
              <Link href={openHref} className="block aspect-video bg-muted" aria-label={`${MY_DESIGNS_COPY.open} ${d.name}`}>
                <img src={demoLineScene(line ?? DEMO_LINES[0])} alt="" className="h-full w-full object-cover" loading="lazy" />
              </Link>
            )}
            <div className="space-y-1 p-3 text-sm">
              {editing === d.id ? (
                <form
                  className="flex gap-2"
                  onSubmit={(e: FormEvent) => { e.preventDefault(); const s = storage(); if (s) renameSavedDesign(s, d.id, draftName); setEditing(null); refresh(); }}
                >
                  <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="h-8" aria-label="Design name" autoFocus />
                  <Button type="submit" size="sm" variant="outline">Save</Button>
                </form>
              ) : (
                <Link href={openHref} className="font-semibold hover:underline">{d.name}</Link>
              )}
              <p className="text-xs text-muted-foreground">{formatDate(d.savedAt)} · {line ? line.name : "Line not set"} · {d.cabinetCount} cabinets</p>
              <div className="flex gap-1 pt-1">
                <Link href={openHref}><Button size="sm" className="h-7 gap-1 text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}><FolderOpen className="h-3.5 w-3.5" aria-hidden /> {MY_DESIGNS_COPY.open}</Button></Link>
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { setEditing(d.id); setDraftName(d.name); }}><Pencil className="h-3.5 w-3.5" aria-hidden /> {MY_DESIGNS_COPY.rename}</Button>
                <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => { const s = storage(); if (s) deleteSavedDesign(s, d.id); refresh(); }}><Trash2 className="h-3.5 w-3.5" aria-hidden /> {MY_DESIGNS_COPY.delete}</Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** /distributor-preview/designs. `?open=<id>` restores that design and opens the designer. */
export function MyDesignsSection() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const openId = new URLSearchParams(search).get("open");
  useEffect(() => {
    if (!openId) return;
    const s = storage();
    if (!s) return;
    const design = listSavedDesigns(s).find((d) => d.id === openId);
    // Runs after the designer (if it was open) has unmounted and saved its own draft.
    if (design && loadSavedDesignIntoDesigner(s, openId)) navigate(openSavedDesignHref(design));
  }, [openId, navigate]);
  return (
    <section className="container py-10 space-y-5">
      <div className="max-w-3xl space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold">{MY_DESIGNS_COPY.title}</h1>
        <p className="text-muted-foreground">{MY_DESIGNS_COPY.intro}</p>
      </div>
      <MyDesignsList />
    </section>
  );
}

/** Shell controls: Save design (named) and a My designs panel with rename/delete/open. */
/** `showMyDesigns={false}`: the designer header already links My designs in its menu. */
export function DesignerSaveControls({ showMyDesigns = true }: { showMyDesigns?: boolean } = {}) {
  const [saveOpen, setSaveOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const s = storage();
    const saved = s ? saveCurrentDesign(s, name || `My design ${listSavedDesigns(s).length + 1}`) : null;
    setStatus(saved ? MY_DESIGNS_COPY.saved(saved.name) : MY_DESIGNS_COPY.nothingToSave);
    if (saved) { setName(""); setTimeout(() => setSaveOpen(false), 900); }
  };
  return (
    <>
      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setStatus(null); setSaveOpen(true); }} data-testid="designer-save"><Save className="h-4 w-4" aria-hidden /> {MY_DESIGNS_COPY.save}</Button>
      {showMyDesigns && <Button size="sm" variant="outline" onClick={() => setListOpen(true)} data-testid="designer-my-designs">{MY_DESIGNS_COPY.title}</Button>}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{MY_DESIGNS_COPY.saveTitle}</DialogTitle>
            <DialogDescription>{MY_DESIGNS_COPY.saveHelp}</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. Smith kitchen" aria-label="Design name" />
            <Button type="submit" className="text-white" style={{ backgroundColor: DEMO_DISTRIBUTOR.primaryColor }}>Save</Button>
          </form>
          {status && <p className="text-sm" role="status">{status}</p>}
        </DialogContent>
      </Dialog>
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{MY_DESIGNS_COPY.title}</DialogTitle>
            <DialogDescription>{MY_DESIGNS_COPY.intro}</DialogDescription>
          </DialogHeader>
          {listOpen && <MyDesignsList compact />}
          <Link href={MY_DESIGNS_ROUTE} className="text-sm underline" style={{ color: DEMO_DISTRIBUTOR.primaryColor }}>Open the My designs page</Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
