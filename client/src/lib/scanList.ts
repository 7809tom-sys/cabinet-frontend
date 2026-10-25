// Pure helpers for the Build-an-Order "Scan Barcode" tab.
// Kept dependency-free and side-effect-free so they can be unit-tested without
// a browser/camera. A scan list is an ordered set of {code, qty} pairs.

export type ScanItem = { code: string; qty: number };

// Normalize a scanned/typed code for de-dupe comparison: trim, collapse inner
// whitespace, uppercase. Display still uses the first-seen original casing.
export function normalizeScanCode(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase();
}

// Add a scanned code. If a matching (normalized) code already exists, bump its
// quantity instead of appending a duplicate row. Blank codes are ignored.
// Returns a NEW array (immutable) so it is safe for React state.
export function addScan(list: ScanItem[], rawCode: string, qty = 1): ScanItem[] {
  const code = rawCode.trim().replace(/\s+/g, " ");
  if (!code) return list;
  const add = Math.max(1, Math.round(qty || 1));
  const norm = normalizeScanCode(code);
  const idx = list.findIndex((it) => normalizeScanCode(it.code) === norm);
  if (idx === -1) return [...list, { code, qty: add }];
  const next = list.slice();
  next[idx] = { ...next[idx], qty: Math.min(999, next[idx].qty + add) };
  return next;
}

// Set an explicit quantity for the row at index. Clamps to 1..999. Out-of-range
// indices are ignored. Returns a new array.
export function setScanQty(list: ScanItem[], index: number, qty: number): ScanItem[] {
  if (index < 0 || index >= list.length) return list;
  const clamped = Math.max(1, Math.min(999, Math.round(qty || 1)));
  const next = list.slice();
  next[index] = { ...next[index], qty: clamped };
  return next;
}

// Remove the row at index. Out-of-range indices are ignored. Returns a new array.
export function removeScan(list: ScanItem[], index: number): ScanItem[] {
  if (index < 0 || index >= list.length) return list;
  return list.filter((_, i) => i !== index);
}

// Total number of physical units across all rows.
export function totalScanQty(list: ScanItem[]): number {
  return list.reduce((sum, it) => sum + it.qty, 0);
}
