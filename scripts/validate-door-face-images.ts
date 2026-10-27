/**
 * Score local door and drawer-front files with validateDoorFaceImages.
 *
 *   pnpm exec tsx scripts/validate-door-face-images.ts path/to/manifest.json
 *
 * Manifest shape:
 * {
 *   "styles": [
 *     {
 *       "ourName": "Aspen Charcoal",
 *       "doorUrl": "https://cdn.example/door.png",
 *       "drawerUrl": "https://cdn.example/drawer.png",
 *       "doorPath": "./door.png",
 *       "drawerPath": "./drawer.png"
 *     }
 *   ]
 * }
 *
 * doorPath and drawerPath are files on disk, relative to the manifest.
 * doorUrl and drawerUrl are the catalog URLs passed to the same-url check.
 * This script does not fetch those URLs, and it does not write to the
 * database or to Featured Styles.
 *
 * The repo has no Aspen Charcoal photograph. Pass a manifest of files you
 * have on disk when you want to score real samples.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  validateDoorFaceImages,
  type FaceImagePixels,
} from "../shared/doorFaceImageQuality";

type ManifestStyle = {
  ourName: string;
  doorUrl: string;
  drawerUrl: string;
  doorPath: string;
  drawerPath: string;
};

function usage(): string {
  return "Usage: pnpm exec tsx scripts/validate-door-face-images.ts <manifest.json>";
}

function readManifest(file: string): ManifestStyle[] {
  const raw = JSON.parse(readFileSync(file, "utf8")) as { styles?: unknown };
  if (!raw || !Array.isArray(raw.styles) || raw.styles.length === 0) {
    throw new Error("manifest.styles must be a non-empty array");
  }
  return raw.styles.map((row, index) => {
    if (!row || typeof row !== "object")
      throw new Error(`styles[${index}] is not an object`);
    const style = row as Record<string, unknown>;
    for (const key of [
      "doorUrl",
      "drawerUrl",
      "doorPath",
      "drawerPath",
    ] as const) {
      if (
        typeof style[key] !== "string" ||
        (style[key] as string).trim() === ""
      ) {
        throw new Error(`styles[${index}].${key} must be a non-empty string`);
      }
    }
    for (const key of ["doorPath", "drawerPath"] as const) {
      if (/^https?:\/\//i.test(style[key] as string)) {
        throw new Error(`styles[${index}].${key} must be a local file`);
      }
    }
    return {
      ourName:
        typeof style.ourName === "string" && style.ourName.trim()
          ? style.ourName.trim()
          : `Style ${index + 1}`,
      doorUrl: (style.doorUrl as string).trim(),
      drawerUrl: (style.drawerUrl as string).trim(),
      doorPath: style.doorPath as string,
      drawerPath: style.drawerPath as string,
    };
  });
}

async function loadImage(file: string): Promise<FaceImagePixels> {
  const sharp = (await import("sharp")).default;
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    rgba: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  };
}

async function main(): Promise<void> {
  const manifestPath = process.argv[2];
  if (!manifestPath || manifestPath === "--help" || manifestPath === "-h") {
    console.error(usage());
    process.exit(manifestPath ? 0 : 2);
  }
  const absoluteManifest = path.resolve(manifestPath);
  const styles = readManifest(absoluteManifest);
  const base = path.dirname(absoluteManifest);
  const reports = [];
  for (const style of styles) {
    const door = await loadImage(path.resolve(base, style.doorPath));
    const drawer = await loadImage(path.resolve(base, style.drawerPath));
    const result = validateDoorFaceImages({
      ourName: style.ourName,
      doorUrl: style.doorUrl,
      drawerUrl: style.drawerUrl,
      door,
      drawer,
    });
    reports.push({
      ourName: style.ourName,
      ok: result.ok,
      issues: result.issues,
    });
  }
  const ok = reports.every((report) => report.ok);
  console.log(JSON.stringify({ ok, styles: reports }, null, 2));
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(2);
});
