/**
 * Validation for affiliate-supplied third-party widget embed snippets.
 *
 * Affiliates paste snippets from outside widget stores (chat, reviews, booking).
 * We deliberately allow <script> — that IS the install mechanism for every one
 * of those providers — but we reject the patterns that indicate a snippet is
 * doing something other than mounting a widget, and we cap the size so nobody
 * pastes a whole minified library into a database column.
 *
 * This is shared so the dashboard can show the same errors the server enforces;
 * the server check is the authoritative one.
 */

export const EMBED_CODE_MAX_LENGTH = 8000;

export type EmbedValidationIssue = {
  severity: "error" | "warning";
  message: string;
};

// Patterns that are never legitimate in a widget install snippet.
const FORBIDDEN: { pattern: RegExp; message: string }[] = [
  {
    pattern: /document\s*\.\s*cookie/i,
    message: "Reading or writing cookies is not allowed in an embed snippet.",
  },
  {
    pattern: /localStorage|sessionStorage/i,
    message: "Browser storage access is not allowed in an embed snippet.",
  },
  {
    pattern: /document\s*\.\s*write/i,
    message: "document.write breaks the page and is not allowed.",
  },
  {
    // A credential/payment field anywhere in the snippet. The keyword can be in
    // any attribute (name, id, placeholder, autocomplete), so match the tag and
    // the keyword independently rather than requiring them in one attribute.
    pattern: /<\s*input\b[^>]*\b(type\s*=\s*["']?password|password|credit[-_ ]?card|cardnumber|card[-_ ]?number|cvv|cvc)\b/i,
    message: "Snippets that collect passwords or card details are not allowed.",
  },
  {
    pattern: /window\s*\.\s*(top|parent)\s*\.\s*location/i,
    message: "Redirecting the parent page is not allowed.",
  },
  {
    pattern: /\bon(error|load)\s*=\s*["']?\s*eval/i,
    message: "Inline eval handlers are not allowed.",
  },
];

// Things that are usually a mistake rather than malicious.
const WARNINGS: { pattern: RegExp; message: string }[] = [
  {
    pattern: /^\s*https?:\/\/\S+\s*$/i,
    message:
      "This looks like a plain URL, not an embed snippet. Copy the full code the provider gave you.",
  },
  {
    pattern: /<\s*(html|head|body)\b/i,
    message:
      "Full HTML document tags were detected. Paste only the widget snippet, not an entire page.",
  },
];

export function validateEmbedCode(raw: string | null | undefined): EmbedValidationIssue[] {
  const code = (raw ?? "").trim();
  if (!code) return [];

  const issues: EmbedValidationIssue[] = [];

  if (code.length > EMBED_CODE_MAX_LENGTH) {
    issues.push({
      severity: "error",
      message: `Snippet is too long (${code.length} characters, limit ${EMBED_CODE_MAX_LENGTH}). Widget snippets are normally under 1,000 characters.`,
    });
  }

  for (const { pattern, message } of FORBIDDEN) {
    if (pattern.test(code)) issues.push({ severity: "error", message });
  }

  for (const { pattern, message } of WARNINGS) {
    if (pattern.test(code)) issues.push({ severity: "warning", message });
  }

  // A snippet with no tag at all won't mount anything.
  if (!/<\s*[a-z]/i.test(code)) {
    issues.push({
      severity: "warning",
      message: "No HTML tags found — this snippet probably won't load a widget.",
    });
  }

  return issues;
}

export function embedCodeHasErrors(raw: string | null | undefined): boolean {
  return validateEmbedCode(raw).some((i) => i.severity === "error");
}

/**
 * Extract the third-party hosts a snippet talks to, so the affiliate can see at
 * a glance who they are about to give access to their page.
 */
export function embedCodeHosts(raw: string | null | undefined): string[] {
  const code = raw ?? "";
  const hosts = new Set<string>();
  const re = /https?:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code)) !== null) hosts.add(m[1].toLowerCase());
  return Array.from(hosts).sort();
}
