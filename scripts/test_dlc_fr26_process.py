"""python3 scripts/test_dlc_fr26_process.py  (plain asserts; no pytest needed)"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import dlc_fr26_process as p


def synth(w=150, h=320, reveal=True, margin=True):
    """Wood-ish door photo: grey margin, dark stray edge line, drawer, reveal, door."""
    rng = np.random.default_rng(1)
    a = np.full((h, w, 3), 150.0) + rng.normal(0, 2, (h, w, 3))
    if reveal:
        a[66:69, :, :] = 40
    if margin:
        a[:4, :, :] = 240; a[-4:, :, :] = 240; a[:, :4, :] = 240; a[:, -4:, :] = 240
        a[4, :, :] = 20; a[:, 4, :] = 20  # stray frame line just inside the margin
    return np.clip(a, 0, 255).astype("uint8")


def test_reveal_found_from_pixels():
    lum = p.luminance(synth().astype(float))
    t, b, l, r = p.trim_outer(lum)
    rv = p.find_reveal(lum, t, b, l, r)
    assert rv and 64 <= rv["peakRow"] <= 69, rv


def test_outer_margin_and_stray_line_trimmed():
    lum = p.luminance(synth().astype(float))
    t, b, l, r = p.trim_outer(lum)
    assert t >= 5 and l >= 5 and 320 - b >= 4 and 150 - r >= 4, (t, b, l, r)


def test_no_reveal_means_door_only():
    lum = p.luminance(synth(reveal=False).astype(float))
    t, b, l, r = p.trim_outer(lum)
    assert p.find_reveal(lum, t, b, l, r) is None


def test_panel_edge_is_not_a_reveal():
    a = synth(reveal=False)
    a[66:69, 40:110, :] = 40  # dark line over only part of the width (inner panel edge)
    lum = p.luminance(a.astype(float))
    t, b, l, r = p.trim_outer(lum)
    assert p.find_reveal(lum, t, b, l, r) is None


def test_process_writes_separate_door_and_drawer(tmp_path=None):
    import tempfile
    d = Path(tempfile.mkdtemp())
    src = d / "Test Finish.jpg"
    Image.fromarray(synth()).save(src, quality=98)
    e = p.process_finish(src, d, {}, True)
    assert e["hasDrawerFront"] and e["drawerBox"] and e["doorBox"]
    assert e["drawerBox"][3] < e["reveal"]["bandStart"] and e["doorBox"][1] > e["reveal"]["bandEnd"]
    assert e["door"]["file"] != e["drawer"]["file"]
    door = Image.open(d / e["door"]["file"]); drawer = Image.open(d / e["drawer"]["file"])
    assert door.size == (e["doorBox"][2] - e["doorBox"][0], e["doorBox"][3] - e["doorBox"][1])  # no resampling
    for im in (door, drawer):
        arr = np.asarray(im).astype(float)
        assert arr.min() > 100, "no dark frame/reveal/margin pixels inside a crop"
        assert arr.max() < 200


def test_enhancement_keeps_colour():
    img = Image.fromarray(synth()[10:60, 10:140])
    e = p.enhance(img)
    m = p.enhancement_metrics(img, e)
    assert m["withinLimits"], m
    assert max(abs(x) for x in m["meanChannelShift"]) < 0.2


if __name__ == "__main__":
    n = 0
    for k, v in list(globals().items()):
        if k.startswith("test_"):
            v(); n += 1; print("ok", k)
    print(n, "passed")
