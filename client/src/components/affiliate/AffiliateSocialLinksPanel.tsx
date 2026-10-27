import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { StorefrontSocialIcons } from "@/components/storefront/StorefrontSocialIcons";
import {
  SOCIAL_PLATFORM_LABELS,
  publicSocialLinks,
  sanitizeSocialLinkDrafts,
  type AffiliateSocialLink,
} from "@shared/affiliateSocialLinks";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";

function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length || from === to) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function AffiliateSocialLinksPanel({ affiliateId }: { affiliateId: number }) {
  const utils = trpc.useUtils();
  const query = trpc.affiliateSocial.get.useQuery({ affiliateId });
  const save = trpc.affiliateSocial.update.useMutation({
    onSuccess: () => {
      toast.success("Social links saved");
      utils.affiliateSocial.get.invalidate({ affiliateId });
    },
    onError: (error) => toast.error(error.message),
  });
  const [links, setLinks] = useState<AffiliateSocialLink[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    if (query.data?.links) setLinks(query.data.links);
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (query.error) return <p className="text-sm text-destructive">{query.error.message}</p>;

  const canEdit = query.data?.canEdit ?? false;
  const iconPreview = publicSocialLinks(links);

  function updateLink(index: number, patch: Partial<AffiliateSocialLink>) {
    setLinks((current) => current.map((link, itemIndex) => itemIndex === index ? { ...link, ...patch } : link));
  }

  function saveLinks() {
    const cleaned = sanitizeSocialLinkDrafts(links);
    if (!cleaned.ok) {
      toast.error(cleaned.message);
      return;
    }
    save.mutate({ affiliateId, links: cleaned.links });
  }

  return (
    <div className="space-y-5" data-testid="my-social-links">
      <div>
        <h3 className="font-semibold">My Social Links</h3>
        <p className="text-sm text-muted-foreground mt-1">
          These icons appear on your public storefront header, footer, and mobile menu. They stay inside the affiliate portal until you turn them on.
        </p>
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          We only need your public profile link. Do not enter a social media password or login token.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4">
        <p className="text-xs font-medium text-muted-foreground mb-2">Live preview</p>
        {iconPreview.length ? <StorefrontSocialIcons links={iconPreview} /> : <p className="text-sm text-muted-foreground">Icons appear here when a link is filled in and visible.</p>}
      </div>

      <div className="space-y-3">
        {links.map((link, index) => (
          <div
            key={link.id}
            draggable={canEdit}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex === null) return;
              setLinks((current) => move(current, dragIndex, index));
              setDragIndex(null);
            }}
            className="rounded-lg border border-border p-3 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">{link.platform === "custom" ? "Custom link" : SOCIAL_PLATFORM_LABELS[link.platform]}</p>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={`show-${link.id}`} className="text-xs text-muted-foreground">Show</Label>
                <Switch id={`show-${link.id}`} checked={link.enabled} disabled={!canEdit} onCheckedChange={(checked) => updateLink(index, { enabled: checked })} />
                <Button type="button" variant="ghost" size="icon" disabled={!canEdit} aria-label="Move up" onClick={() => setLinks((current) => move(current, index, index - 1))}><ChevronUp className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" disabled={!canEdit} aria-label="Move down" onClick={() => setLinks((current) => move(current, index, index + 1))}><ChevronDown className="h-4 w-4" /></Button>
                {link.platform === "custom" ? (
                  <Button type="button" variant="ghost" size="icon" disabled={!canEdit} aria-label="Remove custom link" onClick={() => setLinks((current) => current.filter((_, itemIndex) => itemIndex !== index))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            {link.platform === "custom" ? (
              <Input aria-label="Custom link label" value={link.label} disabled={!canEdit} placeholder="Label" onChange={(event) => updateLink(index, { label: event.target.value })} />
            ) : null}
            <Input
              aria-label={`${SOCIAL_PLATFORM_LABELS[link.platform]} profile URL`}
              value={link.url}
              disabled={!canEdit}
              placeholder="https://"
              onChange={(event) => updateLink(index, { url: event.target.value })}
            />
            <Input
              aria-label={`${SOCIAL_PLATFORM_LABELS[link.platform]} handle`}
              value={link.handle ?? ""}
              disabled={!canEdit}
              placeholder="Public handle (optional)"
              onChange={(event) => updateLink(index, { handle: event.target.value })}
            />
          </div>
        ))}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="gap-1.5" onClick={() => setLinks((current) => [...current, {
            id: `custom-${Date.now()}`,
            platform: "custom",
            label: "",
            url: "",
            handle: null,
            enabled: true,
            sortOrder: current.length,
          }])}>
            <Plus className="h-4 w-4" /> Add custom link
          </Button>
          <Button type="button" onClick={saveLinks} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save social links"}</Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You can view these links. The store owner can allow a team member to edit them.</p>
      )}
    </div>
  );
}
