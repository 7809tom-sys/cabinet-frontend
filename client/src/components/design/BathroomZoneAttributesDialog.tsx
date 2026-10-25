import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FURNITURE_CATALOG, resolvedFurnitureDimensions, type PlacedFurniture, type RoomData } from "@/lib/design";
import { resizeBathroomZone } from "@/lib/bathroomPlanning";

type Props = {
  item: PlacedFurniture | null;
  room: Pick<RoomData, "width" | "depth">;
  onClose: () => void;
  onSave: (item: PlacedFurniture) => void;
};

export default function BathroomZoneAttributesDialog({ item, room, onClose, onSave }: Props) {
  const [values, setValues] = useState({ widthIn: "60", depthIn: "36", x: "0", y: "0", rotation: "0" });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!item) return;
    const size = resolvedFurnitureDimensions(item);
    if (!size) return;
    setValues({ widthIn: String(size.w), depthIn: String(size.d), x: String(item.x), y: String(item.y), rotation: String(item.rotation) });
    setError("");
  }, [item]);
  const definition = item ? FURNITURE_CATALOG.find((candidate) => candidate.id === item.defId) : null;
  return <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-w-md" data-testid="bathroom-zone-attributes-dialog">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!item) return;
        if (Object.values(values).some((value) => value.trim() === "")) { setError("Enter all zone dimensions and positions."); return; }
        const result = resizeBathroomZone(item, { widthIn: Number(values.widthIn), depthIn: Number(values.depthIn), x: Number(values.x), y: Number(values.y), rotation: Number(values.rotation) }, room);
        if (!result.ok) { setError(result.error); return; }
        onSave(result.item);
        onClose();
      }}>
        <DialogHeader>
          <DialogTitle>Planning zone Attributes</DialogTitle>
          <DialogDescription>{definition?.name.split(" · ")[0]} — resize the reserved floor area, not the Pelican product. All measurements are in inches.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-4">
          {([
            ["widthIn", "Zone width (in)", 0.125], ["depthIn", "Zone depth (in)", 0.125],
            ["x", "From left wall (in)", 0], ["y", "From back wall (in)", 0],
          ] as const).map(([key, label, min]) => <div key={key} className="space-y-1">
            <Label htmlFor={`bathroom-zone-${key}`}>{label}</Label>
            <Input id={`bathroom-zone-${key}`} type="number" step="0.125" min={min} required value={values[key]} onChange={(event) => { setValues((previous) => ({ ...previous, [key]: event.target.value })); setError(""); }} />
          </div>)}
          <div className="col-span-2 space-y-1">
            <Label htmlFor="bathroom-zone-rotation">Zone rotation</Label>
            <select id="bathroom-zone-rotation" className="h-10 w-full rounded-md border bg-background px-3 text-foreground" value={values.rotation} onChange={(event) => setValues((previous) => ({ ...previous, rotation: event.target.value }))}>
              {[0, 90, 180, 270].map((rotation) => <option value={rotation} key={rotation}>{rotation}°</option>)}
            </select>
          </div>
        </div>
        <p className="mb-3 text-xs text-stone-600">Room: {room.width}″ × {room.depth}″. A wider tub can fit a larger planning zone. Existing fixtures do not move or stretch when the zone changes; reposition them as needed. Planning only, not an installation opening or a priced part.</p>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit">Apply zone Attributes</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
