import * as THREE from "three";

/**
 * Real surface finishes for the shower surround and the pan.
 *
 * The 3D used to paint the surround with a single flat colour, which reads as a
 * near-white translucent box at any distance. Pelican sells these surrounds in named
 * décors — Carrara Marble, White Wood, White Brick, Grey Wood — and Tom's three
 * reference bathrooms are pale stone, white marble subway tile and grey stone
 * respectively. Each of those has a visible construction rhythm: grout lines between
 * tiles, veining through marble, mottling through stone. Without that rhythm a wall
 * has no scale and no depth.
 *
 * These are drawn as canvas textures at a real physical size, so the grout spacing
 * and veining scale stay correct however large the surround is.
 */

/** How the surround's face is built, from the décor name Pelican publishes. */
export type ShowerSurroundPattern = "marble" | "subway" | "stone" | "plain";

export type ShowerSurroundFinish = {
  /** Base stone / porcelain colour. */
  color: string;
  /** Pattern drawn on top of the base colour. */
  pattern: ShowerSurroundPattern;
  /** Grout or vein colour. */
  accent: string;
  /** Surface roughness; marble is polished, stone is matte. */
  roughness: number;
  clearcoat: number;
  /** How many texture repeats across the panel's own width. */
  repeat: number;
};

/**
 * The décor a surround SKU is sold in.
 *
 * "Carrara Marble" is polished marble with grey veining. "White Brick" is a pale
 * stacked tile, so it gets subway grout lines. "Grey Wood" is the grey stone-look
 * panel of the third reference, so a mottled stone. An unknown code falls back to
 * pale tile rather than a blank colour.
 */
export function showerSurroundFinish(code: string | null | undefined): ShowerSurroundFinish {
  const text = (code ?? "").toLowerCase();
  if (/carrara|marble/.test(text)) {
    // Polished Carrara: cool white slab, clearly visible grey veining.
    return { color: "#ddd8d0", pattern: "marble", accent: "#6f6a62", roughness: 0.2, clearcoat: 0.45, repeat: 1.5 };
  }
  if (/grey wood|gray wood|grey|gray/.test(text)) {
    // The grey stone of the third reference: a mid grey, not a near-white.
    return { color: "#8b8883", pattern: "stone", accent: "#54514d", roughness: 0.74, clearcoat: 0.04, repeat: 2.0 };
  }
  if (/brick/.test(text)) {
    // Pale stacked tile with a legible grout grid.
    return { color: "#d9d4cb", pattern: "subway", accent: "#8c857c", roughness: 0.38, clearcoat: 0.24, repeat: 2.2 };
  }
  if (/white wood/.test(text)) {
    return { color: "#dcd7cf", pattern: "subway", accent: "#948d84", roughness: 0.34, clearcoat: 0.28, repeat: 2.2 };
  }
  return { color: "#d7d2c9", pattern: "subway", accent: "#8f887f", roughness: 0.38, clearcoat: 0.22, repeat: 2.2 };
}

/**
 * Which construction rhythm a surround face should show.
 *
 * Kept as its own function so the 3D and the tests agree on the mapping without
 * needing a WebGL context.
 */
export function showerSurroundPattern(code: string | null | undefined): ShowerSurroundPattern {
  return showerSurroundFinish(code).pattern;
}

/** Deterministic pseudo-random, so the same SKU always renders the same veining. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

/**
 * Draw one tile field.
 *
 * `cells` is how many tiles across the texture; the texture is then repeated
 * `finish.repeat` times across the panel, so the grout spacing stays physical.
 */
