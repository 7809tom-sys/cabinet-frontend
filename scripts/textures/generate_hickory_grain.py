# Generates client/public/textures/rustic_hickory_vertical_grain_v2.webp:
#   python3 scripts/textures/generate_hickory_grain.py client/public/textures/rustic_hickory_vertical_grain_v2.webp 7 3
# Args: output path, random seed, number of pin knots. Needs numpy + Pillow.
import sys
import numpy as np
from PIL import Image

N = 1024
rng = np.random.default_rng(int(sys.argv[2]) if len(sys.argv) > 2 else 7)
fy = np.fft.fftfreq(N)[:, None]
fx = np.fft.fftfreq(N)[None, :]

def periodic_noise(sx, sy):
    """Tileable noise: white noise low-passed with a Gaussian of widths (sx, sy) in cycles/pixel."""
    white = rng.standard_normal((N, N))
    filt = np.exp(-0.5 * ((fx / sx) ** 2 + (fy / sy) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
    out -= out.mean()
    return out / (out.std() + 1e-9)

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

yy, xx = np.mgrid[0:N, 0:N]
# Wander: shift the x coordinate slowly along y so streaks drift like real boards.
wander = periodic_noise(0.003, 0.0012) * 7 + periodic_noise(0.02, 0.004) * 1.2
xs = (xx + wander) % N

def sample_cols(field, cols):
    # field is (N, N); sample each row at warped columns with linear interpolation
    c0 = np.floor(cols).astype(int) % N
    c1 = (c0 + 1) % N
    t = cols - np.floor(cols)
    rows = np.arange(N)[:, None]
    return field[rows, c0] * (1 - t) + field[rows, c1] * t

# Heartwood bands: wide vertical streaks (long in y, varied width in x).
heart = sample_cols(periodic_noise(0.012, 0.0006), xs)
heart2 = sample_cols(periodic_noise(0.040, 0.0010), xs)
h = 0.75 * heart + 0.35 * heart2
heart_mask = smoothstep(0.15, 0.45, h)          # 0 = cream sapwood, 1 = caramel heartwood
dark_mask = smoothstep(1.1, 1.7, h)               # deepest brown cores
# Fine grain lines and growth rings, very long in y.
grain = sample_cols(periodic_noise(0.30, 0.0025), xs)
grain2 = sample_cols(periodic_noise(0.09, 0.0018), xs)
lines = smoothstep(0.7, 1.8, grain) * 0.5 + smoothstep(1.0, 2.4, grain2) * 0.35
# Soft tonal variation.
tone = periodic_noise(0.02, 0.002)

cream = np.array([236, 214, 172], float)
honey = np.array([210, 168, 116], float)
caramel = np.array([172, 120, 72], float)
brown = np.array([118, 80, 48], float)

img = cream[None, None] * (1 - heart_mask[..., None]) + honey[None, None] * heart_mask[..., None]
mid = smoothstep(0.45, 0.95, h)
img = img * (1 - mid[..., None] * 0.85) + caramel[None, None] * (mid[..., None] * 0.85)
img = img * (1 - dark_mask[..., None] * 0.7) + brown[None, None] * (dark_mask[..., None] * 0.7)
# Grain lines darken toward the local heartwood colour.
img *= (1 - 0.22 * lines[..., None])
img *= (1 + 0.025 * tone[..., None])

# Pores / mineral flecks: short dark dashes along the grain.
pores = sample_cols(periodic_noise(0.45, 0.02), xs)
img *= (1 - 0.10 * smoothstep(2.2, 3.2, pores)[..., None])
mineral = sample_cols(periodic_noise(0.15, 0.003), xs)
img *= (1 - 0.30 * smoothstep(2.5, 3.3, mineral)[..., None])

# A few small pin knots with a grain swirl, wrapped so the tile stays seamless.
def knot(cx, cy, rx, ry):
    global img
    dx = ((xx - cx + N / 2) % N) - N / 2
    dy = ((yy - cy + N / 2) % N) - N / 2
    r = np.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
    core = smoothstep(1.0, 0.35, r)
    ring = np.exp(-((r - 1.35) ** 2) / 0.12) * 0.35
    halo = smoothstep(3.2, 1.0, r) * 0.18
    shade = np.clip(core * 0.62 + ring + halo, 0, 0.75)
    knot_col = np.array([92, 58, 30], float)
    img = img * (1 - shade[..., None]) + knot_col[None, None] * shade[..., None]

count = int(sys.argv[3]) if len(sys.argv) > 3 else 3
for _ in range(count):
    knot(rng.uniform(0, N), rng.uniform(0, N), rng.uniform(5, 9), rng.uniform(9, 16))

img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img).save(sys.argv[1], quality=88)
