import { useState } from "react";
import { Pin, Plus, Save, StickyNote, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AdminStickyNoteRichText, AdminStickyNoteRichTextEditor } from "./AdminStickyNoteRichText";

const NOTE_COLORS = [
  { value: "yellow", label: "Yellow", className: "border-amber-300 bg-amber-100 text-amber-950" },
  { value: "peach", label: "Peach", className: "border-orange-300 bg-orange-100 text-orange-950" },
  { value: "mint", label: "Mint", className: "border-emerald-300 bg-emerald-100 text-emerald-950" },
  { value: "sky", label: "Sky", className: "border-sky-300 bg-sky-100 text-sky-950" },
  { value: "violet", label: "Violet", className: "border-violet-300 bg-violet-100 text-violet-950" },
  { value: "rose", label: "Rose", className: "border-rose-300 bg-rose-100 text-rose-950" },
] as const;

type StickyNote = {
  id: number;
  title: string | null;
  body: string;
  color: string;
  isPinned: boolean;
  authorName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function noteColor(color: string) {
  return NOTE_COLORS.find((option) => option.value === color)?.className ?? NOTE_COLORS[0].className;
}

const AUTHOR_NOTE_COLORS = {
  tom: {
    label: "Blue — Tom",
    cardClassName: "border-sky-300 bg-sky-100 text-sky-950",
    badgeClassName: "border-sky-300 bg-sky-700 text-white",
  },
  rich: {
    label: "Green — Rich",
    cardClassName: "border-emerald-300 bg-emerald-100 text-emerald-950",
    badgeClassName: "border-emerald-300 bg-emerald-700 text-white",
  },
  selena: {
    label: "Purple — Selena",
    cardClassName: "border-violet-300 bg-violet-100 text-violet-950",
    badgeClassName: "border-violet-300 bg-violet-700 text-white",
  },
} as const;

function authorNoteColor(authorName: string | null, fallbackColor: string) {
  const normalizedName = authorName?.trim().toLowerCase() ?? "";
  const assignment = AUTHOR_NOTE_COLORS[normalizedName as keyof typeof AUTHOR_NOTE_COLORS];
  if (assignment) return assignment;

  const fallback = NOTE_COLORS.find((option) => option.value === fallbackColor) ?? NOTE_COLORS[0];
  return {
    label: `${fallback.label} — ${authorName || "Administrator"}`,
    cardClassName: fallback.className,
    badgeClassName: "border-current/30 bg-white/60 text-current",
  };
}

function localTimestamp(value: Date) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminStickyNotes() {
  const utils = trpc.useUtils();
  const { data, isLoading, error, refetch } = trpc.adminStickyNotes.list.useQuery();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [color, setColor] = useState<(typeof NOTE_COLORS)[number]["value"]>("yellow");
  const [editing, setEditing] = useState<StickyNote | null>(null);

  const refresh = () => utils.adminStickyNotes.list.invalidate();
  const create = trpc.adminStickyNotes.create.useMutation({
    onSuccess: () => {
      setTitle("");
      setBody("");
      setColor("yellow");
      refresh();
      toast.success("Shared note posted.");
    },
    onError: (error) => toast.error(error.message),
  });
  const update = trpc.adminStickyNotes.update.useMutation({
    onSuccess: () => {
      setEditing(null);
      refresh();
      toast.success("Shared note updated.");
    },
    onError: (error) => toast.error(error.message),
  });
  const remove = trpc.adminStickyNotes.remove.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Shared note removed.");
    },
    onError: (error) => toast.error(error.message),
  });

  const notes = (data ?? []) as StickyNote[];
  return (
    <section className="space-y-5" aria-labelledby="team-notes-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><StickyNote className="h-5 w-5 text-amber-700" /><h2 id="team-notes-title" className="font-serif text-2xl font-bold">Team Notes</h2></div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Private working notes for CabinetDealz administrators. Notes are not visible to customers, affiliates, vendors, designers, or sales representatives.</p>
        </div>
      </div>

      <Card className="border-violet-200 bg-violet-50 shadow-sm" aria-label="Affiliate wildcard DNS setup note">
        <CardContent className="space-y-2 pt-4 text-sm text-violet-950">
          <p className="font-semibold">Affiliate wildcard DNS — Hostinger setup</p>
          <p>
            In <strong>Hostinger hPanel → Domains → DNS Zone → cabinetdealz.com</strong>, add one wildcard CNAME so every affiliate subdomain can resolve automatically.
          </p>
          <div className="grid gap-1 rounded-md border border-violet-200 bg-white p-2 font-mono text-xs sm:grid-cols-4">
            <span>Type: CNAME</span><span>Name: *</span><span className="sm:col-span-2 break-all">Points to: {import.meta.env.VITE_AFFILIATE_DNS_TARGET || "(set VITE_AFFILIATE_DNS_TARGET to the site's hosting domain)"}</span><span>TTL: 3600 or default</span>
          </div>
          <p className="text-xs text-violet-900/80">Do not replace existing <code>@</code>, <code>www</code>, or working affiliate DNS records. The wildcard only routes the web address; each affiliate retains separate branding and storefront settings.</p>
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-amber-950">Post a shared sticky note</p><label className="flex items-center gap-2 text-xs font-medium text-amber-900">Color<select aria-label="New note color" value={color} onChange={(event) => setColor(event.target.value as typeof color)} className="rounded border border-amber-300 bg-white px-2 py-1 text-amber-950">{NOTE_COLORS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title (optional)" maxLength={120} aria-label="New note title" className="bg-white" />
          <AdminStickyNoteRichTextEditor value={body} onChange={setBody} ariaLabel="New note text" />
          <div className="flex justify-end"><Button type="button" disabled={!body.trim() || create.isPending} onClick={() => create.mutate({ title: title.trim() || null, body: body.trim(), color, isPinned: false })} className="gap-2 bg-[var(--color-navy)] text-white"><Plus className="h-4 w-4" /> Post note</Button></div>
        </CardContent>
      </Card>

      {isLoading && <div className="flex justify-center py-10"><Spinner className="h-6 w-6 text-primary" /></div>}
      {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">Couldn’t load team notes: {error.message}<Button variant="outline" size="sm" onClick={() => refetch()} className="ml-3">Retry</Button></div>}
      {!isLoading && !error && notes.length === 0 && <div className="rounded-xl border border-dashed border-muted-foreground/30 px-5 py-12 text-center"><StickyNote className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 font-medium">No shared notes yet</p><p className="mt-1 text-sm text-muted-foreground">Post the first internal update for the administrator team.</p></div>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {notes.map((note) => {
          const isEditing = editing?.id === note.id;
          const authorColor = authorNoteColor(note.authorName, note.color);
          return <Card key={note.id} className={`min-h-56 border-2 shadow-sm transition-transform duration-150 hover:-translate-y-0.5 ${authorColor.cardClassName}`}>
            <CardContent className="flex h-full flex-col gap-3 p-4">
              {isEditing ? <>
                <Input value={editing.title ?? ""} onChange={(event) => setEditing({ ...editing, title: event.target.value || null })} placeholder="Title (optional)" maxLength={120} aria-label="Edit note title" className="bg-white/80" />
                <AdminStickyNoteRichTextEditor value={editing.body} onChange={(body) => setEditing({ ...editing, body })} rows={5} ariaLabel="Edit note text" className="flex-1 bg-white/80" />
                <div className="flex flex-wrap items-center justify-between gap-2"><select aria-label="Edit note color" value={editing.color} onChange={(event) => setEditing({ ...editing, color: event.target.value })} className="rounded border border-current/30 bg-white/80 px-2 py-1 text-xs">{NOTE_COLORS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button><Button type="button" size="sm" disabled={!editing.body.trim() || update.isPending} onClick={() => update.mutate({ id: editing.id, title: editing.title, body: editing.body.trim(), color: editing.color as (typeof NOTE_COLORS)[number]["value"], isPinned: editing.isPinned })} className="gap-1 bg-white/80 text-current hover:bg-white"><Save className="h-3.5 w-3.5" /> Save</Button></div></div>
              </> : <>
                <div className="flex items-start justify-between gap-2">{note.title ? <h3 className="font-semibold leading-snug">{note.title}</h3> : <span />}{note.isPinned && <span className="inline-flex items-center gap-1 rounded-full border border-current/30 bg-white/60 px-2 py-1 text-[10px] font-bold uppercase tracking-wide"><Pin className="h-3 w-3" /> Pinned</span>}</div>
                <AdminStickyNoteRichText value={note.body} />
                <div className="mt-auto space-y-3 border-t border-current/15 pt-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${authorColor.badgeClassName}`}>{authorColor.label}</span><p className="text-[11px] opacity-80">updated {localTimestamp(note.updatedAt)}</p></div><div className="flex items-center justify-between"><Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-current hover:bg-white/60" onClick={() => update.mutate({ id: note.id, isPinned: !note.isPinned })}><Pin className="h-3.5 w-3.5" /> {note.isPinned ? "Unpin" : "Pin"}</Button><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-current hover:bg-white/60" onClick={() => setEditing(note)}>Edit</Button><Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-current hover:bg-white/60" onClick={() => { if (window.confirm("Remove this shared note for every administrator?")) remove.mutate({ id: note.id }); }} aria-label={`Remove ${note.title || "shared note"}`}><Trash2 className="h-4 w-4" /></Button></div></div></div>
              </>}
            </CardContent>
          </Card>;
        })}
      </div>
    </section>
  );
}
