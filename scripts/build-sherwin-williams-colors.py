#!/usr/bin/env python3
"""Build the Sherwin-Williams color data used by the door-editor wizard.

Two published Sherwin-Williams sources, nothing else:

1. PAINT — the published color chart PDF
   https://images.sherwin-williams.com/content_images/sw-pdf-sherwin-williams-colorc.pdf
   Every row in that PDF is "COLOR #  COLOR NAME  LOCATOR #  RED GREEN BLUE  HEX COLOR".
   The hex column is copied verbatim; RED/GREEN/BLUE are cross-checked against it and the
   script fails if any row disagrees, so a shifted column can never land in the data file.

2. STAIN — the published stain color pages
   https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/interior-stains/
   https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/exterior-stains/
   Each swatch on those pages carries the published code, name, and swatch image
   (data-stainbackground, served from sherwin.scene7.com). Sherwin-Williams does not publish a
   hex for a stain, so the hex here is the stain swatch image sampled at the median of its inner
   50% box. That is a measured reading of the published swatch, not an invented value.

Names, codes, page URLs, and hexes are never typed by hand. Re-run this script to rebuild:

    pip install pypdf pillow
    python3 scripts/build-sherwin-williams-colors.py

Outputs (committed):
    data/door-colors/sherwin-williams-paint.json
    data/door-colors/sherwin-williams-stain.json
"""
import io
import json
import os
import re
import statistics
import sys
import urllib.request
from datetime import date

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - build-time dependency only
    sys.exit("pypdf is required: pip install pypdf")
try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("pillow is required: pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "door-colors")
UA = {"User-Agent": "Mozilla/5.0 (compatible; CabinetDealz data build)"}
RETRIEVED = date.today().isoformat()

PAINT_PDF = "https://images.sherwin-williams.com/content_images/sw-pdf-sherwin-williams-colorc.pdf"
STAIN_PAGES = [
    ("Interior", "https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/interior-stains/"),
    ("Exterior", "https://www.sherwin-williams.com/homeowners/color/find-and-explore-colors/stain-colors/exterior-stains/"),
]


def fetch(url, timeout=60):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read()


def build_paint():
    reader = PdfReader(io.BytesIO(fetch(PAINT_PDF)))
    row = re.compile(
        r"^(SW\d{4})\s+(.+?)\s*(N/A|\d{1,3}-[A-Z]\d{1,2})\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s+([0-9A-F]{6})$"
    )
    colors, seen = [], set()
    for page in reader.pages:
        for line in page.extract_text().split("\n"):
            line = line.strip()
            if not line.startswith("SW"):
                continue
            match = row.match(line)
            if not match:
                sys.exit(f"Unparsed chart row: {line!r}")
            code, name, locator, red, green, blue, hexa = match.groups()
            published_rgb = (int(red), int(green), int(blue))
            hex_rgb = tuple(int(hexa[i:i + 2], 16) for i in (0, 2, 4))
            if published_rgb != hex_rgb:
                sys.exit(f"RGB/HEX disagree for {code}: {published_rgb} vs {hex_rgb}")
            if code in seen:
                sys.exit(f"Duplicate chart code {code}")
            seen.add(code)
            colors.append(
                {
                    "code": code,
                    "name": name.strip(),
                    "locator": None if locator == "N/A" else locator,
                    "hex": f"#{hexa.lower()}",
                    "rgb": list(published_rgb),
                }
            )
    colors.sort(key=lambda c: c["code"])
    return {
        "source": {
            "publisher": "Sherwin-Williams",
            "document": "Sherwin-Williams Color color chart (sw-pdf-sherwin-williams-colorc.pdf)",
            "url": PAINT_PDF,
            "columns": "COLOR #, COLOR NAME, LOCATOR #, RED, GREEN, BLUE, HEX COLOR",
            "note": "Code, name, locator and hex are copied from the published chart. RGB is cross-checked against the hex on every row.",
            "retrieved": RETRIEVED,
        },
        "colors": colors,
    }


BLOCK = re.compile(r'data-color-number="([A-Z0-9]+)"\s+data-color-urn\s*=\s*"([^"]+)"(.*?)</a>', re.S)


def attr(body, key):
    match = re.search(key + r'\s*=\s*"([^"]*)"', body)
    return match.group(1).strip() if match else None


def build_stain():
    stains = {}
    # A few listings carry a 1x1 inline placeholder instead of a hosted swatch.
    # Those rows have no published color to measure, so they are left out rather than guessed.
    skipped = []
    for usage, page_url in STAIN_PAGES:
        html = fetch(page_url).decode("utf-8", "replace")
        for code, _urn, body in BLOCK.findall(html):
            swatch = attr(body, "data-stainbackground")
            name = attr(body, "data-colorname")
            detail = attr(body, "data-colorurl")
            if not swatch or not name or not detail:
                continue
            if not swatch.startswith("//") and not swatch.startswith("http"):
                skipped.append(f"{code} {name} ({usage}): listing uses an inline placeholder, no swatch to measure")
                continue
            record = stains.setdefault(
                code,
                {"code": code, "name": name, "page": detail, "swatch": "https:" + swatch, "usage": []},
            )
            if usage not in record["usage"]:
                record["usage"].append(usage)
    if not stains:
        sys.exit("No stain swatches found on the published stain pages")

    ordered = sorted(stains.values(), key=lambda s: s["code"])
    for record in ordered:
        image = Image.open(io.BytesIO(fetch(record["swatch"] + "?wid=40&hei=40"))).convert("RGB")
        width, height = image.size
        inner = image.crop((int(width * 0.25), int(height * 0.25), int(width * 0.75), int(height * 0.75)))
        pixels = list(inner.getdata())
        median = [int(statistics.median(channel)) for channel in zip(*pixels)]
        record["hex"] = "#%02x%02x%02x" % tuple(median)
        record["usage"] = sorted(record["usage"])
    if skipped:
        print("skipped rows without a published swatch:")
        for line in skipped:
            print("  " + line)
    return {
        "source": {
            "publisher": "Sherwin-Williams",
            "documents": [url for _usage, url in STAIN_PAGES],
            "swatchHost": "sherwin.scene7.com (the swatch image each published stain page serves)",
            "method": "Each published stain swatch image was sampled at the median of its inner 50% box. The stain hex in this file is that measured swatch color.",
            "note": "Code, name, and page URL are copied verbatim from the published stain listing pages. Sherwin-Williams does not publish a hex for a stain, so no hex is quoted as published.",
            "retrieved": RETRIEVED,
        },
        "stains": ordered,
    }


def write(name, payload):
    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, name)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"{os.path.relpath(path, ROOT)}: {len(payload.get('colors') or payload.get('stains') or [])} rows")


if __name__ == "__main__":
    write("sherwin-williams-paint.json", build_paint())
    write("sherwin-williams-stain.json", build_stain())
