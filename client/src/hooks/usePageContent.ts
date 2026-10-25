/**
 * usePageContent — loads all admin-overridden page content from the DB
 * and provides helpers to read and update individual fields.
 *
 * Usage:
 *   const { get, upsert, reset, refetch } = usePageContent("home");
 *   // get("hero_title", "Default Title") → returns override or default
 *   // upsert("hero_title", "New Title")  → saves override to DB
 */
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export function usePageContent(pageKey: string) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: allContent, refetch } = trpc.pageContent.getAll.useQuery(
    undefined,
    { enabled: isAdmin, staleTime: 30_000 },
  );

  const upsertMut = trpc.pageContent.upsertField.useMutation({
    onSuccess: () => refetch(),
  });
  const resetMut = trpc.pageContent.resetField.useMutation({
    onSuccess: () => refetch(),
  });

  /** Get the current value for a field, falling back to defaultValue */
  function get(field: string, defaultValue: string): string {
    return allContent?.[pageKey]?.[field] ?? defaultValue;
  }

  /** Check if a field has been overridden */
  function hasOverride(field: string): boolean {
    return !!(allContent?.[pageKey]?.[field]);
  }

  /** Save an override for a field */
  function upsert(field: string, value: string) {
    return upsertMut.mutateAsync({ pageKey, field, value });
  }

  /** Remove the override for a field (revert to default) */
  function reset(field: string) {
    return resetMut.mutateAsync({ pageKey, field });
  }

  return { get, hasOverride, upsert, reset, refetch, isAdmin };
}
