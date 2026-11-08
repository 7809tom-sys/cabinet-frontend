// ─── Straight-on SVG outlines for real catalog hardware ─────────────────────
// The catalog photos are angled product shots, so they cannot be pasted into an
// elevation. Each selected item is instead drawn as a clean front-on outline in
// its family's real shape and finish colour, sized from the catalog dimensions.
//
// Everything here is presentation only: no pricing, cart or 3D behaviour reads it.

import { useId } from "react";
import { mixHexColor, type HardwareDrawSpec, type HardwareFamily } from "@/lib/hardwareElevation";

interface GlyphProps {
  spec: HardwareDrawSpec;
  /** Body box in real inches, already fitted to the cabinet front. */
  widthIn: number;
  heightIn: number;
  /** Finish colour picked by the customer. */
  accent: string;
  /** Door pulls run down the face; drawer pulls keep the bar horizontal. */
  vertical: boolean;
}

/** The drawn box is normalised so its short side is this many SVG units. */
const SHORT_SIDE_UNITS = 100;

function roundedRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  return `M${x + radius},${y}H${x + w - radius}A${radius},${radius} 0 0 1 ${x + w},${y + radius}V${y + h - radius}A${radius},${radius} 0 0 1 ${x + w - radius},${y + h}H${x + radius}A${radius},${radius} 0 0 1 ${x},${y + h - radius}V${y + radius}A${radius},${radius} 0 0 1 ${x + radius},${y}Z`;
}

/**
 * One piece drawn inside a `width` × `height` box using the box's own units, so
 * the outline stays proportional at any zoom. `bar` is the metal body, `post`
 * the darker stand-off/screw detail and `shadow` the ambient contact shade.
 */
