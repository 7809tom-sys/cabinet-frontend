import { ExternalLink, Puzzle, MessageCircle, Star, CalendarClock, Mail, BarChart3, ShieldCheck, Info } from "lucide-react";
import { AffiliateEmbedEditor } from "./AffiliateEmbedEditor";

type PluginsPanelProps = {
  affiliateId?: number;
  isAdmin?: boolean;
  embedCodeDraft?: string | null;
  embedEnabled?: boolean;
  storeName?: string | null;
  onSaved?: () => void;
};

/**
 * Plugins & Add-ons
 *
 * Per product decision we do NOT build or curate our own marketplace. Affiliates
 * are pointed at established third-party widget stores and install what they
 * want themselves. Every store listed here distributes embeddable widgets that
 * work on a React/Vite site via a plain <script> or iframe snippet — that is the
 * compatibility bar for this stack. Package-manager-only plugin ecosystems
 * (WordPress plugins, Shopify apps, Wix apps) are deliberately excluded because
 * they cannot run on this site.
 */

type Store = {
  name: string;
  url: string;
  blurb: string;
  categories: string[];
};

const STORES: Store[] = [
  {
    name: "Elfsight",
    url: "https://elfsight.com/widgets/",
    blurb:
      "Large catalog of embeddable widgets — chat, reviews, galleries, forms, social feeds. Installs as a single script tag.",
    categories: ["Chat", "Reviews", "Galleries", "Forms", "Social"],
  },
  {
    name: "POWR",
    url: "https://www.powr.io/plugins",
    blurb:
      "Form builders, popups, countdown timers, and booking widgets. Free tier available, embeds anywhere.",
    categories: ["Forms", "Popups", "Booking", "Countdown"],
  },
  {
    name: "Common Ninja",
    url: "https://www.commoninja.com/widgets",
    blurb:
      "Comparison tables, FAQs, charts, and testimonial widgets with a code-snippet install.",
    categories: ["Tables", "FAQ", "Charts", "Testimonials"],
  },
  {
    name: "Tidio",
    url: "https://www.tidio.com/",
    blurb:
      "Live chat and chatbot with a mobile app for answering customers on the go. Script-tag install.",
    categories: ["Chat", "Chatbot"],
  },
  {
    name: "Tawk.to",
    url: "https://www.tawk.to/",
    blurb: "Free live chat with unlimited agents and history. Very light script-tag embed.",
    categories: ["Chat"],
  },
  {
    name: "Calendly",
    url: "https://calendly.com/",
    blurb:
      "Consultation and measure-appointment scheduling. Embeds as an inline widget or popup button.",
    categories: ["Booking", "Scheduling"],
  },
  {
    name: "Google Analytics",
    url: "https://marketingplatform.google.com/about/analytics/",
    blurb: "Traffic and conversion analytics for your storefront. Standard script-tag install.",
    categories: ["Analytics"],
  },
  {
    name: "Mailchimp",
    url: "https://mailchimp.com/features/signup-forms/",
    blurb: "Email capture forms and newsletter automation with embeddable signup forms.",
    categories: ["Email", "Forms"],
  },
];

const CATEGORY_ICONS: { icon: React.ElementType; label: string; hint: string }[] = [
  { icon: MessageCircle, label: "Live chat", hint: "Talk to visitors in real time" },
  { icon: Star, label: "Reviews", hint: "Collect and display your own customer reviews" },
  { icon: CalendarClock, label: "Booking", hint: "Let customers schedule consultations" },
  { icon: Mail, label: "Email capture", hint: "Grow a newsletter list" },
  { icon: BarChart3, label: "Analytics", hint: "See where your traffic comes from" },
];

export function AffiliatePluginsPanel({
  affiliateId,
  isAdmin,
  embedCodeDraft,
  embedEnabled,
  storeName,
  onSaved,
}: PluginsPanelProps = {}) {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-primary" /> Plugins &amp; Add-ons
        </h2>
        <p className="text-muted-foreground text-sm">
          Your storefront ships without any built-in chat or third-party widgets, so nothing
          competes with your branding. Add whatever you want from an outside plugin store — the
          stores below all provide embeddable widgets that work on your site.
        </p>
      </div>

      {/* What people usually add */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-3">Popular additions</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_ICONS.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5">
              <c.icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Compatibility note */}
      <div className="rounded-xl border border-border bg-muted/40 p-4 flex gap-3">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Compatibility:</span> your storefront is a
          modern JavaScript site, so it works with any widget that installs as a{" "}
          <span className="font-mono text-xs">&lt;script&gt;</span> tag or iframe embed. WordPress
          plugins, Shopify apps, and Wix apps are not compatible and are intentionally left off this
          list.
        </div>
      </div>

      {/* Store links */}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Plugin stores</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {STORES.map((s) => (
            <a
              key={s.name}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="group rounded-xl border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-semibold text-sm">{s.name}</span>
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary shrink-0" />
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">{s.blurb}</p>
              <div className="flex flex-wrap gap-1">
                {s.categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* Paste + preview + publish */}
      <AffiliateEmbedEditor
        affiliateId={affiliateId}
        isAdmin={isAdmin}
        embedCodeDraft={embedCodeDraft}
        embedEnabled={embedEnabled}
        storeName={storeName}
        onSaved={onSaved}
      />

      {/* How to install */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Info className="h-4 w-4 text-primary" /> How to install a widget
        </h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Open one of the stores above and pick the widget you want.</li>
          <li>Create your account there and configure the widget with your own branding.</li>
          <li>Copy the embed snippet they give you (usually a single script tag).</li>
          <li>
            Paste it into the <span className="font-medium">Custom widget code</span> box above, hit
            Test in preview, then Publish to storefront when it looks right.
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Costs and support for third-party widgets are handled by that provider, not by us. Use
          providers you trust — an embedded widget can see the page it runs on.
        </p>
      </div>
    </div>
  );
}
