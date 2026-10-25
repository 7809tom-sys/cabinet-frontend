import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readInitialLang } from "./storefrontI18n";

// readInitialLang resolves the storefront language in priority order:
//   1) ?lang= URL param  2) saved localStorage choice  3) "en".
// Browser language never silently switches a new customer away from English.
// These tests stub the relevant window globals to lock that contract in.

const STORAGE_KEY = "cd_storefront_lang";

function setupWindow(opts: {
  search?: string;
  stored?: string | null;
  languages?: string[];
}) {
  const store = new Map<string, string>();
  if (opts.stored) store.set(STORAGE_KEY, opts.stored);

  vi.stubGlobal("window", {
    location: { search: opts.search ?? "" },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
    navigator: { languages: opts.languages ?? [], language: opts.languages?.[0] ?? "" },
  } as unknown as Window & typeof globalThis);
}

describe("readInitialLang", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("honors an explicit ?lang=es param above everything else", () => {
    setupWindow({ search: "?lang=es", stored: "en", languages: ["en-US"] });
    expect(readInitialLang()).toBe("es");
  });

  it("honors ?lang=en even when browser is Spanish", () => {
    setupWindow({ search: "?lang=en", languages: ["es-MX"] });
    expect(readInitialLang()).toBe("en");
  });

  it("falls back to a stored choice when no param is present", () => {
    setupWindow({ search: "", stored: "es", languages: ["en-US"] });
    expect(readInitialLang()).toBe("es");
  });

  it("keeps English on a first visit even when the browser is Spanish", () => {
    setupWindow({ search: "", stored: null, languages: ["es-ES", "en"] });
    expect(readInitialLang()).toBe("en");
  });

  it("defaults to English when nothing indicates Spanish", () => {
    setupWindow({ search: "", stored: null, languages: ["en-US"] });
    expect(readInitialLang()).toBe("en");
  });
});
