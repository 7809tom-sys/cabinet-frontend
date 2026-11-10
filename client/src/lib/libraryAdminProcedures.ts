import { trpc } from "@/lib/trpc";
import {
  DEFAULT_LIBRARY_VISIBILITY,
  normalizeLibraryVisibility,
  type LibraryVisibility,
} from "@shared/libraryVisibility";

/**
 * The literature library's admin procedures.
 *
 * `affiliateLiterature.adminList / adminUpload / adminUpdate / adminDelete`
 * already ship on the backend. `visibility` and the affiliate-toggle audit
 * columns are added by docs/patches/cabinet-backend-library-internal-documents.patch,
 * which may be deployed after this frontend build. The rows are normalised here,
 * so the admin page renders correctly before and after that patch:
 *
 *   - a row with no `visibility` (the column has not run yet) reads as internal,
 *     which is the safe direction: an unknown document is admin-only.
 *   - the checkbox still sends `inAffiliateLibrary`, and the backend is what
 *     decides whether the column exists to write.
 *
 * This repo typechecks without the backend's AppRouter, so the client is cast
 * the same way `contractorAccessProcedures` and `walzcraftProfileUpload` do.
 * When AppRouter carries these procedures and fields, delete this file.
 */

export type LibraryDocument = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  filename: string;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  isPublished: boolean;
  sortOrder: number;
  visibility: LibraryVisibility;
  /** Null when the database has no documentRole column yet. */
  documentRole: string | null;
  affiliateToggledAt: string | Date | null;
  affiliateToggledByName: string | null;
  /** `affiliate_literature.createdAt`. Null only when an old payload omitted it. */
  createdAt: string | Date | null;
};

export type LibraryUploadInput = {
  title: string;
  description: string | null;
  category: string;
  filename: string;
  mimeType: string;
  dataBase64: string;
  inAffiliateLibrary: boolean;
  /** True files the upload in the Reference section. Defaults off in the form. */
  reference: boolean;
};

type ProcedureError = { message: string; data?: { code?: string } | null };

type MutationOptions<Result, Input> = {
  onSuccess?: (result: Result, input: Input) => void;
  onError?: (error: ProcedureError) => void;
  onSettled?: () => void;
};

type Mutation<Input> = {
  mutate: (input: Input) => void;
  mutateAsync: (input: Input) => Promise<unknown>;
  isPending: boolean;
};

export type RawLibraryDocument = Partial<Omit<LibraryDocument, "visibility">> & {
  id: number;
  title: string;
  fileKey?: string | null;
  visibility?: string | null;
  documentRole?: string | null;
  affiliateToggledAt?: string | Date | null;
  affiliateToggledByName?: string | null;
  createdAt?: string | Date | null;
};

/** A short-lived link to one private document, from `affiliateResources.adminSignedFile`. */
export type LibrarySignedFile = { url: string; filename: string | null; mimeType: string | null };

/** One row from the server, with the safe defaults applied. */
export function toLibraryDocument(row: RawLibraryDocument): LibraryDocument {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    category: row.category ?? "General",
    filename: row.filename ?? "",
    url: row.url ?? "",
    mimeType: row.mimeType ?? "application/pdf",
    sizeBytes: row.sizeBytes ?? null,
    isPublished: row.isPublished === true,
    sortOrder: row.sortOrder ?? 0,
    visibility: normalizeLibraryVisibility(row.visibility, DEFAULT_LIBRARY_VISIBILITY),
    documentRole: typeof row.documentRole === "string" && row.documentRole.trim() ? row.documentRole : null,
    affiliateToggledAt: row.affiliateToggledAt ?? null,
    affiliateToggledByName: row.affiliateToggledByName ?? null,
    createdAt: row.createdAt ?? null,
  };
}

type LibraryProcedures = {
  adminList: {
    useQuery: () => {
      data?: RawLibraryDocument[];
      isLoading: boolean;
      error: ProcedureError | null;
    };
  };
  adminUpload: {
    useMutation: (options?: MutationOptions<{ id: number; url: string }, LibraryUploadInput>) => Mutation<LibraryUploadInput>;
  };
  adminUpdate: {
    useMutation: (
      options?: MutationOptions<{ id: number }, { id: number; inAffiliateLibrary?: boolean; reference?: boolean }>,
    ) => Mutation<{ id: number; inAffiliateLibrary?: boolean; reference?: boolean }>;
  };
  adminDelete: {
    useMutation: (options?: MutationOptions<{ id: number }, { id: number }>) => Mutation<{ id: number }>;
  };
};

export function useAffiliateLiteratureAdmin() {
  const client = trpc as unknown as {
    affiliateLiterature: LibraryProcedures;
    useUtils: () => {
      affiliateLiterature: { adminList: { invalidate: () => Promise<void> } };
      /**
       * `fetch` lives on the utils proxy. Calling it on the procedure proxy
       * (`trpc.affiliateResources.adminSignedFile.fetch`) throws
       * `hooks[lastArg] is not a function`, which the production bundle
       * minifies to `e[i] is not a function`.
       */
      affiliateResources: {
        adminSignedFile: { fetch: (input: { id: number }) => Promise<LibrarySignedFile> };
      };
    };
  };
  const utils = client.useUtils();
  return {
    utils,
    list: client.affiliateLiterature.adminList.useQuery(),
    // useMutation stays on the procedure, called during this hook's render.
    upload: client.affiliateLiterature.adminUpload,
    update: client.affiliateLiterature.adminUpdate,
    remove: client.affiliateLiterature.adminDelete,
  };
}
