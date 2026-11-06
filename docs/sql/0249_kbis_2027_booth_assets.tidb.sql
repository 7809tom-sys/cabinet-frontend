-- TiDB SQL editor version. Numbered 0249. Run after 0248.
-- One statement per line, so each line can be pasted on its own in the TiDB SQL
-- editor. Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Do not run this from an application. The owner pastes it in the TiDB editor.
-- Safe to re-run: every insert is guarded by NOT EXISTS on a natural key, so a
-- second run inserts nothing and no row is updated or deleted.
--
-- Why: the KBIS 2027 (Kitchen & Bath Industry Show, Las Vegas) booth artwork and
-- the taglines printed on it belong in the two libraries the business already
-- has, so affiliates and admins can find and reuse them.
--
--   1. cabinet_dealz.media_images        admin Media Library, folder "KBIS 2027 Booth".
--   2. cabinet_dealz.affiliate_resources affiliate Marketing Hub, category "kbis-2027-booth".
--
-- The image FILES and the deck are not in the database. They ship with the
-- frontend in client/public/marketing/kbis-2027/ and are served by Vercel at
-- /marketing/kbis-2027/<file>, which is the url each row below stores. Nothing
-- here uploads a file, copies bytes, or calls storage.
--
-- Every image is a CONCEPT RENDERING of a planned booth, not a photograph of a
-- built one. metaJson carries conceptRendering: true on the four image rows so
-- the label survives an edit in the admin panel.
--
-- metaJson also carries supplierReady: true on every row in this category. The
-- owner cleared these assets to be shared with a potential supplier as they are:
-- the images are labelled renderings and the deck is published unchanged.
-- supplierReady is what the Marketing Hub's "Supplier-ready" filter reads.
--
-- The Marketing Hub rows use type 'link' on purpose: a 'link' row outside the
-- tip, faq, and what's-new categories is rendered only by the "KBIS 2027 Booth"
-- section, so these entries do not also appear under Sales Scripts, Printed
-- Materials, or Social Media.
--
-- Rollback: deleting these rows removes the library entries only. The image files
-- ship with the frontend and are not touched by any statement here.

-- 1. Read-only: what the folder already contains. Expect no rows on a first run.
SELECT existing_media.id AS mediaId, existing_media.folder, existing_media.label, existing_media.url FROM cabinet_dealz.media_images AS existing_media WHERE existing_media.folder = 'KBIS 2027 Booth' ORDER BY existing_media.id;

-- 2. Read-only: what the Marketing Hub category already contains. Expect no rows on a first run.
SELECT existing_resource.id AS resourceId, existing_resource.type, existing_resource.title, existing_resource.category, existing_resource.isPublished FROM cabinet_dealz.affiliate_resources AS existing_resource WHERE existing_resource.category = 'kbis-2027-booth' ORDER BY existing_resource.sortOrder, existing_resource.id;

-- 3. Media Library, featured: the booth with closets added. The header lists Cabinets · Quartz · Tile · Flooring · Hardware · Closets.
INSERT INTO cabinet_dealz.media_images (folder, label, url, fileKey, mimeType, sizeBytes) SELECT 'KBIS 2027 Booth', 'KBIS 2027 Booth — Closets Added', '/marketing/kbis-2027/cabinetdealz-kbis-booth-closets.jpg', 'marketing/kbis-2027/cabinetdealz-kbis-booth-closets.jpg', 'image/jpeg', 255261 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.media_images AS present_media WHERE present_media.url = '/marketing/kbis-2027/cabinetdealz-kbis-booth-closets.jpg');

-- 4. Media Library: final layout, with the affiliate poster and the sign-up counter card.
INSERT INTO cabinet_dealz.media_images (folder, label, url, fileKey, mimeType, sizeBytes) SELECT 'KBIS 2027 Booth', 'KBIS 2027 Booth — Final Layout', '/marketing/kbis-2027/cabinetdealz-kbis-booth-final.jpg', 'marketing/kbis-2027/cabinetdealz-kbis-booth-final.jpg', 'image/jpeg', 332797 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.media_images AS present_media WHERE present_media.url = '/marketing/kbis-2027/cabinetdealz-kbis-booth-final.jpg');

-- 5. Media Library: backdrop poster, quick-design TV, brochures, and counter cards.
INSERT INTO cabinet_dealz.media_images (folder, label, url, fileKey, mimeType, sizeBytes) SELECT 'KBIS 2027 Booth', 'KBIS 2027 Booth — Backdrop, TV, and Counter', '/marketing/kbis-2027/cabinetdealz-kbis-booth-pop.png', 'marketing/kbis-2027/cabinetdealz-kbis-booth-pop.png', 'image/png', 974508 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.media_images AS present_media WHERE present_media.url = '/marketing/kbis-2027/cabinetdealz-kbis-booth-pop.png');

-- 6. Media Library: the concept rendering with the live price screen and the tablet demo.
INSERT INTO cabinet_dealz.media_images (folder, label, url, fileKey, mimeType, sizeBytes) SELECT 'KBIS 2027 Booth', 'KBIS 2027 Booth — Concept with Live Price Screen', '/marketing/kbis-2027/cabinetdealz-kbis-booth-concept.jpg', 'marketing/kbis-2027/cabinetdealz-kbis-booth-concept.jpg', 'image/jpeg', 299225 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.media_images AS present_media WHERE present_media.url = '/marketing/kbis-2027/cabinetdealz-kbis-booth-concept.jpg');

