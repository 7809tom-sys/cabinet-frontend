#!/usr/bin/env python3
"""
DLC_FR26 (20-20 Design catalog) -> DL door and drawer-front textures.

    python3 scripts/dlc_fr26_process.py <path to extracted DLC_FR26 folder> [--no-enhance]

Writes (never touches the originals, and never edits the source files):
  data/dlc-fr26/source/finishes/*.jpg   copies of the 21 Large finish photos (originals, kept)
  data/dlc-fr26/source/textures/*       copies of the grain textures and normal maps (originals, kept)
  data/dlc-fr26/processed/door/<slug>.png      door crop, cropped BEFORE texturing
  data/dlc-fr26/processed/drawer/<slug>.png    drawer-front crop (only where the photo shows a real drawer)
  data/dlc-fr26/processed/enhanced/{door,drawer}/<slug>.png   optional light grain enhancement (switchable off)
  data/dlc-fr26/manifest.json                  boxes, reveal rows, flags, softness, enhancement metrics

Rules (Tom, Oct 31):
  * Crop first. Outer margins, stray edge lines and the reveal gap are removed before anything
    becomes a texture, so they can never stretch or repeat across a face.
  * Door and drawer are separate surfaces from DIFFERENT pixels. A photo with no real reveal gets a
    door crop only; the drawer is never filled from the door photo.
  * The reveal is found from the pixels (a dark horizontal line that spans the whole width), never
    from a fixed percentage.
  * Pixels are never resampled: crops stay at the photo's native resolution (no stretching).
  * IMG.jpg is the "image not available" placeholder and is never used.
"""
from __future__ import annotations

import json
import shutil
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

PLACEHOLDER_FILES = {"img.jpg"}

# --- tuning (all in luminance points 0-255 or pixels) -------------------------------------------
SAFETY_V_FRAC = 0.02      # minimum trim top/bottom, share of height
SAFETY_H_FRAC = 0.03      # minimum trim left/right, share of width
SAFETY_MIN_PX = 3
EDGE_STEP = 22            # an outer line this far from the line 3px in is a stray edge/margin line
EDGE_EXTRA_MAX = 8
REVEAL_WINDOW = (0.14, 0.36)   # search window for the drawer/door reveal, share of photo height
REVEAL_MIN_DEPTH = 18     # how much darker than its neighbours the reveal row must be
REVEAL_SPAN_COVERAGE = 0.75   # share of the width the dark line must cross (a panel edge does not)
REVEAL_BAND_FRAC = 0.35   # band edges: rows still this fraction as dark as the peak
REVEAL_GAP_PX = 2         # extra rows kept out of both crops around the band
MIN_DRAWER_PX = 12
ENH_RADIUS, ENH_PERCENT, ENH_THRESHOLD = 0.8, 35, 2
ENH_MAX_MEAN_SHIFT = 1.0  # per RGB channel, levels
ENH_MAX_MEAN_ABS = 6.0

SOFT_LAPVAR = 130.0
SHARP_LAPVAR = 400.0
FLAT_STD = 6.0


def slugify(name: str) -> str:
    out = "".join(c.lower() if c.isalnum() else "-" for c in name)
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-")


def luminance(rgb: np.ndarray) -> np.ndarray:
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]


def trim_outer(lum: np.ndarray) -> tuple[int, int, int, int]:
    """(top, bottom, left, right) as exclusive-end bounds of the kept area."""
    h, w = lum.shape
    sv = max(SAFETY_MIN_PX, round(SAFETY_V_FRAC * h))
    sh = max(SAFETY_MIN_PX, round(SAFETY_H_FRAC * w))
    mid_x = slice(int(w * 0.15), int(w * 0.85))
    mid_y = slice(int(h * 0.15), int(h * 0.85))

    def extend(profile: np.ndarray, start: int) -> int:
        k = start
        while k - start < EDGE_EXTRA_MAX and k + 3 < len(profile) and abs(profile[k] - profile[k + 3]) > EDGE_STEP:
            k += 1
        return k

    rows = np.median(lum[:, mid_x], axis=1)
    cols = np.median(lum[mid_y, :], axis=0)
    top = extend(rows, sv)
    bottom = h - extend(rows[::-1], sv)
    left = extend(cols, sh)
    right = w - extend(cols[::-1], sh)
    return top, bottom, left, right


