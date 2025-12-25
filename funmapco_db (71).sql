-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Dec 25, 2025 at 11:02 PM
-- Server version: 10.6.24-MariaDB
-- PHP Version: 8.4.14

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `funmapco_db`
--

-- --------------------------------------------------------

--
-- Stand-in structure for view `addons`
-- (See below for the actual view)
--
CREATE TABLE `addons` (
`id` int(11)
,`name` varchar(255)
,`addon_key` varchar(255)
,`description` text
,`price` decimal(10,2)
,`duration_days` int(11)
,`active` tinyint(1)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `admins`
-- (See below for the actual view)
--
CREATE TABLE `admins` (
`id` int(11)
,`email` varchar(255)
,`password_hash` varchar(255)
,`username` varchar(255)
,`username_key` varchar(255)
,`avatar_file` varchar(255)
,`created_at` datetime
,`settings_json` longtext
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `admin_messages`
-- (See below for the actual view)
--
CREATE TABLE `admin_messages` (
`id` int(11)
,`message_name` varchar(100)
,`message_key` varchar(100)
,`message_type` enum('toast','error','success','warning','confirm','modal','email','label')
,`message_category` varchar(50)
,`container_key` varchar(50)
,`message_text` text
,`message_description` varchar(255)
,`supports_html` tinyint(1)
,`placeholders` text
,`is_active` tinyint(1)
,`is_visible` tinyint(1)
,`is_deletable` tinyint(1)
,`display_duration` int(11)
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `admin_settings`
-- (See below for the actual view)
--
CREATE TABLE `admin_settings` (
`id` int(11)
,`setting_key` varchar(100)
,`setting_value` text
,`setting_type` enum('string','boolean','integer','decimal','json','dropdown')
,`description` varchar(255)
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `amenities`
-- (See below for the actual view)
--
CREATE TABLE `amenities` (
`id` int(11)
,`option_filename` varchar(255)
,`option_value` varchar(50)
,`option_label` varchar(100)
,`sort_order` int(11)
,`is_active` tinyint(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `banned_words`
-- (See below for the actual view)
--
CREATE TABLE `banned_words` (
`id` int(11)
,`word` varchar(255)
,`language` varchar(10)
,`reason` varchar(255)
,`created_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `categories`
-- (See below for the actual view)
--
CREATE TABLE `categories` (
`id` int(11)
,`category_name` varchar(255)
,`category_key` varchar(255)
,`sort_order` int(11)
,`hidden` tinyint(1)
,`icon_path` varchar(255)
,`color_hex` char(7)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `category_icons`
-- (See below for the actual view)
--
CREATE TABLE `category_icons` (
`id` int(11)
,`option_filename` varchar(255)
,`option_value` varchar(50)
,`option_label` varchar(100)
,`sort_order` int(11)
,`is_active` tinyint(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `checkout_options`
-- (See below for the actual view)
--
CREATE TABLE `checkout_options` (
`id` int(11)
,`checkout_key` varchar(100)
,`checkout_title` varchar(255)
,`checkout_description` text
,`checkout_logic` text
,`checkout_currency` varchar(10)
,`checkout_flagfall_price` decimal(10,2)
,`checkout_basic_day_rate` decimal(10,2)
,`checkout_discount_day_rate` decimal(10,2)
,`checkout_featured` tinyint(1)
,`checkout_sidebar_ad` tinyint(1)
,`sort_order` tinyint(3) unsigned
,`hidden` tinyint(1)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `commissions`
-- (See below for the actual view)
--
CREATE TABLE `commissions` (
`id` int(11)
,`transaction_id` int(11)
,`post_id` int(11)
,`member_id` int(11)
,`member_name` varchar(255)
,`gross_amount` decimal(10,2)
,`site_commission` decimal(10,2)
,`member_payout` decimal(10,2)
,`payout_status` enum('pending','paid')
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `coupons`
-- (See below for the actual view)
--
CREATE TABLE `coupons` (
`id` int(11)
,`code` varchar(50)
,`description` varchar(255)
,`discount_type` enum('percent','fixed')
,`discount_value` decimal(10,2)
,`valid_from` date
,`valid_until` date
,`usage_limit` int(11)
,`status` enum('active','expired')
,`created_by_admin_id` int(11)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `currencies`
-- (See below for the actual view)
--
CREATE TABLE `currencies` (
`id` int(11)
,`option_filename` varchar(255)
,`option_value` varchar(50)
,`option_label` varchar(100)
,`sort_order` int(11)
,`is_active` tinyint(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `fields`
-- (See below for the actual view)
--
CREATE TABLE `fields` (
`id` int(11)
,`field_key` varchar(255)
,`input_type` varchar(255)
,`min_length` int(11)
,`max_length` int(11)
,`show_limit` tinyint(1)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `fieldsets`
-- (See below for the actual view)
--
CREATE TABLE `fieldsets` (
`id` int(11)
,`fieldset_key` varchar(255)
,`fieldset_fields` longtext
,`fieldset_name` varchar(255)
,`fieldset_options` longtext
,`fieldset_placeholder` text
,`fieldset_tooltip` varchar(500)
,`sort_order` int(10) unsigned
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `layout_containers`
-- (See below for the actual view)
--
CREATE TABLE `layout_containers` (
`id` int(11)
,`tab_id` int(11)
,`tab_name` varchar(100)
,`container_key` varchar(100)
,`container_name` varchar(100)
,`icon_path` varchar(255)
,`sort_order` int(11)
,`is_visible` tinyint(1)
,`is_deletable` tinyint(1)
,`is_collapsible` tinyint(1)
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `layout_rows`
-- (See below for the actual view)
--
CREATE TABLE `layout_rows` (
`id` int(11)
,`container_id` int(11)
,`container_name` varchar(100)
,`row_key` varchar(100)
,`row_name` varchar(100)
,`is_visible` tinyint(1)
,`is_deletable` tinyint(1)
,`is_active` tinyint(1)
,`metadata` text
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `layout_tabs`
-- (See below for the actual view)
--
CREATE TABLE `layout_tabs` (
`id` int(11)
,`tab_key` varchar(100)
,`panel_key` enum('admin','member','filter','advert')
,`tab_name` varchar(100)
,`sort_order` int(11)
,`is_visible` tinyint(1)
,`is_deletable` tinyint(1)
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `logs`
-- (See below for the actual view)
--
CREATE TABLE `logs` (
`id` int(11)
,`actor_type` enum('admin','member','codex','system')
,`actor_id` int(11)
,`action` varchar(255)
,`description` text
,`ip_address` varchar(45)
,`created_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `media`
-- (See below for the actual view)
--
CREATE TABLE `media` (
`id` int(11)
,`member_id` int(11)
,`post_id` int(11)
,`file_name` varchar(255)
,`file_url` varchar(500)
,`file_size` int(11)
,`uploaded_at` datetime
,`backup_json` longtext
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `members`
-- (See below for the actual view)
--
CREATE TABLE `members` (
`id` int(11)
,`email` varchar(255)
,`password_hash` varchar(255)
,`username` varchar(255)
,`avatar_file` varchar(255)
,`username_key` varchar(255)
,`theme` varchar(20)
,`language` varchar(10)
,`currency` varchar(10)
,`country_code` varchar(2)
,`map_lighting` varchar(20)
,`map_style` varchar(20)
,`created_at` datetime
,`backup_json` longtext
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `member_settings`
-- (See below for the actual view)
--
CREATE TABLE `member_settings` (
`member_setting_key` varchar(100)
,`member_setting_value` text
,`member_setting_type` varchar(20)
,`member_setting_description` varchar(255)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `moderation_log`
-- (See below for the actual view)
--
CREATE TABLE `moderation_log` (
`id` int(11)
,`post_id` int(11)
,`post_title` varchar(255)
,`moderator_id` int(11)
,`moderator_name` varchar(255)
,`action` varchar(50)
,`reason` text
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `phone_prefixes`
-- (See below for the actual view)
--
CREATE TABLE `phone_prefixes` (
`id` int(11)
,`option_filename` varchar(255)
,`option_value` varchar(50)
,`option_label` varchar(100)
,`sort_order` int(11)
,`is_active` tinyint(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `posts`
-- (See below for the actual view)
--
CREATE TABLE `posts` (
`id` int(11)
,`post_key` varchar(255)
,`member_id` int(11)
,`member_name` varchar(255)
,`subcategory_key` varchar(255)
,`loc_qty` int(10) unsigned
,`visibility` enum('paused','active','expired')
,`moderation_status` enum('pending','clean','blurred','hidden')
,`flag_reason` text
,`checkout_title` varchar(255)
,`payment_status` enum('pending','paid','failed','refunded')
,`expires_at` datetime
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `post_children`
-- (See below for the actual view)
--
CREATE TABLE `post_children` (
`id` int(11)
,`map_card_id` int(11)
,`session_date` date
,`session_time` time
,`seating_area` varchar(100)
,`pricing_tier` varchar(100)
,`variant_name` varchar(100)
,`price` decimal(10,2)
,`currency` varchar(10)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `post_map_cards`
-- (See below for the actual view)
--
CREATE TABLE `post_map_cards` (
`id` int(11)
,`post_id` int(11)
,`subcategory_key` varchar(255)
,`title` varchar(255)
,`description` text
,`custom_text` varchar(500)
,`custom_textarea` text
,`custom_dropdown` varchar(255)
,`custom_radio` varchar(255)
,`email` varchar(255)
,`phone` varchar(50)
,`venue_name` varchar(255)
,`address_line` varchar(500)
,`latitude` decimal(10,7)
,`longitude` decimal(10,7)
,`country_code` varchar(2)
,`website_url` varchar(500)
,`tickets_url` varchar(500)
,`coupon_code` varchar(100)
,`checkout_title` varchar(255)
,`session_summary` varchar(255)
,`price_summary` varchar(255)
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `post_revisions`
-- (See below for the actual view)
--
CREATE TABLE `post_revisions` (
`id` int(11)
,`post_id` int(11)
,`post_title` varchar(255)
,`editor_id` int(11)
,`editor_name` varchar(255)
,`edited_at` datetime
,`change_type` varchar(50)
,`change_summary` varchar(255)
,`data_json` longtext
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `subcategories`
-- (See below for the actual view)
--
CREATE TABLE `subcategories` (
`id` int(11)
,`category_id` int(11)
,`category_name` varchar(255)
,`subcategory_name` varchar(255)
,`subcategory_key` varchar(255)
,`fieldset_ids` varchar(255)
,`fieldset_name` varchar(255)
,`required` varchar(255)
,`fieldset_mods` longtext
,`location_repeat` varchar(255)
,`must_repeat` varchar(255)
,`autofill_repeat` varchar(255)
,`checkout_surcharge` decimal(10,2)
,`sort_order` text
,`hidden` tinyint(1)
,`icon_path` varchar(255)
,`color_hex` varchar(7)
,`subcategory_type` varchar(20)
,`subcategory_type_logic` text
,`location_type` enum('Venue','City','Address')
,`created_at` timestamp
,`updated_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `system_images`
-- (See below for the actual view)
--
CREATE TABLE `system_images` (
`id` int(11)
,`option_filename` varchar(255)
,`option_value` varchar(50)
,`option_label` varchar(100)
,`sort_order` int(11)
,`is_active` tinyint(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `transactions`
-- (See below for the actual view)
--
CREATE TABLE `transactions` (
`id` int(11)
,`member_id` int(11)
,`member_name` varchar(255)
,`post_id` int(11)
,`post_title` varchar(255)
,`addon_id` int(11)
,`coupon_code` varchar(50)
,`discount_amount` decimal(10,2)
,`payment_id` varchar(255)
,`payment_gateway` varchar(50)
,`amount` decimal(10,2)
,`currency` varchar(10)
,`status` enum('paid','pending','refunded')
,`created_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Structure for view `addons`
--
DROP TABLE IF EXISTS `addons`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `addons`  AS SELECT `funmapco_system`.`addons`.`id` AS `id`, `funmapco_system`.`addons`.`name` AS `name`, `funmapco_system`.`addons`.`addon_key` AS `addon_key`, `funmapco_system`.`addons`.`description` AS `description`, `funmapco_system`.`addons`.`price` AS `price`, `funmapco_system`.`addons`.`duration_days` AS `duration_days`, `funmapco_system`.`addons`.`active` AS `active`, `funmapco_system`.`addons`.`created_at` AS `created_at`, `funmapco_system`.`addons`.`updated_at` AS `updated_at` FROM `funmapco_system`.`addons` ;

-- --------------------------------------------------------

--
-- Structure for view `admins`
--
DROP TABLE IF EXISTS `admins`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `admins`  AS SELECT `funmapco_system`.`admins`.`id` AS `id`, `funmapco_system`.`admins`.`email` AS `email`, `funmapco_system`.`admins`.`password_hash` AS `password_hash`, `funmapco_system`.`admins`.`username` AS `username`, `funmapco_system`.`admins`.`username_key` AS `username_key`, `funmapco_system`.`admins`.`avatar_file` AS `avatar_file`, `funmapco_system`.`admins`.`created_at` AS `created_at`, `funmapco_system`.`admins`.`settings_json` AS `settings_json`, `funmapco_system`.`admins`.`updated_at` AS `updated_at` FROM `funmapco_system`.`admins` ;

-- --------------------------------------------------------

--
-- Structure for view `admin_messages`
--
DROP TABLE IF EXISTS `admin_messages`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `admin_messages`  AS SELECT `funmapco_system`.`admin_messages`.`id` AS `id`, `funmapco_system`.`admin_messages`.`message_name` AS `message_name`, `funmapco_system`.`admin_messages`.`message_key` AS `message_key`, `funmapco_system`.`admin_messages`.`message_type` AS `message_type`, `funmapco_system`.`admin_messages`.`message_category` AS `message_category`, `funmapco_system`.`admin_messages`.`container_key` AS `container_key`, `funmapco_system`.`admin_messages`.`message_text` AS `message_text`, `funmapco_system`.`admin_messages`.`message_description` AS `message_description`, `funmapco_system`.`admin_messages`.`supports_html` AS `supports_html`, `funmapco_system`.`admin_messages`.`placeholders` AS `placeholders`, `funmapco_system`.`admin_messages`.`is_active` AS `is_active`, `funmapco_system`.`admin_messages`.`is_visible` AS `is_visible`, `funmapco_system`.`admin_messages`.`is_deletable` AS `is_deletable`, `funmapco_system`.`admin_messages`.`display_duration` AS `display_duration`, `funmapco_system`.`admin_messages`.`created_at` AS `created_at`, `funmapco_system`.`admin_messages`.`updated_at` AS `updated_at` FROM `funmapco_system`.`admin_messages` ;

-- --------------------------------------------------------

--
-- Structure for view `admin_settings`
--
DROP TABLE IF EXISTS `admin_settings`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `admin_settings`  AS SELECT `funmapco_system`.`admin_settings`.`id` AS `id`, `funmapco_system`.`admin_settings`.`setting_key` AS `setting_key`, `funmapco_system`.`admin_settings`.`setting_value` AS `setting_value`, `funmapco_system`.`admin_settings`.`setting_type` AS `setting_type`, `funmapco_system`.`admin_settings`.`description` AS `description`, `funmapco_system`.`admin_settings`.`created_at` AS `created_at`, `funmapco_system`.`admin_settings`.`updated_at` AS `updated_at` FROM `funmapco_system`.`admin_settings` ;

-- --------------------------------------------------------

--
-- Structure for view `amenities`
--
DROP TABLE IF EXISTS `amenities`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `amenities`  AS SELECT `funmapco_system`.`amenities`.`id` AS `id`, `funmapco_system`.`amenities`.`option_filename` AS `option_filename`, `funmapco_system`.`amenities`.`option_value` AS `option_value`, `funmapco_system`.`amenities`.`option_label` AS `option_label`, `funmapco_system`.`amenities`.`sort_order` AS `sort_order`, `funmapco_system`.`amenities`.`is_active` AS `is_active` FROM `funmapco_system`.`amenities` ;

-- --------------------------------------------------------

--
-- Structure for view `banned_words`
--
DROP TABLE IF EXISTS `banned_words`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `banned_words`  AS SELECT `funmapco_system`.`banned_words`.`id` AS `id`, `funmapco_system`.`banned_words`.`word` AS `word`, `funmapco_system`.`banned_words`.`language` AS `language`, `funmapco_system`.`banned_words`.`reason` AS `reason`, `funmapco_system`.`banned_words`.`created_at` AS `created_at` FROM `funmapco_system`.`banned_words` ;

-- --------------------------------------------------------

--
-- Structure for view `categories`
--
DROP TABLE IF EXISTS `categories`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `categories`  AS SELECT `funmapco_system`.`categories`.`id` AS `id`, `funmapco_system`.`categories`.`category_name` AS `category_name`, `funmapco_system`.`categories`.`category_key` AS `category_key`, `funmapco_system`.`categories`.`sort_order` AS `sort_order`, `funmapco_system`.`categories`.`hidden` AS `hidden`, `funmapco_system`.`categories`.`icon_path` AS `icon_path`, `funmapco_system`.`categories`.`color_hex` AS `color_hex`, `funmapco_system`.`categories`.`created_at` AS `created_at`, `funmapco_system`.`categories`.`updated_at` AS `updated_at` FROM `funmapco_system`.`categories` ;

-- --------------------------------------------------------

--
-- Structure for view `category_icons`
--
DROP TABLE IF EXISTS `category_icons`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `category_icons`  AS SELECT `funmapco_system`.`category_icons`.`id` AS `id`, `funmapco_system`.`category_icons`.`option_filename` AS `option_filename`, `funmapco_system`.`category_icons`.`option_value` AS `option_value`, `funmapco_system`.`category_icons`.`option_label` AS `option_label`, `funmapco_system`.`category_icons`.`sort_order` AS `sort_order`, `funmapco_system`.`category_icons`.`is_active` AS `is_active` FROM `funmapco_system`.`category_icons` ;

-- --------------------------------------------------------

--
-- Structure for view `checkout_options`
--
DROP TABLE IF EXISTS `checkout_options`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `checkout_options`  AS SELECT `funmapco_system`.`checkout_options`.`id` AS `id`, `funmapco_system`.`checkout_options`.`checkout_key` AS `checkout_key`, `funmapco_system`.`checkout_options`.`checkout_title` AS `checkout_title`, `funmapco_system`.`checkout_options`.`checkout_description` AS `checkout_description`, `funmapco_system`.`checkout_options`.`checkout_logic` AS `checkout_logic`, `funmapco_system`.`checkout_options`.`checkout_currency` AS `checkout_currency`, `funmapco_system`.`checkout_options`.`checkout_flagfall_price` AS `checkout_flagfall_price`, `funmapco_system`.`checkout_options`.`checkout_basic_day_rate` AS `checkout_basic_day_rate`, `funmapco_system`.`checkout_options`.`checkout_discount_day_rate` AS `checkout_discount_day_rate`, `funmapco_system`.`checkout_options`.`checkout_featured` AS `checkout_featured`, `funmapco_system`.`checkout_options`.`checkout_sidebar_ad` AS `checkout_sidebar_ad`, `funmapco_system`.`checkout_options`.`sort_order` AS `sort_order`, `funmapco_system`.`checkout_options`.`hidden` AS `hidden`, `funmapco_system`.`checkout_options`.`created_at` AS `created_at`, `funmapco_system`.`checkout_options`.`updated_at` AS `updated_at` FROM `funmapco_system`.`checkout_options` ;

-- --------------------------------------------------------

--
-- Structure for view `commissions`
--
DROP TABLE IF EXISTS `commissions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `commissions`  AS SELECT `funmapco_content`.`commissions`.`id` AS `id`, `funmapco_content`.`commissions`.`transaction_id` AS `transaction_id`, `funmapco_content`.`commissions`.`post_id` AS `post_id`, `funmapco_content`.`commissions`.`member_id` AS `member_id`, `funmapco_content`.`commissions`.`member_name` AS `member_name`, `funmapco_content`.`commissions`.`gross_amount` AS `gross_amount`, `funmapco_content`.`commissions`.`site_commission` AS `site_commission`, `funmapco_content`.`commissions`.`member_payout` AS `member_payout`, `funmapco_content`.`commissions`.`payout_status` AS `payout_status`, `funmapco_content`.`commissions`.`created_at` AS `created_at`, `funmapco_content`.`commissions`.`updated_at` AS `updated_at` FROM `funmapco_content`.`commissions` ;

-- --------------------------------------------------------

--
-- Structure for view `coupons`
--
DROP TABLE IF EXISTS `coupons`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `coupons`  AS SELECT `funmapco_system`.`coupons`.`id` AS `id`, `funmapco_system`.`coupons`.`code` AS `code`, `funmapco_system`.`coupons`.`description` AS `description`, `funmapco_system`.`coupons`.`discount_type` AS `discount_type`, `funmapco_system`.`coupons`.`discount_value` AS `discount_value`, `funmapco_system`.`coupons`.`valid_from` AS `valid_from`, `funmapco_system`.`coupons`.`valid_until` AS `valid_until`, `funmapco_system`.`coupons`.`usage_limit` AS `usage_limit`, `funmapco_system`.`coupons`.`status` AS `status`, `funmapco_system`.`coupons`.`created_by_admin_id` AS `created_by_admin_id`, `funmapco_system`.`coupons`.`created_at` AS `created_at`, `funmapco_system`.`coupons`.`updated_at` AS `updated_at` FROM `funmapco_system`.`coupons` ;

-- --------------------------------------------------------

--
-- Structure for view `currencies`
--
DROP TABLE IF EXISTS `currencies`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `currencies`  AS SELECT `funmapco_system`.`currencies`.`id` AS `id`, `funmapco_system`.`currencies`.`option_filename` AS `option_filename`, `funmapco_system`.`currencies`.`option_value` AS `option_value`, `funmapco_system`.`currencies`.`option_label` AS `option_label`, `funmapco_system`.`currencies`.`sort_order` AS `sort_order`, `funmapco_system`.`currencies`.`is_active` AS `is_active` FROM `funmapco_system`.`currencies` ;

-- --------------------------------------------------------

--
-- Structure for view `fields`
--
DROP TABLE IF EXISTS `fields`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `fields`  AS SELECT `funmapco_system`.`fields`.`id` AS `id`, `funmapco_system`.`fields`.`field_key` AS `field_key`, `funmapco_system`.`fields`.`input_type` AS `input_type`, `funmapco_system`.`fields`.`min_length` AS `min_length`, `funmapco_system`.`fields`.`max_length` AS `max_length`, `funmapco_system`.`fields`.`show_limit` AS `show_limit`, `funmapco_system`.`fields`.`created_at` AS `created_at`, `funmapco_system`.`fields`.`updated_at` AS `updated_at` FROM `funmapco_system`.`fields` ;

-- --------------------------------------------------------

--
-- Structure for view `fieldsets`
--
DROP TABLE IF EXISTS `fieldsets`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `fieldsets`  AS SELECT `funmapco_system`.`fieldsets`.`id` AS `id`, `funmapco_system`.`fieldsets`.`fieldset_key` AS `fieldset_key`, `funmapco_system`.`fieldsets`.`fieldset_fields` AS `fieldset_fields`, `funmapco_system`.`fieldsets`.`fieldset_name` AS `fieldset_name`, `funmapco_system`.`fieldsets`.`fieldset_options` AS `fieldset_options`, `funmapco_system`.`fieldsets`.`fieldset_placeholder` AS `fieldset_placeholder`, `funmapco_system`.`fieldsets`.`fieldset_tooltip` AS `fieldset_tooltip`, `funmapco_system`.`fieldsets`.`sort_order` AS `sort_order`, `funmapco_system`.`fieldsets`.`created_at` AS `created_at`, `funmapco_system`.`fieldsets`.`updated_at` AS `updated_at` FROM `funmapco_system`.`fieldsets` ;

-- --------------------------------------------------------

--
-- Structure for view `layout_containers`
--
DROP TABLE IF EXISTS `layout_containers`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `layout_containers`  AS SELECT `funmapco_system`.`layout_containers`.`id` AS `id`, `funmapco_system`.`layout_containers`.`tab_id` AS `tab_id`, `funmapco_system`.`layout_containers`.`tab_name` AS `tab_name`, `funmapco_system`.`layout_containers`.`container_key` AS `container_key`, `funmapco_system`.`layout_containers`.`container_name` AS `container_name`, `funmapco_system`.`layout_containers`.`icon_path` AS `icon_path`, `funmapco_system`.`layout_containers`.`sort_order` AS `sort_order`, `funmapco_system`.`layout_containers`.`is_visible` AS `is_visible`, `funmapco_system`.`layout_containers`.`is_deletable` AS `is_deletable`, `funmapco_system`.`layout_containers`.`is_collapsible` AS `is_collapsible`, `funmapco_system`.`layout_containers`.`is_active` AS `is_active`, `funmapco_system`.`layout_containers`.`created_at` AS `created_at`, `funmapco_system`.`layout_containers`.`updated_at` AS `updated_at` FROM `funmapco_system`.`layout_containers` ;

-- --------------------------------------------------------

--
-- Structure for view `layout_rows`
--
DROP TABLE IF EXISTS `layout_rows`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `layout_rows`  AS SELECT `funmapco_system`.`layout_rows`.`id` AS `id`, `funmapco_system`.`layout_rows`.`container_id` AS `container_id`, `funmapco_system`.`layout_rows`.`container_name` AS `container_name`, `funmapco_system`.`layout_rows`.`row_key` AS `row_key`, `funmapco_system`.`layout_rows`.`row_name` AS `row_name`, `funmapco_system`.`layout_rows`.`is_visible` AS `is_visible`, `funmapco_system`.`layout_rows`.`is_deletable` AS `is_deletable`, `funmapco_system`.`layout_rows`.`is_active` AS `is_active`, `funmapco_system`.`layout_rows`.`metadata` AS `metadata`, `funmapco_system`.`layout_rows`.`created_at` AS `created_at`, `funmapco_system`.`layout_rows`.`updated_at` AS `updated_at` FROM `funmapco_system`.`layout_rows` ;

-- --------------------------------------------------------

--
-- Structure for view `layout_tabs`
--
DROP TABLE IF EXISTS `layout_tabs`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `layout_tabs`  AS SELECT `funmapco_system`.`layout_tabs`.`id` AS `id`, `funmapco_system`.`layout_tabs`.`tab_key` AS `tab_key`, `funmapco_system`.`layout_tabs`.`panel_key` AS `panel_key`, `funmapco_system`.`layout_tabs`.`tab_name` AS `tab_name`, `funmapco_system`.`layout_tabs`.`sort_order` AS `sort_order`, `funmapco_system`.`layout_tabs`.`is_visible` AS `is_visible`, `funmapco_system`.`layout_tabs`.`is_deletable` AS `is_deletable`, `funmapco_system`.`layout_tabs`.`is_active` AS `is_active`, `funmapco_system`.`layout_tabs`.`created_at` AS `created_at`, `funmapco_system`.`layout_tabs`.`updated_at` AS `updated_at` FROM `funmapco_system`.`layout_tabs` ;

-- --------------------------------------------------------

--
-- Structure for view `logs`
--
DROP TABLE IF EXISTS `logs`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `logs`  AS SELECT `funmapco_content`.`logs`.`id` AS `id`, `funmapco_content`.`logs`.`actor_type` AS `actor_type`, `funmapco_content`.`logs`.`actor_id` AS `actor_id`, `funmapco_content`.`logs`.`action` AS `action`, `funmapco_content`.`logs`.`description` AS `description`, `funmapco_content`.`logs`.`ip_address` AS `ip_address`, `funmapco_content`.`logs`.`created_at` AS `created_at` FROM `funmapco_content`.`logs` ;

-- --------------------------------------------------------

--
-- Structure for view `media`
--
DROP TABLE IF EXISTS `media`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `media`  AS SELECT `funmapco_content`.`media`.`id` AS `id`, `funmapco_content`.`media`.`member_id` AS `member_id`, `funmapco_content`.`media`.`post_id` AS `post_id`, `funmapco_content`.`media`.`file_name` AS `file_name`, `funmapco_content`.`media`.`file_url` AS `file_url`, `funmapco_content`.`media`.`file_size` AS `file_size`, `funmapco_content`.`media`.`uploaded_at` AS `uploaded_at`, `funmapco_content`.`media`.`backup_json` AS `backup_json`, `funmapco_content`.`media`.`created_at` AS `created_at`, `funmapco_content`.`media`.`updated_at` AS `updated_at` FROM `funmapco_content`.`media` ;

-- --------------------------------------------------------

--
-- Structure for view `members`
--
DROP TABLE IF EXISTS `members`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `members`  AS SELECT `funmapco_content`.`members`.`id` AS `id`, `funmapco_content`.`members`.`email` AS `email`, `funmapco_content`.`members`.`password_hash` AS `password_hash`, `funmapco_content`.`members`.`username` AS `username`, `funmapco_content`.`members`.`avatar_file` AS `avatar_file`, `funmapco_content`.`members`.`username_key` AS `username_key`, `funmapco_content`.`members`.`theme` AS `theme`, `funmapco_content`.`members`.`language` AS `language`, `funmapco_content`.`members`.`currency` AS `currency`, `funmapco_content`.`members`.`country_code` AS `country_code`, `funmapco_content`.`members`.`map_lighting` AS `map_lighting`, `funmapco_content`.`members`.`map_style` AS `map_style`, `funmapco_content`.`members`.`created_at` AS `created_at`, `funmapco_content`.`members`.`backup_json` AS `backup_json`, `funmapco_content`.`members`.`updated_at` AS `updated_at` FROM `funmapco_content`.`members` ;

-- --------------------------------------------------------

--
-- Structure for view `member_settings`
--
DROP TABLE IF EXISTS `member_settings`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `member_settings`  AS SELECT `funmapco_system`.`member_settings`.`member_setting_key` AS `member_setting_key`, `funmapco_system`.`member_settings`.`member_setting_value` AS `member_setting_value`, `funmapco_system`.`member_settings`.`member_setting_type` AS `member_setting_type`, `funmapco_system`.`member_settings`.`member_setting_description` AS `member_setting_description`, `funmapco_system`.`member_settings`.`created_at` AS `created_at`, `funmapco_system`.`member_settings`.`updated_at` AS `updated_at` FROM `funmapco_system`.`member_settings` ;

-- --------------------------------------------------------

--
-- Structure for view `moderation_log`
--
DROP TABLE IF EXISTS `moderation_log`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `moderation_log`  AS SELECT `funmapco_content`.`moderation_log`.`id` AS `id`, `funmapco_content`.`moderation_log`.`post_id` AS `post_id`, `funmapco_content`.`moderation_log`.`post_title` AS `post_title`, `funmapco_content`.`moderation_log`.`moderator_id` AS `moderator_id`, `funmapco_content`.`moderation_log`.`moderator_name` AS `moderator_name`, `funmapco_content`.`moderation_log`.`action` AS `action`, `funmapco_content`.`moderation_log`.`reason` AS `reason`, `funmapco_content`.`moderation_log`.`created_at` AS `created_at`, `funmapco_content`.`moderation_log`.`updated_at` AS `updated_at` FROM `funmapco_content`.`moderation_log` ;

-- --------------------------------------------------------

--
-- Structure for view `phone_prefixes`
--
DROP TABLE IF EXISTS `phone_prefixes`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `phone_prefixes`  AS SELECT `funmapco_system`.`phone_prefixes`.`id` AS `id`, `funmapco_system`.`phone_prefixes`.`option_filename` AS `option_filename`, `funmapco_system`.`phone_prefixes`.`option_value` AS `option_value`, `funmapco_system`.`phone_prefixes`.`option_label` AS `option_label`, `funmapco_system`.`phone_prefixes`.`sort_order` AS `sort_order`, `funmapco_system`.`phone_prefixes`.`is_active` AS `is_active` FROM `funmapco_system`.`phone_prefixes` ;

-- --------------------------------------------------------

--
-- Structure for view `posts`
--
DROP TABLE IF EXISTS `posts`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `posts`  AS SELECT `funmapco_content`.`posts`.`id` AS `id`, `funmapco_content`.`posts`.`post_key` AS `post_key`, `funmapco_content`.`posts`.`member_id` AS `member_id`, `funmapco_content`.`posts`.`member_name` AS `member_name`, `funmapco_content`.`posts`.`subcategory_key` AS `subcategory_key`, `funmapco_content`.`posts`.`loc_qty` AS `loc_qty`, `funmapco_content`.`posts`.`visibility` AS `visibility`, `funmapco_content`.`posts`.`moderation_status` AS `moderation_status`, `funmapco_content`.`posts`.`flag_reason` AS `flag_reason`, `funmapco_content`.`posts`.`checkout_title` AS `checkout_title`, `funmapco_content`.`posts`.`payment_status` AS `payment_status`, `funmapco_content`.`posts`.`expires_at` AS `expires_at`, `funmapco_content`.`posts`.`created_at` AS `created_at`, `funmapco_content`.`posts`.`updated_at` AS `updated_at` FROM `funmapco_content`.`posts` ;

-- --------------------------------------------------------

--
-- Structure for view `post_children`
--
DROP TABLE IF EXISTS `post_children`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `post_children`  AS SELECT `funmapco_content`.`post_children`.`id` AS `id`, `funmapco_content`.`post_children`.`map_card_id` AS `map_card_id`, `funmapco_content`.`post_children`.`session_date` AS `session_date`, `funmapco_content`.`post_children`.`session_time` AS `session_time`, `funmapco_content`.`post_children`.`seating_area` AS `seating_area`, `funmapco_content`.`post_children`.`pricing_tier` AS `pricing_tier`, `funmapco_content`.`post_children`.`variant_name` AS `variant_name`, `funmapco_content`.`post_children`.`price` AS `price`, `funmapco_content`.`post_children`.`currency` AS `currency`, `funmapco_content`.`post_children`.`created_at` AS `created_at`, `funmapco_content`.`post_children`.`updated_at` AS `updated_at` FROM `funmapco_content`.`post_children` ;

-- --------------------------------------------------------

--
-- Structure for view `post_map_cards`
--
DROP TABLE IF EXISTS `post_map_cards`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `post_map_cards`  AS SELECT `funmapco_content`.`post_map_cards`.`id` AS `id`, `funmapco_content`.`post_map_cards`.`post_id` AS `post_id`, `funmapco_content`.`post_map_cards`.`subcategory_key` AS `subcategory_key`, `funmapco_content`.`post_map_cards`.`title` AS `title`, `funmapco_content`.`post_map_cards`.`description` AS `description`, `funmapco_content`.`post_map_cards`.`custom_text` AS `custom_text`, `funmapco_content`.`post_map_cards`.`custom_textarea` AS `custom_textarea`, `funmapco_content`.`post_map_cards`.`custom_dropdown` AS `custom_dropdown`, `funmapco_content`.`post_map_cards`.`custom_radio` AS `custom_radio`, `funmapco_content`.`post_map_cards`.`email` AS `email`, `funmapco_content`.`post_map_cards`.`phone` AS `phone`, `funmapco_content`.`post_map_cards`.`venue_name` AS `venue_name`, `funmapco_content`.`post_map_cards`.`address_line` AS `address_line`, `funmapco_content`.`post_map_cards`.`latitude` AS `latitude`, `funmapco_content`.`post_map_cards`.`longitude` AS `longitude`, `funmapco_content`.`post_map_cards`.`country_code` AS `country_code`, `funmapco_content`.`post_map_cards`.`website_url` AS `website_url`, `funmapco_content`.`post_map_cards`.`tickets_url` AS `tickets_url`, `funmapco_content`.`post_map_cards`.`coupon_code` AS `coupon_code`, `funmapco_content`.`post_map_cards`.`checkout_title` AS `checkout_title`, `funmapco_content`.`post_map_cards`.`session_summary` AS `session_summary`, `funmapco_content`.`post_map_cards`.`price_summary` AS `price_summary`, `funmapco_content`.`post_map_cards`.`created_at` AS `created_at`, `funmapco_content`.`post_map_cards`.`updated_at` AS `updated_at` FROM `funmapco_content`.`post_map_cards` ;

-- --------------------------------------------------------

--
-- Structure for view `post_revisions`
--
DROP TABLE IF EXISTS `post_revisions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `post_revisions`  AS SELECT `funmapco_content`.`post_revisions`.`id` AS `id`, `funmapco_content`.`post_revisions`.`post_id` AS `post_id`, `funmapco_content`.`post_revisions`.`post_title` AS `post_title`, `funmapco_content`.`post_revisions`.`editor_id` AS `editor_id`, `funmapco_content`.`post_revisions`.`editor_name` AS `editor_name`, `funmapco_content`.`post_revisions`.`edited_at` AS `edited_at`, `funmapco_content`.`post_revisions`.`change_type` AS `change_type`, `funmapco_content`.`post_revisions`.`change_summary` AS `change_summary`, `funmapco_content`.`post_revisions`.`data_json` AS `data_json`, `funmapco_content`.`post_revisions`.`created_at` AS `created_at`, `funmapco_content`.`post_revisions`.`updated_at` AS `updated_at` FROM `funmapco_content`.`post_revisions` ;

-- --------------------------------------------------------

--
-- Structure for view `subcategories`
--
DROP TABLE IF EXISTS `subcategories`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `subcategories`  AS SELECT `funmapco_system`.`subcategories`.`id` AS `id`, `funmapco_system`.`subcategories`.`category_id` AS `category_id`, `funmapco_system`.`subcategories`.`category_name` AS `category_name`, `funmapco_system`.`subcategories`.`subcategory_name` AS `subcategory_name`, `funmapco_system`.`subcategories`.`subcategory_key` AS `subcategory_key`, `funmapco_system`.`subcategories`.`fieldset_ids` AS `fieldset_ids`, `funmapco_system`.`subcategories`.`fieldset_name` AS `fieldset_name`, `funmapco_system`.`subcategories`.`required` AS `required`, `funmapco_system`.`subcategories`.`fieldset_mods` AS `fieldset_mods`, `funmapco_system`.`subcategories`.`location_repeat` AS `location_repeat`, `funmapco_system`.`subcategories`.`must_repeat` AS `must_repeat`, `funmapco_system`.`subcategories`.`autofill_repeat` AS `autofill_repeat`, `funmapco_system`.`subcategories`.`checkout_surcharge` AS `checkout_surcharge`, `funmapco_system`.`subcategories`.`sort_order` AS `sort_order`, `funmapco_system`.`subcategories`.`hidden` AS `hidden`, `funmapco_system`.`subcategories`.`icon_path` AS `icon_path`, `funmapco_system`.`subcategories`.`color_hex` AS `color_hex`, `funmapco_system`.`subcategories`.`subcategory_type` AS `subcategory_type`, `funmapco_system`.`subcategories`.`subcategory_type_logic` AS `subcategory_type_logic`, `funmapco_system`.`subcategories`.`location_type` AS `location_type`, `funmapco_system`.`subcategories`.`created_at` AS `created_at`, `funmapco_system`.`subcategories`.`updated_at` AS `updated_at` FROM `funmapco_system`.`subcategories` ;

-- --------------------------------------------------------

--
-- Structure for view `system_images`
--
DROP TABLE IF EXISTS `system_images`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `system_images`  AS SELECT `funmapco_system`.`system_images`.`id` AS `id`, `funmapco_system`.`system_images`.`option_filename` AS `option_filename`, `funmapco_system`.`system_images`.`option_value` AS `option_value`, `funmapco_system`.`system_images`.`option_label` AS `option_label`, `funmapco_system`.`system_images`.`sort_order` AS `sort_order`, `funmapco_system`.`system_images`.`is_active` AS `is_active` FROM `funmapco_system`.`system_images` ;

-- --------------------------------------------------------

--
-- Structure for view `transactions`
--
DROP TABLE IF EXISTS `transactions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`cpses_fu1yizyiag`@`localhost` SQL SECURITY DEFINER VIEW `transactions`  AS SELECT `funmapco_content`.`transactions`.`id` AS `id`, `funmapco_content`.`transactions`.`member_id` AS `member_id`, `funmapco_content`.`transactions`.`member_name` AS `member_name`, `funmapco_content`.`transactions`.`post_id` AS `post_id`, `funmapco_content`.`transactions`.`post_title` AS `post_title`, `funmapco_content`.`transactions`.`addon_id` AS `addon_id`, `funmapco_content`.`transactions`.`coupon_code` AS `coupon_code`, `funmapco_content`.`transactions`.`discount_amount` AS `discount_amount`, `funmapco_content`.`transactions`.`payment_id` AS `payment_id`, `funmapco_content`.`transactions`.`payment_gateway` AS `payment_gateway`, `funmapco_content`.`transactions`.`amount` AS `amount`, `funmapco_content`.`transactions`.`currency` AS `currency`, `funmapco_content`.`transactions`.`status` AS `status`, `funmapco_content`.`transactions`.`created_at` AS `created_at`, `funmapco_content`.`transactions`.`updated_at` AS `updated_at` FROM `funmapco_content`.`transactions` ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
