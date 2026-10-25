// Global language context (EN / ES / ZH) for the entire Cabinet Dealz site.
//
// This is the single source of truth for the visitor's language choice. It
// reuses the SAME localStorage key, `?lang=` deep-link rule, and browser-
// language detection as the affiliate storefront (see storefrontI18n.ts), so a
// language picked on the main site carries into every affiliate/member
// storefront and vice versa — one switch, one persisted choice, everywhere.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { readInitialLang, makeStorefrontT, type Lang } from "@/lib/storefrontI18n";
import { SITE_STRINGS, type SiteStringKey } from "@/lib/i18n/site";

const STORAGE_KEY = "cd_storefront_lang";

type LanguageContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  /** Translate a site UI-chrome key, interpolating {var} placeholders. */
  t: (key: SiteStringKey, vars?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  // Persist the choice and reflect it on <html lang> for a11y / SEO.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore storage errors (private mode, etc.) */
    }
    try {
      document.documentElement.lang = lang;
    } catch {
      /* ignore (SSR / non-DOM) */
    }
  }, [lang]);

  // Keep multiple tabs / the storefront's own toggle in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "en" || e.newValue === "es" || e.newValue === "zh")) {
        setLangState(e.newValue as Lang);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(
    () => setLangState((prev) => prev === "en" ? "es" : prev === "es" ? "zh" : "en"),
    []
  );

  const t = useCallback(
    (key: SiteStringKey, vars?: Record<string, string | number>) => {
      const table = (SITE_STRINGS as Record<string, Record<string, string>>)[lang] ?? SITE_STRINGS.en;
      let str: string = table[key] ?? (SITE_STRINGS.en as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggle, t }),
    [lang, setLang, toggle, t]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

/** Access the global language. Safe to call anywhere under <LanguageProvider>. */
export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a <LanguageProvider>");
  }
  return ctx;
}

/**
 * Non-throwing variant for shared components (e.g. the storefront) that may
 * render outside the global provider in tests. Falls back to a local reading.
 */
export function useLanguageOptional(): LanguageContextValue | null {
  return useContext(LanguageContext);
}

/**
 * Storefront-flavored language hook bound to the GLOBAL language. Returns the
 * same `{ lang, setLang, toggle }` plus a storefront-string translator `t`, so
 * affiliate/member storefronts share the one site-wide EN|ES choice. Drop-in
 * replacement for the standalone `useStorefrontLang()`.
 */
export function useStorefrontLangGlobal() {
  const { lang, setLang, toggle } = useLanguage();
  const t = useMemo(() => makeStorefrontT(lang), [lang]);
  return { lang, setLang, toggle, t };
}
