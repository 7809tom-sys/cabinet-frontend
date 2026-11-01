#!/usr/bin/env python3
"""
Publishes the DLC_FR26 crops to the web build and emits the typed catalog table.

    python3 scripts/dlc_fr26_emit_catalog.py

Reads data/dlc-fr26/manifest.json (written by dlc_fr26_process.py). Copies the plain
processed/door/*.png and processed/drawer/*.png to client/public/textures/dlc-fr26/{door,drawer}/
(stable URLs /textures/dlc-fr26/door/<slug>.png) and writes shared/dlcFr26Catalog.generated.ts.
Plain crops only; the enhanced set is not published and stays off.
"""
import json, shutil
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).resolve().parent.parent
data = root / "data" / "dlc-fr26"
pub = root / "client" / "public" / "textures" / "dlc-fr26"
m = json.loads((data / "manifest.json").read_text())
if pub.exists():
    shutil.rmtree(pub)
for face in ("door", "drawer", "grain"):
    (pub / face).mkdir(parents=True, exist_ok=True)
(data / "processed" / "grain").mkdir(parents=True, exist_ok=True)


# Tom (Oct 31): only Driftwood's grain is unusually high-contrast (column-mean swing 24-28 levels, about twice
# the others). Patches above this swing are softened: contrast pulled toward the patch's own mean per channel
# (colour and grain direction unchanged) plus a very light blur. One value to tune.
GRAIN_SWING_THRESHOLD = 22.0
GRAIN_SOFTEN_CONTRAST = 0.65
GRAIN_SOFTEN_BLUR = 0.6


def column_swing(img: Image.Image) -> float:
    lum = np.asarray(img.convert("L"), dtype=float)
    cols = lum.mean(axis=0)
    return float(cols.max() - cols.min())


def soften_patch(img: Image.Image) -> tuple[Image.Image, bool]:
    if column_swing(img) <= GRAIN_SWING_THRESHOLD:
        return img, False
    from PIL import ImageFilter
    a = np.asarray(img.convert("RGB"), dtype=float)
    mean = a.reshape(-1, 3).mean(axis=0)
    soft = mean + (a - mean) * GRAIN_SOFTEN_CONTRAST
    out = Image.fromarray(np.clip(soft.round(), 0, 255).astype("uint8"), "RGB").filter(ImageFilter.GaussianBlur(GRAIN_SOFTEN_BLUR))
    return out, True


# Tom (Oct 31, Dove Grey): mottling on pale painted/neutral finishes reads as dirt. Patches that are light
# (mean luminance above PALE_MIN_LUMA) and near-neutral (channel spread below PALE_MAX_SPREAD) get their
# contrast pulled toward the patch mean and a slightly stronger blur. Natural woods (warm, saturated) and EWO,
# which ships its own texture, are not touched. One set of values to tune.
PALE_MIN_LUMA = 165.0
PALE_MAX_SPREAD = 12.0
PALE_SOFTEN_CONTRAST = 0.55
PALE_SOFTEN_BLUR = 1.2


def is_pale_neutral(img: Image.Image) -> bool:
    a = np.asarray(img.convert("RGB"), dtype=float).reshape(-1, 3)
    mean = a.mean(axis=0)
    luma = 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2]
    return bool(luma > PALE_MIN_LUMA and (mean.max() - mean.min()) < PALE_MAX_SPREAD)


def soften_pale(img: Image.Image) -> tuple[Image.Image, bool]:
    if not is_pale_neutral(img):
        return img, False
    from PIL import ImageFilter
    a = np.asarray(img.convert("RGB"), dtype=float)
    mean = a.reshape(-1, 3).mean(axis=0)
    soft = mean + (a - mean) * PALE_SOFTEN_CONTRAST
    out = Image.fromarray(np.clip(soft.round(), 0, 255).astype("uint8"), "RGB").filter(ImageFilter.GaussianBlur(PALE_SOFTEN_BLUR))
    return out, True


