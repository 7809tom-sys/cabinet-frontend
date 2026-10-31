#!/usr/bin/env python3
"""
DLC_FR26 reports (read-only; no SKU codes or prices are changed anywhere).

    python3 scripts/dlc_fr26_reports.py <extracted DLC_FR26 folder> <dl_prices.csv>

Writes to data/dlc-fr26/reports/:
  finish_name_map.csv            item 5: source finish file/name -> canonical finish, with the quirk noted
  cabinet_code_mapping.csv       item 5: 20-20 code (ItemList.Html) -> DL price-list SKU, match kind
  cabinet_code_mismatches.csv    item 5: DL SKUs with no 20-20 code, and 20-20 codes with no DL SKU summary counts
  missing_cabinet_pictures.csv   item 6: every ItemList picture that is not in the zip
"""
import csv, re, sys
from pathlib import Path

FINISH_MAP = [
    # source file stem, catalog code, canonical finish, quirk, status
    ("Arctic White", "AW?", "Arctic White", "", "ok"),
    ("Chestnut", "", "Chestnut", "", "ok"),
    ("Cyber Grey", "CG", "Cyber Grey", "'Grey' spelling; 'Dove Gray' / 'Grey Shaker' use the other spellings. Canonical spelling to be chosen by Tom.", "ok"),
    ("Dark Caramel", "DC", "Dark Caramel", "", "ok"),
    ("Dove Gray", "DG", "Dove Gray", "paf.xml display name is 'Dove Grey', file is 'Dove Gray'", "spelling-mixed"),
    ("Driftwood", "", "Driftwood", "photo shows a door only (no drawer front)", "ok"),
    ("EWO", "EWO", "European White Oak", "abbreviation; grain textures EWO_H / EWO_V exist", "abbreviation"),
    ("Expresso Shaker", "SSE", "Espresso Shaker", "misspelling of Espresso (source file name left as is)", "misspelled"),
    ("Glacier White", "GW", "Glacier White", "", "ok"),
    ("Grey Shaker", "", "Grey Shaker", "'Grey' spelling vs 'Dove Gray'", "spelling-mixed"),
    ("Ivory White", "", "Ivory White", "", "ok"),
    ("MC", "MC", "Midnight Cove (UNCONFIRMED)", "abbreviation; paf.xml says MC = Midnight Cove; Tom to confirm", "abbreviation-unconfirmed"),
    ("New York Glaze", "", "New York Glaze", "", "ok"),
    ("Pearl White", "PW", "Pearl White", "", "ok"),
    ("Peccan", "", "Pecan", "misspelling of Pecan (source file name left as is)", "misspelled"),
    ("Port", "", "Port", "", "ok"),
    ("Slim Shaker Alabaster", "SSA", "Slim Shaker Alabaster", "", "ok"),
    ("Slim Shaker Ebony", "", "Slim Shaker Ebony", "", "ok"),
    ("Versa Shaker", "VS", "Versa Shaker", "", "ok"),
    ("White Shaker", "WS", "White Shaker", "", "ok"),
    ("IMG", "", "(none)", "'image not available' placeholder; never used as a texture", "placeholder-excluded"),
]


def parse_items(html: str):
    out = []
    for block in re.split(r"<table", html)[1:]:
        m = re.search(r"User Code: </b>([^<]+)<br>", block)
        if not m:
            continue
        desc = re.search(r"Description: </b>([^<]*)<br>", block)
        img = re.search(r"Image name: </b>([^<]+)<br>", block)
        out.append((m.group(1).strip(), (desc.group(1).strip() if desc else ""), (img.group(1).strip() if img else "")))
    return out


def match_dl(code: str, dl: set):
    c = code.upper()
    if c in dl:
        return c, "exact"
    base = c.split(".")[0]
    if base != c and base in dl:
        return base, f"suffix-dropped({c[len(base):]})"
    if re.search(r"[LR]$", base) and base[:-1] in dl:
        return base[:-1], "handing-dropped(L/R)"
    if re.sub(r"^B(?=G)", "", c) in dl and c.startswith("BG"):
        return c[1:], "prefix-dropped(B)"
    return "", "no-match"


def main(a):
    src, dlp = Path(a[1]), Path(a[2])
    out = Path(__file__).resolve().parent.parent / "data" / "dlc-fr26" / "reports"
    out.mkdir(parents=True, exist_ok=True)
    present = {p.name.lower() for p in (src / "MultiMedia" / "Pictures").rglob("*.jpg")}
    items = parse_items((src / "MultiMedia" / "ItemList.Html").read_text(encoding="latin-1"))
    dl = {r["dlSku"].upper() for r in csv.DictReader(open(dlp, encoding="utf-8"))}

    with open(out / "finish_name_map.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["sourceFileStem", "catalogOptionCode", "canonicalFinish", "note", "status"]); w.writerows(FINISH_MAP)

    rows, hit = [], set()
    for code, desc, img in items:
        sku, kind = match_dl(code, dl)
        if sku:
            hit.add(sku)
        rows.append([code, desc, sku, kind])
    with open(out / "cabinet_code_mapping.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["twentyTwentyCode", "description", "dlSku", "matchKind"]); w.writerows(rows)
    unmatched_dl = sorted(dl - hit)
    with open(out / "cabinet_code_mismatches.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["side", "code", "note"])
        for r in rows:
            if r[3] == "no-match":
                w.writerow(["20-20 code not in DL price list", r[0], r[1]])
        for s in unmatched_dl:
            w.writerow(["DL SKU not found in 20-20 list", s, ""])
    with open(out / "missing_cabinet_pictures.csv", "w", newline="") as f:
        w = csv.writer(f); w.writerow(["twentyTwentyCode", "imageName", "inZip"])
        miss = 0
        for code, desc, img in items:
            ok = img.lower() in present
            miss += not ok
            if not ok:
                w.writerow([code, img, "no"])
    kinds = {}
    for r in rows:
        kinds[r[3].split("(")[0]] = kinds.get(r[3].split("(")[0], 0) + 1
    print(f"items={len(items)} kinds={kinds} dlSkus={len(dl)} dlMatched={len(hit)} dlUnmatched={len(unmatched_dl)} missingPictures={miss}")


if __name__ == "__main__":
    main(sys.argv)