def find_reveal(lum: np.ndarray, top: int, bottom: int, left: int, right: int) -> dict | None:
    """Real drawer/door reveal inside the trimmed area, or None. Row indices are in photo coordinates."""
    sub = lum[top:bottom, left:right]
    h, w = sub.shape
    if h < 60:
        return None
    rows = sub.mean(axis=1)

    def valley(y: int) -> float:
        a = max(0, y - 7)
        b = min(h, y + 8)
        ref = (rows[a:max(a + 1, y - 3)].mean() + rows[min(h - 1, y + 4):b].mean()) / 2
        return float(ref - rows[y])

    lo, hi = int(h * REVEAL_WINDOW[0]), int(h * REVEAL_WINDOW[1])
    if hi - lo < 4:
        return None
    def coverage_at(y: int, depth: float) -> float:
        a, b = max(0, y - 7), min(h, y + 8)
        ref_cols = (sub[a:max(a + 1, y - 3)].mean(axis=0) + sub[min(h - 1, y + 4):b].mean(axis=0)) / 2
        return float(((ref_cols - sub[y]) >= 0.4 * depth).mean())

    # candidates: rows that are real valleys; a true reveal crosses (nearly) the whole width,
    # an inner panel edge does not, so full-width coverage beats raw darkness.
    best = None
    for y in range(lo, hi):
        d = valley(y)
        if d < REVEAL_MIN_DEPTH:
            continue
        c = coverage_at(y, d)
        if c < REVEAL_SPAN_COVERAGE:
            continue
        key = (c >= 0.9, d)
        if best is None or key > best[0]:
            best = (key, y, d, c)
    if best is None:
        return None
    _, peak_y, depth, coverage = best
    start = peak_y
    while start - 1 >= 0 and valley(start - 1) >= REVEAL_BAND_FRAC * depth and peak_y - start < 8:
        start -= 1
    end = peak_y
    while end + 1 < h and valley(end + 1) >= REVEAL_BAND_FRAC * depth and end - peak_y < 8:
        end += 1
    return {
        "bandStart": top + start,
        "bandEnd": top + end,
        "peakRow": top + peak_y,
        "depth": round(depth, 1),
        "spanCoverage": round(coverage, 3),
    }


def laplacian_variance(lum: np.ndarray) -> float:
    c = lum
    lap = -4 * c[1:-1, 1:-1] + c[:-2, 1:-1] + c[2:, 1:-1] + c[1:-1, :-2] + c[1:-1, 2:]
    return float(lap.var())


def enhance(img: Image.Image) -> Image.Image:
    """Gentle unsharp mask on luminance only. The luminance change is added equally to R, G and B,
    so hue and average colour are not shifted (no colour-space round trip)."""
    rgb = np.asarray(img, dtype=float)
    lum_img = Image.fromarray(np.clip(luminance(rgb), 0, 255).round().astype("uint8"), "L")
    sharp = np.asarray(lum_img.filter(ImageFilter.UnsharpMask(radius=ENH_RADIUS, percent=ENH_PERCENT, threshold=ENH_THRESHOLD)), dtype=float)
    delta = (sharp - np.asarray(lum_img, dtype=float))[..., None]
    return Image.fromarray(np.clip(rgb + delta, 0, 255).round().astype("uint8"), "RGB")


def enhancement_metrics(before: Image.Image, after: Image.Image) -> dict:
    a = np.asarray(before, dtype=float)
    b = np.asarray(after, dtype=float)
    shift = (b.mean(axis=(0, 1)) - a.mean(axis=(0, 1)))
    mean_abs = float(np.abs(b - a).mean())
    return {
        "meanChannelShift": [round(float(s), 3) for s in shift],
        "meanAbsChange": round(mean_abs, 3),
        "withinLimits": bool(np.abs(shift).max() <= ENH_MAX_MEAN_SHIFT and mean_abs <= ENH_MAX_MEAN_ABS),
    }


def read_options(paf: Path) -> dict[str, dict]:
    """Door Finish options from the catalog: file stem -> {code, displayName}."""
    out: dict[str, dict] = {}
    root = ET.parse(paf).getroot()
    for feat in root.iter("Feature"):
        if feat.get("code") != "8810000":
            continue
        for opt in feat.findall("Option"):
            img = opt.find("Multimedia[@type='LargeImage']")
            if img is None or not img.text:
                continue
            stem = Path(img.text.replace("\\", "/")).stem
            out[stem.lower()] = {"code": opt.get("code"), "displayName": opt.findtext("DisplayName")}
    return out


