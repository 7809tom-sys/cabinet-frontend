import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Layers, Palette, Pencil, Search, X } from "lucide-react";
import { toast } from "sonner";
import { DoorStyleSwatch, type DoorStyleLike } from "@/components/DoorStyleSwatch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useMobile";
import { useLanguage } from "@/contexts/LanguageContext";
import { styleDisplayName } from "@/lib/styleDisplayName";
import { groupStylesByDistributor } from "@/lib/groupStylesByDistributor";
import { designerDoorFrameMetrics } from "@/lib/doorFrameMetrics";
import { doorStyleColorHex, orderDoorStylesByColor } from "@/lib/doorColorSpectrum";

// ─────────────────────────────────────────────────────────────────────────────
// ColorSlotButton
// One of the two "color" (door-style) buttons in the Design Tool. The HIGHLIGHTED
// (active) slot is the door style that newly-placed cabinets are painted in, so a
// member can place the perimeter in Color 1, then switch to Color 2 for the island
// to build a two-tone kitchen. Clicking the body selects the slot; the small edit
// affordance opens a picker to set/change which door style this slot holds.
// ─────────────────────────────────────────────────────────────────────────────

type StyleOption = {
  id: number;
  ourName: string | null;
  aliasName?: string | null;
  thumbnailImageUrl?: string | null;
  doorSampleImageUrl?: string | null;
  distributorId?: number | null;
  styleCode?: string | null;
  doorStyle?: string | null;
  color?: string | null;
  swColor?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  railWidth?: string | number | null;
  stileWidth?: string | number | null;
  sourceSpecification?: string | null;
  centerRailWidth?: string | number | null;
  profileNotes?: string | null;
  cornerSwatchImageUrl?: string | null;
};

/** Neutral, customer-safe distributor label (no hidden supplier brand). */
export type DistributorLabel = { id: number; name: string | null; seriesName?: string | null };

interface ColorSlotButtonProps {
  label: string;
  slot: "A" | "B";
  active: boolean;
  /** The door style currently assigned to this slot, or null if unset. */
  style: (DoorStyleLike & { id?: number }) | null;
  /** All selectable door styles (already scoped to the locked supply line). */
  styles: StyleOption[];
  /** Neutral distributor labels for grouping headers (from trpc.distributors.list). */
  distributors?: DistributorLabel[];
  /** Make this slot the active color. */
  onSelect: () => void;
  /** Assign a door style id to this slot. */
  onPick: (styleId: number) => void;
  /** Remove this slot's color (only offered for the optional second color). */
  onClear?: () => void;
  /** When true, blocks the picker from opening (e.g. cabinets locked, or Color 1 not yet set). */
  disabled?: boolean;
  /** Tooltip shown when the user tries to open a disabled picker. */
  disabledReason?: string;
}

interface StyleGroup {
  distributorId: number | null;
  label: string;
  seriesName?: string | null;
  styles: StyleOption[];
}

// ─── Door style type filter ───────────────────────────────────────────────────
type StyleTypeFilter = "all" | "shaker" | "raised" | "flat";
const STYLE_TYPE_FILTERS: { key: StyleTypeFilter; label: string }[] = [
  { key: "all", label: "All Styles" },
  { key: "shaker", label: "Shaker" },
  { key: "raised", label: "Raised Panel" },
  { key: "flat", label: "Flat Panel" },
];

function matchesStyleType(name: string, filter: StyleTypeFilter): boolean {
  if (filter === "all") return true;
  const n = name.toLowerCase();
  if (filter === "shaker") return n.includes("shaker");
  if (filter === "raised") return n.includes("raised") || n.includes("raised panel");
  if (filter === "flat") return n.includes("flat") || n.includes("slab") || n.includes("modern");
  return true;
}

