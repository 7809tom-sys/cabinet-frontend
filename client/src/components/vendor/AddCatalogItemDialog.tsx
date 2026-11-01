import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  PELICAN_CODE_MAX,
  PELICAN_DESCRIPTION_MAX,
  PELICAN_NAME_MAX,
  PELICAN_SIZE_MAX,
  type AddCatalogItemDraft,
} from "@/lib/vendorCatalogAddItem";

export function AddCatalogItemDialog({
  open,
  pending,
  draft,
  categories,
  subcategories,
  subcategoriesLoading = false,
  browseLabel,
  onDraft,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  draft: AddCatalogItemDraft;
  categories: readonly string[];
  subcategories: readonly string[];
  subcategoriesLoading?: boolean;
  browseLabel: string | null;
  onDraft: (draft: AddCatalogItemDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const set = (patch: Partial<AddCatalogItemDraft>) => onDraft({ ...draft, ...patch });
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" data-testid="vendor-add-item-dialog">
        <DialogHeader>
          <DialogTitle>Add item</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {browseLabel
              ? `Adding to ${browseLabel}. Name is required. Category and sub-category can be changed.`
              : "Choose a category and sub-category. Name is required. Code, description, size, prices, and coverage are optional."}
            {" "}Photos are uploaded on the next screen.
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="vendor-add-item-name">Product name</Label>
            <Input
              id="vendor-add-item-name"
              data-testid="vendor-add-item-name"
              value={draft.name}
              maxLength={PELICAN_NAME_MAX}
              onChange={(event) => set({ name: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-category">Category</Label>
              <Select value={draft.category || undefined} onValueChange={(category) => set({ category, subCategory: draft.category === category ? draft.subCategory : "" })}>
                <SelectTrigger id="vendor-add-item-category" aria-label="Category" data-testid="vendor-add-item-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-subcategory">Sub-category</Label>
              <Select
                value={subcategories.includes(draft.subCategory) ? draft.subCategory : undefined}
                onValueChange={(subCategory) => set({ subCategory })}
                disabled={!draft.category || subcategories.length === 0}
              >
                <SelectTrigger id="vendor-add-item-subcategory" aria-label="Sub-category" data-testid="vendor-add-item-subcategory">
                  <SelectValue placeholder={subcategoriesLoading ? "Loading sub-categories…" : draft.category ? "Choose a sub-category" : "Choose a category first"} />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((subCategory) => (
                    <SelectItem key={subCategory} value={subCategory}>{subCategory}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!subcategoriesLoading && draft.category && subcategories.length === 0 && (
                <p className="text-xs text-muted-foreground">No sub-categories are on file for this category.</p>
              )}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendor-add-item-code">Code / SKU</Label>
            <Input
              id="vendor-add-item-code"
              data-testid="vendor-add-item-code"
              value={draft.code}
              maxLength={PELICAN_CODE_MAX}
              placeholder="Optional. A code is generated when this is blank."
              onChange={(event) => set({ code: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="vendor-add-item-description">Description</Label>
            <Textarea
              id="vendor-add-item-description"
              data-testid="vendor-add-item-description"
              rows={3}
              value={draft.description}
              maxLength={PELICAN_DESCRIPTION_MAX}
              onChange={(event) => set({ description: event.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-size">Size</Label>
              <Input
                id="vendor-add-item-size"
                data-testid="vendor-add-item-size"
                value={draft.size}
                maxLength={PELICAN_SIZE_MAX}
                onChange={(event) => set({ size: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-coverage">Coverage (sq ft)</Label>
              <Input
                id="vendor-add-item-coverage"
                data-testid="vendor-add-item-coverage"
                inputMode="decimal"
                value={draft.coverageSqFt}
                onChange={(event) => set({ coverageSqFt: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-list-price">List price</Label>
              <Input
                id="vendor-add-item-list-price"
                data-testid="vendor-add-item-list-price"
                inputMode="decimal"
                value={draft.listPrice}
                onChange={(event) => set({ listPrice: event.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vendor-add-item-msrp">MSRP</Label>
              <Input
                id="vendor-add-item-msrp"
                data-testid="vendor-add-item-msrp"
                inputMode="decimal"
                value={draft.msrp}
                onChange={(event) => set({ msrp: event.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="button" data-testid="vendor-add-item-submit" onClick={onSubmit} disabled={pending || !draft.name.trim()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