function FamilyShape({
  family,
  width,
  height,
  bar,
  post,
  shadow,
}: {
  family: HardwareFamily;
  width: number;
  height: number;
  bar: string;
  post: string;
  shadow: string;
}) {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const min = Math.min(w, h);
  switch (family) {
    case "round-knob": {
      const r = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return (
        <>
          <circle cx={cx + r * 0.08} cy={cy + r * 0.12} r={r * 0.94} fill={shadow} opacity={0.3} />
          <circle cx={cx} cy={cy} r={r * 0.92} fill={`url(#${bar})`} stroke={post} strokeWidth={Math.max(1.5, r * 0.08)} />
          <circle cx={cx - r * 0.22} cy={cy - r * 0.26} r={r * 0.3} fill="#ffffff" opacity={0.34} />
        </>
      );
    }
    case "square-knob": {
      const side = min;
      const x = (w - side) / 2;
      const y = (h - side) / 2;
      const radius = side * 0.16;
      return (
        <>
          <path d={roundedRect(x + side * 0.04, y + side * 0.07, side * 0.94, side * 0.94, radius)} fill={shadow} opacity={0.28} />
          <path d={roundedRect(x, y, side * 0.94, side * 0.94, radius)} fill={`url(#${bar})`} stroke={post} strokeWidth={Math.max(1.2, side * 0.045)} />
          <path d={roundedRect(x + side * 0.2, y + side * 0.2, side * 0.54, side * 0.54, radius * 0.5)} fill="none" stroke={post} strokeWidth={Math.max(1, side * 0.035)} opacity={0.55} />
        </>
      );
    }
    case "bar-pull": {
      // Two stand-off posts carrying one straight tube, seen head-on.
      const barH = h * 0.5;
      const barY = h * 0.08;
      const footW = Math.max(4, w * 0.09);
      const footH = h * 0.62;
      return (
        <>
          {[0, 1].map((index) => {
            const x = index === 0 ? w * 0.07 : w * 0.93 - footW;
            return <path key={index} d={roundedRect(x, barY + barH * 0.55, footW, footH, footW / 2)} fill={post} opacity={0.9} />;
          })}
          <path d={roundedRect(0, barY + h * 0.07, w, barH, barH / 2)} fill={shadow} opacity={0.22} />
          <path d={roundedRect(0, barY, w, barH, barH / 2)} fill={`url(#${bar})`} stroke={post} strokeWidth={Math.max(1.2, min * 0.05)} />
          <path d={roundedRect(w * 0.05, barY + barH * 0.16, w * 0.9, barH * 0.2, barH * 0.1)} fill="#ffffff" opacity={0.34} />
        </>
      );
    }
    case "arch-pull": {
      // A bow/arch tube: both ends land on the door, the middle stands proud.
      const stroke = Math.max(8, min * 0.42);
      const pad = Math.max(stroke * 0.6, w * 0.05);
      const bottom = h * 0.9;
      const top = h * 0.12;
      const curve = `M${pad},${bottom}C${pad + w * 0.12},${top} ${w - pad - w * 0.12},${top} ${w - pad},${bottom}`;
      return (
        <>
          <path d={curve} fill="none" stroke={shadow} strokeWidth={stroke} strokeLinecap="round" opacity={0.22} transform={`translate(0 ${h * 0.06})`} />
          <path d={curve} fill="none" stroke={`url(#${bar})`} strokeWidth={stroke} strokeLinecap="round" />
          <path d={curve} fill="none" stroke="#ffffff" strokeWidth={Math.max(1.5, stroke * 0.16)} strokeLinecap="round" opacity={0.4} />
          {[pad, w - pad].map((x, index) => (
            <circle key={index} cx={x} cy={bottom} r={stroke * 0.56} fill={post} />
          ))}
        </>
      );
    }
    case "t-bar": {
      // A T-bar: a short grip tube on a single centre stem.
      const barH = h * 0.34;
      const stemW = Math.max(5, w * 0.1);
      const stemX = w / 2 - stemW / 2;
      return (
        <>
          <path d={roundedRect(stemX, barH * 0.7, stemW, h - barH * 0.9, stemW / 2)} fill={post} />
          <path d={roundedRect(w * 0.02, 0, w * 0.96, barH, barH * 0.42)} fill={`url(#${bar})`} stroke={post} strokeWidth={Math.max(1.2, min * 0.05)} />
          <path d={roundedRect(w * 0.08, barH * 0.16, w * 0.84, barH * 0.2, barH * 0.1)} fill="#ffffff" opacity={0.3} />
          <path d={roundedRect(w / 2 - stemW * 1.1, h - stemW * 0.7, stemW * 2.2, stemW * 0.7, stemW * 0.25)} fill={post} />
        </>
      );
    }
    case "edge-pull": {
      // A finger/tab pull is screwed to the opening edge, so it reads as a lip
      // with a shadowed finger slot directly under the top edge.
      const lipH = h * 0.62;
      return (
        <>
          <path d={roundedRect(w * 0.02, 0, w * 0.96, lipH, lipH * 0.34)} fill={`url(#${bar})`} stroke={post} strokeWidth={Math.max(1.2, lipH * 0.12)} />
          <path d={roundedRect(w * 0.12, lipH * 0.42, w * 0.76, lipH * 0.26, lipH * 0.13)} fill={shadow} opacity={0.5} />
          <path d={roundedRect(w * 0.08, lipH * 0.12, w * 0.84, lipH * 0.12, lipH * 0.06)} fill="#ffffff" opacity={0.3} />
        </>
      );
    }
    case "cup-pull":
    default: {
      // Cup / bin pull: a half-moon shell with a screw tab on each side.
      const bodyH = h * 0.86;
      const tabW = Math.max(5, w * 0.08);
      const halfH = Math.max(5, bodyH * 0.7);
      return (
        <>
          {[0, 1].map((index) => {
            const x = index === 0 ? 0 : w - tabW;
            return <path key={index} d={roundedRect(x, bodyH - tabW, tabW, Math.max(1, bodyH * 0.9), tabW * 0.3)} fill={post} />;
          })}
          <path
            d={`M${w * 0.04},${bodyH * 0.06}H${w * 0.96}V${bodyH * 0.34}A${w * 0.46},${halfH} 0 0 1 ${w * 0.04},${bodyH * 0.34}Z`}
            fill={`url(#${bar})`}
            stroke={post}
            strokeWidth={Math.max(1.2, min * 0.06)}
          />
          <path
            d={`M${w * 0.16},${bodyH * 0.2}V${bodyH * 0.32}A${w * 0.34},${halfH * 0.6} 0 0 0 ${w * 0.84},${bodyH * 0.32}V${bodyH * 0.2}`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={Math.max(1, min * 0.05)}
            opacity={0.36}
          />
        </>
      );
    }
  }
}

/**
 * One hardware piece, drawn front-on in the customer's finish. The SVG fills its
 * container, and its viewBox is derived from the real inch box, so the outline
 * keeps true proportions while the whole elevation zooms.
 */
export function HardwareGlyph({ spec, widthIn, heightIn, accent, vertical }: GlyphProps) {
  const rawId = useId();
  const gradientId = `hw-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const w = Math.max(0.001, widthIn);
  const h = Math.max(0.001, heightIn);
  const shortIn = Math.min(w, h);
  const unitPerIn = SHORT_SIDE_UNITS / shortIn;
  const longU = (Math.max(w, h)) * unitPerIn;
  const shortU = SHORT_SIDE_UNITS;
  // A door pull is the same real piece turned 90°, so the natural horizontal
  // outline is rotated inside the tall container instead of being redrawn.
  const rotated = vertical && !spec.knob && spec.family !== "edge-pull" && spec.family !== "cup-pull";

  const highlight = mixHexColor(accent, "#ffffff", 0.6);
  const shade = mixHexColor(accent, "#000000", 0.42);
  const outline = mixHexColor(accent, "#000000", 0.55);

  return (
    <svg
      viewBox={rotated ? `0 0 ${shortU} ${longU}` : `0 0 ${longU} ${shortU}`}
      width="100%"
      height="100%"
      style={{ display: "block", overflow: "visible" }}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={highlight} />
          <stop offset="34%" stopColor={accent} />
          <stop offset="72%" stopColor={shade} />
          <stop offset="100%" stopColor={mixHexColor(accent, "#ffffff", 0.22)} />
        </linearGradient>
      </defs>
      <g transform={rotated ? `translate(${shortU} 0) rotate(90)` : undefined}>
        <FamilyShape family={spec.family} width={longU} height={shortU} bar={gradientId} post={outline} shadow={shade} />
      </g>
    </svg>
  );
}
