import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImageIcon, Plus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import {
  MAX_ROOM_SCENE_PHOTOS_PER_STYLE,
  PRESET_ROOM_SCENE_NAMES,
  ROOM_SCENE_IMAGE_TYPES,
  ROOM_SCENE_MAX_BYTES,
  groupRoomScenes,
  roomSceneImageError,
  type RoomScenePhoto,
} from "@shared/vendorRoomScenes";

type StyleOption = { id: number; ourName: string };
type CabinetOption = { cabinetId: number; masterCode: string };

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Upload and place photos inside the existing Featured Styles / Door Styles room scene library. */
export function VendorRoomSceneLibrary({
  styleId,
  styleName,
  distributorId,
  styles,
  cabinets,
  onChanged,
}: {
  styleId: number;
  styleName: string;
  distributorId?: number;
  styles: StyleOption[];
  cabinets: CabinetOption[];
  onChanged?: () => void;
}) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const photosQuery = trpc.distributorPortal.ownRoomScenes.useQuery(distributorId ? { distributorId } : undefined);
  const catalogQuery = trpc.distributorPortal.catalog.useQuery({
    ...(distributorId ? { distributorId } : {}),
    styleId,
    limit: 100,
    offset: 0,
  });
  const taggableCabinets = cabinets.length > 0
    ? cabinets
    : (catalogQuery.data?.items ?? []).flatMap((item) => item.cabinetId ? [{ cabinetId: item.cabinetId, masterCode: item.masterCode ?? item.platformSku ?? `SKU ${item.skuId}` }] : []);
  const photos = useMemo(
    () => (photosQuery.data ?? []).filter((photo) => photo.styleId === styleId) as RoomScenePhoto[],
    [photosQuery.data, styleId],
  );
  const scenes = useMemo(() => groupRoomScenes(photos), [photos]);
  const [sceneName, setSceneName] = useState<string>(PRESET_ROOM_SCENE_NAMES[0]);
  const [customName, setCustomName] = useState("");
  const [description, setDescription] = useState("");
  const [tagPhotoId, setTagPhotoId] = useState<number | null>(null);
  const line = distributorId ? { distributorId } : {};
  const refresh = () => {
    void utils.distributorPortal.ownRoomScenes.invalidate();
    void utils.distributorPortal.featuredStyles.invalidate();
    void utils.distributorPortal.myLine.invalidate();
    onChanged?.();
  };
  const fail = (error: { message: string }) => toast.error(error.message);
  const upload = trpc.distributorPortal.uploadFeaturedStyleScenePhoto.useMutation({ onSuccess: () => { toast.success("Room scene photo added"); refresh(); }, onError: fail });
  const rename = trpc.distributorPortal.renameFeaturedStyleScene.useMutation({ onSuccess: refresh, onError: fail });
  const reorderScenes = trpc.distributorPortal.reorderFeaturedStyleScenes.useMutation({ onSuccess: refresh, onError: fail });
  const reorderPhotos = trpc.distributorPortal.reorderFeaturedStyleScenePhotos.useMutation({ onSuccess: refresh, onError: fail });
  const movePhoto = trpc.distributorPortal.moveFeaturedStyleScenePhoto.useMutation({ onSuccess: () => { toast.success("Photo moved"); refresh(); }, onError: fail });
  const setCover = trpc.distributorPortal.setFeaturedStyleSceneCover.useMutation({ onSuccess: refresh, onError: fail });
  const tagPhoto = trpc.distributorPortal.tagFeaturedStyleScenePhoto.useMutation({ onSuccess: () => { toast.success("Photo tags saved"); setTagPhotoId(null); refresh(); }, onError: fail });
  const removePhoto = trpc.distributorPortal.deleteFeaturedStyleScene.useMutation({ onSuccess: refresh, onError: fail });
  const removeScene = trpc.distributorPortal.deleteFeaturedStyleSceneGroup.useMutation({ onSuccess: () => { toast.success("Room scene removed"); refresh(); }, onError: fail });

  const chosenName = sceneName === "custom" ? customName : sceneName;
  const atLimit = photos.length >= MAX_ROOM_SCENE_PHOTOS_PER_STYLE;

  const handleFile = async (file: File) => {
    const contentType = file.type;
    if (!ROOM_SCENE_IMAGE_TYPES.includes(contentType as typeof ROOM_SCENE_IMAGE_TYPES[number])) {
      toast.error("Room scene photos must be JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > ROOM_SCENE_MAX_BYTES) {
      toast.error("Room scene photos must be 8 MB or smaller.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const imageError = roomSceneImageError(bytes, contentType);
    if (imageError) { toast.error(imageError); return; }
    const imageBase64 = await readFile(file);
    upload.mutate({
      ...line,
      styleId,
      sceneName: chosenName.trim() || "Kitchen",
      sceneDescription: description.trim() || null,
      imageBase64,
      contentType: contentType as "image/jpeg" | "image/png" | "image/webp",
      fileName: file.name,
    });
  };

  const moveScene = (index: number, direction: -1 | 1) => {
    const names = scenes.map((scene) => scene.name);
    const target = index + direction;
    if (target < 0 || target >= names.length) return;
    [names[index], names[target]] = [names[target], names[index]];
    reorderScenes.mutate({ ...line, styleId, orderedNames: names });
  };

  return (
    <div data-testid="vendor-room-scene-library" className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
      <div>
        <Label>Room scenes ({photos.length}/{MAX_ROOM_SCENE_PHOTOS_PER_STYLE})</Label>
        <p className="text-xs text-muted-foreground">Upload a photo and place it in a Kitchen, Bathroom, Laundry, or custom scene for {styleName}. You can only change photos from your own line.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          Scene
          <select className="h-8 w-full rounded-md border bg-background px-2 text-sm" value={sceneName} onChange={(event) => setSceneName(event.target.value)} aria-label="Room scene name">
            {PRESET_ROOM_SCENE_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
            {scenes.filter((scene) => !PRESET_ROOM_SCENE_NAMES.includes(scene.name as typeof PRESET_ROOM_SCENE_NAMES[number])).map((scene) => <option key={scene.name} value={scene.name}>{scene.name}</option>)}
            <option value="custom">Custom name</option>
          </select>
        </label>
        {sceneName === "custom" && <label className="space-y-1 text-xs">Custom name<Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Mudroom" /></label>}
        <label className="space-y-1 text-xs sm:col-span-2">Description (optional)<Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="White shaker kitchen with island" /></label>
      </div>
      <input ref={fileRef} type="file" accept={ROOM_SCENE_IMAGE_TYPES.join(",")} className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); event.target.value = ""; }} />
      <Button type="button" size="sm" disabled={atLimit || upload.isPending || (sceneName === "custom" && !customName.trim())} onClick={() => fileRef.current?.click()}>
        <Upload className="mr-1 h-3.5 w-3.5" />{upload.isPending ? "Uploading…" : "Upload photo into this scene"}
      </Button>
      {atLimit && <p className="text-xs text-amber-800">This door style already has six room scene photos.</p>}
      {scenes.map((scene, sceneIndex) => (
        <div key={scene.name} className="space-y-2 rounded-md border border-emerald-200 bg-background p-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input aria-label={`Rename ${scene.name}`} defaultValue={scene.name} key={`${scene.name}-name`} className="h-8 max-w-[180px]" onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== scene.name) rename.mutate({ ...line, styleId, fromName: scene.name, name: next, description: scene.description });
            }} />
            <Input aria-label={`${scene.name} description`} defaultValue={scene.description ?? ""} key={`${scene.name}-description`} placeholder="Optional description" className="h-8 min-w-[160px] flex-1" onBlur={(event) => {
              const next = event.target.value.trim();
              if (next !== (scene.description ?? "")) rename.mutate({ ...line, styleId, fromName: scene.name, name: scene.name, description: next || null });
            }} />
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={sceneIndex === 0} aria-label={`Move ${scene.name} scene up`} onClick={() => moveScene(sceneIndex, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={sceneIndex === scenes.length - 1} aria-label={`Move ${scene.name} scene down`} onClick={() => moveScene(sceneIndex, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Delete ${scene.name} scene`} onClick={() => removeScene.mutate({ ...line, styleId, sceneName: scene.name })}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {scene.photos.map((photo, photoIndex) => (
              <div key={photo.id} className="space-y-1 rounded border border-border p-1">
                <img src={photo.imageUrl} alt={`${scene.name} photo ${photoIndex + 1}`} className="h-20 w-full rounded object-cover" />
                <div className="flex flex-wrap gap-1">
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={photoIndex === 0} aria-label="Move photo earlier" onClick={() => {
                    const orderedIds = scene.photos.map((item) => item.id);
                    [orderedIds[photoIndex - 1], orderedIds[photoIndex]] = [orderedIds[photoIndex], orderedIds[photoIndex - 1]];
                    reorderPhotos.mutate({ ...line, styleId, sceneName: scene.name, orderedIds });
                  }}><ArrowUp className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={photoIndex === scene.photos.length - 1} aria-label="Move photo later" onClick={() => {
                    const orderedIds = scene.photos.map((item) => item.id);
                    [orderedIds[photoIndex + 1], orderedIds[photoIndex]] = [orderedIds[photoIndex], orderedIds[photoIndex + 1]];
                    reorderPhotos.mutate({ ...line, styleId, sceneName: scene.name, orderedIds });
                  }}><ArrowDown className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant={photo.isCover ? "default" : "ghost"} className="h-7 w-7" aria-label="Set cover photo" onClick={() => setCover.mutate({ ...line, photoId: photo.id })}><Star className="h-3.5 w-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Delete photo" onClick={() => removePhoto.mutate({ ...line, sceneId: photo.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
                <label className="block text-[10px] text-muted-foreground">Move to
                  <select className="mt-0.5 w-full rounded border bg-background px-1 py-0.5" aria-label={`Move photo ${photo.id}`} value={`${styleId}::${scene.name}`} onChange={(event) => {
                    const [nextStyle, nextScene] = event.target.value.split("::");
                    movePhoto.mutate({ ...line, photoId: photo.id, styleId: Number(nextStyle), sceneName: nextScene });
                  }}>
                    {scenes.map((target) => <option key={target.name} value={`${styleId}::${target.name}`}>{target.name}</option>)}
                    {styles.filter((style) => style.id !== styleId).map((style) => <option key={style.id} value={`${style.id}::${scene.name}`}>{style.ourName}</option>)}
                  </select>
                </label>
                <Button type="button" size="sm" variant="outline" className="h-7 w-full text-[11px]" onClick={() => setTagPhotoId(photo.id)}><Plus className="mr-1 h-3 w-3" />Tag items</Button>
                {tagPhotoId === photo.id && (
                  <TagEditor
                    cabinets={taggableCabinets}
                    styles={styles}
                    cabinetIds={photo.taggedCabinetIds ?? []}
                    styleIds={photo.taggedStyleIds ?? []}
                    pending={tagPhoto.isPending}
                    onSave={(cabinetIds, styleIds) => tagPhoto.mutate({ ...line, photoId: photo.id, cabinetIds, styleIds })}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      {photosQuery.isLoading && <p className="text-xs text-muted-foreground"><ImageIcon className="mr-1 inline h-3.5 w-3.5" />Loading room scenes…</p>}
    </div>
  );
}

function TagEditor({
  cabinets,
  styles,
  cabinetIds,
  styleIds,
  pending,
  onSave,
}: {
  cabinets: CabinetOption[];
  styles: StyleOption[];
  cabinetIds: number[];
  styleIds: number[];
  pending: boolean;
  onSave: (cabinetIds: number[], styleIds: number[]) => void;
}) {
  const [cabinetsSelected, setCabinetsSelected] = useState(cabinetIds);
  const [stylesSelected, setStylesSelected] = useState(styleIds);
  const toggle = (list: number[], id: number, setList: (ids: number[]) => void) => {
    setList(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  };
  return (
    <div className="space-y-1 rounded border border-dashed p-1">
      <p className="text-[10px] font-medium">Your catalog</p>
      <div className="max-h-24 space-y-1 overflow-y-auto">
        {cabinets.slice(0, 40).map((cabinet) => (
          <label key={cabinet.cabinetId} className="flex items-center gap-1 text-[10px]">
            <input type="checkbox" checked={cabinetsSelected.includes(cabinet.cabinetId)} onChange={() => toggle(cabinetsSelected, cabinet.cabinetId, setCabinetsSelected)} />
            {cabinet.masterCode}
          </label>
        ))}
        {styles.map((style) => (
          <label key={style.id} className="flex items-center gap-1 text-[10px]">
            <input type="checkbox" checked={stylesSelected.includes(style.id)} onChange={() => toggle(stylesSelected, style.id, setStylesSelected)} />
            {style.ourName}
          </label>
        ))}
      </div>
      <Button type="button" size="sm" className="h-7 w-full text-[11px]" disabled={pending} onClick={() => onSave(cabinetsSelected, stylesSelected)}>Save tags</Button>
    </div>
  );
}
