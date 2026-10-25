import { useMemo, useState } from "react";
import { doorPanelKind } from "@/lib/design";
import { catalogMediaRecoveryUrl, newCatalogMediaRetryNonce } from "@/lib/catalogMediaImage";

// ─────────────────────────────────────────────────────────────────────────────
// DoorStyleSwatch
// Renders a clean, consistent SVG of a cabinet door in the door style's REAL
// color and panel treatment. This replaces photographic image fields that point
// at non-existent files (e.g. /door-samples/*.jpg), so the catalog always shows
// an accurate, on-brand visual with no distributor/dealer watermark.
//
// Color is derived from the door style's paint/finish color name (Sherwin-Williams
// codes are common in the data, e.g. "SW 7004 Snowbound"). Panel treatment is
// derived from the door-style family (Shaker, Raised Panel, Slab, Beaded, Inset).
// ─────────────────────────────────────────────────────────────────────────────

export interface DoorStyleLike {
  styleCode?: string | null;
  ourName?: string | null;
  aliasName?: string | null;
  name?: string | null;
  doorStyle?: string | null;
  color?: string | null;
  swColor?: string | null;
  finish?: string | null;
  woodSpecies?: string | null;
  /** Real door photo thumbnail — shown instead of SVG when present */
  thumbnailImageUrl?: string | null;
  /** Fallback door sample photo */
  doorSampleImageUrl?: string | null;
}

interface DoorStyleSwatchProps {
  style: DoorStyleLike;
  className?: string;
}

export interface Swatch {
  face: string;
  edge: string;
  panel: string;
  label: string;
  isWood: boolean;
  isGlass: boolean;
}

const COLOR_BY_KEYWORD: { match: RegExp; hex: string; wood?: boolean }[] = [
  { match: /snowbound|extra white|pure white|high reflective|marshmallow|alabaster|greek villa/, hex: "#f4f2ec" },
  { match: /cashmere/, hex: "#e3dacd" },
  { match: /creamy|antique white|natural choice|shoji|ivory|biscuit|almond|manila/, hex: "#ece2cf" },
  { match: /repose gray|agreeable gray|accessible beige|mindful gray|greige|mushroom/, hex: "#cabfae" },
  { match: /mineral|dorian gray|gauntlet|dovetail|pewter|repose|fog/, hex: "#a7a39a" },
  { match: /grizzle|peppercorn|iron ore|urbane bronze|graphite|charcoal|slate|gris/, hex: "#5b5b58" },
  { match: /tricorn black|black magic|caviar|onyx|carbon|tricorn|cracked pepper|noir|velvet black|iron black|obsidian|midnight|\bblack\b/, hex: "#2a2a2c" },
  { match: /naval|indigo|sea serpent|navy|cobalt|blue/, hex: "#36465c" },
  { match: /evergreen|pewter green|rosemary|sage|forest|hunter|green|ivy/, hex: "#56685b" },
  { match: /harbor/, hex: "#9aa0a6" },
  { match: /unfinished/, hex: "#d8bb84", wood: true },
  { match: /hickory|rustic/, hex: "#a07850", wood: true },
  { match: /cherry|mahogany|chestnut|cinnamon|brick|spice/, hex: "#7a4a32", wood: true },
  { match: /walnut|mocha|coffee|java|espresso|chocolate|brown|umbra|shadow/, hex: "#6b4a32", wood: true },
  { match: /white oak|natural|honey|maple|wheat|amber|toffee|oak|solis|solar/, hex: "#c79a63", wood: true },
  { match: /gray|grey|stone|cinder|slate|vesper|nimbus|sterling|carbon/, hex: "#9aa0a6" },
  { match: /white|snow|arctic|pearl|dove|frost|blanc|nova|lumina|haven white|aura blanc|bloom blanc|edge blanc|dawn|air white|ice white|aura white|nimbus white|nova white|edge white|oxford white|casselberry white|white core|dual white|bloom white/, hex: "#f3f1ec" },
  { match: /cream|linen|sand|beige|tan|creme|ivoire|aura cream|terra|vellum crema|velvet cream|earth shaker/, hex: "#e6dcc6" },
  { match: /rust|copper|sylvan|bloom umbra|forest rust|bloom shadow/, hex: "#b5603a", wood: true },
  { match: /sage|zenith|zephyr|oxford sage/, hex: "#7a9e7e" },
  { match: /gold|brass|aurum|treasure/, hex: "#c9a84c" },
];

const DEFAULT_HEX = "#c79a63"; // warm wood fallback

/**
 * Supplier/admin hex values are the actual finish data and must take precedence
 * over word matching. Normalizing 3-digit values here keeps the visual swatch
 * and the light-to-dark color rail on one source of truth.
 */
