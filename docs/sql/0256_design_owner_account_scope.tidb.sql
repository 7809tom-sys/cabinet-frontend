-- TiDB SQL editor version. Numbered 0256. Run after 0255.
-- Paste each numbered block on its own. One statement per block, and each
-- statement is on ONE line so a line-based editor cannot split it.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- This file adds nothing to the schema, so it needs no conditional DDL.
--
-- NUMBERING NOTE: 0249 is taken by PR 273. This file is 0256 so the two never
-- collide, and it is safe to run before or after 273 because it only reads rows
-- and (in section 5) updates rows. Nothing here creates or alters a table.
--
-- READ THIS FIRST
--
-- Sections 1-4 are READ-ONLY previews. They change nothing. Run them and read
-- the result before deciding anything.
--
-- Section 5 is a CORRECTION (UPDATE). It is written out so Tom can review the
-- exact rows and the exact new values, but it is NOT part of this fix and must
-- not be run until he has read section 4 and approved it. Nothing in this file
-- was executed by the agent, and the schema this fix needs is already present:
-- no ALTER TABLE is required for designs to load by account.
--
-- WHY THIS FILE EXISTS
--
-- A saved design has one OWNER (kitchen_designs.userId, the account that saved
-- it) and one ORIGIN STORE (kitchen_designs.affiliateId, the storefront it came
-- through). The save path used to take the store from the URL, so a design saved
-- by a signed-in person while a storefront page was open was filed under that
-- store: it showed that store's brand, appeared in that store's CRM, and was
-- missing from the person's own "My Designs" list on every other device.
--
-- THE FIX (code, not SQL) makes every read, write, rename, delete and open use
-- the design's own stored affiliateId, and makes a NEW save use the signed-in
-- account's scope. Designs already saved under the wrong store keep their wrong
-- affiliateId: the code cannot know, on its own, which of them were mis-filed.
-- Sections 1-4 show you which ones look suspicious, and section 5 is the one-time
-- correction if you decide to re-file them.
--
-- "First Class" below is the affiliate slug `firstclass`
-- (First Class Flooring & Cabinet Design).
--
-- NOTE ON RECOVERY. A design is never lost by this fix: ownership is
-- kitchen_designs.userId and it is unchanged. A design that was saved under the
-- wrong store can always be found by user id (section 2) and re-filed by
-- section 5. The one case that cannot be recovered from these tables is a plan
-- that was never saved at all because the person was not signed in when they
-- hit Save: that work lives only in that browser's local draft, which the
-- frontend now attaches to the account on sign-in.

-- 1. READ-ONLY. Every saved design named like "Maple Life", with its current
--    owner account and originating store. This answers "where did the Maple
--    Life save actually go?" Safe to run twice.
SELECT saved_design.id AS designId, saved_design.name AS designName, saved_design.userId AS ownerUserId, owner_user.email AS ownerEmail, owner_user.name AS ownerName, owner_user.role AS ownerRole, saved_design.affiliateId AS affiliateId, origin_store.slug AS affiliateSlug, origin_store.storeName AS affiliateStoreName, saved_design.createdAt, saved_design.updatedAt FROM cabinet_dealz.kitchen_designs AS saved_design LEFT JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId LEFT JOIN cabinet_dealz.affiliates AS origin_store ON origin_store.id = saved_design.affiliateId WHERE saved_design.name LIKE '%Maple Life%' ORDER BY saved_design.updatedAt DESC LIMIT 50;

-- 2. READ-ONLY. The same view for every design owned by one account, which is
--    how you confirm Rich's own designs and where each one currently lives.
--    Replace the email and run again. Safe to run twice.
SELECT saved_design.id AS designId, saved_design.name AS designName, saved_design.userId AS ownerUserId, owner_user.email AS ownerEmail, saved_design.affiliateId AS affiliateId, origin_store.slug AS affiliateSlug, origin_store.storeName AS affiliateStoreName, saved_design.projectName, saved_design.roomLabel, saved_design.recordKind, saved_design.createdAt, saved_design.updatedAt FROM cabinet_dealz.kitchen_designs AS saved_design LEFT JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId LEFT JOIN cabinet_dealz.affiliates AS origin_store ON origin_store.id = saved_design.affiliateId WHERE LOWER(owner_user.email) = LOWER('rich@example.com') ORDER BY saved_design.updatedAt DESC LIMIT 200;

