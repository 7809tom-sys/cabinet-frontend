import type { ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useAffiliateFeaturePublish } from "@/lib/useAffiliateFeaturePublish";
import { AFFILIATE_FEATURES, type AffiliateFeatureKey } from "@shared/affiliateFeaturePublish";

/**
 * Affiliate entry check. When the server publish list is loaded, the feature
 * stays closed unless some distributor or vendor has it switched on.
 * When that procedure is not deployed yet, the existing screen stays up and
 * the admin Publish tab explains that the server is not enforcing it yet.
 */
export function AffiliatePublishedFeature({
  feature,
  children,
}: {
  feature: AffiliateFeatureKey;
  children: ReactNode;
}) {
  const publish = useAffiliateFeaturePublish();
  const label = AFFILIATE_FEATURES.find((item) => item.key === feature)?.label ?? feature;
  if (publish.status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (publish.status === "error") {
    return (
      <p className="mx-auto max-w-lg px-6 py-16 text-sm text-destructive" role="alert" data-testid="affiliate-feature-error">
        Could not check whether {label} is published for affiliates: {publish.errorMessage ?? "the publish list failed"}.
      </p>
    );
  }
  if (publish.status === "ready" && !publish.anyPublished(feature)) {
    return (
      <p className="mx-auto max-w-lg px-6 py-16 text-sm text-muted-foreground" data-testid="affiliate-feature-blocked">
        {label} is not published for affiliates.
      </p>
    );
  }
  return children;
}
