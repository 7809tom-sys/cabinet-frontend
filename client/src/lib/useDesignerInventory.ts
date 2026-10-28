import { useEffect, useMemo, useRef, useState } from "react";
import type { DesignCabinet, PlacedCabinet, RoomData } from "./design";
import {
  collectInventoryLookupSkus,
  designInventoryFromStock,
  inventoryCandidateFromDesignCabinet,
  type DesignInventoryEvaluation,
  type InventoryCatalogCandidate,
  type InventoryCabinetNotice,
} from "./inventoryAlternatives";
import {
  INVENTORY_SIM_FIXTURE_OUT_OF_STOCK,
  INVENTORY_SIM_STORAGE_KEY,
  readInventorySimulation,
  resolveDesignerInventoryProvider,
  type InventoryProvider,
  type StockStatusResult,
} from "./inventoryProvider";
import { trpc } from "./trpc";

const EMPTY: DesignInventoryEvaluation = { providerId: "unknown", notices: [] };

export type DesignerDoorStyleRef = {
  id: number;
  distributorId?: number | null;
  ourName?: string | null;
  aliasName?: string | null;
  styleCode?: string | null;
};

export type DesignerInventoryState = {
  providerId: InventoryProvider["id"];
  simulationActive: boolean;
  forcedOutOfStock: readonly string[];
  loadingAlternatives: boolean;
  notices: readonly InventoryCabinetNotice[];
  noticeFor: (uid: string | null | undefined) => InventoryCabinetNotice | null;
  stock: readonly StockStatusResult[] | null;
  catalog: readonly InventoryCatalogCandidate[];
  assumeUnlistedInStock: boolean;
};

type PlaceableQuery = {
  fetch?: (input: {
    styleId?: number;
    distributorId?: number;
    affiliateSlug?: string;
  }) => Promise<DesignCabinet[]>;
};

function styleName(style: DesignerDoorStyleRef): string {
  return style.ourName?.trim() || style.aliasName?.trim() || style.styleCode?.trim() || `Style ${style.id}`;
}

/**
 * Stock check for the open design. Unknown data produces no notices and does
 * not request other door styles. The admin simulation is the only provider
 * that loads cross-style catalog rows, and only after a placed cabinet is out.
 */
