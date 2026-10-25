/**
 * AddCabinetDialog — admin-only dialog to create a single new cabinet record.
 * Optionally creates a distributor SKU at the same time.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus } from "lucide-react";

const CATEGORIES = ["Base", "Wall", "Tall", "ADA", "Vanity", "Accessory", "Sink Base", "Drawer Base"];
const PLACEMENT_TYPES = ["base", "wall", "tall", "island"];
const HINGE_SIDES = ["left", "right", "both", "none"];

interface Props {
  onCreated?: (masterCode: string) => void;
}

export default function AddCabinetDialog({ onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [masterCode, setMasterCode] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Base");
  const [subCategory, setSubCategory] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");
  const [placementType, setPlacementType] = useState("base");
  const [numberOfDoors, setNumberOfDoors] = useState("");
  const [numberOfDrawers, setNumberOfDrawers] = useState("");
  const [hingeSide, setHingeSide] = useState("none");
  const [isActive, setIsActive] = useState(true);
  const [addSku, setAddSku] = useState(false);
  const [distributorId, setDistributorId] = useState("");
  const [styleId, setStyleId] = useState("");
  const [distributorSku, setDistributorSku] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [yourCost, setYourCost] = useState("");

  const distributorsQuery = trpc.distributors.list.useQuery();
  const stylesQuery = trpc.doorStyles.list.useQuery();

  const createMut = trpc.cabinets.adminCreateCabinet.useMutation({
    onSuccess: (data) => {
      toast.success(`Cabinet "${data.masterCode}" created successfully.${data.skuId ? " Distributor SKU added." : ""}`);
      setOpen(false);
      resetForm();
      onCreated?.(data.masterCode);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create cabinet.");
    },
  });

  function resetForm() {
    setMasterCode(""); setDescription(""); setCategory("Base"); setSubCategory("");
    setWidth(""); setHeight(""); setDepth(""); setPlacementType("base");
    setNumberOfDoors(""); setNumberOfDrawers(""); setHingeSide("none");
    setIsActive(true); setAddSku(false); setDistributorId(""); setStyleId("");
    setDistributorSku(""); setListPrice(""); setYourCost("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!masterCode.trim() || !description.trim() || !category) {
      toast.error("Master Code, Description, and Category are required.");
      return;
    }
    const input: Parameters<typeof createMut.mutate>[0] = {
      masterCode: masterCode.trim(),
      description: description.trim(),
      category,
      subCategory: subCategory.trim() || undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      depth: depth ? parseFloat(depth) : undefined,
      placementType: placementType || undefined,
      numberOfDoors: numberOfDoors ? parseInt(numberOfDoors) : undefined,
      numberOfDrawers: numberOfDrawers ? parseInt(numberOfDrawers) : undefined,
      hingeSide: hingeSide !== "none" ? hingeSide : undefined,
      isActive,
    };
    if (addSku && distributorId && styleId && distributorSku.trim()) {
      input.distributorSku = {
        distributorId: parseInt(distributorId),
        styleId: parseInt(styleId),
        distributorSku: distributorSku.trim(),
        listPrice: listPrice ? parseFloat(listPrice) : undefined,
        yourCost: yourCost ? parseFloat(yourCost) : undefined,
      };
    }
    createMut.mutate(input);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Cabinet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Cabinet</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Core fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Master Code <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. B24, DB-24-3"
                value={masterCode}
                onChange={(e) => setMasterCode(e.target.value.toUpperCase())}
                required
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Description <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 24 inch Base Cabinet"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sub-Category</Label>
              <Input
                placeholder="e.g. Drawer Base"
                value={subCategory}
                onChange={(e) => setSubCategory(e.target.value)}
              />
            </div>
          </div>

          {/* Dimensions */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Width (in)</Label>
              <Input type="number" step="0.5" placeholder="24" value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Height (in)</Label>
              <Input type="number" step="0.5" placeholder="34.5" value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Depth (in)</Label>
              <Input type="number" step="0.5" placeholder="24" value={depth} onChange={(e) => setDepth(e.target.value)} />
            </div>
          </div>

          {/* Design fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Placement Type</Label>
              <Select value={placementType} onValueChange={setPlacementType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLACEMENT_TYPES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hinge Side</Label>
              <Select value={hingeSide} onValueChange={setHingeSide}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HINGE_SIDES.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Doors</Label>
              <Input type="number" min="0" placeholder="0" value={numberOfDoors} onChange={(e) => setNumberOfDoors(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Drawers</Label>
              <Input type="number" min="0" placeholder="0" value={numberOfDrawers} onChange={(e) => setNumberOfDrawers(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} id="isActive" />
            <Label htmlFor="isActive">Active (visible in catalog)</Label>
          </div>

          {/* Optional SKU */}
          <Separator />
          <div className="flex items-center gap-2">
            <Switch checked={addSku} onCheckedChange={setAddSku} id="addSku" />
            <Label htmlFor="addSku">Also add a distributor SKU</Label>
          </div>
          {addSku && (
            <div className="space-y-3 pl-2 border-l-2 border-muted">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Distributor</Label>
                  <Select value={distributorId} onValueChange={setDistributorId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(distributorsQuery.data ?? []).map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Door Style</Label>
                  <Select value={styleId} onValueChange={setStyleId}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {(stylesQuery.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.ourName || s.styleCode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Distributor SKU <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. 3DB24"
                  value={distributorSku}
                  onChange={(e) => setDistributorSku(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>List Price ($)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Your Cost ($)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={yourCost} onChange={(e) => setYourCost(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? "Creating…" : "Create Cabinet"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