def grain_patch(img: Image.Image, box=(.30, .28, .70, .72)) -> tuple[Image.Image, bool]:
    """Frame-free grain patch: a window inside the recessed panel of the door crop, shrunk until
    no rail/stile edge or reveal falls inside it. Used for sides, end panels and skins so they carry
    the door's grain and colour without the door photo's frame lines."""
    a = np.asarray(img.convert("RGB"), dtype=float)
    lum = 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
    h, w = lum.shape
    x0, x1, y0, y1 = int(w * box[0]), int(w * box[2]), int(h * box[1]), int(h * box[3])
    for _ in range(12):
        win = lum[y0:y1, x0:x1]
        # smoothed row/column means: an edge shows up as a step, grain does not
        rows = win.mean(axis=1); cols = win.mean(axis=0)
        step = max(np.abs(np.diff(rows)).max() if len(rows) > 1 else 0, np.abs(np.diff(cols)).max() if len(cols) > 1 else 0)
        if step <= 6.0 and win.std() < 22:
            return img.crop((x0, y0, x1, y1)), True
        dx, dy = max(1, int((x1 - x0) * .08)), max(1, int((y1 - y0) * .08))
        x0, x1, y0, y1 = x0 + dx, x1 - dx, y0 + dy, y1 - dy
        if x1 - x0 < 16 or y1 - y0 < 16:
            break
    cx, cy = w // 2, h // 2
    return img.crop((cx - 12, cy - 12, cx + 12, cy + 12)), False


ALIASES = {  # catalog spellings -> extra names DL may use (matching also normalises Gray/Grey etc.)
    "ewo": ["European White Oak"],
    "expresso-shaker": ["Espresso Shaker"],
    "peccan": ["Pecan"],
}
rows = []
for f in m["finishes"]:
    slug = f["slug"]
    shutil.copy2(data / f["door"]["file"], pub / "door" / f"{slug}.png")
    if f["drawer"]:
        shutil.copy2(data / f["drawer"]["file"], pub / "drawer" / f"{slug}.png")
    door_img = Image.open(data / f["door"]["file"])
    patch, clean = grain_patch(door_img)
    patch, softened = soften_patch(patch)
    if slug != "ewo":
        patch, pale = soften_pale(patch)
    else:
        pale = False
    patch.save(data / "processed" / "grain" / f"{slug}.png")
    patch.save(pub / "grain" / f"{slug}.png")
    # drawer faces get their own patch from a different clean window of the same finish
    dpatch, dclean = grain_patch(door_img, (.36, .52, .64, .74))
    if not dclean:
        dpatch = patch
    else:
        dpatch, dsoft = soften_patch(dpatch)
        softened = softened or dsoft
        if slug != "ewo":
            dpatch, dpale = soften_pale(dpatch)
            pale = pale or dpale
    dpatch.save(data / "processed" / "grain" / f"{slug}-drawer.png")
    dpatch.save(pub / "grain" / f"{slug}-drawer.png")
    door = np.asarray(Image.open(data / f["door"]["file"]).convert("RGB"), dtype=float)
    h, w, _ = door.shape
    mid = door[int(h * .1):int(h * .9), int(w * .1):int(w * .9)]
    r, g, b = [int(round(x)) for x in np.median(mid.reshape(-1, 3), axis=0)]
    name = (f["catalogOption"] or {}).get("displayName") or Path(f["sourceFile"]).stem
    rows.append({
        "slug": slug,
        "names": sorted({Path(f["sourceFile"]).stem, name, *ALIASES.get(slug, [])}),
        "door": f"/textures/dlc-fr26/door/{slug}.png",
        "drawer": f"/textures/dlc-fr26/drawer/{slug}.png" if f["drawer"] else None,
        "doorSize": f["door"]["size"],
        "drawerSize": f["drawer"]["size"] if f["drawer"] else None,
        "solidColor": f"#{r:02x}{g:02x}{b:02x}",
        "grain": f"/textures/dlc-fr26/grain/{slug}.png",
        "grainSize": list(patch.size),
        "grainFrameFree": bool(clean),
        # --- face textures: frame-free grain for door AND drawer faces (3D rails/stiles supply the frame) ---
        "faceDoor": f"/textures/dlc-fr26/grain/{slug}.png",
        "faceDrawer": f"/textures/dlc-fr26/grain/{slug}-drawer.png",
        # physical size of one tile, from the door crop's pixel density (door crop ~16in wide)
        "faceTileIn": [round(patch.size[0] / (f["door"]["size"][0] / 16.0), 2), round(patch.size[1] / (f["door"]["size"][0] / 16.0), 2)],
        "faceTileDrawerIn": [round(dpatch.size[0] / (f["door"]["size"][0] / 16.0), 2), round(dpatch.size[1] / (f["door"]["size"][0] / 16.0), 2)],
        "faceNormal": None,
        "faceTint": None,
        "grainSoftened": bool(softened),
        "grainPaleSoftened": bool(pale),
    })

