import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronRight,
  FolderTree,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export function CategoriesAdmin() {
  const utils = trpc.useUtils();
  const { data: categories, isLoading } = trpc.cabinetCategories.list.useQuery();

  // State for adding new category
  const [newCatName, setNewCatName] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  // State for editing a category
  const [editingCatId, setEditingCatId] = useState<number | null>(null);
  const [editCatName, setEditCatName] = useState("");

  // State for expanded categories (to show sub-categories)
  const [expandedCats, setExpandedCats] = useState<Set<number>>(new Set());

  // State for adding new sub-category
  const [addingSubForCat, setAddingSubForCat] = useState<number | null>(null);
  const [newSubName, setNewSubName] = useState("");

  // State for editing a sub-category
  const [editingSubId, setEditingSubId] = useState<number | null>(null);
  const [editSubName, setEditSubName] = useState("");

  // Mutations
  const createCat = trpc.cabinetCategories.create.useMutation({
    onSuccess: () => {
      toast.success("Category created");
      utils.cabinetCategories.list.invalidate();
      setNewCatName("");
      setAddingCat(false);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const updateCat = trpc.cabinetCategories.update.useMutation({
    onSuccess: () => {
      toast.success("Category renamed");
      utils.cabinetCategories.list.invalidate();
      setEditingCatId(null);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const deleteCat = trpc.cabinetCategories.delete.useMutation({
    onSuccess: () => {
      toast.success("Category deleted");
      utils.cabinetCategories.list.invalidate();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const reorderCats = trpc.cabinetCategories.reorder.useMutation({
    onSuccess: () => {
      utils.cabinetCategories.list.invalidate();
    },
    onError: (err) => toast.error(`Reorder failed: ${err.message}`),
  });

  const createSub = trpc.cabinetCategories.createSub.useMutation({
    onSuccess: () => {
      toast.success("Sub-category created");
      utils.cabinetCategories.list.invalidate();
      setNewSubName("");
      setAddingSubForCat(null);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const updateSub = trpc.cabinetCategories.updateSub.useMutation({
    onSuccess: () => {
      toast.success("Sub-category renamed");
      utils.cabinetCategories.list.invalidate();
      setEditingSubId(null);
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const deleteSub = trpc.cabinetCategories.deleteSub.useMutation({
    onSuccess: () => {
      toast.success("Sub-category deleted");
      utils.cabinetCategories.list.invalidate();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const reorderSubs = trpc.cabinetCategories.reorderSubs.useMutation({
    onSuccess: () => {
      utils.cabinetCategories.list.invalidate();
    },
    onError: (err) => toast.error(`Reorder failed: ${err.message}`),
  });

  const toggleExpand = (catId: number) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
  };

  const moveCatUp = (index: number) => {
    if (!categories || index === 0) return;
    const ids = categories.map((c) => c.id);
    [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
    reorderCats.mutate({ ids });
  };

  const moveCatDown = (index: number) => {
    if (!categories || index >= categories.length - 1) return;
    const ids = categories.map((c) => c.id);
    [ids[index], ids[index + 1]] = [ids[index + 1], ids[index]];
    reorderCats.mutate({ ids });
  };

  const moveSubUp = (cat: typeof categories extends (infer T)[] | undefined ? T : never, subIndex: number) => {
    if (subIndex === 0) return;
    const ids = cat.subCategories.map((s) => s.id);
    [ids[subIndex - 1], ids[subIndex]] = [ids[subIndex], ids[subIndex - 1]];
    reorderSubs.mutate({ categoryId: cat.id, ids });
  };

  const moveSubDown = (cat: typeof categories extends (infer T)[] | undefined ? T : never, subIndex: number) => {
    if (subIndex >= cat.subCategories.length - 1) return;
    const ids = cat.subCategories.map((s) => s.id);
    [ids[subIndex], ids[subIndex + 1]] = [ids[subIndex + 1], ids[subIndex]];
    reorderSubs.mutate({ categoryId: cat.id, ids });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            Categories & Sub-Categories
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Tap a category to expand sub-categories. Use arrows to reorder.
          </p>
        </div>
        {!addingCat && (
          <Button size="sm" onClick={() => setAddingCat(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        )}
      </div>

      {/* Add new category inline */}
      {addingCat && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <Input
            placeholder="New category name..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newCatName.trim()) createCat.mutate({ name: newCatName.trim() });
              if (e.key === "Escape") { setAddingCat(false); setNewCatName(""); }
            }}
            autoFocus
            className="flex-1 h-9"
          />
          <Button
            size="sm"
            onClick={() => { if (newCatName.trim()) createCat.mutate({ name: newCatName.trim() }); }}
            disabled={!newCatName.trim() || createCat.isPending}
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setAddingCat(false); setNewCatName(""); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Category list — compact */}
      <div className="space-y-1">
        {categories?.map((cat, catIndex) => {
          const isExpanded = expandedCats.has(cat.id);
          const isEditing = editingCatId === cat.id;

          return (
            <div key={cat.id} className="rounded-lg border bg-card overflow-hidden">
              {/* Category row */}
              <div className="flex items-center gap-1 px-2 py-2">
                {/* Up/Down reorder */}
                <div className="flex flex-col">
                  <button
                    onClick={() => moveCatUp(catIndex)}
                    disabled={catIndex === 0}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => moveCatDown(catIndex)}
                    disabled={catIndex === (categories?.length ?? 0) - 1}
                    className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                  >
                    <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>

                {/* Expand/collapse — large tap target */}
                <button
                  onClick={() => toggleExpand(cat.id)}
                  className="flex items-center gap-2 flex-1 py-1.5 px-2 rounded hover:bg-muted/50 transition-colors min-h-[40px] active:bg-muted"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editCatName}
                        onChange={(e) => setEditCatName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && editCatName.trim()) updateCat.mutate({ id: cat.id, name: editCatName.trim() });
                          if (e.key === "Escape") setEditingCatId(null);
                        }}
                        autoFocus
                        className="max-w-[160px] h-7 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => { e.stopPropagation(); if (editCatName.trim()) updateCat.mutate({ id: cat.id, name: editCatName.trim() }); }}
                        disabled={!editCatName.trim() || updateCat.isPending}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); setEditingCatId(null); }}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm font-medium flex-1 text-left">{cat.name}</span>
                  )}

                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {cat.subCategories.length}
                  </Badge>
                </button>

                {/* Action buttons */}
                {!isEditing && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      className="p-1.5 rounded hover:bg-muted transition-colors"
                      onClick={() => { setEditingCatId(cat.id); setEditCatName(cat.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      className="p-1.5 rounded hover:bg-destructive/10 transition-colors"
                      onClick={() => {
                        if (confirm(`Delete "${cat.name}" and all its sub-categories?`)) {
                          deleteCat.mutate({ id: cat.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                )}
              </div>

              {/* Sub-categories (expanded) */}
              {isExpanded && (
                <div className="px-3 pb-2 pt-0">
                  <div className="ml-8 space-y-0.5 border-l-2 border-muted pl-2">
                    {cat.subCategories.map((sub, subIndex) => {
                      const isEditingSub = editingSubId === sub.id;
                      return (
                        <div key={sub.id} className="flex items-center gap-1 py-1 px-1 rounded hover:bg-muted/30">
                          {/* Sub reorder arrows */}
                          <div className="flex flex-col shrink-0">
                            <button
                              onClick={() => moveSubUp(cat, subIndex)}
                              disabled={subIndex === 0}
                              className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                            >
                              <ArrowUp className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            <button
                              onClick={() => moveSubDown(cat, subIndex)}
                              disabled={subIndex === cat.subCategories.length - 1}
                              className="p-0.5 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                            >
                              <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </div>

                          {isEditingSub ? (
                            <>
                              <Input
                                value={editSubName}
                                onChange={(e) => setEditSubName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && editSubName.trim()) updateSub.mutate({ id: sub.id, name: editSubName.trim() });
                                  if (e.key === "Escape") setEditingSubId(null);
                                }}
                                autoFocus
                                className="flex-1 h-7 text-sm"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => { if (editSubName.trim()) updateSub.mutate({ id: sub.id, name: editSubName.trim() }); }}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditingSubId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm flex-1">{sub.name}</span>
                              <button
                                className="p-1 rounded hover:bg-muted opacity-50 hover:opacity-100 transition-opacity"
                                onClick={() => { setEditingSubId(sub.id); setEditSubName(sub.name); }}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                className="p-1 rounded hover:bg-destructive/10 opacity-50 hover:opacity-100 transition-opacity"
                                onClick={() => {
                                  if (confirm(`Delete sub-category "${sub.name}"?`)) {
                                    deleteSub.mutate({ id: sub.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}

                    {/* Add sub-category */}
                    {addingSubForCat === cat.id ? (
                      <div className="flex items-center gap-1 py-1 px-1">
                        <Input
                          placeholder="New sub-category..."
                          value={newSubName}
                          onChange={(e) => setNewSubName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newSubName.trim()) createSub.mutate({ categoryId: cat.id, name: newSubName.trim() });
                            if (e.key === "Escape") { setAddingSubForCat(null); setNewSubName(""); }
                          }}
                          autoFocus
                          className="flex-1 h-7 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => { if (newSubName.trim()) createSub.mutate({ categoryId: cat.id, name: newSubName.trim() }); }}
                          disabled={!newSubName.trim() || createSub.isPending}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => { setAddingSubForCat(null); setNewSubName(""); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground py-1.5 px-1 rounded hover:bg-muted/30 transition-colors"
                        onClick={() => { setAddingSubForCat(cat.id); setNewSubName(""); }}
                      >
                        <Plus className="h-3 w-3" />
                        Add sub-category
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(!categories || categories.length === 0) && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderTree className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No categories yet. Click "Add" to get started.</p>
        </div>
      )}
    </div>
  );
}

export default CategoriesAdmin;
