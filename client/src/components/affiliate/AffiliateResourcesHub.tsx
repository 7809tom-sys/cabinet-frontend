// AffiliateResourcesHub.tsx
// Curated training and reference library for Cabinet Dealz affiliates.
// Sections: Platform Guides, Sales Training, Design Training, YouTube Channels, Quick-Start Checklist.

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, PlayCircle, FileText, Download, ExternalLink, CheckCircle2,
  Lightbulb, TrendingUp, Ruler, Star, Youtube, ChevronRight, Sparkles,
} from "lucide-react";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";

// ─── Data ─────────────────────────────────────────────────────────────────────

const PLATFORM_GUIDES = [
  {
    title: "Getting Started with Cabinet Dealz",
    description: "A complete walkthrough of the affiliate dashboard — from setting up your storefront to sharing your referral link.",
    icon: Sparkles,
    badge: "Start Here",
    badgeColor: "bg-[var(--color-gold)] text-[var(--color-navy)]",
    action: "Download PDF",
    href: "/manus-storage/01-getting-started_7112e75c.pdf",
  },
  {
    title: "How to Use the 3D Kitchen Designer",
    description: "Step-by-step guide to using the Cabinet Dealz 3D Designer: placing cabinets, selecting door styles, generating quotes, and sharing designs with customers.",
    icon: Ruler,
    badge: "Design Tool",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    action: "Download PDF",
    href: "/manus-storage/02-design-tool_86325f23.pdf",
  },
  {
    title: "Customizing Your Storefront",
    description: "How to add your logo, brand colors, hero headline, promo banners, contact info, and gallery photos to make your storefront uniquely yours.",
    icon: Star,
    badge: "Branding",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    action: "Download PDF",
    href: "/manus-storage/03-customize-storefront_5771b58a.pdf",
  },
  {
    title: "Setting Up Your Payout Account",
    description: "How to complete your W-9, submit your bank information, upload identity documents, and sign your 1099-NEC consent to unlock commission payouts.",
    icon: FileText,
    badge: "Payouts",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    action: "Download PDF",
    href: "/manus-storage/04-payout-setup_f2b719b0.pdf",
  },
  {
    title: "Using Your CRM Board",
    description: "How to manage leads, track deals through the sales pipeline, add notes, and close more orders using the built-in CRM.",
    icon: TrendingUp,
    badge: "CRM",
    badgeColor: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    action: "Download PDF",
    href: "/manus-storage/05-crm-guide_3c194803.pdf",
  },
];

const SALES_TRAINING = [
  {
    title: "The Cabinet Dealz Sales Playbook",
    description: "A comprehensive guide to selling kitchen cabinets: understanding customer needs, presenting options, handling price objections, and closing the sale.",
    icon: TrendingUp,
    badge: "Core Guide",
    badgeColor: "bg-[var(--color-gold)] text-[var(--color-navy)]",
    action: "Download PDF",
    href: "/manus-storage/06-sales-playbook_a817aa30.pdf",
  },
  {
    title: "Handling Common Objections",
    description: "Scripts and strategies for the most common objections: \"I need to think about it,\" \"It's too expensive,\" \"I'm getting other quotes,\" and more.",
    icon: Lightbulb,
    badge: "Objection Handling",
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    action: "Download PDF",
    href: "/manus-storage/07-objection-handling_b6e2a924.pdf",
  },
  {
    title: "Closing Techniques for Cabinet Sales",
    description: "Proven closing techniques adapted for the home improvement market: the assumptive close, the summary close, and the urgency close.",
    icon: CheckCircle2,
    badge: "Closing",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    action: "Download PDF",
    href: "/manus-storage/08-closing-techniques_fe0ee6cc.pdf",
  },
  {
    title: "Building Your Local Referral Network",
    description: "How to partner with contractors, interior designers, real estate agents, and home stagers to build a steady stream of cabinet referrals.",
    icon: Star,
    badge: "Networking",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    action: "Download PDF",
    href: "/manus-storage/09-referral-network_c2f4bf94.pdf",
  },
  {
    title: "Social Media for Cabinet Affiliates",
    description: "A practical guide to promoting your storefront on Facebook, Instagram, and Nextdoor — including post templates, hashtag strategy, and before/after photo tips.",
    icon: Sparkles,
    badge: "Social Media",
    badgeColor: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    action: "Download PDF",
    href: "/manus-storage/10-social-media_505fee8f.pdf",
  },
];

