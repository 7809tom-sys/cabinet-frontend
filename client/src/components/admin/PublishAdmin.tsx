import { Fragment, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useAffiliateFeaturePublish, useSetAffiliateFeaturePublish } from "@/lib/useAffiliateFeaturePublish";
import {
  AFFILIATE_FEATURES,
  GLOBAL_SUBJECT_ID,
  GLOBAL_SUBJECT_KIND,
  SUBJECT_KILL_FEATURE_KEY,
  publishFlagOff,
  publishFlagOn,
  publishRowFor,
  type AffiliateFeatureKey,
  type PublishSubjectKind,
} from "@shared/affiliateFeaturePublish";
import { toast } from "sonner";

type DistributorRecord = {
  id: number;
  code?: string | null;
  name: string;
  isActive?: boolean | null;
};

type VendorRecord = {
  id: number;
  name: string;
  isApproved?: boolean | null;
  sourceKey?: string | null;
  linkedDistributor?: { id: number; code?: string | null; name?: string | null } | null;
};

type SubjectRow = {
  kind: PublishSubjectKind;
  id: number;
  code: string;
  name: string;
  note: string;
};

const SUBJECT_PAGE_SIZE = 8;

const OFF_EVERYWHERE_FEATURES = [
  ...AFFILIATE_FEATURES.filter((item) => item.key === "bathroom_builder"),
  ...AFFILIATE_FEATURES.filter((item) => item.key !== "bathroom_builder"),
];

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function usePublishSubjects() {
  const client = trpc as unknown as {
    distributorAdmin: { adminList: { useQuery: () => { data?: DistributorRecord[]; isLoading: boolean; error: { message: string } | null } } };
    vendors: { list: { useQuery: () => { data?: VendorRecord[]; isLoading: boolean; error: { message: string } | null } } };
  };
  const distributors = client.distributorAdmin.adminList.useQuery();
  const vendors = client.vendors.list.useQuery();
  const subjects = useMemo(() => {
    const lines = distributors.data ?? [];
    const vendorRows = vendors.data ?? [];
    const fromLines: SubjectRow[] = lines.map((line) => ({
      kind: "distributor",
      id: line.id,
      code: line.code || "—",
      name: line.name,
      note: line.isActive === false ? "Offline cabinet line" : "Cabinet line",
    }));
    const fromVendors: SubjectRow[] = vendorRows.map((vendor) => ({
        kind: "vendor",
        id: vendor.id,
        code: vendor.sourceKey || "—",
        name: vendor.name,
        note: vendor.linkedDistributor
          ? `Vendor linked to ${vendor.linkedDistributor.code || vendor.linkedDistributor.name || vendor.linkedDistributor.id}`
          : vendor.isApproved === false ? "Vendor, not approved" : "Vendor",
      }));
    return [...fromLines, ...fromVendors].sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
  }, [distributors.data, vendors.data]);
  return { distributors, vendors, subjects };
}

