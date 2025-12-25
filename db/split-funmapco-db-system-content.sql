-- Split funmapco_db into two databases:
--   - funmapco_system  (site/system configuration)
--   - funmapco_content (user/content/operational data)
--
-- IMPORTANT:
-- - This script MOVES tables (RENAME TABLE). Run during maintenance.
-- - It then recreates COMPATIBILITY VIEWS inside `funmapco_db` so existing code that
--   queries `funmapco_db.table_name` continues to work without any changes.
-- - Views are (generally) updatable because they are simple `SELECT * FROM schema.table`.
--
-- Tested assumptions:
-- - Source database name: funmapco_db
-- - MariaDB/MySQL supports cross-database views.
-- - Your app user has privileges on all 3 schemas.
--
-- If your source DB name differs, replace `funmapco_db` accordingly.

START TRANSACTION;

-- 1) Target databases must be created in cPanel first (shared hosting users often
--    cannot CREATE DATABASE from SQL; they'll get #1044 access denied).
--
-- Create these in cPanel → MySQL® Databases:
--   - funmapco_system
--   - funmapco_content
-- Then add your MySQL user to BOTH databases with ALL PRIVILEGES.

-- 2) Move SYSTEM tables (site-wide configuration)
RENAME TABLE
  `funmapco_db`.`addons`            TO `funmapco_system`.`addons`,
  `funmapco_db`.`admins`            TO `funmapco_system`.`admins`,
  `funmapco_db`.`admin_messages`    TO `funmapco_system`.`admin_messages`,
  `funmapco_db`.`admin_settings`    TO `funmapco_system`.`admin_settings`,
  `funmapco_db`.`member_settings`   TO `funmapco_system`.`member_settings`,
  `funmapco_db`.`amenities`         TO `funmapco_system`.`amenities`,
  `funmapco_db`.`banned_words`      TO `funmapco_system`.`banned_words`,
  `funmapco_db`.`categories`        TO `funmapco_system`.`categories`,
  `funmapco_db`.`subcategories`     TO `funmapco_system`.`subcategories`,
  `funmapco_db`.`category_icons`    TO `funmapco_system`.`category_icons`,
  `funmapco_db`.`checkout_options`  TO `funmapco_system`.`checkout_options`,
  `funmapco_db`.`coupons`           TO `funmapco_system`.`coupons`,
  `funmapco_db`.`currencies`        TO `funmapco_system`.`currencies`,
  `funmapco_db`.`fields`            TO `funmapco_system`.`fields`,
  `funmapco_db`.`fieldsets`         TO `funmapco_system`.`fieldsets`,
  `funmapco_db`.`layout_containers` TO `funmapco_system`.`layout_containers`,
  `funmapco_db`.`layout_rows`       TO `funmapco_system`.`layout_rows`,
  `funmapco_db`.`layout_tabs`       TO `funmapco_system`.`layout_tabs`,
  `funmapco_db`.`phone_prefixes`    TO `funmapco_system`.`phone_prefixes`,
  `funmapco_db`.`system_images`     TO `funmapco_system`.`system_images`;

-- 3) Move CONTENT tables (members, posts, uploads, transactions, logs)
RENAME TABLE
  `funmapco_db`.`members`         TO `funmapco_content`.`members`,
  `funmapco_db`.`posts`           TO `funmapco_content`.`posts`,
  `funmapco_db`.`post_children`   TO `funmapco_content`.`post_children`,
  `funmapco_db`.`post_map_cards`  TO `funmapco_content`.`post_map_cards`,
  `funmapco_db`.`post_revisions`  TO `funmapco_content`.`post_revisions`,
  `funmapco_db`.`media`           TO `funmapco_content`.`media`,
  `funmapco_db`.`transactions`    TO `funmapco_content`.`transactions`,
  `funmapco_db`.`commissions`     TO `funmapco_content`.`commissions`,
  `funmapco_db`.`logs`            TO `funmapco_content`.`logs`,
  `funmapco_db`.`moderation_log`  TO `funmapco_content`.`moderation_log`;

-- 4) Recreate compatibility views in funmapco_db (so existing code keeps working)
USE `funmapco_db`;

-- System views
DROP VIEW IF EXISTS `addons`;
CREATE VIEW `addons` AS SELECT * FROM `funmapco_system`.`addons`;

DROP VIEW IF EXISTS `admins`;
CREATE VIEW `admins` AS SELECT * FROM `funmapco_system`.`admins`;

DROP VIEW IF EXISTS `admin_messages`;
CREATE VIEW `admin_messages` AS SELECT * FROM `funmapco_system`.`admin_messages`;

