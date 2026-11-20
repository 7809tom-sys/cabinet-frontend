/**
 * Colors sampled from door images in the browser, keyed by image URL (Tom, Nov 20 2026:
 * the checkmarked door image is the door color, "nothing may substitute for it").
 *
 * The door-color resolver is synchronous and shared with the server, so it cannot load
 * an image. The Designer primes this cache for the door images it shows (the uploaded
 * sample and the Approved AI picture); `styleWithCheckedDoorImage` reads it. A URL that
 * has not finished sampling reads as null, and a URL that cannot be read stays null, so
 * nothing is ever made up.
 */
import { useEffect, useState } from "react";
import { sampleDoorImageHex } from "@/lib/sampleDoorImageHex";

type Sampler = (url: string) => Promise<string | null>;

const sampledHex = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let sampler: Sampler = sampleDoorImageHex;

/** The sampled color for this image, or null when it is unknown or still sampling. */
export function cachedDoorImageHex(url: string | null | undefined): string | null {
  const key = (url ?? "").trim();
  return key ? sampledHex.get(key) ?? null : null;
}

/** Samples every URL not sampled yet. Resolves true when any new color arrived. */
export async function primeDoorImageHexes(urls: readonly (string | null | undefined)[]): Promise<boolean> {
  const keys = Array.from(new Set(urls.map((url) => (url ?? "").trim()).filter(Boolean)));
  const work = keys
    .filter((key) => !sampledHex.has(key))
    .map((key) => {
      let job = pending.get(key);
      if (!job) {
        job = sampler(key).catch(() => null).then((hex) => {
          sampledHex.set(key, hex);
          pending.delete(key);
          return hex;
        });
        pending.set(key, job);
      }
      return job;
    });
  if (work.length === 0) return false;
  const results = await Promise.all(work);
  return results.some(Boolean);
}

/**
 * Primes the cache for these URLs and returns a number that changes whenever new colors
 * arrive, so memoised door colors recompute.
 */
export function useDoorImageHexVersion(urls: readonly (string | null | undefined)[]): number {
  const [version, setVersion] = useState(0);
  const key = Array.from(new Set(urls.map((url) => (url ?? "").trim()).filter(Boolean))).sort().join("\n");
  useEffect(() => {
    let live = true;
    void primeDoorImageHexes(key ? key.split("\n") : []).then((changed) => {
      if (live && changed) setVersion((current) => current + 1);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return version;
}

/** Tests only. */
export function __setDoorImageSamplerForTests(next: Sampler | null, seed?: Record<string, string | null>): void {
  sampler = next ?? sampleDoorImageHex;
  sampledHex.clear();
  pending.clear();
  for (const [url, hex] of Object.entries(seed ?? {})) sampledHex.set(url, hex);
}
