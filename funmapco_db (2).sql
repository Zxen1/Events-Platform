-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 05, 2025 at 02:28 PM
-- Server version: 10.6.23-MariaDB
-- PHP Version: 8.4.13

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

DELIMITER $$
--
-- Procedures
--
DROP PROCEDURE IF EXISTS `rebuild_field_type_enum`$$
CREATE DEFINER=`funmapco`@`localhost` PROCEDURE `rebuild_field_type_enum` ()   BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE field_name VARCHAR(255);
  DECLARE cur CURSOR FOR SELECT field_key FROM fields;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  UPDATE field_types 
    SET field_type_item_1 = NULL,
        field_type_item_2 = NULL,
        field_type_item_3 = NULL,
        field_type_item_4 = NULL,
        field_type_item_5 = NULL;

  read_loop: LOOP
    FETCH cur INTO field_name;
    IF done THEN
      LEAVE read_loop;
    END IF;

    UPDATE field_types
    SET field_type_item_1 = IF(field_type_item_1 IS NULL, CONCAT(field_name, ' [field=', id, ']'), field_type_item_1),
        field_type_item_2 = IF(field_type_item_2 IS NULL, CONCAT(field_name, ' [field=', id, ']'), field_type_item_2),
        field_type_item_3 = IF(field_type_item_3 IS NULL, CONCAT(field_name, ' [field=', id, ']'), field_type_item_3),
        field_type_item_4 = IF(field_type_item_4 IS NULL, CONCAT(field_name, ' [field=', id, ']'), field_type_item_4),
        field_type_item_5 = IF(field_type_item_5 IS NULL, CONCAT(field_name, ' [field=', id, ']'), field_type_item_5)
    WHERE field_type_item_1 IS NULL OR field_type_item_2 IS NULL 
       OR field_type_item_3 IS NULL OR field_type_item_4 IS NULL OR field_type_item_5 IS NULL;
  END LOOP;

  CLOSE cur;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `addons`
--

DROP TABLE IF EXISTS `addons`;
CREATE TABLE `addons` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `addon_key` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `duration_days` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

DROP TABLE IF EXISTS `admins`;
CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `settings_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`settings_json`)),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `email`, `password_hash`, `display_name`, `created_at`, `settings_json`, `updated_at`) VALUES
(2, 'admin', '$2a$12$EED5zmTO8Eyhj0N/6F1W5.dyHyMlYbOABsWf6oTk0.j/Tv8rhOIU.', 'Administrator', '2025-10-22 01:00:41', NULL, '2025-10-29 23:32:47');

-- --------------------------------------------------------

--
-- Table structure for table `banned_words`
--

DROP TABLE IF EXISTS `banned_words`;
CREATE TABLE `banned_words` (
  `id` int(11) NOT NULL,
  `word` varchar(255) DEFAULT NULL,
  `language` varchar(10) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `categories`
--

DROP TABLE IF EXISTS `categories`;
CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `category_name` varchar(255) NOT NULL,
  `category_key` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `icon_path` varchar(255) DEFAULT NULL,
  `mapmarker_path` varchar(255) DEFAULT NULL,
  `color_hex` char(7) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `category_name`, `category_key`, `sort_order`, `icon_path`, `mapmarker_path`, `color_hex`, `created_at`, `updated_at`) VALUES
(1, 'What\'s On', 'whats_on', 1, 'assets/icons-20/whats-on-category-icon-20.webp', 'assets/icons-30/whats-on-category-icon-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-11-05 10:45:46'),
(2, 'Opportunities', 'opportunities', 4, 'assets/icons-20/opportunities-category-icon-20.webp', 'assets/icons-30/opportunities-category-icon-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-11-05 10:45:46'),
(3, 'Learning', 'learning', 3, 'assets/icons-20/learning-category-icon-20.webp', 'assets/icons-30/learning-category-icon-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-11-05 10:45:46'),
(4, 'Buy and Sell', 'buy_and_sell', 5, 'assets/icons-20/Buy-and-sell-category-icon-20.webp', 'assets/icons-30/Buy-and-sell-category-icon-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-10-30 05:10:15'),
(5, 'For Hire', 'for_hire', 2, 'assets/icons-20/For-hire-category-icon-20.webp', 'assets/icons-30/For-hire-category-icon-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-11-05 10:45:46');

-- --------------------------------------------------------

--
-- Table structure for table `commissions`
--

DROP TABLE IF EXISTS `commissions`;
CREATE TABLE `commissions` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) DEFAULT NULL,
  `post_id` int(11) DEFAULT NULL,
  `member_id` int(11) DEFAULT NULL,
  `member_name` varchar(255) DEFAULT NULL,
  `gross_amount` decimal(10,2) DEFAULT NULL,
  `site_commission` decimal(10,2) DEFAULT NULL,
  `member_payout` decimal(10,2) DEFAULT NULL,
  `payout_status` enum('pending','paid') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `coupons`
--

DROP TABLE IF EXISTS `coupons`;
CREATE TABLE `coupons` (
  `id` int(11) NOT NULL,
  `code` varchar(50) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `discount_type` enum('percent','fixed') DEFAULT NULL,
  `discount_value` decimal(10,2) DEFAULT NULL,
  `valid_from` date DEFAULT NULL,
  `valid_until` date DEFAULT NULL,
  `usage_limit` int(11) DEFAULT 0,
  `status` enum('active','expired') DEFAULT 'active',
  `created_by_admin_id` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fields`
