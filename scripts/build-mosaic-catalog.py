#!/usr/bin/env python3
"""Rebuild the Designer's mosaic catalog from Pelican Int'l's own storefront.

What this does, in order:

1. Reads the distributor's product list (`/products.json`) and the mosaic collection, so the
   product names, SKUs, sheet sizes, material descriptions and product pages come from the
   distributor, not from this repo.
2. Downloads each product's own product photos.
3. Picks, per product, the photo whose content box matches the published sheet aspect (a
   complete sheet) in preference to a close-up, and rejects a staged room photo outright.
4. Measures the photo's grout bands, which turns the photo into a ruler:
     - complete sheet -> the published width IS the ruler, so the grout width is measured;
     - close-up       -> the 1/16 in. mosaic joint is the ruler, so the module is how much
                         product the crop spans (never more than one sheet).
5. Bakes a tileable texture from that photo at the module size, keeping the photographed chip
   shapes undistorted.
6. Writes `client/src/lib/mosaicCatalog.data.ts`.

Nothing is invented: a product the distributor lists but publishes no photo for is written
into `UNRESOLVED_MOSAICS` with no texture.

Usage:
    python3 scripts/build-mosaic-catalog.py [--cache DIR]

Requires: Pillow, numpy, scipy.
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import urllib.request
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_TEXTURES = os.path.join(REPO, "client/public/textures/mosaics")
OUT_DATA = os.path.join(REPO, "client/src/lib/mosaicCatalog.data.ts")
STORE = "https://buildpelican.com"
TILE_CATEGORY = "Tile & Mosaic"
MAX_SRC = 1600
TARGET_PX = 1024
GROUT_RULE_IN = 1 / 16          # the codebase's own mosaic joint rule
GROUT_MIN_IN = 1 / 16
GROUT_MAX_IN = 1 / 8
SHEET_ASPECT_TOLERANCE = 0.03   # a complete sheet matches its printed aspect this closely
WHITE_RING_MIN = 0.85           # a studio sheet floats on a white surround
SOURCE_DATE = "2026-11-02"

# Chip pattern and finish per product, read off each product's own sheet.
PATTERN: dict[str, str] = {
    "Arctic Vail": "picket", "Carbon Hex": "hex", "Carrara Subway": "subway",
    "Cloudline Marble": "linear", "Concord Square": "square", "Desert Clay": "square",
    "Earthstone Blend": "square", "Emerald Dust": "linear", "Forest Stone": "square",
    "Frosted Slate": "linear", "Glacier Shift": "chevron", "Golden Trace": "square",
    "Greenline Square": "framed-square", "Greystone Bloom": "bloom", "Icestone Flux": "diamond",
    "Icy Haze": "square", "Ivory Bloom": "bloom", "Midnight Mist": "linear",
    "Misty Coast": "linear", "Mocha Ridge": "subway", "Moonlight Shadow": "linear",
    "Moonstone Hex": "hex", "Mystic Trace": "linear", "Noble Row": "brick",
    "Noir Block": "framed-square", "Oat Stone": "subway", "Palace Arch": "lantern",
    "Pearled Hex": "hex", "Pewter Glow": "square", "Polar Sea": "linear",
    "Pure Botanica": "floral", "Rustic Umber": "linear", "Sailors Knot": "lattice",
    "Santorini Blue": "linear", "Shell Radiance": "clover", "Silver Drift": "linear",
    "Stonewave Gray": "subway", "Taupe Vail": "subway", "Thassos Subway": "subway",
    "Tidal Teal": "linear", "Winter Harbor": "picket",
}

GEOMETRY = {
    "picket": "Elongated hexagons set in mirrored vertical columns",
    "hex": "Regular hexagons in a honeycomb",
    "subway": "Rectangles in a running bond",
    "brick": "Thin bricks in a running bond",
    "square": "Squares in a straight-set grid",
    "diamond": "Squares set on the diagonal",
    "linear": "Horizontal strips of mixed length",
    "herringbone": "Rectangles in an angled herringbone",
    "chevron": "Parallelograms meeting in a continuous chevron",
    "framed-square": "Concentric framed square",
    "bloom": "Hexagons and diamonds cut into a star bloom",
    "lantern": "Arabesque lantern shape",
    "floral": "Petal tiles in an interlocking floral repeat",
    "lattice": "Diamond chips held in a lattice",
    "clover": "Squares with rounded clover corners",
}

FINISH_OVERRIDE = {
    "Glacier Shift": "polished", "Pearled Hex": "iridescent", "Shell Radiance": "iridescent",
    "Arctic Vail": "satin", "Greystone Bloom": "honed", "Ivory Bloom": "honed",
    "Icestone Flux": "honed",
}
HONED = {
    "Arctic Vail", "Carrara Subway", "Glacier Shift", "Moonstone Hex", "Stonewave Gray",
    "Taupe Vail", "Thassos Subway", "Winter Harbor", "Greenline Square", "Noir Block",
    "Palace Arch", "Pure Botanica", "Greystone Bloom", "Ivory Bloom", "Icestone Flux",
}


def material_family(description: str) -> str:
    d = description.lower()
    if "marble & glass & stainless" in d:
        return "marble-glass-stainless"
    if "glass & stainless" in d:
        return "glass-stainless"
    if "glass & aluminum" in d:
        return "glass-aluminum"
    if "glass & shell" in d:
        return "glass-shell"
    if "marble & aluminum" in d:
        return "marble-aluminum"
    if "glass & marble" in d or "marble & glass" in d:
        return "glass-marble"
    if "recycle" in d:
        return "recycled-glass"
    if "glass" in d:
        return "glass"
    return "marble"


def finish_for(description: str, name: str) -> str:
    if name in FINISH_OVERRIDE:
        return FINISH_OVERRIDE[name]
    d = description.lower()
    if name in HONED:
        return "honed"
    if "glass" in d and "marble" not in d:
        return "gloss"
    return "polished"


def luma(hex_color: str) -> float:
    n = int(hex_color[1:], 16)
    return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)


# ---------------------------------------------------------------- distributor data


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": "CabinetDealz mosaic catalog builder"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_products() -> dict[str, dict]:
    products: list[dict] = []
    page = 1
    while True:
        payload = fetch_json(f"{STORE}/products.json?limit=250&page={page}")
        batch = payload.get("products", [])
        if not batch:
            break
        products += batch
        page += 1
    mosaic = fetch_json(f"{STORE}/collections/mosaic-tiles/products.json?limit=250").get("products", [])
    by_title = {p["title"].strip().lower(): p for p in products}
    by_title.update({p["title"].strip().lower(): p for p in mosaic})
    return by_title


def download(url: str, path: str) -> bool:
    if os.path.exists(path) and os.path.getsize(path) > 1000:
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=90) as response, open(path, "wb") as handle:
            handle.write(response.read())
        return True
    except Exception as error:  # noqa: BLE001 - a missing photo is data, not a crash
        print(f"    could not download {url}: {error}")
        return False


# ---------------------------------------------------------------- photo measurement


def load_rgb(path: str) -> np.ndarray:
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.uint8)


def content_box(rgb: np.ndarray) -> tuple[int, int, int, int] | None:
    """Bounding box of the sheet inside a white studio photo."""
    gray = rgb.astype(np.float64).mean(axis=2)
    dark = gray < 246
    xs = np.where(dark.mean(axis=0) > 0.30)[0]
    ys = np.where(dark.mean(axis=1) > 0.30)[0]
    if xs.size < 8 or ys.size < 8:
        return None
    return int(xs[0]), int(ys[0]), int(xs[-1]) + 1, int(ys[-1]) + 1


def white_ring(rgb: np.ndarray) -> float:
    gray = rgb.astype(np.float64).mean(axis=2)
    h, w = gray.shape
    r = max(2, int(min(h, w) * 0.03))
    ring = np.concatenate([gray[:r, :].ravel(), gray[-r:, :].ravel(), gray[:, :r].ravel(), gray[:, -r:].ravel()])
    return float((ring > 243).mean())


def joint_mask(rgb: np.ndarray) -> np.ndarray:
    """Pixels darker than the local chip field: the mounting gap between chips."""
    im = Image.fromarray(rgb)
    radius = max(2, min(rgb.shape[:2]) // 130)
    blur = np.asarray(im.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float64)
    gray = rgb.astype(np.float64).mean(axis=2)
    i16 = rgb.astype(np.int16)
    chroma = i16.max(axis=2) - i16.min(axis=2)
    return ((blur.mean(axis=2) - gray) > 8) & (chroma < 58)


def _bands(coverage: np.ndarray, floor: float, max_w: int) -> list[int]:
    widths: list[int] = []
    i, n = 0, len(coverage)
    while i < n:
        if coverage[i] < floor:
            i += 1
            continue
        j = i
        while j < n and coverage[j] >= floor:
            j += 1
        if 1 <= j - i <= max_w:
            widths.append(j - i)
        i = j
    return widths


def measure_joint(rgb: np.ndarray) -> tuple[float, float]:
    """Median joint width in pixels and how consistent it is."""
    ch, cw = rgb.shape[:2]
    mask = joint_mask(rgb)
    max_w = max(3, int(min(cw, ch) * 0.03))
    widths: list[int] = []
    for axis in (0, 1):
        coverage = mask.mean(axis=axis)
        widths += _bands(coverage, max(0.25, float(np.percentile(coverage, 85))), max_w)
    if len(widths) < 4:
        return 0.0, 1.0
    med = float(np.median(widths))
    spread = float(np.std(widths) / med) if med else 1.0
    return med, spread


def grout_hex(rgb: np.ndarray, mask: np.ndarray) -> str | None:
    sampled = rgb[mask]
    if len(sampled) < 200:
        return None
    med = np.median(sampled, axis=0)
    return "#{:02x}{:02x}{:02x}".format(*(int(round(v)) for v in med))


def palette(rgb: np.ndarray, k: int = 5) -> list[tuple[str, float]]:
    """Coarse chip palette, white surround excluded."""
    small = np.asarray(Image.fromarray(rgb).resize((72, 72), Image.LANCZOS), dtype=np.int16)
    flat = small.reshape(-1, 3)
    keep = ~((flat[:, 0] > 250) & (flat[:, 1] > 250) & (flat[:, 2] > 250))
    body = flat[keep] if keep.sum() >= 500 else flat
    rng = np.random.default_rng(7)
    points = body.astype(np.float64)
    centers = points[rng.choice(len(points), min(k, len(points)), replace=False)]
    for _ in range(20):
        labels = ((points[:, None, :] - centers[None, :, :]) ** 2).sum(axis=2).argmin(axis=1)
        for index in range(len(centers)):
            sel = points[labels == index]
            if len(sel):
                centers[index] = sel.mean(axis=0)
    weights = np.array([(labels == index).sum() for index in range(len(centers))], dtype=float)
    order = np.argsort(-weights)
    total = max(1.0, weights.sum())
    return [
        ("#{:02x}{:02x}{:02x}".format(*(int(round(v)) for v in centers[i])), round(float(weights[i] / total), 3))
        for i in order
    ]


def chip_area_side(rgb: np.ndarray, sheet_in: tuple[float, float]) -> float | None:
    """Square-root of the median chip area, in inches: an independent size check."""
    mask = joint_mask(rgb)
    chips = ndimage.binary_opening(~mask, structure=np.ones((3, 3)))
    labels, count = ndimage.label(chips)
    if count == 0:
        return None
    areas = ndimage.sum(chips, labels, range(1, count + 1))
    total = rgb.shape[0] * rgb.shape[1]
    keep = areas >= total * 0.0006
    if keep.sum() < 4:
        return None
    return float((np.median(areas[keep]) / total * sheet_in[0] * sheet_in[1]) ** 0.5)


# ---------------------------------------------------------------- per-product bake


@dataclass
class Candidate:
    index: int
    path: str
    box: tuple[int, int, int, int]
    aspect: float
    white_ring: float

    @property
    def complete_sheet(self) -> bool:
        return self.white_ring >= WHITE_RING_MIN


def choose_photo(paths: list[str], sheet_in: tuple[float, float]) -> Candidate | None:
    """Prefer a complete studio sheet whose content box matches the printed aspect."""
    target = sheet_in[0] / sheet_in[1]
    candidates: list[Candidate] = []
    for index, path in enumerate(paths):
        rgb = load_rgb(path)
        h, w = rgb.shape[:2]
        scale = min(1.0, MAX_SRC / max(w, h))
        if scale < 1:
            rgb = np.asarray(Image.fromarray(rgb).resize((round(w * scale), round(h * scale)), Image.LANCZOS))
        box = content_box(rgb)
        if box is None:
            continue
        aspect = (box[2] - box[0]) / (box[3] - box[1])
        candidates.append(Candidate(index, path, box, aspect, white_ring(rgb)))
    if not candidates:
        return None
    # A staged room photo has no white studio surround; never use one as a texture.
    sheets = [c for c in candidates if c.complete_sheet] or candidates
    exact = [c for c in sheets if abs(c.aspect - target) / target <= SHEET_ASPECT_TOLERANCE]
    if exact:
        return exact[0]
    return min(sheets, key=lambda c: abs(c.aspect - target) / target)


def bake_texture(photo: Candidate, slug: str, sheet_in: tuple[float, float]) -> dict:
    rgb = load_rgb(photo.path)
    h, w = rgb.shape[:2]
    scale = min(1.0, MAX_SRC / max(w, h))
    if scale < 1:
        rgb = np.asarray(Image.fromarray(rgb).resize((round(w * scale), round(h * scale)), Image.LANCZOS))
    x0, y0, x1, y1 = photo.box
    face = Image.fromarray(rgb[y0:y1, x0:x1])
    fw, fh = face.size
    face_rgb = np.asarray(face, dtype=np.uint8)

    joint_px, spread = measure_joint(face_rgb)
    target_aspect = sheet_in[0] / sheet_in[1]
    is_complete = photo.complete_sheet and abs(photo.aspect - target_aspect) / target_aspect <= SHEET_ASPECT_TOLERANCE

    if is_complete:
        # The published width is the ruler, so a legible joint becomes a real measurement. When the
        # joint cannot be read, the sheet still repeats at its printed size but the width is an
        # estimate, and the record says so.
        module_w = sheet_in[0]
        module_h = module_w * fh / fw
        legible = bool(joint_px) and spread <= 1.2
        grout_in = min(GROUT_MAX_IN, max(GROUT_MIN_IN, joint_px * (sheet_in[0] / fw))) if legible else GROUT_RULE_IN
        grout_measured = legible
        source = "measured-from-sheet" if legible else "sheet-size"
    elif joint_px and spread <= 1.2:
        # The 1/16 in. joint is the ruler: this is how much product the crop spans.
        module_w = min(GROUT_RULE_IN / joint_px * fw, sheet_in[0])
        module_h = module_w * fh / fw
        grout_in = GROUT_RULE_IN
        grout_measured = False
        source = "joint-derived"
    else:
        # Joints too faint to measure: anchor on the printed width and never claim more than a sheet.
        module_w = sheet_in[0]
        module_h = module_w * fh / fw
        grout_in = GROUT_RULE_IN
        grout_measured = False
        source = "sheet-size"
    if module_h > sheet_in[1]:
        module_h = sheet_in[1]
        module_w = module_h * fw / fh

    factor = TARGET_PX / max(fw, fh)
    out_w, out_h = max(64, round(fw * factor)), max(64, round(fh * factor))
    os.makedirs(OUT_TEXTURES, exist_ok=True)
    face.resize((out_w, out_h), Image.LANCZOS).save(
        os.path.join(OUT_TEXTURES, f"{slug}.webp"), "WEBP", quality=90, method=6
    )

    pal = palette(face_rgb)
    sampled_grout = grout_hex(face_rgb, joint_mask(face_rgb) & (np.abs(np.diff(face_rgb.mean(axis=2), axis=0, prepend=0)) > 0))
    return {
        "moduleIn": [round(module_w, 3), round(module_h, 3)],
        "texturePx": [out_w, out_h],
        "groutIn": round(grout_in, 5),
        "groutInMeasured": grout_measured,
        "scaleSource": source,
        "groutColor": sampled_grout or max((c for c, _ in pal), key=luma),
        "groutColorSampled": bool(sampled_grout),
        "palette": [c for c, _ in pal[:4]],
        "chipSideIn": round(chip_area_side(face_rgb, sheet_in) or 0.0, 3),
    }


# ---------------------------------------------------------------- emit


def emit(entries: list[dict], non_mosaic: list[dict], unresolved: list[dict]) -> None:
    def js(value: object) -> str:
        return json.dumps(value)

    lines = [
        "/**",
        " * The Pelican Int'l Tile & Mosaic catalog, as the Designer renders it.",
        " *",
        " * GENERATED FILE - do not hand-edit. Rebuild with `python3 scripts/build-mosaic-catalog.py`.",
        " *",
        " * Every value is one of two things and nothing else:",
        " *  - published by the distributor on www.buildpelican.com (name, SKU, sheet size, material",
        " *    family, product page), or",
        " *  - measured from that same product's own product photo (texture, chip palette, and the",
        " *    grout width wherever the photo's joints are legible).",
        " *",
        " * `scaleSource` says which ruler fixed the module size:",
        " *  - \"measured-from-sheet\": the photo is the whole sheet, so the published size IS the module",
        " *    and the grout width is a real measurement (`groutInMeasured: true`).",
        " *  - \"joint-derived\": a close-up, so the 1/16 in. mosaic joint turns the photo into a ruler for",
        " *    how much product the crop covers. Chips keep their photographed shape and scale together.",
        " *  - \"sheet-size\": the photo's joints were too faint to measure, so it anchors on the printed",
        " *    sheet width rather than claiming a size it cannot prove.",
        " *",
        " * A mosaic the distributor lists but publishes no source for stays in `UNRESOLVED_MOSAICS`",
        " * with no texture. Nothing here is invented.",
        " */",
        f'export const MOSAIC_CATALOG_SOURCE_DATE = "{SOURCE_DATE}";',
        "",
        "export type MosaicPatternKind =",
        *[f'  | "{kind}"' for kind in sorted(set(PATTERN.values()))],
        "  ;",
        "",
        "/** Material family, copied from the distributor's own product description. */",
        "export type MosaicMaterialFamily =",
        '  | "marble"',
        '  | "glass"',
        '  | "recycled-glass"',
        '  | "glass-marble"',
        '  | "glass-stainless"',
        '  | "glass-aluminum"',
        '  | "glass-shell"',
        '  | "marble-aluminum"',
        '  | "marble-glass-stainless";',
        "",
        'export type MosaicSurfaceFinish = "polished" | "honed" | "satin" | "gloss" | "iridescent";',
        "",
        "/** Which measurement fixed the module size. See the file header. */",
        'export type MosaicScaleSource = "measured-from-sheet" | "joint-derived" | "sheet-size";',
        "",
        "export type MosaicCatalogEntry = {",
        "  /** Distributor SKU. Saved designs carry this as `pelicanCode`. */",
        "  sku: string;",
        "  slug: string;",
        "  /** Published sheet size in inches, first two numbers (the third is thickness). */",
        "  sizeIn: [number, number];",
        "  pattern: MosaicPatternKind;",
        "  /** Plain-language description of the chip pattern, for the admin audit. */",
        "  geometry: string;",
        "  family: MosaicMaterialFamily;",
        "  finish: MosaicSurfaceFinish;",
        "  /** Tileable texture baked from this product's own product photo. */",
        "  texture: string;",
        "  texturePx: [number, number];",
        "  /** Real inches the texture covers when it repeats once. */",
        "  moduleIn: [number, number];",
        "  /** Grout band width in inches, always inside the 1/16-1/8 in. mosaic rule. */",
        "  groutIn: number;",
        "  /** True only when the width was measured from a complete-sheet photo. */",
        "  groutInMeasured: boolean;",
        "  scaleSource: MosaicScaleSource;",
        "  groutColor: string;",
        "  /** True when the grout colour was sampled from the photo's own joint bands. */",
        "  groutColorSampled: boolean;",
        "  /** Chip colours sampled from the sheet. */",
        "  palette: [string, string, string, string];",
        "  lightest: string;",
        "  darkest: string;",
        "  /** The distributor's own product page for this exact item. */",
        "  source: string;",
        "};",
        "",
        "/**",
        " * A Pelican Tile & Mosaic row that is not a mosaic sheet (cultured-marble vanity tops and",
        " * prefab slabs). It has no mosaic rendering and must never be given a mosaic texture.",
        " */",
        "export type NonMosaicCatalogEntry = {",
        "  sku: string;",
        "  name: string;",
        "  size: string;",
        "  subCategory: string;",
        "  description: string;",
        "};",
        "",
        "/**",
        " * A mosaic the distributor lists for sale but publishes no product data or photo for.",
        " * Deliberately left without a texture rather than guessed.",
        " */",
        "export type UnresolvedMosaicEntry = {",
        "  sku: string;",
        "  name: string;",
        "  size: string;",
        "  reason: string;",
        "};",
        "",
        "export const MOSAIC_CATALOG: readonly MosaicCatalogEntry[] = [",
    ]
    for entry in sorted(entries, key=lambda e: e["sku"].lower()):
        pal = ", ".join(js(c) for c in entry["palette"][:4])
        lines += [
            "  {",
            f'    sku: {js(entry["sku"])},',
            f'    slug: {js(entry["slug"])},',
            f'    sizeIn: [{entry["sizeIn"][0]}, {entry["sizeIn"][1]}],',
            f'    pattern: {js(entry["pattern"])},',
            f'    geometry: {js(entry["geometry"])},',
            f'    family: {js(entry["family"])},',
            f'    finish: {js(entry["finish"])},',
            f'    texture: {js(entry["texture"])},',
            f'    texturePx: [{entry["texturePx"][0]}, {entry["texturePx"][1]}],',
            f'    moduleIn: [{entry["moduleIn"][0]}, {entry["moduleIn"][1]}],',
            f'    groutIn: {entry["groutIn"]},',
            f'    groutInMeasured: {str(entry["groutInMeasured"]).lower()},',
            f'    scaleSource: {js(entry["scaleSource"])},',
            f'    groutColor: {js(entry["groutColor"])},',
            f'    groutColorSampled: {str(entry["groutColorSampled"]).lower()},',
            f'    palette: [{pal}],',
            f'    lightest: {js(entry["lightest"])},',
            f'    darkest: {js(entry["darkest"])},',
            f'    source: {js(entry["source"])},',
            "  },",
        ]
    lines += ["];", "", "export const NON_MOSAIC_TILE_ROWS: readonly NonMosaicCatalogEntry[] = ["]
    for row in sorted(non_mosaic, key=lambda e: e["sku"].lower()):
        lines += [
            "  {",
            f'    sku: {js(row["sku"])},',
            f'    name: {js(row["name"])},',
            f'    size: {js(row["size"])},',
            f'    subCategory: {js(row["subCategory"])},',
            f'    description: {js(row["description"])},',
            "  },",
        ]
    lines += ["];", "", "export const UNRESOLVED_MOSAICS: readonly UnresolvedMosaicEntry[] = ["]
    for row in sorted(unresolved, key=lambda e: e["sku"].lower()):
        lines += [
            "  {",
            f'    sku: {js(row["sku"])},',
            f'    name: {js(row["name"])},',
            f'    size: {js(row["size"])},',
            f'    reason: {js(row["reason"])},',
            "  },",
        ]
    lines += ["];", ""]
    with open(OUT_DATA, "w", encoding="utf-8") as handle:
        handle.write("\n".join(lines))


# ---------------------------------------------------------------- main


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", default=os.path.join(tempfile.gettempdir(), "mosaic-photos"))
    parser.add_argument("--catalog", help="Local Tile & Mosaic rows JSON (same shape as pelican_seed.json)")
    args = parser.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    if args.catalog:
        with open(args.catalog, encoding="utf-8") as handle:
            rows = [r for r in json.load(handle) if r.get("category") == TILE_CATEGORY]
    else:
        print("No --catalog given. Provide the distributor's Tile & Mosaic rows exported from the catalog DB.")
        return 2

    print(f"{len(rows)} Tile & Mosaic rows")
    products = fetch_products()

    entries: list[dict] = []
    non_mosaic: list[dict] = []
    unresolved: list[dict] = []

    for row in rows:
        name = row["name"]
        if row.get("subCategory") != "Mosaic":
            non_mosaic.append({
                "sku": row["pelicanCode"], "name": name, "size": row["size"],
                "subCategory": row.get("subCategory") or "", "description": row.get("description") or "",
            })
            continue
        product = products.get(name.strip().lower())
        if product is None or name not in PATTERN:
            unresolved.append({
                "sku": row["pelicanCode"], "name": name, "size": row["size"],
                "reason": (
                    "The distributor lists this mosaic for sale, but its product page and storefront "
                    "publish no product photo, so the chip pattern, colour and grout cannot be verified "
                    "against the product. Left without a texture rather than guessed."
                ),
            })
            print(f"  {name}: no distributor source -> unresolved")
            continue

        slug = name.lower().replace(" ", "-").replace("'", "")
        paths = []
        for index, image in enumerate(product.get("images", [])):
            path = os.path.join(args.cache, f"{slug}-{index}.png")
            if download(image["src"], path):
                paths.append(path)
        sheet_in = tuple(float(v) for v in row["size"].split(" x ")[:2])
        photo = choose_photo(paths, sheet_in)
        if photo is None:
            unresolved.append({
                "sku": row["pelicanCode"], "name": name, "size": row["size"],
                "reason": "The distributor's photos could not be read as a product sheet.",
            })
            print(f"  {name}: no readable photo -> unresolved")
            continue

        baked = bake_texture(photo, slug, sheet_in)
        pal = baked["palette"]
        entries.append({
            "sku": row["pelicanCode"],
            "slug": slug,
            "sizeIn": [sheet_in[0], sheet_in[1]],
            "pattern": PATTERN[name],
            "geometry": GEOMETRY[PATTERN[name]],
            "family": material_family(row.get("description") or ""),
            "finish": finish_for(row.get("description") or "", name),
            "texture": f"/textures/mosaics/{slug}.webp",
            "texturePx": baked["texturePx"],
            "moduleIn": baked["moduleIn"],
            "groutIn": baked["groutIn"],
            "groutInMeasured": baked["groutInMeasured"],
            "scaleSource": baked["scaleSource"],
            "groutColor": baked["groutColor"],
            "groutColorSampled": baked["groutColorSampled"],
            "palette": pal,
            "lightest": max(pal, key=luma),
            "darkest": min(pal, key=luma),
            "source": f"{STORE}/products/{product['handle']}",
        })
        print(f"  {name}: {baked['moduleIn']}in grout={baked['groutIn']}in [{baked['scaleSource']}]")

    emit(entries, non_mosaic, unresolved)
    print(f"\n{len(entries)} verified, {len(non_mosaic)} non-mosaic, {len(unresolved)} unresolved")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