function drawPattern(
  context: CanvasRenderingContext2D,
  size: number,
  finish: ShowerSurroundFinish,
): void {
  const random = seeded(
    Array.from(finish.color + finish.pattern).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7),
  );

  if (finish.pattern === "marble") {
    // A soft base, then veins that wander across the slab.
    context.fillStyle = finish.color;
    context.fillRect(0, 0, size, size);
    for (let vein = 0; vein < 14; vein += 1) {
      const startY = random() * size;
      context.beginPath();
      context.strokeStyle = `rgba(120, 114, 106, ${0.35 + random() * 0.3})`;
      context.lineWidth = 0.6 + random() * 2.2;
      context.moveTo(-10, startY);
      let y = startY;
      for (let x = -10; x < size + 10; x += size / 12) {
        y += (random() - 0.5) * size * 0.06;
        context.lineTo(x, y);
      }
      context.stroke();
    }
    // A few darker veins over the pale ones, which is what reads as Carrara.
    for (let vein = 0; vein < 4; vein += 1) {
      const startY = random() * size;
      context.beginPath();
      context.strokeStyle = `rgba(72, 68, 62, ${0.55 + random() * 0.3})`;
      context.lineWidth = 1.6 + random() * 2.4;
      context.moveTo(-10, startY);
      let y = startY;
      for (let x = -10; x < size + 10; x += size / 8) {
        y += (random() - 0.5) * size * 0.09;
        context.lineTo(x, y);
      }
      context.stroke();
    }
    return;
  }

  if (finish.pattern === "stone") {
    // Mottled stone: a base plus irregular patches and fine speckle.
    context.fillStyle = finish.color;
    context.fillRect(0, 0, size, size);
    for (let patch = 0; patch < 90; patch += 1) {
      const radius = size * (0.01 + random() * 0.06);
      context.beginPath();
      context.fillStyle = `rgba(96, 92, 86, ${0.18 + random() * 0.26})`;
      context.ellipse(random() * size, random() * size, radius, radius * (0.5 + random()), random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    for (let speck = 0; speck < 2600; speck += 1) {
      context.fillStyle = `rgba(${random() > 0.5 ? "255,255,255" : "90,88,84"}, ${0.04 + random() * 0.1})`;
      context.fillRect(random() * size, random() * size, 1.4, 1.4);
    }
    // Faint panel joints, like large-format stone.
    context.strokeStyle = finish.accent;
    context.globalAlpha = 0.35;
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(0, size / 2);
    context.lineTo(size, size / 2);
    context.stroke();
    context.globalAlpha = 1;
    return;
  }

  // Subway / stacked tile: offset courses with real grout.
  context.fillStyle = finish.color;
  context.fillRect(0, 0, size, size);
  const courses = 6;
  const rowHeight = size / courses;
  const tileWidth = size / 2;
  context.strokeStyle = finish.accent;
  context.lineWidth = Math.max(4, size / 110);
  for (let row = 0; row < courses; row += 1) {
    const offset = row % 2 === 0 ? 0 : tileWidth / 2;
    const y = row * rowHeight;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(size, y);
    context.stroke();
    for (let x = -tileWidth; x <= size + tileWidth; x += tileWidth) {
      context.beginPath();
      context.moveTo(x + offset, y);
      context.lineTo(x + offset, y + rowHeight);
      context.stroke();
    }
    // A subtle per-tile shade so the field is not one flat colour.
    for (let x = -tileWidth; x <= size + tileWidth; x += tileWidth) {
      context.fillStyle = `rgba(255,255,255,${0.05 + random() * 0.14})`;
      context.fillRect(x + offset + 2, y + 2, tileWidth - 4, rowHeight - 4);
    }
  }
}

/** A cached canvas texture per finish, since a scene rebuild must not redraw it. */
const finishTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * The surround's face texture, sized so grout and veining read at real scale.
 *
 * Returns null when there is no DOM (SSR / tests), so callers must fall back to the
 * flat colour.
 */
export function showerSurroundTexture(finish: ShowerSurroundFinish): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `${finish.pattern}:${finish.color}:${finish.accent}:${finish.repeat}`;
  const cached = finishTextureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  drawPattern(context, 512, finish);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(finish.repeat, finish.repeat * 0.75);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  finishTextureCache.set(key, texture);
  return texture;
}

/**
 * The pan's floor finish: a solid white acrylic base with a fine non-slip texture.
 *
 * A pan is opaque. The reference bathrooms all show a solid white base with real
 * depth, and a translucent one reads as a washed-out box.
 */
export function showerPanTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const cached = finishTextureCache.get("pan");
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = "#fbfbf9";
  context.fillRect(0, 0, 256, 256);
  const random = seeded(31);
  // A very fine stipple: acrylic pans are slightly textured, never mirror-smooth.
  for (let dot = 0; dot < 4200; dot += 1) {
    context.fillStyle = `rgba(226,228,226,${0.25 + random() * 0.35})`;
    context.fillRect(random() * 256, random() * 256, 1.5, 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 2);
  texture.colorSpace = THREE.SRGBColorSpace;
  finishTextureCache.set("pan", texture);
  return texture;
}

/**
 * The metal finish for the door frame, rails and the shower system.
 *
 * Tom asked for the chosen finish — black, chrome or brushed nickel. Each is a real
 * metal, not a grey plastic, so it carries a specular highlight.
 */
export function showerMetalMaterial(finish: "matte-black" | "chrome" | "brushed-nickel"): THREE.MeshStandardMaterial {
  if (finish === "matte-black") {
    // Matte black metal: high metalness, mid roughness, no mirror.
    return new THREE.MeshStandardMaterial({ color: "#1b1d20", roughness: 0.42, metalness: 0.82 });
  }
  if (finish === "chrome") {
    return new THREE.MeshStandardMaterial({ color: "#d9dee1", roughness: 0.12, metalness: 0.94 });
  }
  return new THREE.MeshStandardMaterial({ color: "#c3c9cd", roughness: 0.3, metalness: 0.88 });
}

/** Which metal finish a shower SKU is sold in, from its catalogue code or name. */
export function showerFinishFromCode(code: string | null | undefined): "matte-black" | "chrome" | "brushed-nickel" {
  const text = (code ?? "").toUpperCase();
  if (/\bMB\b|MATTE BLACK|BLACK/.test(text)) return "matte-black";
  if (/\bBN\b|BRUSHED NICKEL/.test(text)) return "brushed-nickel";
  return "chrome";
}

/** Clear glass, the way a real enclosure reads: see-through with a slight tint. */
export function showerGlassMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: "#eaf4f7",
    roughness: 0.04,
    metalness: 0,
    transmission: 0.92,
    transparent: true,
    opacity: 0.34,
    thickness: 0.012,
    ior: 1.5,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
}