function exactStyleHex(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!match) continue;
    const raw = match[1].toLowerCase();
    return raw.length === 3
      ? `#${raw.split("").map((part) => `${part}${part}`).join("")}`
      : `#${raw}`;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function shade(hex: string, amount: number): string {
  // amount < 0 darkens, > 0 lightens
  const [r, g, b] = hexToRgb(hex);
  const adj = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `#${[adj(r), adj(g), adj(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function resolveSwatch(style: DoorStyleLike): Swatch {
  const haystack = `${style.color ?? ""} ${style.swColor ?? ""} ${style.ourName ?? ""} ${style.aliasName ?? ""} ${style.name ?? ""} ${style.finish ?? ""} ${style.woodSpecies ?? ""}`.toLowerCase();
  const suppliedHex = exactStyleHex(style.color, style.swColor);
  let face = suppliedHex ?? DEFAULT_HEX;
  let isWood = false;
  let isGlass = false;

  if (/glass|crystal|prism|nocturne glass|prism clear|night glass/.test(haystack)) {
    isGlass = true;
    face = "#b8d4e8";
  } else {
    for (const c of COLOR_BY_KEYWORD) {
      if (c.wood && c.match.test(haystack)) isWood = true;
      // A verified hex is more specific than every text alias. Still scan the
      // words above for wood-grain treatment, but never replace its color.
      if (suppliedHex) continue;
      if (c.match.test(haystack)) {
        face = c.hex;
        isWood = c.wood ?? false;
        break;
      }
    }
  }

  const lum = luminance(face);
  return {
    face,
    edge: shade(face, lum > 0.6 ? -0.18 : -0.12),
    panel: shade(face, lum > 0.6 ? -0.07 : 0.05),
    label: lum > 0.55 ? "#3a3a3a" : "#f5f5f5",
    isWood,
    isGlass,
  };
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const mix = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `#${[mix(ar, br), mix(ag, bg), mix(ab, bb)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function WoodGrain({ W, H, edge, opacity = 0.15 }: { W: number; H: number; edge: string; opacity?: number }) {
  const lines = [0.18, 0.32, 0.47, 0.61, 0.74, 0.87];
  return (
    <>
      {lines.map((x, i) => (
        <line
          key={i}
          x1={W * x}
          y1={4}
          x2={W * x + (i % 2 === 0 ? 1.5 : -1)}
          y2={H - 4}
          stroke={edge}
          strokeWidth={0.6}
          opacity={opacity}
        />
      ))}
    </>
  );
}

