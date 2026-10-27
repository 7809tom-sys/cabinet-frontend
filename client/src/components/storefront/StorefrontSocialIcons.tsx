import { Facebook, Instagram, Link2, Linkedin, Twitter, Youtube } from "lucide-react";
import type { PublicAffiliateSocialLink, AffiliateSocialPlatform } from "@shared/affiliateSocialLinks";
import { SOCIAL_PLATFORM_LABELS } from "@shared/affiliateSocialLinks";

function Glyph({ platform }: { platform: AffiliateSocialPlatform }) {
  const className = "h-5 w-5";
  if (platform === "facebook") return <Facebook className={className} aria-hidden="true" />;
  if (platform === "instagram") return <Instagram className={className} aria-hidden="true" />;
  if (platform === "youtube") return <Youtube className={className} aria-hidden="true" />;
  if (platform === "linkedin") return <Linkedin className={className} aria-hidden="true" />;
  if (platform === "x") return <Twitter className={className} aria-hidden="true" />;
  if (platform === "custom") return <Link2 className={className} aria-hidden="true" />;
  const letter = SOCIAL_PLATFORM_LABELS[platform].slice(0, 1);
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontFamily="Arial, sans-serif" fill="currentColor">{letter}</text>
    </svg>
  );
}

export function StorefrontSocialIcons({
  links,
  className = "",
  iconClassName = "",
}: {
  links: PublicAffiliateSocialLink[];
  className?: string;
  iconClassName?: string;
}) {
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`} data-testid="storefront-social-icons">
      {links.map((link) => (
        <a
          key={`${link.platform}-${link.url}`}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.label} (opens in a new tab)`}
          title={link.label}
          className={iconClassName}
        >
          <Glyph platform={link.platform} />
        </a>
      ))}
    </div>
  );
}
