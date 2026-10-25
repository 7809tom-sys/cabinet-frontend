import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { Phone, Mail, MapPin } from "lucide-react";

export function SiteFooter() {
  const { t } = useLanguage();
  return (
    <footer className="bg-[var(--color-navy)] text-white/70">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand + Contact */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-[var(--color-gold)] text-[var(--color-navy)] font-bold text-xs">
                CD
              </div>
              <span className="font-serif text-lg font-bold text-white">
                Cabinet<span className="text-[var(--color-gold)]">Dealz</span>
              </span>
            </div>
            <p className="text-sm leading-relaxed mb-4">
              {t("home_footer_blurb")}
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-[var(--color-gold)]" />
                <span>470 N Tamiami Trail<br />Osprey, FL 34229</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-[var(--color-gold)]" />
                <a href="tel:+19418993288" className="hover:text-white transition-colors">
                  (941) 899-3288
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-[var(--color-gold)]" />
                <a href="mailto:sales@cabinetdealz.com" className="hover:text-white transition-colors">
                  sales@cabinetdealz.com
                </a>
              </li>
            </ul>
          </div>

          {/* Tools */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{t("home_footer_col_tools")}</div>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Shop Cabinets", href: "/catalog" },
                { label: t("nav_shop_by_style"), href: "/styles" },
                { label: "Cabinet Education", href: "/styles#profile-guide" },
                { label: "Kitchen Planning Guide", href: "/kitchen-planning" },
                { label: t("nav_design_tool"), href: "/design" },
                { label: t("nav_build_an_order"), href: "/bulk-order" },
                { label: t("nav_photo_to_cart"), href: "/photo-to-cart" },
                { label: "Fixture Photo Match", href: "/fixture-photo" },
                { label: "Surfaces & Fixtures", href: "/surfaces" },
                { label: "Plumber's Choice", href: "/plumbers-choice" },
                { label: "StoneCreek", href: "/stonecreek" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Portals */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">{t("home_footer_col_portals")}</div>
            <ul className="space-y-2 text-sm">
              {[
                { label: t("nav_supplier_portal"), href: "/distributor" },
                { label: "Become a Vendor / Supplier", href: "/become-a-vendor" },
                { label: t("home_aud_affiliates_cta"), href: "/affiliate" },
                { label: t("nav_admin"), href: "/admin" },
                { label: "About Cabinet Dealz", href: "/about" },
                { label: "Contact Us", href: "/contact" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-white/40 mb-3">Legal</div>
            <ul className="space-y-2 text-sm">
              {[
                { label: "Shipping Policy", href: "/shipping-policy" },
                { label: "Return Policy", href: "/return-policy" },
                { label: "Privacy Policy", href: "/privacy-policy" },
                { label: "Terms & Conditions", href: "/terms" },
              ].map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="hover:text-white transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/40">
          <span>&copy; {new Date().getFullYear()} Cabinet Dealz. {t("footer_rights")}</span>
          <span>{t("home_footer_members_only")}</span>
        </div>
      </div>
    </footer>
  );
}
