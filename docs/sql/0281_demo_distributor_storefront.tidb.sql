-- 0281: OPTIONAL demo storefront row for the Distributor preview page (Nov 21 2026).
--
-- PREPARED, NOT APPLIED. Do not run without Tom's approval.
--
-- Why: /distributor-preview/designer opens the live 3D designer through the existing
-- branded path /store/:slug/design. Until this row exists it points at the existing
-- "sales-demo" storefront, so the designer chrome shows the Sales Demo branding.
-- Applying this row gives the designer the placeholder "Demo Distributor" logo and colors.
-- After applying, change DEMO_DISTRIBUTOR_DESIGNER_SLUG in
-- client/src/lib/demoDistributor.ts from "sales-demo" to "demo-distributor".
--
-- Notes:
--   * Placeholder identity only. example.com email; no user account is linked (userId NULL).
--   * logoUrl is the static file shipped in client/public/demo/demo-distributor-logo.svg.
--   * Idempotent: inserts nothing if the slug or referral code already exists.
--   * Verify on staging first that a membershipStatus of 'pending' does not hide the
--     storefront or designer for this row.

INSERT INTO affiliates (storeName, slug, contactName, email, referralCode, status, logoUrl, primaryColor, accentColor, tagline, storefrontEnabled)
SELECT 'Demo Distributor', 'demo-distributor', 'Demo Contact', 'demo-distributor@example.com', 'DEMODIST', 'active',
       '/demo/demo-distributor-logo.svg', '#0f4c5c', '#f4a259',
       'Cabinet lines you can design, price and order in one place.', TRUE
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM affiliates WHERE slug = 'demo-distributor' OR referralCode = 'DEMODIST');

-- Check (read-only):
-- SELECT id, storeName, slug, status, storefrontEnabled FROM affiliates WHERE slug = 'demo-distributor';