# Tom (Oct 31, Dark Caramel): the catalog photo is a muted pink-grey (#856b63) while DL's own thumbnail is a warm
# walnut. Tom chose warm walnut. Keep the photo's grain, move its colour to WALNUT_TARGET with a multiplicative
# tint (same mechanism as EWO), and soften the patch like Driftwood's. Target is an estimate from the thumbnail.
WALNUT_TARGETS = {"dark-caramel": "#6a4631"}
WALNUT_SOFTEN_CONTRAST = 0.65
WALNUT_SOFTEN_BLUR = 0.6
_lin = lambda c: np.where(c / 255 <= .04045, c / 255 / 12.92, ((c / 255 + .055) / 1.055) ** 2.4)
_srgb = lambda l: np.round(255 * np.where(l <= .0031308, l * 12.92, 1.055 * np.power(l, 1 / 2.4) - .055)).astype(int)
for _slug, _hex in WALNUT_TARGETS.items():
    _row = next(r for r in rows if r["slug"] == _slug)
    from PIL import ImageFilter
    _means = []
    for _name in (f"{_slug}.png", f"{_slug}-drawer.png"):
        _im = Image.open(pub / "grain" / _name).convert("RGB")
        _a = np.asarray(_im, dtype=float)
        _m = _a.reshape(-1, 3).mean(axis=0)
        _means.append(_m)
        _soft = _m + (_a - _m) * WALNUT_SOFTEN_CONTRAST
        _out = Image.fromarray(np.clip(_soft.round(), 0, 255).astype("uint8"), "RGB").filter(ImageFilter.GaussianBlur(WALNUT_SOFTEN_BLUR))
        _out.save(pub / "grain" / _name)
        _out.save(data / "processed" / "grain" / _name)
    _tgt = np.array([int(_hex[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)
    _ratio = np.clip(_lin(_tgt) / _lin(np.mean(_means, axis=0)), 0, 1)
    _row.update({"solidColor": _hex, "faceTint": "#%02x%02x%02x" % tuple(_srgb(_ratio)), "grainSoftened": True})

# Tom (Oct 31, Slim Shaker Alabaster): the catalog photo is a cool #eff3f5 while the DL sample is a warm off-white,
# about #ebe5e5. Keep the catalog grain, tint it to WARM_TARGETS, and take a further WARM_EXTRA_CUT (linear, on top
# of the 15% pale cut applied at render time) so it stops reading flat white. The cut is baked into faceTint and
# solidColor, so doors, drawers, sides, skins and end panels all get the same result. Alabaster only.
WARM_TARGETS = {
    "slim-shaker-alabaster": ("#ebe5e5", 0.05),
    "pearl-white": ("#dfd9d9", 0.0),  # Tom, Oct 31: still too white next to the DL sample; antique white measured from the sample door, no extra cut
}
for _slug, (_hex, _cut) in WARM_TARGETS.items():
    _row = next(r for r in rows if r["slug"] == _slug)
    _means = [np.asarray(Image.open(pub / "grain" / _n).convert("RGB"), dtype=float).reshape(-1, 3).mean(axis=0)
              for _n in (f"{_slug}.png", f"{_slug}-drawer.png")]
    _tgt = _lin(np.array([int(_hex[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)) * (1 - _cut)
    _ratio = np.clip(_tgt / _lin(np.mean(_means, axis=0)), 0, 1)
    _solid = _srgb(_tgt)
    _row.update({"solidColor": "#%02x%02x%02x" % tuple(_solid), "faceTint": "#%02x%02x%02x" % tuple(_srgb(_ratio))})

# Tom (Oct 31, Glacier White): too blue; match Pearl White's antique white. Its catalog colour (#d7d8dd, patch mean about
# #dadbe0) is darker than the target in red and green, and a tint can only darken, so the patch itself is shifted to the
# target colour per channel (grain kept, faceTint stays null) and its speckle is pulled further toward the mean
# (the patch is about 5x speckly-er than Pearl White's). No extra brightness cut. One entry per finish.
SHIFT_TARGETS = {"glacier-white": ("#dfd9d9", 0.35)}  # (target, extra contrast kept)
for _slug, (_hex, _keep) in SHIFT_TARGETS.items():
    _row = next(r for r in rows if r["slug"] == _slug)
    _tgt = np.array([int(_hex[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)
    for _name in (f"{_slug}.png", f"{_slug}-drawer.png"):
        _a = np.asarray(Image.open(pub / "grain" / _name).convert("RGB"), dtype=float)
        _m = _a.reshape(-1, 3).mean(axis=0)
        _out = Image.fromarray(np.clip((_tgt + (_a - _m) * _keep).round(), 0, 255).astype("uint8"), "RGB")
        _out.save(pub / "grain" / _name)
        _out.save(data / "processed" / "grain" / _name)
    _row.update({"solidColor": _hex, "faceTint": None})

# European White Oak: the catalog ships a real 1024px vertical-grain texture with a normal map. Use it for
# door, drawer and side faces. It is lighter than the finish photo, so a tint brings it to the sample colour.
EWO = next(r for r in rows if r["slug"] == "ewo")
ewo_src = data / "source" / "textures"
for src_name, dst_name in (("EWO_V.jpg", "ewo-v.jpg"), ("EWO_V.jpg_nm,5.png", "ewo-v-nm.png")):
    shutil.copy2(ewo_src / src_name, pub / "grain" / dst_name)
tex = np.asarray(Image.open(ewo_src / "EWO_V.jpg").convert("RGB"), dtype=float)
tex_mean = np.median(tex.reshape(-1, 3), axis=0)
target = np.array([int(EWO["solidColor"][i:i + 2], 16) for i in (1, 3, 5)], dtype=float)
to_lin = lambda c: np.where(c / 255 <= .04045, c / 255 / 12.92, ((c / 255 + .055) / 1.055) ** 2.4)
ratio = np.clip(to_lin(target) / to_lin(tex_mean), 0, 1)
to_srgb = lambda l: np.round(255 * np.where(l <= .0031308, l * 12.92, 1.055 * np.power(l, 1 / 2.4) - .055)).astype(int)
EWO.update({
    "grain": "/textures/dlc-fr26/grain/ewo-v.jpg",
    "grainSize": [1024, 1024], "grainFrameFree": True,
    "faceDoor": "/textures/dlc-fr26/grain/ewo-v.jpg",
    "faceDrawer": "/textures/dlc-fr26/grain/ewo-v.jpg",
    "faceTileIn": [24.0, 24.0], "faceTileDrawerIn": [24.0, 24.0],
    "faceNormal": "/textures/dlc-fr26/grain/ewo-v-nm.png",
    "faceTint": "#%02x%02x%02x" % tuple(to_srgb(ratio)),
    "grainSoftened": False,
    "grainPaleSoftened": False,
})

ts = (
    "// GENERATED by scripts/dlc_fr26_emit_catalog.py from data/dlc-fr26/manifest.json. Do not edit by hand.\n"
    "export interface DlcFr26CatalogEntry {\n  slug: string;\n  /** Names this finish goes by in the source files and DL's own list. */\n  names: string[];\n"
    "  door: string;\n  /** null when the photo has no drawer front (the drawer must never reuse the door photo). */\n  drawer: string | null;\n"
    "  doorSize: [number, number];\n  drawerSize: [number, number] | null;\n  /** Median door color, used for a drawer front that has no crop. */\n  solidColor: string;\n  /** Frame-free grain patch from inside the door panel: sides, end panels and skins use it (tiled, mirrored). */\n  grain: string;\n  grainSize: [number, number];\n  grainFrameFree: boolean;\n  /** Face textures: frame-free grain for door and drawer faces. The 3D rails and stiles supply the frame. */\n  faceDoor: string;\n  faceDrawer: string;\n  /** Physical size of one grain tile in inches [door, drawer]. */\n  faceTileIn: [number, number];\n  faceTileDrawerIn: [number, number];\n  /** Normal map for grain depth (European White Oak only). */\n  faceNormal: string | null;\n  /** Multiplier (sRGB hex, applied in linear) that brings the texture to the sample colour; null = none. */\n  faceTint: string | null;\n  /** True when the grain patch was softened because its light/dark swing was unusually high. */\n  grainSoftened: boolean;\n  /** True when the patch is a pale, near-neutral finish whose mottling was softened. */\n  grainPaleSoftened: boolean;\n}\n\n"
    "export const DLC_FR26_CATALOG: DlcFr26CatalogEntry[] = " + json.dumps(rows, indent=2) + ";\n"
)
(root / "shared" / "dlcFr26Catalog.generated.ts").write_text(ts)
print(len(rows), "finishes;", sum(1 for r in rows if r["drawer"]), "drawer crops copied to", pub)
