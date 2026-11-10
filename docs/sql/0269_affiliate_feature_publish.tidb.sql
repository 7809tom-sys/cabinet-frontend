-- TiDB SQL editor version. Numbered 0269. Run after 0268.
-- One statement per line. Every table is cabinet_dealz.<table>.
-- No IF NOT EXISTS. A second run answers that the table already exists; that means this statement already did its job. Skip it.
-- Do not run this from an application. Paste it in the TiDB editor.
-- This file creates an empty table. It inserts nothing, updates nothing, and deletes nothing.
-- A missing row means not published. Affiliates receive a feature only when a row says published = 1.
--
-- Backend (cabinet-backend) still has to:
-- 1. Admin-only distributorAdmin.listAffiliateFeaturePublish returns every row (subjectKind, subjectId, featureKey, published, updatedByName, updatedAt).
-- 2. Admin-only distributorAdmin.setAffiliateFeaturePublish upserts one row and sets updatedByUserId, updatedByName, and updatedAt from the signed-in admin.
-- 3. Reject affiliate catalog, designer, closet, surfaces, hardware, samples, packages, promotions, image cabinet, installation, and quote reads unless the matching row is published = 1. Hiding a link in the browser is not enough.
-- 4. Feature keys: kitchen_designer, bathroom_builder, laundry_builder, closet_builder, closet_studio, other_room_designer, cabinet_catalog, pelican_catalog, hardware_catalog, closet_catalog, kitchen_packages, samples, promotions, image_cabinet, installation_estimates, quote.
-- 5. subjectKind is distributor or vendor. subjectId is that table's id. Cabinet catalog checks the distributor id. A vendor with no distributor line uses subjectKind vendor.

CREATE TABLE cabinet_dealz.affiliate_feature_publish (id BIGINT NOT NULL AUTO_INCREMENT, subjectKind VARCHAR(16) NOT NULL, subjectId BIGINT NOT NULL, featureKey VARCHAR(64) NOT NULL, published TINYINT NOT NULL, updatedByUserId BIGINT NULL, updatedByName VARCHAR(255) NULL, updatedAt DATETIME NULL, PRIMARY KEY (id), UNIQUE KEY affiliate_feature_publish_pair (subjectKind, subjectId, featureKey));
