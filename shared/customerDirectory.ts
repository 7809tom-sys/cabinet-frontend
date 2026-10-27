/** Storefront view events are anonymous and are not tied to a person. */
export const BROWSING_HISTORY_NOTE =
  "Individual browsing history is not recorded. This timeline shows saved designs, quotes, estimates, and notes.";

export type CustomerStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export type CustomerSource =
  | "design"
  | "quote"
  | "order"
  | "lead"
  | "crm"
  | "estimate"
  | "storefront";

export type DirectoryAccess = {
  affiliateId: number;
  isOwner: boolean;
  accessCrm: boolean;
  accessDesigner: boolean;
} | null;

export type DirectoryActor = {
  role: string;
  access: DirectoryAccess;
};

export type DirectoryDecision =
  | { ok: true; affiliateId: number | null }
  | { ok: false; message: string };

/** Affiliate owners, CRM team members, and admins. Never the public. */
export function decideDirectoryAccess(
  actor: DirectoryActor,
  requestedAffiliateId: number | null,
): DirectoryDecision {
  if (actor.role === "admin") {
    return { ok: true, affiliateId: requestedAffiliateId };
  }
  const access = actor.access;
  if (!access) {
    return { ok: false, message: "No affiliate account is linked to your login." };
  }
  if (!access.isOwner && !access.accessCrm) {
    return { ok: false, message: "CRM access has not been enabled for this team member." };
  }
  if (requestedAffiliateId != null && requestedAffiliateId !== access.affiliateId) {
    return { ok: false, message: "You can only view customers for your own store." };
  }
  return { ok: true, affiliateId: access.affiliateId };
}

export function decideAssistAccess(args: {
  role: string;
  access: DirectoryAccess;
  designAffiliateId: number | null;
}): { ok: true } | { ok: false; message: string } {
  if (args.role === "admin") return { ok: true };
  const access = args.access;
  if (!access || (!access.isOwner && !access.accessDesigner)) {
    return { ok: false, message: "Designer access has not been enabled for this team member." };
  }
  if (args.designAffiliateId == null || access.affiliateId !== args.designAffiliateId) {
    return { ok: false, message: "This design belongs to another store." };
  }
  return { ok: true };
}

export function canEditCustomerProject(callerUserId: number, projectUserId: number): boolean {
  return callerUserId === projectUserId;
}

/** Affiliates may note and follow up. They cannot edit or delete the project. */
export function affiliateCanMutateCustomerProject(): false {
  return false;
}