DROP VIEW IF EXISTS `admin_settings`;
CREATE VIEW `admin_settings` AS SELECT * FROM `funmapco_system`.`admin_settings`;

DROP VIEW IF EXISTS `member_settings`;
CREATE VIEW `member_settings` AS SELECT * FROM `funmapco_system`.`member_settings`;

DROP VIEW IF EXISTS `amenities`;
CREATE VIEW `amenities` AS SELECT * FROM `funmapco_system`.`amenities`;

DROP VIEW IF EXISTS `banned_words`;
CREATE VIEW `banned_words` AS SELECT * FROM `funmapco_system`.`banned_words`;

DROP VIEW IF EXISTS `categories`;
CREATE VIEW `categories` AS SELECT * FROM `funmapco_system`.`categories`;

DROP VIEW IF EXISTS `subcategories`;
CREATE VIEW `subcategories` AS SELECT * FROM `funmapco_system`.`subcategories`;

DROP VIEW IF EXISTS `category_icons`;
CREATE VIEW `category_icons` AS SELECT * FROM `funmapco_system`.`category_icons`;

DROP VIEW IF EXISTS `checkout_options`;
CREATE VIEW `checkout_options` AS SELECT * FROM `funmapco_system`.`checkout_options`;

DROP VIEW IF EXISTS `coupons`;
CREATE VIEW `coupons` AS SELECT * FROM `funmapco_system`.`coupons`;

DROP VIEW IF EXISTS `currencies`;
CREATE VIEW `currencies` AS SELECT * FROM `funmapco_system`.`currencies`;

DROP VIEW IF EXISTS `fields`;
CREATE VIEW `fields` AS SELECT * FROM `funmapco_system`.`fields`;

DROP VIEW IF EXISTS `fieldsets`;
CREATE VIEW `fieldsets` AS SELECT * FROM `funmapco_system`.`fieldsets`;

DROP VIEW IF EXISTS `layout_containers`;
CREATE VIEW `layout_containers` AS SELECT * FROM `funmapco_system`.`layout_containers`;

DROP VIEW IF EXISTS `layout_rows`;
CREATE VIEW `layout_rows` AS SELECT * FROM `funmapco_system`.`layout_rows`;

DROP VIEW IF EXISTS `layout_tabs`;
CREATE VIEW `layout_tabs` AS SELECT * FROM `funmapco_system`.`layout_tabs`;

DROP VIEW IF EXISTS `phone_prefixes`;
CREATE VIEW `phone_prefixes` AS SELECT * FROM `funmapco_system`.`phone_prefixes`;

DROP VIEW IF EXISTS `system_images`;
CREATE VIEW `system_images` AS SELECT * FROM `funmapco_system`.`system_images`;

-- Content views
DROP VIEW IF EXISTS `members`;
CREATE VIEW `members` AS SELECT * FROM `funmapco_content`.`members`;

DROP VIEW IF EXISTS `posts`;
CREATE VIEW `posts` AS SELECT * FROM `funmapco_content`.`posts`;

DROP VIEW IF EXISTS `post_children`;
CREATE VIEW `post_children` AS SELECT * FROM `funmapco_content`.`post_children`;

DROP VIEW IF EXISTS `post_map_cards`;
CREATE VIEW `post_map_cards` AS SELECT * FROM `funmapco_content`.`post_map_cards`;

DROP VIEW IF EXISTS `post_revisions`;
CREATE VIEW `post_revisions` AS SELECT * FROM `funmapco_content`.`post_revisions`;

DROP VIEW IF EXISTS `media`;
CREATE VIEW `media` AS SELECT * FROM `funmapco_content`.`media`;

DROP VIEW IF EXISTS `transactions`;
CREATE VIEW `transactions` AS SELECT * FROM `funmapco_content`.`transactions`;

DROP VIEW IF EXISTS `commissions`;
CREATE VIEW `commissions` AS SELECT * FROM `funmapco_content`.`commissions`;

DROP VIEW IF EXISTS `logs`;
CREATE VIEW `logs` AS SELECT * FROM `funmapco_content`.`logs`;

DROP VIEW IF EXISTS `moderation_log`;
CREATE VIEW `moderation_log` AS SELECT * FROM `funmapco_content`.`moderation_log`;

COMMIT;

-- Quick sanity checks (optional)
-- SELECT COUNT(*) FROM `funmapco_db`.`posts`;
-- SELECT COUNT(*) FROM `funmapco_content`.`posts`;
-- SELECT COUNT(*) FROM `funmapco_db`.`admin_settings`;
-- SELECT COUNT(*) FROM `funmapco_system`.`admin_settings`;