// ─── Color filter ─────────────────────────────────────────────────────────────
type ColorFilter = "all" | "white" | "grey" | "offwhite" | "tan" | "dark" | "lightstain" | "greystain" | "tanstain" | "darkstain";
const COLOR_FILTERS: { key: ColorFilter; label: string }[] = [
  { key: "all", label: "All Colors" },
  { key: "white", label: "White" },
  { key: "grey", label: "Grey" },
  { key: "offwhite", label: "Off White" },
  { key: "tan", label: "Tan" },
  { key: "dark", label: "Dark" },
  { key: "lightstain", label: "Light Stain" },
  { key: "greystain", label: "Grey Stain" },
  { key: "tanstain", label: "Tan Stain" },
  { key: "darkstain", label: "Dark Stain" },
];

function matchesColor(name: string, filter: ColorFilter): boolean {
  if (filter === "all") return true;
  const n = name.toLowerCase();
  if (filter === "white") return (n.includes("white") || n.includes("blanc")) && !n.includes("off white") && !n.includes("off-white");
  if (filter === "grey") return (n.includes("grey") || n.includes("gray")) && !n.includes("stain");
  if (filter === "offwhite") return n.includes("off white") || n.includes("off-white") || n.includes("cream") || n.includes("antique white") || n.includes("linen");
  if (filter === "tan") return (n.includes("tan") || n.includes("beige") || n.includes("sand") || n.includes("caramel")) && !n.includes("stain");
  if (filter === "dark") return (n.includes("espresso") || n.includes("dark") || n.includes("black") || n.includes("charcoal") || n.includes("navy") || n.includes("midnight")) && !n.includes("stain");
  if (filter === "lightstain") return n.includes("light") && n.includes("stain");
  if (filter === "greystain") return (n.includes("grey") || n.includes("gray")) && n.includes("stain");
  if (filter === "tanstain") return (n.includes("tan") || n.includes("honey") || n.includes("natural") || n.includes("oak")) && n.includes("stain");
  if (filter === "darkstain") return (n.includes("dark") || n.includes("walnut") || n.includes("cherry") || n.includes("mahogany") || n.includes("tobacco") || n.includes("java")) && n.includes("stain");
  return true;
}

export function matchesStyleSearch(style: StyleOption, query: string, seriesName?: string | null): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (styleDisplayName(style) || "").toLowerCase();
  const series = (seriesName ?? "").toLowerCase();
  const finishText = [
    style.color,
    style.swColor,
    style.finish,
    style.woodSpecies,
    style.styleCode,
  ].filter(Boolean).join(" ").toLowerCase();
  return name.includes(q) || series.includes(q) || finishText.includes(q);
}

