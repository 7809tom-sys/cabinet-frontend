/**
 * Screenshot harness for the Fixtures sidebar → catalog popup flow.
 *
 * It renders the REAL `RecommendedSurfaces` sidebar and the REAL
 * `SurfacesPickerDialog`, wired the way the Design Tool wires them: clicking a
 * category row sets the browse role and opens the popup on that tab.
 *
 * On the previous build the sidebar is an accordion of collapsible rows with a
 * "Browse all" link each; on this build each category is a single row that opens
 * the popup, so there is one place to browse and pick.
 *
 * Served by the Vite dev server at /dev/fixtures-categories-shot.html and used
 * only by the screenshot run. Nothing in the app imports it.
 */
import { createRoot } from "react-dom/client";
import { useCallback, useState, type ComponentType, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "@/lib/trpc";
import { apiUrl } from "@/lib/apiBase";
import { PreferredProductsProvider } from "@/contexts/PreferredProductsContext";
import { RecommendedSurfaces, type RecommendedRole } from "@/components/design/RecommendedSurfaces";
import { SurfacesPickerDialog, type SelectedSurface } from "@/components/design/SurfacesPickerDialog";
import "@/index.css";

/**
 * The sidebar and popup read the live catalog through tRPC. The screenshot does
 * not need the network, and the dev server has no session, so the real product
 * rows are supplied here — the same shape `surfaces.recommended` returns,
 * including the PL-3099 row exactly as the live catalog stores it (a StoneCreek
 * "Farmhouse Reserve 33in Farmhouse Apron-Front" name over an 18x13 undermount
 * basin), which is the mismatch the owner reported.
 */
/**
 * The sidebar and dialog resolve their rows through tRPC. This bundle is built
 * with `--alias:@/lib/trpc=…/fixturesCategoriesScreenshotTrpc.ts`, so the real
 * components run against deterministic catalog data instead of a live session.
 * The alias applies to this one build only; the app keeps the real client.
 */
const shot = (id: number, code: string, name: string, size: string, sellPrice: number, subCategory: string, category = "Shower & Bath"): SelectedSurface => ({
  id, pelicanCode: code, slug: `s-${id}`, name, category, subCategory, size,
  imageUrl: null, materialImageUrl: null, sellPrice, showInDesigner: true, isActive: true,
} as unknown as SelectedSurface);

/** Real-shaped rows so the dialog's own grid renders in the screenshot. */
export const SCREENSHOT_BATHROOM_ROWS: Partial<Record<RecommendedRole, SelectedSurface[]>> = {
  "shower-pan": [
    shot(401, "PL-016036C", 'PL-016036C 60" x 36" Center Drain Shower Pan', '60" x 36"', 799.99, "Shower Accessories"),
    shot(402, "PL-016030L", 'PL-016030L 60" x 30" Left Drain Shower Pan', '60" x 30"', 699.99, "Shower Accessories"),
    shot(403, "PL-016032R", 'PL-016032R 60" x 32" Right Drain Shower Pan', '60" x 32"', 749.99, "Shower Accessories"),
    shot(404, "PL-SMC4836C", 'PL-SMC4836C 47-63/64" x 36" Center Drain Shower Pan', '47-63/64" x 36"', 634.99, "Shower Accessories"),
  ],
  "shower-surround": [
    shot(501, "PL-603696 Marble", 'PL-603696 Marble 60" x 36" x 96" 3-Piece Alcove Surround', '60" x 36" x 96"', 1650, "Shower Surrounds"),
    shot(502, "PL-603096 Grey Wood", 'PL-603096 Grey Wood 60" x 30" x 96" 3-Piece Alcove Surround', '60" x 30" x 96"', 1650, "Shower Surrounds"),
    shot(503, "PL-603296 White Wood", 'PL-603296 White Wood 60" x 32" x 96" 3-Piece Alcove Surround', '60" x 32" x 96"', 1650, "Shower Surrounds"),
    shot(504, "PL-483696 Brick", 'PL-483696 Brick 48" x 36" x 96" 3-Piece Alcove Surround', '48" x 36" x 96"', 1650, "Shower Surrounds"),
  ],
  "shower-system": [
    shot(601, "PL-86H55 CHROME", "PL-86H55 CHROME Hydra Shower System", '8" x 8"', 549, "Shower Valves & Systems"),
    shot(602, "PL-86H15 BRUSHED NICKEL", "PL-86H15 BRUSHED NICKEL Hydra Shower System", '8" x 8"', 479, "Shower Valves & Systems"),
  ],
  "shower-door": [
    shot(701, "PL-03A42S60 CHR", "PL-03A42S60 CHR Frameless Double Sliding Shower Door", '60" x 76"', 1649.99, "Shower & Tub Doors"),
  ],
  "shower-niche": [
    shot(801, "PL-SN1614", "PL-SN1614 Single Shelf Shower Niche", '16" x 14"', 129, "Shower Accessories"),
    shot(802, "PL-SN1627", "PL-SN1627 Double Shelf Shower Niche", '27-1/16" x 16-1/64"', 179, "Shower Accessories"),
    shot(803, "PL-SD88 Corner", "PL-SD88 Corner Soap Tray", '8" x 8"', 59, "Shower Accessories"),
  ],
  "bathroom-sink": [
    shot(659, "PL-3099 White", 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl — White', '18" x 13"', 46.44, "Sinks", "Sinks & Faucets"),
    shot(656, "PL-3099 Individually Packed", 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl', '18" x 13"', 116.10, "Sinks", "Sinks & Faucets"),
    shot(655, "PL-3099 Gloss Black", 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl', '18" x 13"', 96.75, "Sinks", "Sinks & Faucets"),
  ],
};

/** Counts the sidebar shows in the screenshot, matching the live families. */
export const SCREENSHOT_CATEGORY_COUNTS: Record<string, number> = {
  "bathroom-sink": 9,
  "bathroom-faucet": 3,
  "toilet-bidet": 14,
  bathtub: 8,
  "shower-pan": 22,
  "shower-surround": 28,
  "shower-tile": 49,
  "shower-system": 15,
  "shower-door": 27,
  "shower-niche": 5,
};

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false, staleTime: Infinity } },
});

