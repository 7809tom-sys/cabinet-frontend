/**
 * Checkout city/state fill from freight.lookupZip.
 *
 * The debounced ZIP already used for pickup options drives this. A city or
 * state the customer typed by hand stays put until that 5-digit ZIP changes.
 * A different ZIP fills both from the new lookup. An unknown ZIP leaves both
 * fields as they are.
 */

export type ZipLookup = { city: string; state: string };

export type ZipFillMemory = {
  /** Last 5-digit ZIP whose lookup we already applied, including an unknown one. */
  appliedZip5: string | null;
  /** 5-digit ZIP the customer hand-edited the city against, if they did. */
  cityEditedZip5: string | null;
  stateEditedZip5: string | null;
};

export function emptyZipFillMemory(): ZipFillMemory {
  return { appliedZip5: null, cityEditedZip5: null, stateEditedZip5: null };
}

/** Five-digit ZIP from a 5-digit value or ZIP+4. Anything else is not ready. */
export function checkoutZip5(value: string): string | null {
  const match = value.trim().match(/^(\d{5})(?:-\d{4})?$/);
  return match?.[1] ?? null;
}

export function rememberManualCity(memory: ZipFillMemory, zip5: string | null): ZipFillMemory {
  if (memory.cityEditedZip5 === zip5) return memory;
  return { ...memory, cityEditedZip5: zip5 };
}

export function rememberManualState(memory: ZipFillMemory, zip5: string | null): ZipFillMemory {
  if (memory.stateEditedZip5 === zip5) return memory;
  return { ...memory, stateEditedZip5: zip5 };
}

export function applyZipLookup(input: {
  city: string;
  state: string;
  memory: ZipFillMemory;
  zip5: string | null;
  /** Undefined while the lookup is still in flight. Null when the ZIP is unknown. */
  lookup: ZipLookup | null | undefined;
}): { city: string; state: string; memory: ZipFillMemory } {
  const { city, state, memory, zip5, lookup } = input;
  if (!zip5 || lookup === undefined || memory.appliedZip5 === zip5) {
    return { city, state, memory };
  }
  if (lookup === null) {
    return { city, state, memory: { ...memory, appliedZip5: zip5 } };
  }
  return {
    city: memory.cityEditedZip5 === zip5 ? city : lookup.city,
    state: memory.stateEditedZip5 === zip5 ? state : lookup.state,
    memory: {
      appliedZip5: zip5,
      cityEditedZip5: memory.cityEditedZip5 === zip5 ? zip5 : null,
      stateEditedZip5: memory.stateEditedZip5 === zip5 ? zip5 : null,
    },
  };
}