// ─── Filter pill button ───────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-all whitespace-nowrap",
        active
          ? "border-[#d4a75a] bg-[#d4a75a] text-white shadow-sm"
          : "border-border bg-white text-muted-foreground hover:border-[#d4a75a]/60 hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function ColorSlotButton({
  label,
  active,
  style,
  styles,
  distributors,
  onSelect,
  onPick,
  onClear,
  disabled = false,
  disabledReason,
}: ColorSlotButtonProps) {
  const { t } = useLanguage();
  const isMobile = useIsMobile(1024);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [styleTypeFilter, setStyleTypeFilter] = useState<StyleTypeFilter>("all");
  const [colorFilter, setColorFilter] = useState<ColorFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const name = style ? (styleDisplayName(style as { ourName?: string | null; aliasName?: string | null }) || null) : null;
  const hasStyle = style != null;
  const selectedFrameMetrics = designerDoorFrameMetrics(style as StyleOption | null);
  const selectedColorLabel = style
    ? style.color ?? style.finish ?? style.ourName ?? "Selected finish"
    : null;

  // Group the styles by distributor (supply line) via the shared, unit-tested
  // helper. Groups are ordered by their neutral label so the list is stable;
  // styles inside keep their incoming order.
  const groups = useMemo<StyleGroup[]>(() => {
    const base = groupStylesByDistributor(styles, distributors ?? [], {
      fallback: (id) => t("dt_cs_line_fallback", { id }),
      other: t("dt_cs_line_other"),
    });
    // Attach seriesName from the distributor labels to each group.
    const seriesById = new Map<number, string | null | undefined>();
    for (const d of (distributors ?? [])) seriesById.set(d.id, d.seriesName);
    return base.map((g) => ({
      ...g,
      seriesName: g.distributorId != null ? seriesById.get(g.distributorId) : null,
    }));
  }, [styles, distributors, t]);

  // Which distributor group is currently expanded (one at a time). Defaults to
  // the group that holds the selected style, else the first group.
  const selectedDistId = useMemo(() => {
    const sid = (style as { id?: number } | null)?.id;
    if (sid == null) return undefined;
    return styles.find((s) => s.id === sid)?.distributorId ?? null;
  }, [style, styles]);

  // Distributor-first flow: the picker opens on a list of SUPPLY LINES; choosing
  // one drills into that line's door-style grid. `chosenGroup` is the line the
  // user has drilled into (null = still on the line list). When a style is
  // already selected we deep-link straight into its line; when only one line is
  // in scope (e.g. slot B, or a locked design) we skip the chooser entirely.
  const onlyOneGroup = groups.length <= 1;
  const [chosenGroup, setChosenGroup] = useState<number | null | undefined>(undefined);
  // Effective drilled-in line: explicit choice wins; otherwise auto-enter when
  // there's a single line OR a style is already selected.
  const effectiveGroup =
    chosenGroup !== undefined
      ? chosenGroup
      : onlyOneGroup
        ? groups[0]?.distributorId ?? null
        : selectedDistId !== undefined
          ? selectedDistId
          : null;

  // Reset to the line list each time the picker is (re)opened, unless we should
  // deep-link into a line (single line, or an already-selected style).
  useEffect(() => {
    if (!pickerOpen) return;
    setChosenGroup(undefined);
    setStyleTypeFilter("all");
    setColorFilter("all");
    setSearchQuery("");
    // Auto-focus the search input after the picker opens
    setTimeout(() => searchInputRef.current?.focus(), 80);
  }, [pickerOpen]);

  const activeGroup = groups.find((g) => g.distributorId === effectiveGroup) ?? null;

  // Apply style type + color filters + search query to a list of styles
  const applyFilters = (list: StyleOption[], seriesName?: string | null): StyleOption[] => {
    const q = searchQuery.trim().toLowerCase();
    return list.filter((s) => {
      const n = styleDisplayName(s) || "";
      if (!matchesStyleType(n, styleTypeFilter)) return false;
      if (!matchesColor(n, colorFilter)) return false;
      if (q && !matchesStyleSearch(s, q, seriesName)) return false;
      return true;
    });
  };

  // Search bar component — shown at the very top of the picker
  const SearchBar = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 px-1" aria-label="Cabinet color order">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cabinet colors</span>
        <span className="text-[10px] font-semibold text-[#1a2744]">Light → Dark</span>
      </div>
      <div className="relative mb-2">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search finish name, color, series or SKU…"
          aria-label="Search cabinet finish name, color, series or SKU"
          className="w-full rounded-lg border border-border bg-white py-1.5 pl-7 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground/70 focus:border-[#d4a75a] focus:outline-none focus:ring-1 focus:ring-[#d4a75a]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear finish search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );

  // Filter pills UI — shown above the style grid when drilled into a group
  const FilterBar = () => (
    <div className="space-y-1.5 pb-2">
      {/* Style type row */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {STYLE_TYPE_FILTERS.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={styleTypeFilter === f.key}
            onClick={() => setStyleTypeFilter(f.key)}
          />
        ))}
      </div>
      {/* Color row */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        {COLOR_FILTERS.map((f) => (
          <FilterPill
            key={f.key}
            label={f.label}
            active={colorFilter === f.key}
            onClick={() => setColorFilter(f.key)}
          />
        ))}
      </div>
    </div>
  );

  // Card-grid of door styles within one open distributor group.
  const StyleGrid = ({ list, cols, seriesName }: { list: StyleOption[]; cols: 2 | 3; seriesName?: string | null }) => {
    // Keep every color choice in the same customer-facing light-to-deep order
    // as the public color rail. Filtering must not reintroduce catalog arrival
    // order, which previously made the picker appear randomly mixed by line.
    const filtered = applyFilters(orderDoorStylesByColor(list), seriesName);
    return filtered.length === 0 ? (
      <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
        No styles match the selected filters.
      </div>
    ) : (
      <div className={`grid gap-2 p-1 ${cols === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {filtered.map((s) => {
          const isSelected = (style as { id?: number } | null)?.id === s.id;
          const sName = styleDisplayName(s) || t("dt_cs_style_num", { id: s.id });
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onPick(s.id);
                setPickerOpen(false);
              }}
              title={sName}
              className={[
                "relative flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-all",
                "hover:border-[#d4a75a]/70 hover:bg-accent/60 active:scale-[0.97]",
                isSelected
                  ? "border-[#d4a75a] bg-[#d4a75a]/10 ring-1 ring-[#d4a75a] shadow-sm"
                  : "border-border bg-white",
              ].join(" ")}
            >
              <div className="relative w-full aspect-[10/13] overflow-hidden rounded">
                <DoorStyleSwatch
                  style={s as Parameters<typeof DoorStyleSwatch>[0]["style"]}
                  className="h-full w-full"
                />
                {(s as StyleOption).cornerSwatchImageUrl && (
                  <img
                    src={(s as StyleOption).cornerSwatchImageUrl!}
                    alt="Corner swatch"
                    className="absolute bottom-0 right-0 w-[40%] h-[40%] object-cover rounded-tl border-t border-l border-white/80 shadow-sm"
                    loading="lazy"
                  />
                )}
              </div>
              <span className={`w-full text-[10px] leading-tight ${isSelected ? "font-semibold text-[#1a2744]" : "text-muted-foreground"}`}>
                <span className="block truncate">{sName}</span>
                {seriesName && (
                  <span className="block truncate text-[9px] text-muted-foreground/70">({seriesName})</span>
                )}
              </span>
              {s.styleCode && (
                <a
                  href={`/family/${encodeURIComponent(s.styleCode)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 inline-flex items-center gap-0.5 text-[9px] text-[#1a2744]/70 hover:text-[#d4a75a] hover:underline transition-colors"
                >
                  <ExternalLink className="h-2.5 w-2.5" />
                  {t("dt_cs_view_collection")}
                </a>
              )}
              {isSelected && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#d4a75a] text-white shadow">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  // The list of SUPPLY LINES to choose from (step 1). Each row shows the neutral
  // line label + how many door styles it carries.
  const LineChooser = () => (
    <div className="space-y-1.5">
      <p className="px-1 pb-1 text-[11px] leading-snug text-muted-foreground">
        {t("dt_cs_pick_line_help")}
      </p>
      {groups.map((g) => {
        const hasSelected = g.styles.some(
          (s) => (style as { id?: number } | null)?.id === s.id
        );
        return (
          <button
            key={String(g.distributorId)}
            type="button"
            onClick={() => setChosenGroup(g.distributorId)}
            className={[
              "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-all active:scale-[0.99]",
              hasSelected
                ? "border-[#d4a75a] bg-[#d4a75a]/10"
                : "border-border bg-white hover:border-[#d4a75a]/60 hover:bg-accent/50",
            ].join(" ")}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Layers className="h-4 w-4 shrink-0 text-[#d4a75a]" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-foreground">{g.label}</span>
                <span className="block text-[10px] text-muted-foreground">
                  {t("dt_cs_group_count", { count: g.styles.length })}
                </span>
              </span>
              {hasSelected && (
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-[#d4a75a] text-white">
                  <Check className="h-2 w-2" strokeWidth={3} />
                </span>
              )}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );

  // Distributor-first picker: step 1 = choose a supply line, step 2 = its styles.
  // When only one line is in scope (slot B, or a locked design) we skip step 1.
  // When a search query is active, flatten ALL groups and search across them
  const searchGroups = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        styles: g.styles.filter((s) => {
          const n = (styleDisplayName(s) || "").toLowerCase();
          const sn = (g.seriesName ?? "").toLowerCase();
          return n.includes(q) || sn.includes(q);
        }),
      }))
      .filter((g) => g.styles.length > 0);
  }, [searchQuery, groups]);

  const StyleList = ({ cols = 2 }: { cols?: 2 | 3 }) =>
    styles.length === 0 ? (
      <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
        {t("dt_cs_none_available")}
      </div>
    ) : searchQuery.trim() ? (
      // Search mode: show results across all groups
      <div className="space-y-1">
        <SearchBar />
        {searchGroups && searchGroups.length > 0 ? (
          searchGroups.map((g) => (
            <div key={String(g.distributorId)} className="space-y-1">
              {groups.length > 1 && (
                <div className="flex items-center gap-1.5 px-1 pt-1">
                  <Layers className="h-3 w-3 text-[#d4a75a]" />
                  <span className="text-[11px] font-semibold text-foreground">{g.label}</span>
                  {g.seriesName && <span className="text-[10px] text-muted-foreground">({g.seriesName})</span>}
                </div>
              )}
              <StyleGrid list={g.styles} cols={cols} seriesName={g.seriesName} />
            </div>
          ))
        ) : (
          <div className="px-2 py-4 text-center text-[11px] text-muted-foreground">
            No styles match &ldquo;{searchQuery}&rdquo;.
          </div>
        )}
      </div>
    ) : onlyOneGroup ? (
      <div className="space-y-1">
        <SearchBar />
        <FilterBar />
        <StyleGrid list={groups[0]?.styles ?? styles} cols={cols} seriesName={groups[0]?.seriesName} />
      </div>
    ) : activeGroup == null ? (
      <div className="space-y-1">
        <SearchBar />
        <LineChooser />
      </div>
    ) : (
      <div className="space-y-2">
        <SearchBar />
        {/* Back to supply-line list */}
        <button
          type="button"
          onClick={() => setChosenGroup(null)}
          className="flex items-center gap-1 rounded-md px-1 py-1 text-[11px] font-medium text-[#1a2744] hover:underline"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t("dt_cs_back_to_lines")}
        </button>
        <div className="flex items-center gap-1.5 px-1">
          <Layers className="h-3.5 w-3.5 text-[#d4a75a]" />
          <span className="truncate text-[12px] font-semibold text-foreground">{activeGroup.label}</span>
          <span className="text-[10px] text-muted-foreground">
            {t("dt_cs_group_count", { count: activeGroup.styles.length })}
          </span>
        </div>
        <FilterBar />
        <StyleGrid list={activeGroup.styles} cols={cols} seriesName={activeGroup.seriesName} />
      </div>
    );

  return (
    <div
      className={[
        "relative rounded-lg border p-2 text-left transition-all",
        active
          ? "border-[#d4a75a] bg-[#d4a75a]/10 ring-2 ring-[#d4a75a] shadow-sm"
          : "border-border bg-white hover:border-[#d4a75a]/60",
      ].join(" ")}
    >
      {/* Active check badge */}
      {active && (
        <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#d4a75a] text-white shadow">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {hasStyle && onClear && (
          <button
            type="button"
            title={t("dt_cs_remove_color")}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="text-muted-foreground hover:text-red-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Body: clicking selects this slot as the active color */}
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-2"
      >
        <div className="relative h-10 w-8 shrink-0 overflow-hidden rounded border border-border bg-white">
          {hasStyle ? (
            <DoorStyleSwatch style={style} className="h-full w-full object-contain" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Palette className="h-4 w-4" />
            </div>
          )}
          {hasStyle && (style as StyleOption)?.cornerSwatchImageUrl && (
            <img
              src={(style as StyleOption).cornerSwatchImageUrl!}
              alt="Corner swatch"
              className="absolute bottom-0 right-0 w-[50%] h-[50%] object-cover rounded-tl shadow-sm"
              loading="lazy"
            />
          )}
        </div>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-semibold text-foreground">
            {name ?? t("dt_cs_set_style")}
          </span>
          <span className="block text-[10px] text-muted-foreground">
            {active
              ? t("dt_cs_active")
              : hasStyle
                ? t("dt_cs_click_use")
                : t("dt_cs_optional_second")}
          </span>
          {hasStyle && (
            <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground" aria-label={`${label} selected color`}>
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: doorStyleColorHex(style) }}
              />
              <span className="truncate">Color: {selectedColorLabel}</span>
            </span>
          )}
          {/* Slim Shaker has an explicit one-inch family rule; other profiles stay source-bound. */}
          {hasStyle && selectedFrameMetrics && (
            <span className="block text-[9px] text-muted-foreground/80 mt-0.5">
              Rail {selectedFrameMetrics.railWidth}&quot; · Stile {selectedFrameMetrics.stileWidth}&quot;
              {(style as StyleOption).centerRailWidth ? ` · Ctr ${(style as StyleOption).centerRailWidth}"` : ""}
            </span>
          )}
          {hasStyle && !selectedFrameMetrics && (
            <span className="block text-[9px] text-muted-foreground/80 mt-0.5">Frame spec pending — neutral face shown</span>
          )}
        </span>
      </button>

      {/* The trigger looks identical on desktop & mobile; only what it opens differs. */}
      {isMobile ? (
        <>
          <button
            type="button"
            onClick={() => {
              if (disabled) { toast.info(disabledReason ?? "Set Color 1 first before choosing Color 2."); return; }
              setPickerOpen(true);
            }}
            className={[
              "mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium hover:underline",
              disabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-[#1a2744]",
            ].join(" ")}
          >
            <Pencil className="h-3 w-3" />
            {hasStyle ? t("dt_cs_change_style") : t("dt_cs_choose_style")}
          </button>
          <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
            <SheetContent
              side="bottom"
              className="flex max-h-[85vh] flex-col rounded-t-2xl p-0"
            >
              <SheetHeader className="border-b px-4 py-3">
                <SheetTitle className="text-base">
                  {hasStyle ? t("dt_cs_change_style") : t("dt_cs_choose_style")}
                </SheetTitle>
              </SheetHeader>
              <div
                className="flex-1 overflow-y-auto overscroll-contain px-3 py-2"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <StyleList cols={3} />
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <Popover open={disabled ? false : pickerOpen} onOpenChange={(o) => { if (disabled) { toast.info(disabledReason ?? "Set Color 1 first before choosing Color 2."); return; } setPickerOpen(o); }}>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={() => { if (disabled) { toast.info(disabledReason ?? "Set Color 1 first before choosing Color 2."); } }}
              className={[
                "mt-1.5 inline-flex items-center gap-1 text-[10px] font-medium hover:underline",
                disabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-[#1a2744]",
              ].join(" ")}
            >
              <Pencil className="h-3 w-3" />
              {hasStyle ? t("dt_cs_change_style") : t("dt_cs_choose_style")}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="bottom" collisionPadding={12} className="w-72 p-1">
            <div
              className="max-h-[min(60vh,480px)] overflow-y-auto overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
              onWheelCapture={(e) => e.stopPropagation()}
            >
              <div className="px-1 pt-1">
                <StyleList />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default ColorSlotButton;
