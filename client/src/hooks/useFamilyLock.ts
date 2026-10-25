// Family-lock: a storefront shopping session is locked to ONE cabinet line
// (door style/finish) which belongs to ONE distributor. This guarantees every
// item in an order ships from a single supply line (no multi-distributor
// freight). The lock is persisted per storefront slug in localStorage.

import { useCallback, useEffect, useState } from "react";

export type LockedFamily = {
  styleId: number;
  distributorId: number;
  name: string;
  doorStyle: string | null;
  finish: string | null;
  color: string | null;
  woodSpecies?: string | null;
  boxConstruction?: string | null;
  drawerConstruction?: string | null;
  hardware?: string | null;
  frameSize?: string | null;
  overlayType?: string | null;
  doorPanelType?: string | null;
  thumbnailImageUrl: string | null;
  roomSceneImageUrl: string | null;
  doorSampleImageUrl?: string | null;
  styleCode?: string | null;
};

function keyFor(slug: string) {
  return `cd_family_lock_${slug}`;
}

function read(slug: string): LockedFamily | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.styleId === "number") return parsed as LockedFamily;
    return null;
  } catch {
    return null;
  }
}

export function useFamilyLock(slug: string) {
  const [family, setFamily] = useState<LockedFamily | null>(() => read(slug));

  // Re-hydrate if the slug changes (different storefront).
  useEffect(() => {
    setFamily(read(slug));
  }, [slug]);

  const lock = useCallback(
    (f: LockedFamily) => {
      try {
        window.localStorage.setItem(keyFor(slug), JSON.stringify(f));
      } catch {
        /* ignore */
      }
      setFamily(f);
    },
    [slug]
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(keyFor(slug));
    } catch {
      /* ignore */
    }
    setFamily(null);
  }, [slug]);

  return { family, lock, clear };
}
