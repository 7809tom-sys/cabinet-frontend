export type HardwareCatalogVariant = {
  id: number;
  sku: string;
  finish: string;
  imageUrl: string | null;
  unitPriceCents: number | null;
};

export type HardwareCatalogRow = Omit<HardwareCatalogVariant, "finish"> & {
  name: string;
  description: string | null;
  collection: string | null;
  productType: string | null;
  finish: string | null;
  configurationKey: string | null;
  configurationLabel: string | null;
};

export type HardwareConfiguration = {
  collection: string;
  productType: string;
  configurationKey: string;
  label: string;
  variants: HardwareCatalogVariant[];
};

function normalizedSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesHardwareConfigurationSearch(row: HardwareCatalogRow, search: string): boolean {
  const needle = normalizedSearch(search);
  if (!needle) return true;
  return [
    row.sku,
    row.name,
    row.description ?? "",
    row.collection ?? "",
    row.productType ?? "",
    row.finish ?? "",
  ].some((value) => value.toLocaleLowerCase().includes(needle));
}

/**
 * Convert publicly eligible Hardware Resources rows into shopper-facing cards.
 * A card represents one source configuration; a variant represents one exact
 * sellable SKU/finish. The grouping key comes from the reviewed import source,
 * so title text and SKU patterns never determine ordering identity at runtime.
 */
export function groupHardwareConfigurations(rows: readonly HardwareCatalogRow[], search?: string): HardwareConfiguration[] {
  const groups = new Map<string, {
    collection: string;
    productType: string;
    configurationKey: string;
    label: string;
    variants: HardwareCatalogVariant[];
    searchRows: HardwareCatalogRow[];
  }>();
  for (const row of rows) {
    if (!row.collection || !row.productType || !row.finish || !row.configurationKey || !row.configurationLabel) continue;
    const group = groups.get(row.configurationKey) ?? {
      collection: row.collection,
      productType: row.productType,
      configurationKey: row.configurationKey,
      label: row.configurationLabel,
      variants: [],
      searchRows: [],
    };
    group.searchRows.push(row);
    group.variants.push({
      id: row.id,
      sku: row.sku,
      finish: row.finish,
      imageUrl: row.imageUrl,
      unitPriceCents: row.unitPriceCents,
    });
    groups.set(row.configurationKey, group);
  }
  const groupList: Array<{
    collection: string;
    productType: string;
    configurationKey: string;
    label: string;
    variants: HardwareCatalogVariant[];
    searchRows: HardwareCatalogRow[];
  }> = [];
  groups.forEach((group) => groupList.push(group));
  return groupList
    .filter((group) => !search || group.searchRows.some((row) => matchesHardwareConfigurationSearch(row, search)))
    .map(({ searchRows: _searchRows, ...group }) => ({
      ...group,
      variants: group.variants.sort((a, b) => a.finish.localeCompare(b.finish) || a.sku.localeCompare(b.sku)),
    }))
    .sort((a, b) => a.collection.localeCompare(b.collection)
      || a.productType.localeCompare(b.productType)
      || a.label.localeCompare(b.label)
      || a.configurationKey.localeCompare(b.configurationKey));
}
