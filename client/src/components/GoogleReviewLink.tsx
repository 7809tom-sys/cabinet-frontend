import { GOOGLE_REVIEW_URL } from "@/lib/googleReviewLink";

export function GoogleReviewLink({
  className,
  href = GOOGLE_REVIEW_URL,
}: {
  className?: string;
  href?: string;
}) {
  const url = href.trim();
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-testid="google-review-link"
    >
      Review us on Google
    </a>
  );
}
