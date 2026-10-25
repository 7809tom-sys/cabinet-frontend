import { useEffect, useRef } from "react";

/**
 * Mount an affiliate's published third-party widget snippet on their storefront.
 *
 * Why this is not just `dangerouslySetInnerHTML`: scripts injected via innerHTML
 * are inert — the browser will not execute them. Widget providers ship a
 * <script> tag as the install mechanism, so to make those work we parse the
 * snippet and re-create each <script> element via document.createElement, which
 * the browser does execute.
 *
 * Trust model: this only ever renders `embedCode`, the snippet the affiliate
 * explicitly published for their own store, validated on the server. It runs on
 * the storefront page (same origin as the store) because that is what widgets
 * require; the isolated sandbox is used for the dashboard *preview* stage so
 * misbehaving snippets are caught before they get here.
 */
export function StorefrontEmbed({ code }: { code?: string | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const snippet = (code ?? "").trim();
    host.innerHTML = "";
    if (!snippet) return;

    // Parse in an inert document so nothing executes during parsing.
    const parsed = new DOMParser().parseFromString(
      `<div id="cd-embed-root">${snippet}</div>`,
      "text/html"
    );
    const root = parsed.getElementById("cd-embed-root");
    if (!root) return;

    const injected: HTMLScriptElement[] = [];

    Array.from(root.childNodes).forEach((node) => {
      if (node.nodeName.toLowerCase() === "script") {
        const original = node as HTMLScriptElement;
        // Recreate the script so the browser actually runs it.
        const script = document.createElement("script");
        Array.from(original.attributes).forEach((attr) =>
          script.setAttribute(attr.name, attr.value)
        );
        if (original.textContent) script.textContent = original.textContent;
        host.appendChild(script);
        injected.push(script);
      } else {
        host.appendChild(node.cloneNode(true));
      }
    });

    return () => {
      injected.forEach((s) => s.remove());
      if (host) host.innerHTML = "";
    };
  }, [code]);

  if (!code) return null;
  return <div ref={hostRef} data-storefront-embed="" />;
}