export function DoorStyleSwatch({ style, className }: DoorStyleSwatchProps) {
  // Hooks must be called unconditionally (Rules of Hooks)
  const sw = useMemo(() => resolveSwatch(style), [style]);
  const kind = useMemo(() => doorPanelKind(style.doorStyle ?? style.ourName ?? style.aliasName ?? style.name), [style]);
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null);
  const [photoRetry, setPhotoRetry] = useState<{ original: string; url: string } | null>(null);

  // If a real door photo is available, show it instead of the SVG illustration.
  const photoUrl = style.thumbnailImageUrl || style.doorSampleImageUrl;
  if (photoUrl && failedPhotoUrl !== photoUrl) {
    return (
      <img
        src={photoRetry?.original === photoUrl ? photoRetry.url : photoUrl}
        alt={`${style.aliasName || style.ourName || style.name || style.styleCode || "Door"} door sample`}
        className={className}
        style={{ objectFit: "cover", display: "block" }}
        loading="lazy"
        onError={() => {
          if (photoRetry?.original === photoUrl) {
            setFailedPhotoUrl(photoUrl);
            return;
          }
          const retryUrl = catalogMediaRecoveryUrl(photoUrl, newCatalogMediaRetryNonce());
          if (retryUrl) setPhotoRetry({ original: photoUrl, url: retryUrl });
          else setFailedPhotoUrl(photoUrl);
        }}
      />
    );
  }

  const W = 100;
  const H = 130;
  // Standard Shaker rail/stile reads ~2.25". A Slim/Narrow Shaker uses a ~1/2"
  // rail, so its frame is roughly a fifth as wide — draw a visibly thinner stile.
  const isSlim = kind === "slim-shaker";
  const stile = isSlim ? 6 : 13;
  const lum = luminance(sw.face);

  const gradId = `dg-${(style.ourName ?? style.aliasName ?? style.styleCode ?? "x").replace(/\s+/g, "").slice(0, 20)}`;
  const shadowId = `ds-${gradId}`;
  const grainClipId = `dgc-${gradId}`;

  const highlight = mixHex(sw.face, "#ffffff", lum > 0.7 ? 0.1 : 0.2);
  const shadowTone = shade(sw.face, lum > 0.6 ? -0.1 : -0.08);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${style.aliasName || style.ourName || style.name || style.styleCode || "Door"} door sample`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="45%" stopColor={sw.face} />
          <stop offset="100%" stopColor={shadowTone} />
        </linearGradient>
        <filter id={shadowId} x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="1.5" dy="2" stdDeviation="2.5" floodColor="#00000030" />
        </filter>
        {sw.isWood && (
          <clipPath id={grainClipId}>
            <rect x="2" y="2" width={W - 4} height={H - 4} rx="3" />
          </clipPath>
        )}
      </defs>

      {/* Outer door slab with gradient + drop shadow */}
      <rect
        x="2" y="2"
        width={W - 4} height={H - 4}
        rx="3"
        fill={`url(#${gradId})`}
        stroke={sw.edge}
        strokeWidth="1.5"
        filter={`url(#${shadowId})`}
      />

      {/* Wood grain lines */}
      {sw.isWood && (
        <g clipPath={`url(#${grainClipId})`}>
          <WoodGrain W={W} H={H} edge={sw.edge} />
        </g>
      )}

      {/* Glass pane */}
      {sw.isGlass && (
        <>
          <rect x={stile} y={stile} width={W - 2 * stile} height={H - 2 * stile} rx="2"
            fill="none" stroke={sw.edge} strokeWidth="1.5" />
          <rect x={stile + 3} y={stile + 3} width={W - 2 * stile - 6} height={H - 2 * stile - 6} rx="1.5"
            fill="#c8dff0" fillOpacity="0.5" stroke="#a0c4d8" strokeWidth="0.75" />
          <line x1={stile + 8} y1={stile + 6} x2={stile + 18} y2={stile + 28}
            stroke="#ffffff" strokeWidth="2" strokeOpacity="0.45" strokeLinecap="round" />
        </>
      )}

      {/* Slab */}
      {kind === "slab" && (
        <rect x="8" y="8" width={W - 16} height={H - 16} rx="2"
          fill="none" stroke={sw.edge} strokeWidth="0.6" opacity="0.35" />
      )}

      {/* Beaded */}
      {kind === "beaded" && (
        <>
          <rect x="8" y="8" width={W - 16} height={H - 16} rx="2"
            fill="none" stroke={sw.edge} strokeWidth="1" opacity="0.45" />
          {[0.22, 0.41, 0.59, 0.78].map((x, i) => (
            <line key={i} x1={W * x} y1="10" x2={W * x} y2={H - 10}
              stroke={sw.edge} strokeWidth="0.8" opacity="0.38" />
          ))}
        </>
      )}

      {/* Shaker / Slim Shaker / Inset / Raised */}
      {(kind === "shaker" || kind === "slim-shaker" || kind === "inset" || kind === "raised") && (
        <>
          {/* Panel drop shadow (tighter for a slim frame so it doesn't swallow it) */}
          <rect x={stile + (isSlim ? 1 : 2)} y={stile + (isSlim ? 1 : 2)} width={W - 2 * stile} height={H - 2 * stile}
            rx="2" fill={sw.edge} opacity="0.18" />
          {/* Panel face */}
          <rect x={stile} y={stile} width={W - 2 * stile} height={H - 2 * stile}
            rx="2" fill={sw.panel} stroke={sw.edge} strokeWidth={isSlim ? 1 : 1.25} />
          {/* Inner bevel highlight */}
          <rect x={stile + 3} y={stile + 3} width={W - 2 * stile - 6} height={H - 2 * stile - 6}
            rx="1.5" fill="none" stroke={shade(sw.face, 0.1)} strokeWidth="0.7" opacity="0.6" />
          {kind === "raised" && (
            <>
              <rect x={stile + 9} y={stile + 9} width={W - 2 * stile - 18} height={H - 2 * stile - 18}
                rx="2" fill={shade(sw.face, 0.05)} stroke={sw.edge} strokeWidth="0.8" />
              <rect x={stile + 12} y={stile + 12} width={W - 2 * stile - 24} height={H - 2 * stile - 24}
                rx="1.5" fill="none" stroke={shade(sw.face, 0.12)} strokeWidth="0.5" opacity="0.45" />
            </>
          )}
        </>
      )}

      {/* Double shaker */}
      {kind === "double-shaker" && (
        <>
          {[0, 1].map((row) => {
            const panelH = (H - 2 * stile - 4) / 2;
            const py = stile + row * (panelH + 4);
            return (
              <g key={row}>
                <rect x={stile + 2} y={py + 2} width={W - 2 * stile} height={panelH}
                  rx="2" fill={sw.edge} opacity="0.18" />
                <rect x={stile} y={py} width={W - 2 * stile} height={panelH}
                  rx="2" fill={sw.panel} stroke={sw.edge} strokeWidth="1.2" />
                <rect x={stile + 3} y={py + 3} width={W - 2 * stile - 6} height={panelH - 6}
                  rx="1.5" fill="none" stroke={shade(sw.face, 0.08)} strokeWidth="0.6" opacity="0.55" />
              </g>
            );
          })}
        </>
      )}

      {/* Door knob */}
      <circle cx={W - 10} cy={H / 2} r={3.5}
        fill={lum > 0.55 ? "#b0a090" : "#d4c8b0"}
        stroke={lum > 0.55 ? "#8a7a6a" : "#a09080"}
        strokeWidth="0.75" />
      <circle cx={W - 11.5} cy={H / 2 - 1.5} r={1.2}
        fill="white" opacity={0.4} />

      {/* Top edge highlight */}
      <rect x="3" y="2" width={W - 6} height={3} rx="2"
        fill="white" opacity={lum > 0.7 ? 0.22 : 0.15} />
    </svg>
  );
}

export default DoorStyleSwatch;
