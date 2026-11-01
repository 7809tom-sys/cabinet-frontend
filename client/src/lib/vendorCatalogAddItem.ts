import { catalogCategoryKey } from "@shared/catalogCategory";
import { catalogCategoryValuesEqual } from "@shared/catalogCategorySpelling";
import { trpc } from "@/lib/trpc";

/** Matches `pelican.createProduct` on cabinet-backend PR #68. */
export const PELICAN_CATEGORY_MAX = 64;
export const PELICAN_SUBCATEGORY_MAX = 128;
export const PELICAN_NAME_MAX = 255;
export const PELICAN_CODE_MAX = 191;
export const PELICAN_DESCRIPTION_MAX = 10_000;
export const PELICAN_SIZE_MAX = 128;
export const PELICAN_MONEY_MAX = 99_999_999.99;
export const PELICAN_COVERAGE_MAX = 999_999.99;

export type AddCatalogItemDraft = {
  name: string;
  category: string;
  subCategory: string;
  code: string;
  description: string;
  size: string;
  listPrice: string;
  msrp: string;
  coverageSqFt: string;
};

/**
 * Body sent to `pelican.createProduct`.
 * `isActive`, `showInCatalog`, and `showInDesigner` are omitted so the
 * procedure defaults (true) apply.
 */
export type CreatePelicanProductInput = {
  category: string;
  subCategory: string;
  name: string;
  pelicanCode?: string;
  description?: string;
  size?: string;
  listPrice?: number;
  msrp?: number;
  coverageSqFt?: number;
};

export type CreatePelicanProductResult = {
  id: number;
  pelicanCode: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  subCategory: string;
  size: string | null;
  listPrice: string | null;
  msrp: string | null;
  coverageSqFt: string | null;
  isActive: boolean;
  showInCatalog: boolean;
  showInDesigner: boolean;
  sellPrice: number | null;
  markupBps: number;
};

export function initialAddCatalogItemDraft(browse: {
  category?: string | null;
  subCategory?: string | null;
}): AddCatalogItemDraft {
  return {
    name: "",
    category: browse.category?.trim() ?? "",
    subCategory: browse.subCategory?.trim() ?? "",
    code: "",
    description: "",
    size: "",
    listPrice: "",
    msrp: "",
    coverageSqFt: "",
  };
}

/** "Tile & Mosaic > Mosaic" while a category is selected. Null on All. */
export function catalogBrowseLabel(category?: string | null, subCategory?: string | null): string | null {
  const cat = category?.trim() ?? "";
  if (!cat) return null;
  const sub = subCategory?.trim() ?? "";
  return sub ? `${cat} > ${sub}` : cat;
}

export function catalogSubcategoryOptions(input: {
  category?: string | null;
  serverSubs?: readonly (string | null | undefined)[];
  items?: readonly { category?: string | null; subCategory?: string | null }[];
}): string[] {
  const category = input.category?.trim() ?? "";
  if (!category) return [];
  const seen = new Set<string>();
  const options: string[] = [];
  const add = (value: string | null | undefined) => {
    const key = catalogCategoryKey(value);
    if (!key) return;
    const folded = key.toLowerCase();
    if (seen.has(folded)) return;
    seen.add(folded);
    options.push(key);
  };
  for (const sub of input.serverSubs ?? []) add(sub);
  for (const item of input.items ?? []) {
    if (category && !catalogCategoryValuesEqual(item.category, category)) continue;
    add(item.subCategory);
  }
  return options;
}

export function itemsMatchingSubcategory<T extends { subCategory?: string | null }>(
  items: readonly T[],
  subCategory: string | null | undefined,
): T[] {
  const sub = subCategory?.trim() ?? "";
  if (!sub) return [...items];
  return items.filter((item) => catalogCategoryValuesEqual(item.subCategory, sub));
}

export function categoryChoices(categories: readonly string[], current: string): string[] {
  const options: string[] = [];
  const seen = new Set<string>();
  const add = (value: string) => {
    const key = catalogCategoryKey(value);
    if (!key || key.length > PELICAN_CATEGORY_MAX || seen.has(key.toLowerCase())) return;
    seen.add(key.toLowerCase());
    options.push(key);
  };
  add(current);
  for (const category of categories) add(category);
  return options;
}

type Parsed = { ok: true; value: CreatePelicanProductInput } | { ok: false; message: string };

function lengthError(value: string, label: string, max: number): string | null {
  if (value.length > max) return `${label} must be ${max} characters or fewer.`;
  return null;
}

function optionalAmount(
  raw: string,
  label: string,
  kind: "nonnegative" | "positive",
): { ok: true; value?: number } | { ok: false; message: string } {
  const trimmed = raw.trim().replace(/[$,]/g, "");
  if (!trimmed) return { ok: true };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return { ok: false, message: `${label} must be a number.` };
  const max = kind === "positive" ? PELICAN_COVERAGE_MAX : PELICAN_MONEY_MAX;
  if (parsed > max) return { ok: false, message: `${label} is too large.` };
  if (kind === "nonnegative" && parsed < 0) return { ok: false, message: `${label} must be 0 or greater.` };
  if (kind === "positive" && !(parsed > 0)) return { ok: false, message: `${label} must be greater than 0.` };
  const rounded = Math.round(parsed * 100) / 100;
  if (kind === "positive" && !(rounded > 0)) return { ok: false, message: `${label} must be greater than 0.` };
  return { ok: true, value: rounded };
}