const DESIGN_TRAINING = [
  {
    title: "Kitchen Design Fundamentals",
    description: "The essential rules of kitchen layout: the work triangle, standard cabinet dimensions, clearances, and how to design a functional, beautiful kitchen.",
    icon: Ruler,
    badge: "Fundamentals",
    badgeColor: "bg-[var(--color-gold)] text-[var(--color-navy)]",
    action: "Download PDF",
    href: "/manus-storage/11-design-fundamentals_cf44ef06.pdf",
  },
  {
    title: "Cabinet Sizing & Specification Guide",
    description: "A complete reference for base, wall, and tall cabinet dimensions — including standard heights, depths, widths, and how to spec for appliances.",
    icon: BookOpen,
    badge: "Reference",
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    action: "Download PDF",
    href: "/manus-storage/12-cabinet-sizing_05b7722e.pdf",
  },
  {
    title: "Door Style Selection Guide",
    description: "How to match door styles to customer preferences and home architecture — from Shaker and raised panel to slab and craftsman.",
    icon: Star,
    badge: "Door Styles",
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    action: "Download PDF",
    href: "/manus-storage/13-door-styles-guide_02a8df95.pdf",
  },
  {
    title: "Color & Finish Trends",
    description: "Current kitchen color trends, popular finish combinations, and how to guide customers toward choices they will love for years.",
    icon: Lightbulb,
    badge: "Trends",
    badgeColor: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    action: "Download PDF",
    href: "/manus-storage/15-trends-and-vision_af6791c7.pdf",
  },
  {
    title: "Presenting Your Design to Customers",
    description: "How to use the Cabinet Dealz design tool to walk customers through their kitchen plan, explain pricing, and turn a design session into a sale.",
    icon: TrendingUp,
    badge: "Presentation",
    badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    action: "Download PDF",
    href: "/manus-storage/14-reading-a-kitchen_547b0735.pdf",
  },
];

