import { useId } from "react";
import {
  buildProfileGeometry,
  GLAZE_OPTIONS,
  GLAZE_LINE_WIDTH_IN,
  type WalzProfileTemplate,
  type GlazeOption,
} from "@shared/walzcraftDoorTemplates";

const PADDING_IN = 0.3;

export function formatInches(n: number): string {
  if (!Number.isFinite(n)) return "0\"";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Math.floor(abs + 1e-9);
  const frac = abs - whole;
  const eighths = Math.round(frac * 8);
  if (eighths === 0) return `${sign}${whole}"`;
  if (eighths === 8) return `${sign}${whole + 1}"`;
  let num = eighths;
  let den = 8;
  while (num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  if (whole === 0) return `${sign}${num}/${den}"`;
  return `${sign}${whole}-${num}/${den}"`;
}

function formatAngle(deg: number): string {
  const rounded = Math.round(deg * 10) / 10;
  return `${rounded}°`;
}

export function WalzProfileSvg({
  template,
  glaze = "none",
  className,
}: {
  template: WalzProfileTemplate;
  glaze?: GlazeOption;
  className?: string;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, "");
  const hatchId = `hatch-${uid}`;

  const geo = buildProfileGeometry(template);
  const { outline, recesses, widthIn, thicknessIn } = geo;

  const vbX = -PADDING_IN;
  const vbY = -PADDING_IN;
  const vbW = widthIn + PADDING_IN * 2;
  const vbH = thicknessIn + PADDING_IN + 0.5; // extra bottom room for labels + footnote

  // Flip y so face (y=thickness) is at top of the drawing.
  const flip = (y: number) => thicknessIn - y;

  const outlinePoints = outline
    .map(([x, y]) => `${x},${flip(y)}`)
    .join(" ");

  const glazeOpt = GLAZE_OPTIONS.find((g) => g.id === glaze) ?? GLAZE_OPTIONS[0];
  const showGlaze = glaze !== "none";

  // Dimension labels
  const frameWidth = template.frameWidth;
  const reveal = template.panelReveal;
  const bevel = template.faceBevelDeg;

  const frameLabel = `${formatInches(frameWidth.value)}${frameWidth.estimated ? "*" : ""}`;
  const revealLabel = `${formatInches(reveal.value)}${reveal.estimated ? "*" : ""}`;
  const showBevel = bevel.value > 0;
  const bevelLabel = showBevel
    ? `${formatAngle(bevel.value)}${bevel.estimated ? "*" : ""}`
    : "";

  const anyEstimated =
    frameWidth.estimated ||
    reveal.estimated ||
    (showBevel && bevel.estimated);

  // Frame label position: centered under the frame region (x from 0..frameWidth)
  const frameLabelX = Math.min(frameWidth.value, widthIn) / 2;
  const frameLabelY = thicknessIn + 0.18;

  // Reveal label position: under the panel bevel region
  const revealStartX = Math.min(frameWidth.value + 0.125, widthIn);
  const revealEndX = Math.min(revealStartX + reveal.value, widthIn);
  const revealLabelX = (revealStartX + revealEndX) / 2;
  const revealLabelY = thicknessIn + 0.18;

  // Bevel angle label: near the frame face, above the drawing
  const bevelLabelX = Math.min(frameWidth.value * 0.5, widthIn);
  const bevelLabelY = -0.08;

  const fontSize = 0.16;

  return (
    <svg
      role="img"
      aria-label={`${template.id} ${template.name} profile`}
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      <defs>
        <pattern
          id={hatchId}
          patternUnits="userSpaceOnUse"
          width="0.12"
          height="0.12"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="0.12"
            stroke="#999999"
            strokeWidth="0.012"
          />
        </pattern>
      </defs>

      {/* Hatching under the profile */}
      <polygon
        points={outlinePoints}
        fill={`url(#${hatchId})`}
        stroke="none"
      />

      {/* Main outline */}
      <polygon
        points={outlinePoints}
        fill="#ffffff"
        fillOpacity={0.85}
        stroke="#000000"
        strokeWidth={0.03}
        strokeLinejoin="round"
      />

      {/* Glaze lines in recesses */}
      {showGlaze &&
        recesses.map((poly, i) => {
          const pts = poly
            .map(([x, y]) => `${x},${flip(y)}`)
            .join(" ");
          return (
            <polyline
              key={`glaze-${i}`}
              points={pts}
              fill="none"
              stroke={glazeOpt.stroke}
              strokeWidth={GLAZE_LINE_WIDTH_IN}
              strokeLinecap="round"
              strokeLinejoin="round"
              data-testid="glaze-line"
            />
          );
        })}

      {/* Dimension labels */}
      <g
        fill="#000000"
        fontFamily="sans-serif"
        fontSize={fontSize}
        textAnchor="middle"
      >
        <text x={frameLabelX} y={frameLabelY}>
          {frameLabel}
        </text>
        <text x={revealLabelX} y={revealLabelY}>
          {revealLabel}
        </text>
        {showBevel && (
          <text x={bevelLabelX} y={bevelLabelY}>
            {bevelLabel}
          </text>
        )}
        {anyEstimated && (
          <text
            x={widthIn / 2}
            y={thicknessIn + 0.36}
            fontSize={fontSize * 0.85}
            fill="#555555"
          >
            * estimated
          </text>
        )}
      </g>
    </svg>
  );
}