function Harness() {
  const params = new URLSearchParams(location.search);
  // `?open=<role>` starts with the popup already on that category's tab.
  const [open, setOpen] = useState(params.has("open"));
  const [browseRole, setBrowseRole] = useState<RecommendedRole>((params.get("open") as RecommendedRole) ?? "bathroom-sink");
  const [selected, setSelected] = useState<SelectedSurface[]>(() => {
    // ?select=3099 preselects the PL-3099 row so the banner can be inspected.
    if (!params.has("select")) return [];
    // The PL-3099 row exactly as the live catalog stores it: a StoneCreek
    // farmhouse title over an 18" x 13" undermount vanity basin.
    return [{
      id: 656,
      pelicanCode: "PL-3099 Individually Packed",
      slug: "s-656",
      name: 'StoneCreek Farmhouse Reserve 33" Farmhouse Apron-Front Single Bowl',
      category: "Sinks & Faucets",
      subCategory: "Sinks",
      size: '18" x 13"',
      imageUrl: null,
      sellPrice: 116.1,
    } as unknown as SelectedSurface];
  });

  const onBrowseAll = useCallback((role: RecommendedRole) => {
    setBrowseRole(role);
    setOpen(true);
    // Mirror the Design Tool: the category row is the only way in.
    document.body.dataset.openedRole = role;
  }, []);

  const onToggle = useCallback((item: SelectedSurface) => {
    setSelected((current) => (
      current.some((entry) => entry.id === item.id)
        ? current.filter((entry) => entry.id !== item.id)
        : [...current, item]
    ));
  }, []);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, padding: 16, alignItems: "start" }}>
      <aside
        data-testid="fixtures-sidebar"
        style={{ background: "#fff", border: "1px solid #cbd5e1", borderRadius: 12, padding: 12, maxHeight: "calc(100vh - 32px)", overflowY: "auto" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: "1px solid #e2e8f0" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Preston · Fixtures</span>
        </div>
        <RecommendedSurfaces
          selected={selected}
          onToggle={onToggle}
          onBrowseAll={onBrowseAll}
          roomType="bathroom"
          bathroomPaletteMode="fixtures"
          categoryCounts={SCREENSHOT_CATEGORY_COUNTS as Partial<Record<RecommendedRole, number>>}
        />
      </aside>
      <div style={{ color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
        {open ? "" : "Click a category in the sidebar to open the Bathroom Fixtures catalog on that category."}
      </div>
      <SurfacesPickerDialog
        open={open}
        onOpenChange={setOpen}
        selected={selected}
        onToggle={onToggle}
        roomType="bathroom"
        bathroomPaletteMode="fixtures"
        initialBathroomRole={browseRole}
        injectedBathroomRows={SCREENSHOT_BATHROOM_ROWS}
      />
    </div>
  );
}

// The same provider shape `main.tsx` uses, so the real components can call
// tRPC. Queries are disabled below, so no request leaves the page; the rows come
// from the bundle-alias stub.
const TrpcProvider = (trpc as any).Provider as React.ComponentType<{
  client: unknown;
  queryClient: QueryClient;
  children?: ReactNode;
}>;
const trpcClient = (trpc as any).createClient({
  links: [httpBatchLink({ url: apiUrl("/api/trpc"), transformer: superjson })],
});

function Root() {
  return (
    <TrpcProvider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <PreferredProductsProvider>
          <Harness />
        </PreferredProductsProvider>
      </QueryClientProvider>
    </TrpcProvider>
  );
}

const host = document.getElementById("root");
if (host) {
  createRoot(host).render(<Root />);
  document.body.dataset.ready = "yes";
}