--

DROP TABLE IF EXISTS `fields`;
CREATE TABLE `fields` (
  `id` int(11) NOT NULL,
  `field_key` varchar(255) DEFAULT NULL,
  `type` varchar(50) DEFAULT NULL,
  `options` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `fields`
--

INSERT INTO `fields` (`id`, `field_key`, `type`, `options`, `created_at`, `updated_at`) VALUES
(1, 'title', 'text', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(2, 'description', 'textarea', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(3, 'images', 'images', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(4, 'venue_name', 'text', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(5, 'address_line', 'text', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(6, 'latitude', 'decimal', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(7, 'longitude', 'decimal', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(8, 'session_date', 'date', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(9, 'session_time', 'time', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(10, 'seating_area', 'text', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(11, 'pricing_tier', 'text', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(12, 'ticket_price', 'decimal(10,2)', NULL, '2025-10-29 23:32:47', '2025-10-30 19:19:34'),
(13, 'currency', 'dropdown', 'AUD,USD,EUR,GBP', '2025-10-29 23:32:47', '2025-11-05 13:33:54'),
(14, 'text_box', 'text', NULL, '2025-10-30 17:11:57', '2025-10-30 17:11:57'),
(15, 'text_area', 'textarea', NULL, '2025-10-30 17:11:57', '2025-10-30 17:11:57'),
(16, 'dropdown', 'dropdown', NULL, '2025-10-30 17:14:25', '2025-10-30 17:14:25'),
(17, 'radio_toggle', 'radio', NULL, '2025-10-30 17:14:25', '2025-10-30 17:14:25'),
(18, 'email', 'email', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(19, 'phone', 'tel', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(20, 'website', 'url', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(21, 'variant', 'text', NULL, '2025-10-30 18:33:09', '2025-10-30 18:33:09'),
(22, 'subvariant', 'text', NULL, '2025-10-30 18:33:09', '2025-10-30 18:33:09'),
(23, 'item_price', 'decimal(10,2)', NULL, '2025-10-30 18:39:14', '2025-10-30 18:39:14'),
(25, 'checkout_price', 'decimal(10,2)', NULL, '2025-10-30 19:09:49', '2025-10-30 19:19:34'),
(24, 'checkout_option', 'radio_toggle', NULL, '2025-10-30 19:02:46', '2025-10-30 19:09:49');

--
-- Triggers `fields`
--
DROP TRIGGER IF EXISTS `after_fields_delete`;
DELIMITER $$
CREATE TRIGGER `after_fields_delete` AFTER DELETE ON `fields` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `after_fields_insert`;
DELIMITER $$
CREATE TRIGGER `after_fields_insert` AFTER INSERT ON `fields` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `after_fields_update`;
DELIMITER $$
CREATE TRIGGER `after_fields_update` AFTER UPDATE ON `fields` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `fieldsets`
--

DROP TABLE IF EXISTS `fieldsets`;
CREATE TABLE `fieldsets` (
  `id` int(11) NOT NULL,
  `fieldset_key` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `field_id` text DEFAULT NULL,
  `field_key` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `fieldsets`
--

INSERT INTO `fieldsets` (`id`, `fieldset_key`, `description`, `field_id`, `field_key`, `created_at`, `updated_at`) VALUES
(1, 'venues', 'Fields for venue information like address and coordinates.', '4,5,6,7', 'venue_name,_address_line,_latitude,_longitude', '2025-10-25 16:56:09', '2025-10-30 04:58:22'),
(2, 'sessions', 'Fields for session date and time.', '8,9', 'session_date,_session_time', '2025-10-25 16:56:09', '2025-10-30 04:58:22'),
(3, 'ticket_pricing', 'Fields for seating area, pricing tier, ticket price, and currency.', '10,11,12,13', 'seating_area,_pricing_tier,_ticket_price,_currency', '2025-10-25 16:56:09', '2025-10-30 04:58:22'),
(4, 'location', 'Fields for location details including address and coordinates.', '5,6,7', 'address_line,_latitude,_longitude', '2025-10-29 22:59:10', '2025-10-30 04:58:22'),
(5, 'variant_pricing', 'Fields for managing variants, subvariants, and item pricing.', '21,22,23', 'variant,_subvariant,_item_price', '2025-10-30 18:39:14', '2025-10-30 18:42:18'),
(8, 'checkout_table', 'Fields for checkout options, currency, and price.', '24,13,25', 'checkout_option,_currency,_checkout_price', '2025-10-30 19:09:49', '2025-10-30 19:09:49');

--
-- Triggers `fieldsets`
--
DROP TRIGGER IF EXISTS `after_fieldsets_delete`;
DELIMITER $$
CREATE TRIGGER `after_fieldsets_delete` AFTER DELETE ON `fieldsets` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `after_fieldsets_insert`;
DELIMITER $$
CREATE TRIGGER `after_fieldsets_insert` AFTER INSERT ON `fieldsets` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;
DROP TRIGGER IF EXISTS `after_fieldsets_update`;
DELIMITER $$
CREATE TRIGGER `after_fieldsets_update` AFTER UPDATE ON `fieldsets` FOR EACH ROW BEGIN CALL rebuild_field_type_enum(); END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `field_types`
--

DROP TABLE IF EXISTS `field_types`;
CREATE TABLE `field_types` (
  `id` int(11) NOT NULL,
  `field_type_name` varchar(255) NOT NULL,
  `field_type_key` varchar(255) DEFAULT NULL,
  `placeholder` varchar(512) DEFAULT NULL,
  `field_type_item_1` enum('address_line [field=5]','checkout_option [field=24]','checkout_price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item_price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing_tier [field=11]','radio_toggle [field=17]','seating_area [field=10]','session_date [field=8]','session_time [field=9]','subvariant [field=22]','text_area [field=15]','text_box [field=14]','ticket_price [field=12]','title [field=1]','variant [field=21]','venue_name [field=4]','website [field=20]','checkout_table [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket_pricing [fieldset=3]','variant_pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_2` enum('address_line [field=5]','checkout_option [field=24]','checkout_price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item_price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing_tier [field=11]','radio_toggle [field=17]','seating_area [field=10]','session_date [field=8]','session_time [field=9]','subvariant [field=22]','text_area [field=15]','text_box [field=14]','ticket_price [field=12]','title [field=1]','variant [field=21]','venue_name [field=4]','website [field=20]','checkout_table [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket_pricing [fieldset=3]','variant_pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_3` enum('address_line [field=5]','checkout_option [field=24]','checkout_price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item_price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing_tier [field=11]','radio_toggle [field=17]','seating_area [field=10]','session_date [field=8]','session_time [field=9]','subvariant [field=22]','text_area [field=15]','text_box [field=14]','ticket_price [field=12]','title [field=1]','variant [field=21]','venue_name [field=4]','website [field=20]','checkout_table [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket_pricing [fieldset=3]','variant_pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_4` enum('address_line [field=5]','checkout_option [field=24]','checkout_price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item_price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing_tier [field=11]','radio_toggle [field=17]','seating_area [field=10]','session_date [field=8]','session_time [field=9]','subvariant [field=22]','text_area [field=15]','text_box [field=14]','ticket_price [field=12]','title [field=1]','variant [field=21]','venue_name [field=4]','website [field=20]','checkout_table [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket_pricing [fieldset=3]','variant_pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_5` enum('address_line [field=5]','checkout_option [field=24]','checkout_price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item_price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing_tier [field=11]','radio_toggle [field=17]','seating_area [field=10]','session_date [field=8]','session_time [field=9]','subvariant [field=22]','text_area [field=15]','text_box [field=14]','ticket_price [field=12]','title [field=1]','variant [field=21]','venue_name [field=4]','website [field=20]','checkout_table [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket_pricing [fieldset=3]','variant_pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sort_order` int(10) UNSIGNED DEFAULT 0
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `field_types`
--

INSERT INTO `field_types` (`id`, `field_type_name`, `field_type_key`, `placeholder`, `field_type_item_1`, `field_type_item_2`, `field_type_item_3`, `field_type_item_4`, `field_type_item_5`, `created_at`, `updated_at`, `sort_order`) VALUES
(1, 'Title', 'title', 'eg. Summer Rain', 'title [field=1]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:57:59', 1),
(2, 'Description', 'description', 'eg. Come and Express Yourself!', 'description [field=2]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:58:24', 2),
(3, 'Text Box', 'text_box', 'text', 'text_box [field=14]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:58:32', 3),
(4, 'Text Area', 'text_area', 'The quick brown fox jumped over the lazy dogs.', 'text_area [field=15]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:58:57', 4),
(5, 'Dropdown', 'dropdown', '1,2,3', 'dropdown [field=16]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:59:20', 5),
(6, 'Radio Toggle', 'radio_toggle', 'A,B,C', 'radio_toggle [field=17]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:59:50', 6),
(7, 'Email', 'email', 'you@there.com', 'email [field=18]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:00:06', 7),
(8, 'Phone', 'phone', '+61455555555', 'phone [field=19]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:00:23', 8),
(9, 'Location', 'location', '1 Smith Street, Timbuctu, Kollasis, Tomeggia', 'location [fieldset=4]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:02', 9),
(10, 'Website (URL)', 'website_url', 'www.website.com', 'website [field=20]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:18', 10),
(11, 'Tickets (URL)', 'tickets_url', 'www.tickets.com', 'website [field=20]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:32', 11),
(12, 'Images', 'images', 'images', 'images [field=3]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:51', 12),
(13, 'Coupon', 'coupon', 'eg. FreeStuff', 'text_box [field=14]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:03:06', 13),
(14, 'Variant Pricing', 'variant_pricing', 'prices', 'variant_pricing [fieldset=5]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:03:14', 14),
(15, 'Checkout', 'checkout', 'payme', 'checkout_table [fieldset=8]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:03:20', 15),
(16, 'Venues Sessions and Pricing', 'venues_sessions_pricing', 'eg.VenueSessionPricing', 'venues [fieldset=1]', 'sessions [fieldset=2]', 'ticket_pricing [fieldset=3]', NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:03:46', 16);

-- --------------------------------------------------------

--
-- Table structure for table `field_values`
--

DROP TABLE IF EXISTS `field_values`;
CREATE TABLE `field_values` (
  `id` int(11) NOT NULL,
  `post_id` int(11) DEFAULT NULL,
  `post_title` varchar(255) DEFAULT NULL,
  `field_id` int(11) DEFAULT NULL,
  `field_key` varchar(255) DEFAULT NULL,
  `value` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

DROP TABLE IF EXISTS `logs`;
CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `actor_type` enum('admin','member','codex','system') DEFAULT 'codex',
  `actor_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `media`
--

DROP TABLE IF EXISTS `media`;
CREATE TABLE `media` (
  `id` int(11) NOT NULL,
  `member_id` int(11) DEFAULT NULL,
  `post_id` int(11) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT current_timestamp(),
  `backup_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `members`
--

DROP TABLE IF EXISTS `members`;
CREATE TABLE `members` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `member_key` varchar(255) DEFAULT NULL,
  `avatar_url` varchar(255) DEFAULT NULL,
  `theme` varchar(20) DEFAULT NULL,
  `language` varchar(10) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `backup_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `members`
--

INSERT INTO `members` (`id`, `email`, `password_hash`, `display_name`, `member_key`, `avatar_url`, `theme`, `language`, `currency`, `created_at`, `backup_json`, `updated_at`) VALUES
(1, 'test@funmap.com', '$2y$10$7ABTYshHSH4SsxEH2uXwkuv.FLxVlqwkOrtkxFioJFtrK6drCs.Lm', 'TestUser', 'testuser', NULL, NULL, NULL, NULL, '2025-10-22 01:27:04', NULL, '2025-10-30 05:10:15'),
(2, 'wikidata@funmap.com', '$2a$12$/TY3Fr3AjdRMunhyA1TLzuu6DubnXkLaWc7CpdvxGdkWFEeQwNi4G', 'Wikidata / Wikipedia (CC BY-SA 4.0)', 'wikidata_/_wikipedia_(cc_by-sa_4.0)', 'assets/avatars/wikipedia.png', NULL, NULL, NULL, '2025-10-25 19:00:27', NULL, '2025-10-30 05:10:15'),
(3, 'admin@funmap.com', '$2y$10$rQ6.P/Jwy9RN5HWCZt6Z7uiJSllbDKxNdNGKpOHHTYohai9HSd3N2', 'sun 26 oct 0327', 'sun_26_oct_0327', '', NULL, NULL, NULL, '2025-10-26 03:28:31', NULL, '2025-10-30 05:10:15');

-- --------------------------------------------------------

--
-- Table structure for table `moderation_log`
--

DROP TABLE IF EXISTS `moderation_log`;
CREATE TABLE `moderation_log` (
  `id` int(11) NOT NULL,
  `post_id` int(11) DEFAULT NULL,
  `post_title` varchar(255) DEFAULT NULL,
  `moderator_id` int(11) DEFAULT NULL,
  `moderator_name` varchar(255) DEFAULT NULL,
  `action` varchar(50) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
CREATE TABLE `posts` (
  `id` int(11) NOT NULL,
  `subcategory_id` int(11) DEFAULT NULL,
  `subcategory_name` varchar(255) DEFAULT NULL,
  `member_id` int(11) DEFAULT NULL,
  `member_name` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `post_key` varchar(255) DEFAULT NULL,
  `status` enum('active','expired','draft') DEFAULT 'active',
  `moderation_status` enum('clean','blurred') DEFAULT 'clean',
  `flag_reason` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `backup_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `subcategory_id`, `subcategory_name`, `member_id`, `member_name`, `title`, `post_key`, `status`, `moderation_status`, `flag_reason`, `created_at`, `updated_at`, `backup_json`) VALUES
(1, 42, 'Education Centres', 2, 'Administrator', 'Test 2025-10-29 2241', 'test_2025-10-29_2241', 'active', 'clean', NULL, '2025-10-29 22:42:06', '2025-10-30 05:10:15', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `post_revisions`
--

DROP TABLE IF EXISTS `post_revisions`;
CREATE TABLE `post_revisions` (
  `id` int(11) NOT NULL,
  `post_id` int(11) DEFAULT NULL,
  `post_title` varchar(255) DEFAULT NULL,
  `editor_id` int(11) DEFAULT NULL,
  `editor_name` varchar(255) DEFAULT NULL,
  `edited_at` datetime DEFAULT current_timestamp(),
  `change_type` varchar(50) DEFAULT NULL,
  `change_summary` varchar(255) DEFAULT NULL,
  `data_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`data_json`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `subcategories`
--

DROP TABLE IF EXISTS `subcategories`;
CREATE TABLE `subcategories` (
  `id` int(11) NOT NULL,
  `category_id` int(11) DEFAULT NULL,
  `category_name` varchar(255) DEFAULT NULL,
  `subcategory_name` varchar(255) NOT NULL,
  `subcategory_key` varchar(255) DEFAULT NULL,
  `field_type_id` varchar(255) DEFAULT NULL,
  `field_type_name` varchar(255) DEFAULT NULL,
  `required` varchar(255) DEFAULT NULL,
  `sort_order` text DEFAULT NULL,
  `listing_type` enum('standard','session') DEFAULT 'standard',
  `listing_duration_days` int(11) DEFAULT 30,
  `allow_renewal` tinyint(1) DEFAULT 1,
  `renewal_fee` decimal(10,2) DEFAULT 0.00,
  `auto_expire` tinyint(1) DEFAULT 1,
  `icon_path` varchar(255) DEFAULT NULL,
  `mapmarker_path` varchar(255) DEFAULT NULL,
  `color_hex` char(7) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `category_name`, `subcategory_name`, `subcategory_key`, `field_type_id`, `field_type_name`, `required`, `sort_order`, `listing_type`, `listing_duration_days`, `allow_renewal`, `renewal_fee`, `auto_expire`, `icon_path`, `mapmarker_path`, `color_hex`, `created_at`, `updated_at`) VALUES
(27, 1, 'What\'s On', 'Live Gigs', 'live_gigs', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '1', 'session', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-blue-20.webp', 'assets/icons-30/whats-on-category-icon-blue-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(28, 1, 'What\'s On', 'Live Theatre', 'live_theatre', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '3', 'session', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-dark-yellow-20.webp', 'assets/icons-30/whats-on-category-icon-dark-yellow-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(29, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '2', 'session', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-green-20.webp', 'assets/icons-30/whats-on-category-icon-green-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(30, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '4', 'session', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-indigo-20.webp', 'assets/icons-30/whats-on-category-icon-indigo-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(31, 1, 'What\'s On', 'Live Sport', 'live_sport', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '5', 'session', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-orange-20.webp', 'assets/icons-30/whats-on-category-icon-orange-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(32, 1, 'What\'s On', 'Venues', 'venues', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '7', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-violet-20.webp', 'assets/icons-30/whats-on-category-icon-violet-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(33, 1, 'What\'s On', 'Other Events', 'other_events', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '6', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/whats-on-category-icon-red-20.webp', 'assets/icons-30/whats-on-category-icon-red-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(34, 2, 'Opportunities', 'Stage Auditions', 'stage_auditions', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '6', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-blue-20.webp', 'assets/icons-30/opportunities-category-icon-blue-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(35, 2, 'Opportunities', 'Screen Auditions', 'screen_auditions', '1,2,12,16,15', 'Title, Description, Images, Venues Sessions and Pricing, Checkout', NULL, '5', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-dark-yellow-20.webp', 'assets/icons-30/opportunities-category-icon-dark-yellow-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(36, 2, 'Opportunities', 'Clubs', 'clubs', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '1', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-green-20.webp', 'assets/icons-30/opportunities-category-icon-green-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(37, 2, 'Opportunities', 'Jobs', 'jobs', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '3', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-indigo-20.webp', 'assets/icons-30/opportunities-category-icon-indigo-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(38, 2, 'Opportunities', 'Volunteers', 'volunteers', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '7', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-orange-20.webp', 'assets/icons-30/opportunities-category-icon-orange-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(39, 2, 'Opportunities', 'Competitions', 'competitions', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '2', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-red-20.webp', 'assets/icons-30/opportunities-category-icon-red-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(40, 2, 'Opportunities', 'Other Opportunities', 'other_opportunities', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '4', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/opportunities-category-icon-violet-20.webp', 'assets/icons-30/opportunities-category-icon-violet-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(41, 3, 'Learning', 'Tutors', 'tutors', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '4', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/learning-category-icon-blue-20.webp', 'assets/icons-30/learning-category-icon-blue-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(42, 3, 'Learning', 'Education Centres', 'education_centres', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '2', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/learning-category-icon-dark-yellow-20.webp', 'assets/icons-30/learning-category-icon-dark-yellow-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(43, 3, 'Learning', 'Courses', 'courses', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '1', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/learning-category-icon-green-20.webp', 'assets/icons-30/learning-category-icon-green-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(44, 3, 'Learning', 'Other Learning', 'other_learning', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '3', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/learning-category-icon-red-20.webp', 'assets/icons-30/learning-category-icon-red-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(45, 4, 'Buy and Sell', 'Wanted', 'wanted', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '2', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/Buy-and-sell-category-icon-orange-20.webp', 'assets/icons-30/Buy-and-sell-category-icon-orange-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(46, 4, 'Buy and Sell', 'For Sale', 'for_sale', '1,2,14,12,9,15', 'Title, Description, Variant Pricing, Images, Location, Checkout', NULL, '3', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/Buy-and-sell-category-icon-red-20.webp', 'assets/icons-30/Buy-and-sell-category-icon-red-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(47, 4, 'Buy and Sell', 'Freebies', 'freebies', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '1', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/Buy-and-sell-category-icon-violet-20.webp', 'assets/icons-30/Buy-and-sell-category-icon-violet-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(49, 5, 'For Hire', 'Performers', 'performers', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '2', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/For-hire-category-icon-blue-20.webp', 'assets/icons-30/For-hire-category-icon-blue-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(50, 5, 'For Hire', 'Staff', 'staff', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '3', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/For-hire-category-icon-dark-yellow-20.webp', 'assets/icons-30/For-hire-category-icon-dark-yellow-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-10-30 23:15:33'),
(51, 5, 'For Hire', 'Goods and Services', 'goods_and_services', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', NULL, '1', 'standard', 30, 1, 0.00, 1, 'assets/icons-20/For-hire-category-icon-green-20.webp', 'assets/icons-30/For-hire-category-icon-green-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-10-30 23:15:33');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

DROP TABLE IF EXISTS `transactions`;
CREATE TABLE `transactions` (
  `id` int(11) NOT NULL,
  `member_id` int(11) DEFAULT NULL,
  `member_name` varchar(255) DEFAULT NULL,
  `post_id` int(11) DEFAULT NULL,
  `post_title` varchar(255) DEFAULT NULL,
  `addon_id` int(11) DEFAULT NULL,
  `coupon_code` varchar(50) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `payment_id` varchar(255) DEFAULT NULL,
  `payment_gateway` varchar(50) DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `status` enum('paid','pending','refunded') DEFAULT 'pending',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `addons`
--
ALTER TABLE `addons`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `admins`
--
ALTER TABLE `admins`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `banned_words`
--
ALTER TABLE `banned_words`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `categories`
--
ALTER TABLE `categories`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `commissions`
--
ALTER TABLE `commissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transaction_id` (`transaction_id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `member_id` (`member_id`);

--
-- Indexes for table `coupons`
--
ALTER TABLE `coupons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by_admin_id` (`created_by_admin_id`);

--
-- Indexes for table `fields`
--
ALTER TABLE `fields`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `fieldsets`
--
ALTER TABLE `fieldsets`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `field_types`
--
ALTER TABLE `field_types`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `field_values`
--
ALTER TABLE `field_values`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `field_id` (`field_id`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `media`
--
ALTER TABLE `media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `member_id` (`member_id`),
  ADD KEY `post_id` (`post_id`);

--
-- Indexes for table `members`
--
ALTER TABLE `members`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `moderation_log`
--
ALTER TABLE `moderation_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `moderator_id` (`moderator_id`);

--
-- Indexes for table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `subcategory_id` (`subcategory_id`),
  ADD KEY `member_id` (`member_id`);

--
-- Indexes for table `post_revisions`
--
ALTER TABLE `post_revisions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `editor_id` (`editor_id`);

--
-- Indexes for table `subcategories`
--
ALTER TABLE `subcategories`
  ADD PRIMARY KEY (`id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `transactions`
--
ALTER TABLE `transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `member_id` (`member_id`),
  ADD KEY `post_id` (`post_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `addons`
--
ALTER TABLE `addons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `admins`
--
ALTER TABLE `admins`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `banned_words`
--
ALTER TABLE `banned_words`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `commissions`
--
ALTER TABLE `commissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `coupons`
--
ALTER TABLE `coupons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `fields`
--
ALTER TABLE `fields`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `fieldsets`
--
ALTER TABLE `fieldsets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `field_types`
--
ALTER TABLE `field_types`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `field_values`
--
ALTER TABLE `field_values`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `media`
--
ALTER TABLE `media`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `members`
--
ALTER TABLE `members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `moderation_log`
--
ALTER TABLE `moderation_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `post_revisions`
--
ALTER TABLE `post_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `subcategories`
--
ALTER TABLE `subcategories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