export default function PublishAdmin() {
  const { user, loading } = useAuth();
  const role = (user as { role?: string } | null)?.role;
  const { distributors, vendors, subjects } = usePublishSubjects();
  const publish = useAffiliateFeaturePublish();
  const save = useSetAffiliateFeaturePublish({
    onSuccess: () => toast.success("Publish for affiliates saved"),
    onError: (error) => toast.error(error.message || "Could not save Publish for affiliates"),
  });
  const [search, setSearch] = useState("");
  const [feature, setFeature] = useState<AffiliateFeatureKey | "all">("all");
  const [page, setPage] = useState(0);
  const canSave = publish.status === "ready" && !save.isPending;

  const filteredSubjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return subjects;
    return subjects.filter((subject) => `${subject.name} ${subject.code} ${subject.note}`.toLowerCase().includes(query));
  }, [subjects, search]);

  const features = feature === "all" ? AFFILIATE_FEATURES : AFFILIATE_FEATURES.filter((item) => item.key === feature);
  const pageCount = Math.max(1, Math.ceil(filteredSubjects.length / SUBJECT_PAGE_SIZE));
  const visibleSubjects = filteredSubjects.slice(page * SUBJECT_PAGE_SIZE, (page + 1) * SUBJECT_PAGE_SIZE);

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner /></div>;
  }
  if (role !== "admin") {
    return <p className="text-sm text-muted-foreground" data-testid="publish-denied">Publish is limited to platform administrators.</p>;
  }

  return (
    <section className="space-y-4" data-testid="publish-admin">
      <div>
        <h2 className="text-lg font-semibold">Publish</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every distributor and every vendor has one switch per feature. Publish for affiliates is off until you turn that row on. Off everywhere turns one feature off for all of them. Shut off turns every feature off for that distributor. Turning either switch back off restores the individual switches. Affiliate Literature is not here.
        </p>
      </div>
      {publish.status === "missing" && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950" role="status" data-testid="publish-backend-missing">
          The publish list is not on the API yet, so these switches cannot be saved and the changed-by time is blank. Run docs/sql/0269_affiliate_feature_publish.tidb.sql, then add distributorAdmin.listAffiliateFeaturePublish and distributorAdmin.setAffiliateFeaturePublish on cabinet-backend. Until those reads reject unpublished features, affiliate pages are not blocked by this tab.
        </p>
      )}
      {publish.status === "error" && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          Could not load publish state: {publish.errorMessage ?? "the request failed"}.
        </p>
      )}
      {publish.status === "ready" && publish.rows.length === 0 && (
        <p className="rounded-md border p-3 text-sm text-muted-foreground" data-testid="publish-none">
          No feature is published for affiliates. Affiliate screens that can read this list stay closed until a switch is on.
        </p>
      )}
      {(distributors.error || vendors.error) && (
        <div className="space-y-2">
          {distributors.error ? <p className="text-sm text-destructive" role="alert">Could not load distributors: {distributors.error.message}</p> : null}
          {vendors.error ? <p className="text-sm text-destructive" role="alert">Could not load vendors: {vendors.error.message}</p> : null}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border" data-testid="publish-off-everywhere">
        <ul>
          {OFF_EVERYWHERE_FEATURES.map((item) => {
            const stored = publish.status === "ready"
              ? publishRowFor(publish.rows, { kind: GLOBAL_SUBJECT_KIND, id: GLOBAL_SUBJECT_ID }, item.key)
              : null;
            const off = publishFlagOff(stored?.published);
            return (
              <li key={item.key} className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-0" data-testid={`off-everywhere-${item.key}`}>
                <div>
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {publish.status === "ready" ? (stored?.updatedByName || "—") : "—"}
                    {" · "}
                    {publish.status === "ready" ? formatWhen(stored?.updatedAt) : "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Off everywhere</span>
                  <Switch
                    checked={off}
                    disabled={!canSave}
                    aria-label={`Off everywhere: ${item.label}`}
                    onCheckedChange={(checked) => save.mutate({
                      subjectKind: GLOBAL_SUBJECT_KIND,
                      subjectId: GLOBAL_SUBJECT_ID,
                      featureKey: item.key,
                      published: !checked,
                    })}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="h-9 min-w-56 flex-1"
          value={search}
          placeholder="Search distributor or vendor…"
          aria-label="Search distributors and vendors"
          onChange={(event) => { setSearch(event.target.value); setPage(0); }}
        />
        <Select value={feature} onValueChange={(value) => { setFeature(value as AffiliateFeatureKey | "all"); setPage(0); }}>
          <SelectTrigger className="h-9 w-64" aria-label="Feature"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All features</SelectItem>
            {AFFILIATE_FEATURES.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary">{subjects.filter((subject) => subject.kind === "distributor").length} distributors</Badge>
        <Badge variant="secondary">{subjects.filter((subject) => subject.kind === "vendor").length} vendors</Badge>
        <Badge variant="secondary">{AFFILIATE_FEATURES.length} features</Badge>
      </div>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {AFFILIATE_FEATURES.map((item) => <li key={item.key}><span className="font-medium text-foreground">{item.label}.</span> {item.gatedIn}</li>)}
      </ul>
      {(distributors.isLoading || vendors.isLoading || publish.status === "loading") && <Spinner />}
      {!distributors.isLoading && !vendors.isLoading && subjects.length === 0 && !distributors.error && !vendors.error && (
        <p className="text-sm text-muted-foreground">No distributors or vendors are on file.</p>
      )}
      {visibleSubjects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Distributor / vendor</th>
                <th className="px-3 py-2 text-left font-medium">Code</th>
                <th className="px-3 py-2 text-left font-medium">Feature</th>
                <th className="px-3 py-2 text-left font-medium">Published</th>
                <th className="px-3 py-2 text-left font-medium">Changed by</th>
                <th className="px-3 py-2 text-left font-medium">Changed at</th>
                <th className="px-3 py-2 text-right font-medium">Publish for affiliates</th>
              </tr>
            </thead>
            <tbody>
              {visibleSubjects.map((subject) => {
                const kill = publish.status === "ready"
                  ? publishRowFor(publish.rows, { kind: subject.kind, id: subject.id }, SUBJECT_KILL_FEATURE_KEY)
                  : null;
                const shutOff = publishFlagOff(kill?.published);
                return (
                  <Fragment key={`${subject.kind}-${subject.id}`}>
                    {subject.kind === "distributor" && (
                      <tr className="border-b bg-muted/30" data-testid={`publish-shutoff-${subject.kind}-${subject.id}`}>
                        <td className="px-3 py-2" colSpan={6}>
                          <div className="font-medium">Shut off {subject.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {publish.status === "ready" ? (kill?.updatedByName || "—") : "—"}
                            {" · "}
                            {publish.status === "ready" ? formatWhen(kill?.updatedAt) : "—"}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-muted-foreground">Shut off {subject.name}</span>
                            <Switch
                              checked={shutOff}
                              disabled={!canSave}
                              aria-label={`Shut off ${subject.name}`}
                              onCheckedChange={(checked) => save.mutate({
                                subjectKind: subject.kind,
                                subjectId: subject.id,
                                featureKey: SUBJECT_KILL_FEATURE_KEY,
                                published: !checked,
                              })}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                    {features.map((item) => {
                      const stored = publish.status === "ready"
                        ? publishRowFor(publish.rows, { kind: subject.kind, id: subject.id }, item.key)
                        : null;
                      const published = publishFlagOn(stored?.published);
                      return (
                        <tr key={`${subject.kind}-${subject.id}-${item.key}`} className="border-b last:border-0" data-testid={`publish-row-${subject.kind}-${subject.id}-${item.key}`}>
                          <td className="px-3 py-2">
                            <div className="font-medium">{subject.name}</div>
                            <div className="text-xs text-muted-foreground">{subject.note}</div>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{subject.code}</td>
                          <td className="px-3 py-2">{item.label}</td>
                          <td className="px-3 py-2">
                            {publish.status === "ready" ? (
                              <Badge variant={published ? "default" : "secondary"}>{published ? "Published" : "Not published"}</Badge>
                            ) : (
                              <Badge variant="outline">Unknown</Badge>
                            )}
                          </td>
                          <td className="px-3 py-2">{publish.status === "ready" ? (stored?.updatedByName || "—") : "—"}</td>
                          <td className="px-3 py-2">{publish.status === "ready" ? formatWhen(stored?.updatedAt) : "—"}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">Publish for affiliates</span>
                              <Switch
                                checked={published}
                                disabled={!canSave}
                                aria-label={`Publish for affiliates: ${subject.name} ${item.label}`}
                                onCheckedChange={(checked) => save.mutate({
                                  subjectKind: subject.kind,
                                  subjectId: subject.id,
                                  featureKey: item.key,
                                  published: checked,
                                })}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {filteredSubjects.length > SUBJECT_PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {page + 1} of {pageCount}</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button>
            <Button type="button" size="sm" variant="outline" disabled={page + 1 >= pageCount} onClick={() => setPage((current) => current + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
}