const YOUTUBE_CHANNELS = [
  {
    name: "Kitchen & Bath Design TV",
    handle: "@KitchenBathDesignTV",
    description: "Professional kitchen design tutorials, product reviews, and installation walkthroughs. Great for understanding what customers see before they call you.",
    subscribers: "180K+",
    focus: "Design",
    url: "https://www.youtube.com/@KitchenBathDesignTV",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  {
    name: "Cabinet DIY",
    handle: "@CabinetDIY",
    description: "In-depth cabinet installation and assembly videos. Understanding the installation process helps you answer customer questions with confidence.",
    subscribers: "120K+",
    focus: "Installation",
    url: "https://www.youtube.com/@CabinetDIY",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
  {
    name: "Sales Insights Lab",
    handle: "@SalesInsightsLab",
    description: "Science-based B2C sales techniques, objection handling, and closing strategies. Highly applicable to home improvement sales.",
    subscribers: "500K+",
    focus: "Sales",
    url: "https://www.youtube.com/@salesinsightslab",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  {
    name: "Houzz",
    handle: "@Houzz",
    description: "The world's largest home design platform. Watch to stay current on kitchen trends, popular styles, and what homeowners are searching for.",
    subscribers: "1.2M+",
    focus: "Trends",
    url: "https://www.youtube.com/@Houzz",
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  {
    name: "This Old House",
    handle: "@ThisOldHouse",
    description: "America's most trusted home improvement channel. Kitchen remodel episodes give you credibility-building talking points with homeowners.",
    subscribers: "4M+",
    focus: "Remodeling",
    url: "https://www.youtube.com/@thisoldhouse",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  {
    name: "Grant Cardone",
    handle: "@GrantCardone",
    description: "High-energy sales motivation and closing techniques. Best for mindset and staying motivated during slow periods.",
    subscribers: "2.5M+",
    focus: "Sales Mindset",
    url: "https://www.youtube.com/@grantcardone",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
];

const QUICK_START = [
  { step: 1, label: "Complete your storefront profile", detail: "Add your store name, logo, tagline, contact info, and service area in Customize Store." },
  { step: 2, label: "Set your markup", detail: "Go to Pricing & Margins and set your default markup percentage. You can also set per-style markups." },
  { step: 3, label: "Customize your catalog", detail: "In My Catalog, hide styles you don't sell and upload your own room scene photos for your featured styles." },
  { step: 4, label: "Complete your payout setup", detail: "Submit your W-9, bank info, ID documents, and e-signature in Payout Setup to unlock commission payments." },
  { step: 5, label: "Share your storefront link", detail: "Copy your unique storefront URL from the Overview tab and share it on social media, your website, and with clients." },
  { step: 6, label: "Add your first lead to the CRM", detail: "Open My CRM and add any current prospects. Track them through the pipeline from first contact to closed sale." },
  { step: 7, label: "Run the design tool with a client", detail: "Use the 3D Kitchen Designer to create a kitchen plan with a client. Save the design and add it to your CRM deal." },
  { step: 8, label: "Set up a promo banner", detail: "In Customize Store → Promotions, activate a seasonal banner or holiday offer to drive urgency on your storefront." },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function ResourceCard({ title, description, icon: Icon, badge, badgeColor, action, href }: {
  title: string; description: string; icon: React.ElementType;
  badge: string; badgeColor: string; action: string; href: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-[var(--color-gold)]/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-semibold text-sm">{title}</span>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>{badge}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" asChild>
          <a href={href} target="_blank" rel="noopener noreferrer">
            <Download className="h-3.5 w-3.5" />
            {action}
          </a>
        </Button>
      </div>
    </div>
  );
}

function YoutubeCard({ name, handle, description, subscribers, focus, url, color }: typeof YOUTUBE_CHANNELS[0]) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:border-red-400/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
          <Youtube className="h-5 w-5 text-red-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="font-semibold text-sm">{name}</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{focus}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-1">{handle} · {subscribers} subscribers</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" asChild>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5" />
            Visit Channel
          </a>
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AffiliateResourcesHub() {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  function toggleStep(step: number) {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step); else next.add(step);
      return next;
    });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold">Resources Hub</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Everything you need to set up your storefront, master the design tool, close more sales, and grow your cabinet business.
        </p>
      </div>

      <Tabs defaultValue="quickstart">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="quickstart" className="text-xs">Quick-Start Checklist</TabsTrigger>
          <TabsTrigger value="platform" className="text-xs">Platform Guides</TabsTrigger>
          <TabsTrigger value="sales" className="text-xs">Sales Training</TabsTrigger>
          <TabsTrigger value="design" className="text-xs">Design Training</TabsTrigger>
          <TabsTrigger value="youtube" className="text-xs">YouTube Channels</TabsTrigger>
        </TabsList>

        {/* Quick-Start Checklist */}
        <TabsContent value="quickstart" className="mt-4 space-y-3">
          <div className="rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-3 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">New here?</span> Complete these 8 steps in order to go from sign-up to your first sale as quickly as possible.
          </div>
          <div className="space-y-2">
            {QUICK_START.map(({ step, label, detail }) => {
              const done = completedSteps.has(step);
              return (
                <button
                  key={step}
                  onClick={() => toggleStep(step)}
                  className={`w-full text-left rounded-xl border p-4 flex items-start gap-3 transition-colors ${done ? "border-green-500/30 bg-green-50 dark:bg-green-950/20" : "border-border bg-card hover:border-[var(--color-gold)]/40"}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? "bg-green-500" : "bg-muted"}`}>
                    {done ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-xs font-bold text-muted-foreground">{step}</span>}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>{label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center">
            {completedSteps.size}/{QUICK_START.length} steps completed · Click a step to mark it done
          </p>
        </TabsContent>

        {/* Platform Guides */}
        <TabsContent value="platform" className="mt-4">
          <div className="grid gap-3">
            {PLATFORM_GUIDES.map(g => <ResourceCard key={g.title} {...g} />)}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">
            PDFs are updated regularly. Check back for the latest versions.
          </p>
        </TabsContent>

        {/* Sales Training */}
        <TabsContent value="sales" className="mt-4">
          <div className="grid gap-3">
            {SALES_TRAINING.map(g => <ResourceCard key={g.title} {...g} />)}
          </div>
        </TabsContent>

        {/* Design Training */}
        <TabsContent value="design" className="mt-4">
          <div className="grid gap-3">
            {DESIGN_TRAINING.map(g => <ResourceCard key={g.title} {...g} />)}
          </div>
        </TabsContent>

        {/* YouTube Channels */}
        <TabsContent value="youtube" className="mt-4">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground mb-3">
            These are independently produced YouTube channels that we recommend for ongoing education. Cabinet Dealz is not affiliated with any of these creators.
          </div>
          <div className="grid gap-3">
            {YOUTUBE_CHANNELS.map(c => <YoutubeCard key={c.name} {...c} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
