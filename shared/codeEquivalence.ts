/**
 * Two-way cabinet code equivalence groups.
 *
 * The catalog stores aliases as directed rows (`aliasCode -> masterCode`) in
 * `sku_master_aliases`, `cabinet_aliases`, and `cabinets.altSku1-3`. Pricing
 * used to follow exactly one hop in one direction, so ERB36 (Skyline code)
 * never reached BER36 (Madison code) when the design sat on a Madison line,
 * and a master whose only priced line carries an alias code was unpriced.
 *
 * This module turns every directed link into an undirected equivalence group
 * (union-find). Any code in a group resolves to every other code in the group,
 * so the caller can ask "which codes in this group does the ACTIVE line sell?"
 * The group never changes a price, a code, or a 3D shape: a cabinet keeps its
 * own catalog row; only price *lookup* widens to the group.
 *
 * Normalization (Part 5 rule 4): ignore hyphens, spaces, periods, underscores
 * and case. A single leading zero in the width segment is ignored (BT09 = BT9)
 * — only the first numeric segment, and only one leading zero. Other zeros are
 * preserved (B30 stays B30, W0936 keeps its 09 because it is already a 2-digit
 * width token that other codes write identically).
 */
export type CodeAliasLink = {
  aliasCode: string;
  masterCode: string;
};
export function normalizedEquivalenceCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  // Collapse a single leading zero on the FIRST numeric run only: BT09 -> BT9,
  // FHB-09 -> FHB9, ADA-BT09 -> ADABT9. Never touch B30 / W3030 / W0936-like
  // runs where the zero is not the leading digit of that run, and never
  // collapse "0" itself or multi-digit runs that start with "00".
  return compact.replace(/^([A-Z]*)0(\d)/, "$1$2");
}
export class CodeEquivalenceGroups {
  private parent = new Map<string, string>();
  /** Original spellings seen for each normalized key, first spelling wins. */
  private spellings = new Map<string, Set<string>>();
  private find(key: string): string {
    let root = key;
    while (this.parent.get(root) !== undefined && this.parent.get(root) !== root) root = this.parent.get(root)!;
    // path compression
    let cursor = key;
    while (this.parent.get(cursor) !== undefined && this.parent.get(cursor) !== root) {
      const next = this.parent.get(cursor)!;
      this.parent.set(cursor, root);
      cursor = next;
    }
    return root;
  }
  private ensure(code: string): string {
    const key = normalizedEquivalenceCode(code);
    if (!key) return key;
    if (!this.parent.has(key)) this.parent.set(key, key);
    const seen = this.spellings.get(key) ?? new Set<string>();
    seen.add(code.trim());
    this.spellings.set(key, seen);
    return key;
  }
  /** Register a code with no links (so it is still its own group). */
  add(code: string): this {
    this.ensure(code);
    return this;
  }
  link(a: string, b: string): this {
    const ka = this.ensure(a);
    const kb = this.ensure(b);
    if (!ka || !kb || ka === kb) return this;
    const ra = this.find(ka);
    const rb = this.find(kb);
    if (ra !== rb) this.parent.set(ra, rb);
    return this;
  }
  addLinks(links: readonly CodeAliasLink[]): this {
    for (const { aliasCode, masterCode } of links) this.link(aliasCode, masterCode);
    return this;
  }
  /** Normalized keys of every code equivalent to `code`, including itself. */
  groupKeys(code: string): string[] {
    const key = normalizedEquivalenceCode(code);
    if (!key) return [];
    if (!this.parent.has(key)) return [key];
    const root = this.find(key);
    const out: string[] = [];
    this.parent.forEach((_, candidate) => {
      if (this.find(candidate) === root) out.push(candidate);
    });
    return out.sort();
  }
  /** Every original spelling across the group (useful for SQL `IN (...)`). */
  groupSpellings(code: string): string[] {
    const out = new Set<string>();
    for (const key of this.groupKeys(code)) {
      this.spellings.get(key)?.forEach((spelling) => out.add(spelling));
    }
    const trimmed = code.trim();
    if (trimmed) out.add(trimmed);
    return Array.from(out).sort();
  }
  sameGroup(a: string, b: string): boolean {
    const ka = normalizedEquivalenceCode(a);
    const kb = normalizedEquivalenceCode(b);
    if (!ka || !kb) return false;
    if (ka === kb) return true;
    if (!this.parent.has(ka) || !this.parent.has(kb)) return false;
    return this.find(ka) === this.find(kb);
  }
  /** Every multi-member group as sorted spellings (admin visibility). */
  allGroups(): string[][] {
    const byRoot = new Map<string, Set<string>>();
    for (const key of Array.from(this.parent.keys())) {
      const root = this.find(key);
      const bucket = byRoot.get(root) ?? new Set<string>();
      this.spellings.get(key)?.forEach((spelling) => bucket.add(spelling));
      byRoot.set(root, bucket);
    }
    return Array.from(byRoot.values())
      .map((bucket) => Array.from(bucket).sort())
      .filter((group) => group.length > 1)
      .sort((a, b) => a[0].localeCompare(b[0]));
  }
}
/**
 * Pick, for one requested code, the catalog master codes in its equivalence
 * group that the active line actually sells. `soldCodes` are the codes the
 * active line/style has published+available price rows for (already filtered
 * server-side). Returns the exact requested code first when it is sold, so an
 * exact match always wins over an alias swap.
 */
export function resolveSoldCodesInGroup(
  groups: CodeEquivalenceGroups,
  requestedCode: string,
  soldCodes: readonly string[],
): string[] {
  const requestedKey = normalizedEquivalenceCode(requestedCode);
  const keys = new Set(groups.groupKeys(requestedCode));
  const exact: string[] = [];
  const others: string[] = [];
  for (const sold of soldCodes) {
    const key = normalizedEquivalenceCode(sold);
    if (!keys.has(key)) continue;
    (key === requestedKey ? exact : others).push(sold);
  }
  return [...exact, ...others.sort()];
}
