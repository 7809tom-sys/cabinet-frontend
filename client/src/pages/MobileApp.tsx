import { Link } from "wouter";
import { Download, Smartphone, Ruler, BookOpen, Save, Bell, Lock, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/hooks/usePwaInstall";

const FEATURES = [
  {
    icon: <Smartphone className="h-7 w-7 text-[#d4a75a]" />,
    title: "3D Kitchen Designer",
    desc: "Plan your full kitchen layout on your phone. Place cabinets, appliances, windows, and doors — then send your design directly to our team.",
  },
  {
    icon: <Ruler className="h-7 w-7 text-[#d4a75a]" />,
    title: "AR Tape Measure",
    desc: "Use your phone camera to measure walls, windows, and spaces. Android gets live AR overlay; iPhone uses photo reference measurement.",
    href: "/measure",
  },
  {
    icon: <BookOpen className="h-7 w-7 text-[#d4a75a]" />,
    title: "Full Cabinet Catalog",
    desc: "Browse thousands of cabinet styles, countertops, fixtures, and more — all at trade pricing, right from your pocket.",
  },
  {
    icon: <Save className="h-7 w-7 text-[#d4a75a]" />,
    title: "Save & Share Designs",
    desc: "Save your kitchen designs, share them with clients, and submit orders directly from the app.",
  },
  {
    icon: <Bell className="h-7 w-7 text-[#d4a75a]" />,
    title: "Order Tracking",
    desc: "Get real-time notifications on your order status, shipping updates, and delivery confirmations.",
  },
  {
    icon: <Lock className="h-7 w-7 text-[#d4a75a]" />,
    title: "Trade Account Access",
    desc: "Log in to your trade account for exclusive contractor pricing, saved projects, and CRM integration.",
  },
];

const HOW_TO_STEPS = [
  {
    step: "1",
    title: "Open This Page on Your Phone",
    desc: "Visit cabinetdealz.com/app on your iPhone or Android browser.",
  },
  {
    step: "2",
    title: "Tap \"Install App\"",
    desc: "Tap the Install App button below. Your browser will ask to add it to your home screen.",
  },
  {
    step: "3",
    title: "Launch from Home Screen",
    desc: "Open the CabinetDealz icon on your home screen — it runs like a native app, no App Store needed.",
  },
];

export default function MobileApp() {
  const { canInstall, isInstalled, install } = usePwaInstall();

  return (
    <div className="min-h-screen bg-[#0f1929] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1a2744] to-[#0f1929] pt-20 pb-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#d4a75a]/10 border border-[#d4a75a]/30 rounded-full px-4 py-2 text-[#d4a75a] text-sm font-semibold mb-6">
                <Smartphone className="h-4 w-4" />
                Install Directly — No App Store Needed
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-4">
                Design Kitchens{" "}
                <span className="text-[#d4a75a]">From Your Phone</span>
              </h1>
              <p className="text-[#8a9bb8] text-lg leading-relaxed mb-8">
                The CabinetDealz app puts the full power of our trade platform
                in your pocket — 3D kitchen designer, AR tape measure, full
                catalog, and trade pricing all in one place. Install it directly
                from this page in seconds.
              </p>

              {/* Install Button */}
              <div className="flex flex-wrap gap-4 mb-6">
                {isInstalled ? (
                  <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/40 rounded-xl px-6 py-3 text-green-400 font-semibold">
                    <CheckCircle className="h-5 w-5" />
                    App Installed — Open from Your Home Screen
                  </div>
                ) : canInstall ? (
                  <Button
                    size="lg"
                    onClick={install}
                    className="bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold gap-2 text-base px-8"
                  >
                    <Download className="h-5 w-5" />
                    Install App — Free
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <Button
                      size="lg"
                      className="bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold gap-2 text-base px-8"
                      onClick={() => {
                        // Fallback: guide user to use browser's built-in install
                        alert(
                          "To install:\n• Chrome/Android: tap the menu (⋮) → \"Add to Home Screen\"\n• Safari/iPhone: tap Share (□↑) → \"Add to Home Screen\"\n• Edge/Desktop: click the install icon in the address bar"
                        );
                      }}
                    >
                      <Download className="h-5 w-5" />
                      Install App — Free
                    </Button>
                    <p className="text-xs text-[#6a7a9a]">
                      Works on iPhone, iPad, Android, and desktop browsers.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: App icon + install card */}
            <div className="flex flex-col items-center gap-6">
              {/* App icon */}
              <div className="w-28 h-28 rounded-3xl bg-[#1a2744] border-2 border-[#d4a75a]/30 flex items-center justify-center shadow-2xl">
                <div className="w-20 h-20 rounded-2xl bg-[#d4a75a] flex items-center justify-center">
                  <span className="text-3xl font-extrabold text-[#1a2744]">CD</span>
                </div>
              </div>

              {/* Install card */}
              <div className="bg-[#1e2e4a] border border-[#2a3a5c] rounded-2xl p-6 text-center max-w-xs w-full">
                <p className="text-sm font-semibold text-[#d4a75a] mb-4">
                  Cabinet Dealz App
                </p>
                <div className="space-y-2 text-left mb-5">
                  {["Free to install", "Works offline", "No App Store required", "iOS, Android & Desktop"].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-[#8a9bb8]">
                      <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
                      {item}
                    </div>
                  ))}
                </div>
                {!isInstalled && canInstall && (
                  <Button
                    onClick={install}
                    className="w-full bg-[#d4a75a] text-[#1a2744] hover:bg-[#e0b86a] font-bold gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Install Now
                  </Button>
                )}
                {isInstalled && (
                  <div className="text-green-400 text-sm font-semibold flex items-center justify-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Installed
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-[#0f1929]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2">
            Everything You Need, On the Go
          </h2>
          <p className="text-[#8a9bb8] text-center mb-12">
            All the tools of the CabinetDealz trade platform — now in your pocket.
          </p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const card = (
                <div
                  key={f.title}
                  className={[
                    "bg-[#1e2e4a] border border-[#2a3a5c] rounded-2xl p-6 transition-colors",
                    (f as { href?: string }).href
                      ? "hover:border-[#d4a75a] cursor-pointer"
                      : "hover:border-[#d4a75a]/40",
                  ].join(" ")}
                >
                  <div className="mb-3">{f.icon}</div>
                  <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
                    {f.title}
                    {(f as { href?: string }).href && <ExternalLink className="h-3.5 w-3.5 text-[#d4a75a]" />}
                  </h3>
                  <p className="text-sm text-[#8a9bb8] leading-relaxed">{f.desc}</p>
                </div>
              );
              return (f as { href?: string }).href ? (
                <Link key={f.title} href={(f as { href?: string }).href!}>{card}</Link>
              ) : card;
            })}
          </div>
        </div>
      </section>

      {/* How to install */}
      <section className="py-16 px-4 bg-[#1a2744]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-8">How to Install</h2>
          <div className="grid sm:grid-cols-3 gap-6 text-left mb-10">
            {HOW_TO_STEPS.map((s) => (
              <div key={s.step} className="bg-[#0f1929] rounded-2xl p-6 border border-[#2a3a5c]">
                <div className="w-10 h-10 rounded-full bg-[#d4a75a] text-[#1a2744] font-extrabold text-lg flex items-center justify-center mb-4">
                  {s.step}
                </div>
                <h3 className="font-bold text-white mb-2">{s.title}</h3>
                <p className="text-sm text-[#8a9bb8] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[#6a7a9a] text-sm">
            The app works on any modern browser — Chrome, Safari, Edge, and Firefox.
            No download from a third-party store is required.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-[#0f1929] text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to Design Your Kitchen?</h2>
          <p className="text-[#8a9bb8] mb-8">
            Join contractors and homeowners using CabinetDealz to plan and order their dream kitchens.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/design">
              <button className="bg-[#d4a75a] text-[#1a2744] font-bold px-8 py-3 rounded-xl hover:bg-[#e0b86a] transition-colors">
                Try the Web Designer →
              </button>
            </Link>
            <Link href="/catalog">
              <button className="bg-[#1e2e4a] border border-[#2a3a5c] text-white font-semibold px-8 py-3 rounded-xl hover:border-[#d4a75a]/50 transition-colors">
                Browse Catalog
              </button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