export function canDeleteCustomerDesign(callerUserId: number, ownerUserId: number | null): boolean {
  return ownerUserId != null && callerUserId === ownerUserId;
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  return email.includes("@") ? email : null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

export function customerKey(parts: {
  userId?: number | null;
  email?: string | null;
  phone?: string | null;
}): string | null {
  if (parts.userId != null && parts.userId > 0) return `user:${parts.userId}`;
  const email = normalizeEmail(parts.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(parts.phone);
  if (phone) return `phone:${phone}`;
  return null;
}

const STAGE_TO_STATUS: Record<string, CustomerStatus> = {
  new: "new",
  contacted: "contacted",
  qualified: "contacted",
  image_review: "contacted",
  quoted: "quoted",
  won: "won",
  lost: "lost",
};

export function statusFromStage(stage: string | null | undefined): CustomerStatus {
  if (!stage) return "new";
  return STAGE_TO_STATUS[stage] ?? "new";
}

export type RawCustomerRecord = {
  affiliateId: number | null;
  userId?: number | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: CustomerSource;
  seenAt: string | Date;
  activityAt?: string | Date | null;
  designId?: number | null;
  designName?: string | null;
  thumbnailUrl?: string | null;
  unfinishedDesign?: boolean;
  orderId?: number | null;
  orderNumber?: string | null;
  orderStatus?: string | null;
  orderTotal?: number | null;
  estimateId?: number | null;
  estimateTotal?: number | null;
  estimateStatus?: string | null;
  dealId?: number | null;
  dealStage?: string | null;
  followUpAt?: string | Date | null;
  projectId?: number | null;
};

export type CustomerDesignSummary = {
  id: number;
  name: string;
  thumbnailUrl: string | null;
  unfinished: boolean;
  seenAt: string;
};

export type CustomerQuoteSummary = {
  id: number;
  number: string | null;
  status: string;
  total: number | null;
  kind: "quote" | "order";
  seenAt: string;
};

export type UnifiedCustomer = {
  key: string;
  affiliateId: number | null;
  userId: number | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  sources: CustomerSource[];
  primarySource: CustomerSource;
  firstSeen: string;
  lastActivity: string;
  status: CustomerStatus;
  dealId: number | null;
  followUpAt: string | null;
  designCount: number;
  quoteCount: number;
  orderCount: number;
  projectCount: number;
  unfinishedDesignCount: number;
  openQuoteCount: number;
  totalValue: number;
  designs: CustomerDesignSummary[];
  quotes: CustomerQuoteSummary[];
};

function iso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function earlier(a: string, b: string): string {
  return a < b ? a : b;
}

function later(a: string, b: string): string {
  return a > b ? a : b;
}

class UnionFind {
  private parent = new Map<string, string>();
  find(key: string): string {
    const current = this.parent.get(key);
    if (!current) {
      this.parent.set(key, key);
      return key;
    }
    if (current === key) return key;
    const root = this.find(current);
    this.parent.set(key, root);
    return root;
  }
  union(left: string, right: string) {
    const a = this.find(left);
    const b = this.find(right);
    if (a !== b) this.parent.set(b, a);
  }
}

function identityTokens(row: RawCustomerRecord): string[] {
  const tokens: string[] = [];
  if (row.userId != null && row.userId > 0) tokens.push(`u:${row.userId}`);
  const email = normalizeEmail(row.email);
  if (email) tokens.push(`e:${email}`);
  const phone = normalizePhone(row.phone);
  if (phone) tokens.push(`p:${phone}`);
  return tokens;
}

const OPEN_QUOTE = new Set(["draft", "submitted"]);

export function mergeCustomers(rows: readonly RawCustomerRecord[]): UnifiedCustomer[] {
  const scoped = rows.filter((row) => identityTokens(row).length > 0);
  const uf = new UnionFind();
  for (const row of scoped) {
    const tokens = identityTokens(row);
    for (let i = 1; i < tokens.length; i += 1) uf.union(tokens[0]!, tokens[i]!);
  }
  const groups = new Map<string, RawCustomerRecord[]>();
  for (const row of scoped) {
    const root = uf.find(identityTokens(row)[0]!);
    const list = groups.get(root) ?? [];
    list.push(row);
    groups.set(root, list);
  }

  const customers: UnifiedCustomer[] = [];
  for (const group of Array.from(groups.values())) {
    const userId = group.find((row) => row.userId != null && row.userId > 0)?.userId ?? null;
    const email = group.map((row) => normalizeEmail(row.email)).find(Boolean) ?? null;
    const phone = group.map((row) => normalizePhone(row.phone)).find(Boolean) ?? null;
    const key = customerKey({ userId, email, phone });
    if (!key) continue;
    const name = group.map((row) => row.name?.trim()).find((value) => value && value.length > 0) ?? email ?? "Customer";
    const company = group.map((row) => row.company?.trim()).find(Boolean) ?? null;
    const sources = Array.from(new Set(group.map((row) => row.source)));
    const times = group.map((row) => iso(row.seenAt)).filter((value): value is string => Boolean(value));
    const activities = group
      .map((row) => iso(row.activityAt) ?? iso(row.seenAt))
      .filter((value): value is string => Boolean(value));
    const firstSeen = times.length > 0 ? times.reduce(earlier) : new Date(0).toISOString();
    const lastActivity = activities.length > 0 ? activities.reduce(later) : firstSeen;
    const deal = [...group]
      .filter((row) => row.dealId != null && row.dealStage)
      .sort((a, b) => (iso(a.activityAt) ?? "").localeCompare(iso(b.activityAt) ?? ""))
      .at(-1);
    const follow = [...group]
      .filter((row) => row.followUpAt)
      .sort((a, b) => (iso(a.followUpAt) ?? "").localeCompare(iso(b.followUpAt) ?? ""))
      .at(-1);
    const designs = new Map<number, CustomerDesignSummary>();
    const quotes = new Map<number, CustomerQuoteSummary>();
    const projects = new Set<number>();
    let totalValue = 0;
    const valuedOrders = new Set<number>();
    const valuedEstimates = new Set<number>();
    for (const row of group) {
      if (row.designId != null && !designs.has(row.designId)) {
        designs.set(row.designId, {
          id: row.designId,
          name: row.designName?.trim() || `Design ${row.designId}`,
          thumbnailUrl: row.thumbnailUrl ?? null,
          unfinished: Boolean(row.unfinishedDesign),
          seenAt: iso(row.seenAt) ?? firstSeen,
        });
      }
      if (row.orderId != null && !quotes.has(row.orderId)) {
        const status = row.orderStatus ?? "draft";
        quotes.set(row.orderId, {
          id: row.orderId,
          number: row.orderNumber ?? null,
          status,
          total: row.orderTotal ?? null,
          kind: status === "confirmed" ? "order" : "quote",
          seenAt: iso(row.seenAt) ?? firstSeen,
        });
        if (!valuedOrders.has(row.orderId) && row.orderTotal != null && status !== "cancelled") {
          valuedOrders.add(row.orderId);
          totalValue += row.orderTotal;
        }
      }
      if (row.estimateId != null && row.estimateTotal != null && !valuedEstimates.has(row.estimateId)) {
        valuedEstimates.add(row.estimateId);
        totalValue += row.estimateTotal;
      }
      if (row.projectId != null) projects.add(row.projectId);
    }
    const quoteList = Array.from(quotes.values());
    customers.push({
      key,
      affiliateId: group.find((row) => row.affiliateId != null)?.affiliateId ?? null,
      userId,
      name,
      email,
      phone,
      company,
      sources,
      primarySource: sources[0] ?? "lead",
      firstSeen,
      lastActivity,
      status: statusFromStage(deal?.dealStage),
      dealId: deal?.dealId ?? null,
      followUpAt: iso(follow?.followUpAt ?? null),
      designCount: designs.size,
      quoteCount: quoteList.filter((quote) => quote.kind === "quote" && quote.status !== "cancelled").length,
      orderCount: quoteList.filter((quote) => quote.kind === "order").length,
      projectCount: projects.size,
      unfinishedDesignCount: Array.from(designs.values()).filter((design) => design.unfinished).length,
      openQuoteCount: quoteList.filter((quote) => OPEN_QUOTE.has(quote.status)).length,
      totalValue: Math.round(totalValue * 100) / 100,
      designs: Array.from(designs.values()),
      quotes: quoteList,
    });
  }
  return customers.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));
}