export function useDesignerInventory(input: {
  isAdmin: boolean;
  search: string;
  placed: readonly PlacedCabinet[];
  room: RoomData;
  designStyleId: number | null;
  distributorId: number | null;
  affiliateSlug?: string | null;
  doorStyles: readonly DesignerDoorStyleRef[];
  sameStyleCabinets: readonly DesignCabinet[];
}): DesignerInventoryState {
  const utils = trpc.useUtils();
  const utilsRef = useRef(utils);
  utilsRef.current = utils;
  const storedFlag = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(INVENTORY_SIM_STORAGE_KEY);
    } catch {
      return null;
    }
  }, [input.search]);
  const simulation = useMemo(
    () => readInventorySimulation(input.search, storedFlag),
    [input.search, storedFlag],
  );
  const provider = useMemo(
    () => resolveDesignerInventoryProvider({
      isAdmin: input.isAdmin,
      search: input.search,
      storedFlag,
    }),
    [input.isAdmin, input.search, storedFlag],
  );

  const vendorId = input.distributorId ?? -1;
  const sameStyleCatalog = useMemo(() => {
    if (input.designStyleId == null) return [];
    const current = input.doorStyles.find((style) => style.id === input.designStyleId);
    const name = styleName(current ?? { id: input.designStyleId });
    const seen = new Set<number>();
    const catalog: InventoryCatalogCandidate[] = [];
    for (const cabinet of input.sameStyleCabinets) {
      if (seen.has(cabinet.id)) continue;
      seen.add(cabinet.id);
      catalog.push(inventoryCandidateFromDesignCabinet(cabinet, {
        styleId: input.designStyleId,
        distributorId: vendorId,
        doorStyleName: name,
      }));
    }
    return catalog;
  }, [input.designStyleId, vendorId, input.doorStyles, input.sameStyleCabinets]);

  const [crossStyleCatalog, setCrossStyleCatalog] = useState<InventoryCatalogCandidate[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const catalog = useMemo(
    () => [...sameStyleCatalog, ...crossStyleCatalog],
    [sameStyleCatalog, crossStyleCatalog],
  );
  const lookupSkus = useMemo(
    () => collectInventoryLookupSkus(input.placed, catalog, input.designStyleId),
    [input.placed, catalog, input.designStyleId],
  );
  const lookupKey = lookupSkus.join("\n");
  const stockResult = useMemo(() => {
    if (provider.id === "unknown") return [] as const;
    return provider.getStockStatus(lookupKey ? lookupKey.split("\n") : []);
  }, [provider, lookupKey]);
  const [promisedStock, setPromisedStock] = useState<readonly StockStatusResult[] | null>(null);
  useEffect(() => {
    if (!(stockResult instanceof Promise)) return;
    let cancelled = false;
    setPromisedStock(null);
    void stockResult.then((rows) => {
      if (!cancelled) setPromisedStock(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [stockResult]);
  const stock = stockResult instanceof Promise ? promisedStock : stockResult;

  const evaluation = useMemo(() => {
    if (provider.id === "unknown" || stock == null) return EMPTY;
    return designInventoryFromStock({
      providerId: provider.id,
      placed: input.placed,
      catalog,
      stock,
      room: input.room,
      designStyleId: input.designStyleId,
      distributorId: vendorId,
      assumeUnlistedInStock: provider.id === "stub",
    });
  }, [provider, stock, input.placed, catalog, input.room, input.designStyleId, vendorId]);

  const outKey = (evaluation?.notices ?? []).map((notice) => `${notice.uid}:${notice.masterCode}`).join("|");
  const doorStylesRef = useRef(input.doorStyles);
  doorStylesRef.current = input.doorStyles;
  const otherStyleKey = useMemo(() => {
    if (provider.id !== "stub" || input.distributorId == null || input.designStyleId == null || !outKey) return "";
    return input.doorStyles
      .filter((style) => style.distributorId === input.distributorId && style.id !== input.designStyleId)
      .slice(0, 24)
      .map((style) => style.id)
      .join("|");
  }, [provider.id, input.distributorId, input.designStyleId, input.doorStyles, outKey]);

  useEffect(() => {
    if (!otherStyleKey || input.distributorId == null) {
      setCrossStyleCatalog((current) => (current.length === 0 ? current : []));
      setLoadingAlternatives(false);
      return;
    }
    let cancelled = false;
    setLoadingAlternatives(true);
    const distributorId = input.distributorId;
    const affiliateSlug = input.affiliateSlug ?? undefined;
    const styles = doorStylesRef.current.filter((style) => otherStyleKey.split("|").includes(String(style.id)));
    void Promise.all(styles.map(async (style) => {
      try {
        const procedure = utilsRef.current.design.placeableCabinets as PlaceableQuery;
        if (!procedure.fetch) return [];
        const rows = await procedure.fetch({
          styleId: style.id,
          distributorId,
          affiliateSlug,
        });
        return rows.map((row) => inventoryCandidateFromDesignCabinet(row, {
          styleId: style.id,
          distributorId,
          doorStyleName: styleName(style),
        }));
      } catch {
        return [];
      }
    })).then((groups) => {
      if (cancelled) return;
      setCrossStyleCatalog(groups.flat());
      setLoadingAlternatives(false);
    });
    return () => {
      cancelled = true;
    };
  }, [otherStyleKey, input.distributorId, input.affiliateSlug]);

  const notices = evaluation?.notices ?? [];
  const noticeByUid = useMemo(() => new Map(notices.map((notice) => [notice.uid, notice])), [notices]);

  return {
    providerId: provider.id,
    simulationActive: provider.id === "stub",
    forcedOutOfStock: provider.id === "stub" ? (simulation.enabled ? simulation.skus ?? INVENTORY_SIM_FIXTURE_OUT_OF_STOCK : []) : [],
    loadingAlternatives: provider.id === "stub" && loadingAlternatives,
    notices,
    noticeFor: (uid) => (uid ? noticeByUid.get(uid) ?? null : null),
    stock: stock ?? null,
    catalog,
    assumeUnlistedInStock: provider.id === "stub",
  };
}