-- 3. READ-ONLY. Designs saved on a storefront by an account that is NOT part of
--    that store and never signed up through it. These are the rows that look
--    mis-filed: a platform account (admin/designer/sales_rep) whose design
--    carries that storefront's affiliateId, and whose own users row was not
--    created on that store.
--
--    This is a PREVIEW ONLY. A row here is a CANDIDATE, not a proven error: a
--    store's own designer legitimately saves store designs, and a customer who
--    signed up on that storefront legitimately owns store designs. Read the
--    ownerRole and signupAffiliateId columns before treating anything as wrong.
SELECT saved_design.id AS designId, saved_design.name AS designName, saved_design.userId AS ownerUserId, owner_user.email AS ownerEmail, owner_user.role AS ownerRole, owner_user.signupAffiliateId AS ownerSignupAffiliateId, saved_design.affiliateId AS affiliateId, origin_store.slug AS affiliateSlug, origin_store.storeName AS affiliateStoreName, saved_design.createdAt, saved_design.updatedAt FROM cabinet_dealz.kitchen_designs AS saved_design INNER JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId INNER JOIN cabinet_dealz.affiliates AS origin_store ON origin_store.id = saved_design.affiliateId WHERE saved_design.affiliateId IS NOT NULL AND owner_user.role IN ('admin', 'designer', 'sales_rep', 'distributor') AND (owner_user.signupAffiliateId IS NULL OR owner_user.signupAffiliateId <> saved_design.affiliateId) AND NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_team_members AS team_member WHERE team_member.affiliateId = saved_design.affiliateId AND team_member.isActive = 1 AND (team_member.userId = saved_design.userId OR LOWER(team_member.email) = LOWER(owner_user.email))) ORDER BY saved_design.updatedAt DESC LIMIT 200;

-- 4. READ-ONLY. Which designs would a correction actually touch, and exactly
--    what would change. Run this immediately before deciding on section 5: it is
--    the same predicate, reduced to "current store -> proposed store".
--    Designs belonging to a store's own team, and designs of storefront
--    customers, are deliberately excluded.
SELECT saved_design.id AS designId, saved_design.name AS designName, owner_user.email AS ownerEmail, owner_user.role AS ownerRole, saved_design.affiliateId AS currentAffiliateId, origin_store.slug AS currentAffiliateSlug, CAST(NULL AS SIGNED) AS proposedAffiliateId, COUNT(*) OVER () AS totalRowsThatWouldChange FROM cabinet_dealz.kitchen_designs AS saved_design INNER JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId INNER JOIN cabinet_dealz.affiliates AS origin_store ON origin_store.id = saved_design.affiliateId WHERE saved_design.affiliateId IS NOT NULL AND owner_user.role IN ('admin', 'designer', 'sales_rep', 'distributor') AND (owner_user.signupAffiliateId IS NULL OR owner_user.signupAffiliateId <> saved_design.affiliateId) AND NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_team_members AS team_member WHERE team_member.affiliateId = saved_design.affiliateId AND team_member.isActive = 1 AND (team_member.userId = saved_design.userId OR LOWER(team_member.email) = LOWER(owner_user.email))) ORDER BY saved_design.updatedAt DESC LIMIT 200;

-- 5. CORRECTION - DO NOT RUN WITHOUT TOM'S APPROVAL.
--
--    This is the ONE statement that changes data in this file. It does NOT run
--    as part of the fix. It is here so the change is reviewable and so nothing
--    is ever applied silently.
--
--    What it does: for the rows listed by section 4 ONLY, it moves the design to
--    the owner's own account scope (affiliateId = NULL, i.e. the person's own
--    CabinetDealz account) instead of the storefront it was mis-filed under.
--    The owner (userId) is NOT changed: the design already belongs to the right
--    account, it is only in the wrong store.
--
--    What it deliberately does not do:
--      - it does not touch designs of a store's own team
--      - it does not touch designs of storefront customers (a storefront
--        customer's plan is meant to be in that store's CRM)
--      - it does not update any CRM deal, order, quote or lead, and it does not
--        delete anything, so nothing disappears from a customer's history
--
--    Before running it, take the row list from section 4 (export it), and read
--    this statement again:
UPDATE cabinet_dealz.kitchen_designs AS saved_design INNER JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId SET saved_design.affiliateId = NULL WHERE saved_design.affiliateId IS NOT NULL AND owner_user.role IN ('admin', 'designer', 'sales_rep', 'distributor') AND (owner_user.signupAffiliateId IS NULL OR owner_user.signupAffiliateId <> saved_design.affiliateId) AND NOT EXISTS (SELECT 1 FROM cabinet_dealz.affiliate_team_members AS team_member WHERE team_member.affiliateId = saved_design.affiliateId AND team_member.isActive = 1 AND (team_member.userId = saved_design.userId OR LOWER(team_member.email) = LOWER(owner_user.email)));

-- 6. READ-ONLY, run AFTER section 5 (only if it was approved and run): confirm
--    the affected designs now read as house/account designs. Safe to run twice.
SELECT saved_design.id AS designId, saved_design.name AS designName, saved_design.userId AS ownerUserId, owner_user.email AS ownerEmail, saved_design.affiliateId AS affiliateId, saved_design.updatedAt FROM cabinet_dealz.kitchen_designs AS saved_design LEFT JOIN cabinet_dealz.users AS owner_user ON owner_user.id = saved_design.userId WHERE saved_design.name LIKE '%Maple Life%' ORDER BY saved_design.updatedAt DESC LIMIT 50;