export type CustomerListFilters = {
  search?: string;
  source?: CustomerSource | "all";
  status?: CustomerStatus | "all";
  from?: string | null;
  to?: string | null;
  hasOpenQuote?: boolean;
  unfinishedDesign?: boolean;
  followUpsDue?: boolean;
  now?: string;
  sort?: "name" | "firstSeen" | "lastActivity" | "totalValue" | "status";
  direction?: "asc" | "desc";
};

export function filterCustomers(customers: readonly UnifiedCustomer[], filters: CustomerListFilters): UnifiedCustomer[] {
  const search = filters.search?.trim().toLowerCase() ?? "";
  const now = filters.now ?? new Date().toISOString();
  const filtered = customers.filter((customer) => {
    if (search) {
      const haystack = [customer.name, customer.email, customer.phone, customer.company].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.source && filters.source !== "all" && !customer.sources.includes(filters.source)) return false;
    if (filters.status && filters.status !== "all" && customer.status !== filters.status) return false;
    if (filters.from && customer.lastActivity < filters.from) return false;
    if (filters.to && customer.lastActivity > filters.to) return false;
    if (filters.hasOpenQuote && customer.openQuoteCount < 1) return false;
    if (filters.unfinishedDesign && customer.unfinishedDesignCount < 1) return false;
    if (filters.followUpsDue) {
      if (!customer.followUpAt || customer.followUpAt > now) return false;
      if (customer.status === "won" || customer.status === "lost") return false;
    }
    return true;
  });
  const direction = filters.direction === "asc" ? 1 : -1;
  const sort = filters.sort ?? "lastActivity";
  return [...filtered].sort((a, b) => {
    const left = sort === "name" ? a.name.toLowerCase() : sort === "status" ? a.status : sort === "totalValue" ? a.totalValue : sort === "firstSeen" ? a.firstSeen : a.lastActivity;
    const right = sort === "name" ? b.name.toLowerCase() : sort === "status" ? b.status : sort === "totalValue" ? b.totalValue : sort === "firstSeen" ? b.firstSeen : b.lastActivity;
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
}

export function customersToCsv(customers: readonly UnifiedCustomer[]): string {
  const header = ["Name", "Email", "Phone", "Source", "First seen", "Last activity", "Status", "Deal", "Designs", "Quotes", "Orders", "Total value"];
  const lines = customers.map((customer) => [
    customer.name,
    customer.email ?? "",
    customer.phone ?? "",
    customer.sources.join("|"),
    customer.firstSeen,
    customer.lastActivity,
    customer.status,
    customer.dealId ?? "",
    customer.designCount,
    customer.quoteCount,
    customer.orderCount,
    customer.totalValue.toFixed(2),
  ].map(csvCell).join(","));
  return [header.join(","), ...lines].join("\n");
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function activitySummary(customer: Pick<UnifiedCustomer, "designCount" | "quoteCount" | "projectCount" | "lastActivity">, now = new Date()): string {
  const parts = [
    `${customer.designCount} design${customer.designCount === 1 ? "" : "s"} saved`,
    `${customer.quoteCount} quote${customer.quoteCount === 1 ? "" : "s"}`,
    `${customer.projectCount} project${customer.projectCount === 1 ? "" : "s"}`,
  ];
  const relative = relativeActivity(customer.lastActivity, now);
  if (relative) parts.push(`last active ${relative}`);
  return parts.join(" · ");
}

export function relativeActivity(isoTime: string, now: Date): string | null {
  const then = new Date(isoTime).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((now.getTime() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export function customerPagePath(args: {
  affiliateId: number | null;
  customerKey: string;
  admin: boolean;
}): string {
  const params = new URLSearchParams({ section: "customers", customer: args.customerKey });
  if (args.admin && args.affiliateId != null) params.set("viewAs", String(args.affiliateId));
  if (args.admin && args.affiliateId == null) params.set("scope", "house");
  return `/affiliate?${params.toString()}`;
}