-- 7. Media Library: the opportunity deck, a PDF rather than an image, filed here so admins can find and link it.
INSERT INTO cabinet_dealz.media_images (folder, label, url, fileKey, mimeType, sizeBytes) SELECT 'KBIS 2027 Booth', 'KBIS 2027 Opportunity Deck', '/marketing/kbis-2027/cabinetdealz-kbis-2027-opportunity-deck.pdf', 'marketing/kbis-2027/cabinetdealz-kbis-2027-opportunity-deck.pdf', 'application/pdf', 449980 FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.media_images AS present_media WHERE present_media.url = '/marketing/kbis-2027/cabinetdealz-kbis-2027-opportunity-deck.pdf');

-- 8. Marketing Hub, featured: the closets booth, published and supplier-ready.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'KBIS 2027 Booth — Closets Added', 'Featured KBIS 2027 layout. The header lists Cabinets · Quartz · Tile · Flooring · Hardware · Closets, with a kitchen on one side, a lit closet display on the other, and "Closets: Design. Quote. Order." on the closet front. Concept rendering, not a photo of a built booth.', '/marketing/kbis-2027/cabinetdealz-kbis-booth-closets.jpg', 'kbis-2027-booth', '{"conceptRendering": true, "supplierReady": true}', 700, TRUE, TRUE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'KBIS 2027 Booth — Closets Added');

-- 9. Marketing Hub: final layout with the affiliate poster and the sign-up card.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'KBIS 2027 Booth — Final Layout', 'Affiliate poster on the right and the "Sign up today. Leave the show with your website LIVE." counter sign, next to the quick-design TV and the purchasing-group sign. Concept rendering, not a photo of a built booth.', '/marketing/kbis-2027/cabinetdealz-kbis-booth-final.jpg', 'kbis-2027-booth', '{"conceptRendering": true, "supplierReady": true}', 701, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'KBIS 2027 Booth — Final Layout');

-- 10. Marketing Hub: backdrop poster, quick-design TV, brochures, counter cards.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'KBIS 2027 Booth — Backdrop, TV, and Counter', 'The backdrop poster, the "Kitchen designed in 5 minutes" screen with its live price quote, the brochure stacks, and the counter cards. Concept rendering, not a photo of a built booth.', '/marketing/kbis-2027/cabinetdealz-kbis-booth-pop.png', 'kbis-2027-booth', '{"conceptRendering": true, "supplierReady": true}', 702, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'KBIS 2027 Booth — Backdrop, TV, and Counter');

-- 11. Marketing Hub: concept rendering with the live price screen and tablet demo.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'KBIS 2027 Booth — Concept with Live Price Screen', 'Slate shaker cabinets, quartz top, and the "LIVE PRICE QUOTE" screen, with a rep walking an attendee through the design on a tablet. Concept rendering, not a photo of a built booth.', '/marketing/kbis-2027/cabinetdealz-kbis-booth-concept.jpg', 'kbis-2027-booth', '{"conceptRendering": true, "supplierReady": true}', 703, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'KBIS 2027 Booth — Concept with Live Price Screen');

-- 12. Marketing Hub: the opportunity deck itself, unchanged and supplier-ready.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'KBIS 2027 Opportunity Deck', 'The 9-slide show-at-a-glance deck: dates and venue, who walks the floor, the conservative attendee-to-store funnel, the platform-profit model, and the white-label pitch. Share it with a potential supplier as-is — the file is published unchanged.', '/marketing/kbis-2027/cabinetdealz-kbis-2027-opportunity-deck.pdf', 'kbis-2027-booth', '{"supplierReady": true, "pageCount": 9}', 720, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'KBIS 2027 Opportunity Deck');

-- 13. Marketing Hub copy asset: the affiliate poster line.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'Affiliate poster line', 'Be an affiliate. Be the face of Cabinetdealz.', NULL, 'kbis-2027-booth', '{"supplierReady": true}', 710, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'Affiliate poster line');

-- 14. Marketing Hub copy asset: the purchasing power line.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'Purchasing power line', 'Cabinetdealz purchasing power and technology for your local influence.', NULL, 'kbis-2027-booth', '{"supplierReady": true}', 711, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'Purchasing power line');

-- 15. Marketing Hub copy asset: the closets line.
INSERT INTO cabinet_dealz.affiliate_resources (type, title, body, url, category, metaJson, sortOrder, isPublished, featured) SELECT 'link', 'Closets line', 'Cabinetdealz covers closets the same way as kitchens: design, quote, order, all in one, with the same white-label affiliate model.', NULL, 'kbis-2027-booth', '{"supplierReady": true}', 712, TRUE, FALSE FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_resources AS present_resource WHERE present_resource.category = 'kbis-2027-booth' AND present_resource.title = 'Closets line');

-- 16. Read-only check: all five files are in the Media Library folder.
SELECT added_media.folder, added_media.label, added_media.url, added_media.mimeType, added_media.sizeBytes FROM cabinet_dealz.media_images AS added_media WHERE added_media.folder = 'KBIS 2027 Booth' ORDER BY added_media.id;

-- 17. Read-only check: all eight Marketing Hub rows are in the category.
SELECT added_resource.title, added_resource.type, added_resource.category, added_resource.isPublished, added_resource.featured, added_resource.sortOrder FROM cabinet_dealz.affiliate_resources AS added_resource WHERE added_resource.category = 'kbis-2027-booth' ORDER BY added_resource.sortOrder, added_resource.id;

-- 18. Read-only: the featured row, so a re-run is visibly a no-op.
SELECT checked_resource.title, checked_resource.featured, checked_resource.isPublished FROM cabinet_dealz.affiliate_resources AS checked_resource WHERE checked_resource.category = 'kbis-2027-booth' AND checked_resource.featured = TRUE;