/** Build the createProduct body. Blank optional fields are omitted. */
export function buildCreatePelicanProductInput(draft: AddCatalogItemDraft): Parsed {
  const name = draft.name.trim();
  const category = draft.category.trim();
  const subCategory = draft.subCategory.trim();
  if (!name) return { ok: false, message: "Enter a product name." };
  if (!/[a-z0-9]/i.test(name)) return { ok: false, message: "Product name needs a letter or number so a catalog link can be created." };
  const nameLength = lengthError(name, "Product name", PELICAN_NAME_MAX);
  if (nameLength) return { ok: false, message: nameLength };
  if (!category) return { ok: false, message: "Choose a category." };
  const categoryLength = lengthError(category, "Category", PELICAN_CATEGORY_MAX);
  if (categoryLength) return { ok: false, message: categoryLength };
  if (!subCategory) return { ok: false, message: "Enter a sub-category." };
  const subLength = lengthError(subCategory, "Sub-category", PELICAN_SUBCATEGORY_MAX);
  if (subLength) return { ok: false, message: subLength };

  const code = draft.code.trim();
  const codeLength = lengthError(code, "Code / SKU", PELICAN_CODE_MAX);
  if (codeLength) return { ok: false, message: codeLength };
  const description = draft.description.trim();
  const descriptionLength = lengthError(description, "Description", PELICAN_DESCRIPTION_MAX);
  if (descriptionLength) return { ok: false, message: descriptionLength };
  const size = draft.size.trim();
  const sizeLength = lengthError(size, "Size", PELICAN_SIZE_MAX);
  if (sizeLength) return { ok: false, message: sizeLength };

  const listPrice = optionalAmount(draft.listPrice, "List price", "nonnegative");
  if (!listPrice.ok) return listPrice;
  const msrp = optionalAmount(draft.msrp, "MSRP", "nonnegative");
  if (!msrp.ok) return msrp;
  const coverageSqFt = optionalAmount(draft.coverageSqFt, "Coverage", "positive");
  if (!coverageSqFt.ok) return coverageSqFt;

  return {
    ok: true,
    value: {
      category,
      subCategory,
      name,
      ...(code ? { pelicanCode: code } : {}),
      ...(description ? { description } : {}),
      ...(size ? { size } : {}),
      ...(listPrice.value != null ? { listPrice: listPrice.value } : {}),
      ...(msrp.value != null ? { msrp: msrp.value } : {}),
      ...(coverageSqFt.value != null ? { coverageSqFt: coverageSqFt.value } : {}),
    },
  };
}

export function createdCatalogItemId(result: unknown): number | null {
  if (!result || typeof result !== "object" || !("id" in result)) return null;
  const id = (result as { id: unknown }).id;
  return typeof id === "number" && Number.isInteger(id) && id > 0 ? id : null;
}

/** Shape the existing Pelican edit dialog already opens. Photos start empty. */
export function catalogEditorItemFromCreate(result: CreatePelicanProductResult) {
  return {
    id: result.id,
    name: result.name,
    description: result.description ?? "",
    category: result.category,
    subCategory: result.subCategory,
    pelicanCode: result.pelicanCode,
    size: result.size,
    listPrice: result.listPrice,
    msrp: result.msrp,
    coverageSqFt: result.coverageSqFt,
    imageUrl: null,
    materialImageUrl: null,
    roomSceneImageUrl: null,
    yourCost: null,
    retailPrice: null,
    vendorWholesale: null,
    isActive: result.isActive,
    showInCatalog: result.showInCatalog,
    showInDesigner: result.showInDesigner,
  };
}

export function isCatalogProcedureNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as {
    message?: string;
    data?: { code?: string } | null;
    shape?: { data?: { code?: string } | null; message?: string } | null;
  };
  const code = record.data?.code ?? record.shape?.data?.code;
  if (code === "NOT_FOUND") return true;
  const message = `${record.message ?? ""} ${record.shape?.message ?? ""}`;
  return /No procedure found on path/i.test(message);
}

type CreateMutation = {
  mutateAsync: (input: CreatePelicanProductInput) => Promise<CreatePelicanProductResult>;
  isPending: boolean;
};

// `pelican.createProduct` ships in cabinet-backend PR #68.
// Cast until AppRouter includes it. A missing procedure returns NOT_FOUND.
export function useCreatePelicanProduct(): CreateMutation {
  const client = trpc as unknown as {
    pelican: {
      createProduct: {
        useMutation: () => CreateMutation;
      };
    };
  };
  return client.pelican.createProduct.useMutation();
}