def process_finish(path: Path, out: Path, options: dict[str, dict], do_enhance: bool) -> dict:
    name = path.stem
    slug = slugify(name)
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img)
    lum = luminance(rgb.astype(float))
    h, w = lum.shape
    top, bottom, left, right = trim_outer(lum)
    reveal = find_reveal(lum, top, bottom, left, right)
    entry: dict = {
        "slug": slug,
        "sourceFile": f"source/finishes/{path.name}",
        "sourceSize": [w, h],
        "catalogOption": options.get(name.lower()),
        "outerTrim": {"top": top, "bottom": h - bottom, "left": left, "right": w - right},
        "reveal": reveal,
    }
    door_top = top
    if reveal:
        drawer_box = (left, top, right, reveal["bandStart"] - REVEAL_GAP_PX)
        door_top = reveal["bandEnd"] + 1 + REVEAL_GAP_PX
        door_box = (left, door_top, right, bottom)
        entry["hasDrawerFront"] = drawer_box[3] - drawer_box[1] >= MIN_DRAWER_PX
    else:
        drawer_box = None
        door_box = (left, top, right, bottom)
        entry["hasDrawerFront"] = False
    entry["doorBox"] = list(door_box)
    entry["drawerBox"] = list(drawer_box) if entry["hasDrawerFront"] else None
    flags: list[str] = []
    if not entry["hasDrawerFront"]:
        flags.append("no-drawer-front-in-photo")

    def save(box: tuple[int, int, int, int], face: str) -> dict:
        crop = img.crop(box)
        rel = f"processed/{face}/{slug}.png"
        (out / "processed" / face).mkdir(parents=True, exist_ok=True)
        crop.save(out / rel)
        info = {"file": rel, "size": list(crop.size)}
        if do_enhance:
            enh = enhance(crop)
            erel = f"processed/enhanced/{face}/{slug}.png"
            (out / "processed" / "enhanced" / face).mkdir(parents=True, exist_ok=True)
            enh.save(out / erel)
            m = enhancement_metrics(crop, enh)
            info["enhanced"] = {"file": erel, **m}
            if not m["withinLimits"]:
                flags.append(f"enhancement-out-of-limits-{face}")
        return info

    entry["door"] = save(door_box, "door")
    entry["drawer"] = save(drawer_box, "drawer") if entry["hasDrawerFront"] else None

    door_lum = lum[door_box[1]:door_box[3], door_box[0]:door_box[2]]
    interior = door_lum[int(door_lum.shape[0] * 0.1):int(door_lum.shape[0] * 0.9), int(door_lum.shape[1] * 0.1):int(door_lum.shape[1] * 0.9)]
    lv = laplacian_variance(door_lum)
    sd = float(interior.std())
    tier = "flat-finish" if sd < FLAT_STD else ("soft" if lv < SOFT_LAPVAR else ("sharp" if lv >= SHARP_LAPVAR else "medium"))
    entry["softness"] = {"laplacianVariance": round(lv, 1), "interiorStd": round(sd, 1), "tier": tier}
    if tier == "soft":
        flags.append("soft-needs-higher-res-photo")
    entry["flags"] = flags
    return entry


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if not a.startswith("--")]
    do_enhance = "--no-enhance" not in argv
    if not args:
        print(__doc__)
        return 2
    src = Path(args[0])
    out = Path(__file__).resolve().parent.parent / "data" / "dlc-fr26"
    large = src / "MultiMedia" / "Pictures" / "Large"
    options = read_options(src / "DataPack" / "paf.xml")
    (out / "source" / "finishes").mkdir(parents=True, exist_ok=True)
    (out / "source" / "textures").mkdir(parents=True, exist_ok=True)

    finishes = []
    skipped = []
    for p in sorted(large.glob("*.jpg")):
        if p.name.lower() in PLACEHOLDER_FILES:
            skipped.append({"file": p.name, "reason": "image-not-available placeholder, never used as a texture"})
            continue
        shutil.copy2(p, out / "source" / "finishes" / p.name)   # originals kept
        finishes.append(process_finish(p, out, options, do_enhance))

    textures = []
    tex_dir = src / "Textures"
    for p in sorted(tex_dir.iterdir()):
        if p.is_file():
            shutil.copy2(p, out / "source" / "textures" / p.name)
            try:
                size = list(Image.open(p).size)
            except Exception:
                size = None
            textures.append({"file": f"source/textures/{p.name}", "size": size, "isNormalMap": "_nm" in p.name})

    manifest = {
        "catalog": "DLC_FR26_1 (DLC Framed Cabinetry, September 2026)",
        "enhancement": {"enabled": do_enhance, "method": f"unsharp mask on luminance only, radius {ENH_RADIUS}, percent {ENH_PERCENT}, threshold {ENH_THRESHOLD}", "originalsKept": True},
        "finishes": finishes,
        "skipped": skipped,
        "textures": textures,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"{len(finishes)} finishes, {sum(1 for f in finishes if f['hasDrawerFront'])} with a drawer front, {len(skipped)} skipped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
