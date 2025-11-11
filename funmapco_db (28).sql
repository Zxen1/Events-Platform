-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 12, 2025 at 01:00 AM
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
-- Table structure for table `addons`
--

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
-- Table structure for table `admin_settings`
--

CREATE TABLE `admin_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','boolean','integer','decimal','json') DEFAULT 'string',
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_settings`
--

INSERT INTO `admin_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `created_at`, `updated_at`) VALUES
(1, 'site_name', 'FunMap', 'string', 'Site name', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(2, 'site_tagline', NULL, 'string', 'Site tagline/slogan', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(3, 'contact_email', NULL, 'string', 'Admin contact email', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(4, 'support_email', NULL, 'string', 'Support contact email', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(5, 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(6, 'site_currency', 'USD', 'string', 'Universal currency for all listings', '2025-11-09 16:13:48', '2025-11-09 16:50:56'),
(9, 'welcome_enabled', 'true', 'boolean', 'Show welcome modal to new users', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(10, 'welcome_title', 'Welcome to FunMap', 'string', 'Welcome modal title', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(11, 'welcome_message', NULL, 'json', 'Welcome modal content (JSON)', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(12, 'paypal_enabled', 'false', 'boolean', 'Enable PayPal payments', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(13, 'paypal_mode', 'sandbox', 'string', 'PayPal mode: sandbox or live', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(14, 'paypal_client_id', NULL, 'string', 'PayPal Client ID', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(15, 'paypal_secret', NULL, 'string', 'PayPal Secret Key', '2025-11-09 15:36:38', '2025-11-09 16:18:33'),
(16, 'spin_on_load', 'true', 'boolean', 'Enable map spin on page load', '2025-11-09 15:36:38', '2025-11-09 22:17:14'),
(17, 'spin_load_type', 'new_users', 'string', 'Spin for: everyone or new_users', '2025-11-09 15:36:38', '2025-11-10 04:10:23'),
(18, 'spin_on_logo', 'true', 'boolean', 'Enable map spin when logo clicked', '2025-11-09 15:36:38', '2025-11-10 04:10:24'),
(73, 'spin_zoom_max', '5', 'integer', 'Maximum zoom spin threshold', '2025-11-09 20:39:10', '2025-11-10 09:35:08'),
(150, 'spin_speed', '0.3', 'decimal', 'Speed of globe spin rotation', '2025-11-09 21:56:42', '2025-11-10 09:35:28'),
(529, 'icon_folder', 'assets/icons-30', 'string', 'Folder path for category/subcategory icons', '2025-11-11 10:44:57', '2025-11-11 13:50:20');

-- --------------------------------------------------------

--
-- Table structure for table `banned_words`
--

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

CREATE TABLE `categories` (
  `id` int(11) NOT NULL,
  `category_name` varchar(255) NOT NULL,
  `category_key` varchar(255) DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 1,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `icon_path` varchar(255) DEFAULT NULL,
  `color_hex` char(7) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `category_name`, `category_key`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `created_at`, `updated_at`) VALUES
(1, 'What\'s On', 'whats-on', 1, 0, 'assets/icons-30/whats-on-category-icon-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(2, 'Opportunities', 'opportunities', 4, 0, 'assets/icons-30/opportunities-category-icon-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(3, 'Learning', 'learning', 3, 0, 'assets/icons-30/learning-category-icon-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(4, 'Buy and Sell', 'buy-and-sell', 5, 0, 'assets/icons-30/Buy-and-sell-category-icon-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(5, 'For Hire', 'for-hire', 2, 0, 'assets/icons-30/For-hire-category-icon-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-11-11 23:59:15');

-- --------------------------------------------------------

--
-- Table structure for table `commissions`
--

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
(4, 'venue-name', 'text', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(5, 'address-line', 'text', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(6, 'latitude', 'decimal', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(7, 'longitude', 'decimal', NULL, '2025-10-29 23:32:47', '2025-10-29 23:32:47'),
(8, 'session-date', 'date', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(9, 'session-time', 'time', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(10, 'seating-area', 'text', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(11, 'pricing-tier', 'text', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(12, 'ticket-price', 'decimal(10,2)', NULL, '2025-10-29 23:32:47', '2025-11-06 13:07:35'),
(13, 'currency', 'dropdown', 'AUD,USD,EUR,GBP', '2025-10-29 23:32:47', '2025-11-05 13:33:54'),
(14, 'text-box', 'text', NULL, '2025-10-30 17:11:57', '2025-11-06 13:07:35'),
(15, 'text-area', 'textarea', NULL, '2025-10-30 17:11:57', '2025-11-06 13:07:35'),
(16, 'dropdown', 'dropdown', NULL, '2025-10-30 17:14:25', '2025-11-07 01:59:08'),
(17, 'radio-toggle', 'radio', NULL, '2025-10-30 17:14:25', '2025-11-06 13:07:35'),
(18, 'email', 'email', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(19, 'phone', 'tel', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(20, 'website', 'url', NULL, '2025-10-30 17:25:10', '2025-10-30 17:25:10'),
(21, 'variant', 'text', NULL, '2025-10-30 18:33:09', '2025-10-30 18:33:09'),
(22, 'subvariant', 'text', NULL, '2025-10-30 18:33:09', '2025-10-30 18:33:09'),
(23, 'item-price', 'decimal(10,2)', NULL, '2025-10-30 18:39:14', '2025-11-06 13:07:35'),
(25, 'checkout-price', 'decimal(10,2)', NULL, '2025-10-30 19:09:49', '2025-11-06 13:07:35'),
(24, 'checkout-option', 'radio_toggle', 'standard, premium', '2025-10-30 19:02:46', '2025-11-06 13:13:46');

-- --------------------------------------------------------

--
-- Table structure for table `fieldsets`
--

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
(1, 'venues', 'Fields for venue information like address and coordinates.', '4,5,6,7', 'venue-name,address-line,latitude,longitude', '2025-10-25 16:56:09', '2025-11-06 13:15:40'),
(2, 'sessions', 'Fields for session date and time.', '8,9', 'session-date,session-time', '2025-10-25 16:56:09', '2025-11-06 13:15:47'),
(3, 'ticket-pricing', 'Fields for seating area, pricing tier, ticket price, and currency.', '10,11,12,13', 'seating-area,pricing-tier,ticket-price,currency', '2025-10-25 16:56:09', '2025-11-06 13:16:06'),
(4, 'location', 'Fields for location details including address and coordinates.', '5,6,7', 'address-line,latitude,longitude', '2025-10-29 22:59:10', '2025-11-06 13:16:16'),
(5, 'variant-pricing', 'Fields for managing variants, subvariants, and item pricing.', '21,22,23', 'variant,subvariant,item-price', '2025-10-30 18:39:14', '2025-11-06 13:16:26'),
(8, 'checkout-details', 'Fields for checkout options, currency, and price.', '24,13,25', 'checkout-option,currency,checkout-price', '2025-10-30 19:09:49', '2025-11-06 13:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `field_types`
--

CREATE TABLE `field_types` (
  `id` int(11) NOT NULL,
  `field_type_name` varchar(255) NOT NULL,
  `field_type_key` varchar(255) DEFAULT NULL,
  `placeholder` varchar(512) DEFAULT NULL,
  `field_type_item_1` enum('address-line [field=5]','checkout-option [field=24]','checkout-price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item-price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing-tier [field=11]','radio-toggle [field=17]','seating-area [field=10]','session-date [field=8]','session-time [field=9]','subvariant [field=22]','text-area [field=15]','text-box [field=14]','ticket-price [field=12]','title [field=1]','variant [field=21]','venue-name [field=4]','website [field=20]','checkout-details [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket-pricing [fieldset=3]','variant-pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_2` enum('address-line [field=5]','checkout-option [field=24]','checkout-price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item-price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing-tier [field=11]','radio-toggle [field=17]','seating-area [field=10]','session-date [field=8]','session-time [field=9]','subvariant [field=22]','text-area [field=15]','text-box [field=14]','ticket-price [field=12]','title [field=1]','variant [field=21]','venue-name [field=4]','website [field=20]','checkout-details [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket-pricing [fieldset=3]','variant-pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_3` enum('address-line [field=5]','checkout-option [field=24]','checkout-price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item-price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing-tier [field=11]','radio-toggle [field=17]','seating-area [field=10]','session-date [field=8]','session-time [field=9]','subvariant [field=22]','text-area [field=15]','text-box [field=14]','ticket-price [field=12]','title [field=1]','variant [field=21]','venue-name [field=4]','website [field=20]','checkout-details [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket-pricing [fieldset=3]','variant-pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_4` enum('address-line [field=5]','checkout-option [field=24]','checkout-price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item-price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing-tier [field=11]','radio-toggle [field=17]','seating-area [field=10]','session-date [field=8]','session-time [field=9]','subvariant [field=22]','text-area [field=15]','text-box [field=14]','ticket-price [field=12]','title [field=1]','variant [field=21]','venue-name [field=4]','website [field=20]','checkout-details [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket-pricing [fieldset=3]','variant-pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `field_type_item_5` enum('address-line [field=5]','checkout-option [field=24]','checkout-price [field=25]','currency [field=13]','description [field=2]','dropdown [field=16]','email [field=18]','images [field=3]','item-price [field=23]','latitude [field=6]','longitude [field=7]','phone [field=19]','pricing-tier [field=11]','radio-toggle [field=17]','seating-area [field=10]','session-date [field=8]','session-time [field=9]','subvariant [field=22]','text-area [field=15]','text-box [field=14]','ticket-price [field=12]','title [field=1]','variant [field=21]','venue-name [field=4]','website [field=20]','checkout-details [fieldset=8]','location [fieldset=4]','sessions [fieldset=2]','ticket-pricing [fieldset=3]','variant-pricing [fieldset=5]','venues [fieldset=1]') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sort_order` int(10) UNSIGNED DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `field_types`
--

INSERT INTO `field_types` (`id`, `field_type_name`, `field_type_key`, `placeholder`, `field_type_item_1`, `field_type_item_2`, `field_type_item_3`, `field_type_item_4`, `field_type_item_5`, `created_at`, `updated_at`, `sort_order`) VALUES
(1, 'Title', 'title', 'eg. Summer Rain', 'title [field=1]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:57:59', 1),
(2, 'Description', 'description', 'eg. Come and Express Yourself!', 'description [field=2]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:58:24', 2),
(3, 'Text Box', 'text-box', 'text', 'text-box [field=14]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:19:20', 3),
(4, 'Text Area', 'text-area', 'The quick brown fox jumped over the lazy dogs.', 'text-area [field=15]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:19:28', 4),
(5, 'Dropdown', 'dropdown', '1,2,3', 'dropdown [field=16]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 02:59:20', 5),
(6, 'Radio Toggle', 'radio-toggle', 'A,B,C', 'radio-toggle [field=17]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:19:38', 6),
(7, 'Email', 'email', 'you@there.com', 'email [field=18]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:00:06', 7),
(8, 'Phone', 'phone', '+61 455 555 555', 'phone [field=19]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-09 12:26:42', 8),
(9, 'Location', 'location', '1 Smith Street, Timbuctu, Kollasis, Tomeggia', 'location [fieldset=4]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:02', 9),
(10, 'Website (URL)', 'website-url', 'www.website.com', 'website [field=20]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:07:35', 10),
(11, 'Tickets (URL)', 'tickets-url', 'www.tickets.com', 'website [field=20]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:07:35', 11),
(12, 'Images', 'images', 'images', 'images [field=3]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-05 03:01:51', 12),
(13, 'Coupon', 'coupon', 'eg. FreeStuff', 'text-box [field=14]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:19:54', 13),
(14, 'Variant Pricing', 'variant-pricing', 'prices', 'variant-pricing [fieldset=5]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:20:00', 14),
(15, 'Checkout', 'checkout', 'pay me', 'checkout-details [fieldset=8]', NULL, NULL, NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:29:44', 15),
(16, 'Venue Ticketing', 'venue-ticketing', 'eg.VenueSessionPricing', 'venues [fieldset=1]', 'sessions [fieldset=2]', 'ticket-pricing [fieldset=3]', NULL, NULL, '2025-10-29 19:03:05', '2025-11-06 02:25:18', 16);

-- --------------------------------------------------------

--
-- Table structure for table `field_values`
--

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
(2, 'wikidata@funmap.com', '$2a$12$/TY3Fr3AjdRMunhyA1TLzuu6DubnXkLaWc7CpdvxGdkWFEeQwNi4G', 'Wikidata / Wikipedia (CC BY-SA 4.0)', 'wikidata-/-wikipedia-(cc-by-sa-4.0)', 'assets/avatars/wikipedia.png', NULL, NULL, NULL, '2025-10-25 19:00:27', NULL, '2025-11-06 13:07:35'),
(3, 'admin@funmap.com', '$2y$10$rQ6.P/Jwy9RN5HWCZt6Z7uiJSllbDKxNdNGKpOHHTYohai9HSd3N2', 'sun 26 oct 0327', 'sun-26-oct-0327', '', NULL, NULL, NULL, '2025-10-26 03:28:31', NULL, '2025-11-06 13:07:35'),
(4, 'shs@funmap.com', '$2y$10$zUWx4bFAUhgzwk81yWDLzuW9gLmyh5zQGVioX/mpFMHhyISNZo1ra', 'hello', NULL, '', NULL, NULL, NULL, '2025-11-05 21:43:35', NULL, '2025-11-05 21:43:35');

-- --------------------------------------------------------

--
-- Table structure for table `moderation_log`
--

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

-- --------------------------------------------------------

--
-- Table structure for table `post_revisions`
--

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
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `icon_path` varchar(255) DEFAULT NULL,
  `color_hex` varchar(7) DEFAULT NULL,
  `listing_fee` decimal(10,2) DEFAULT NULL,
  `renew_fee` decimal(10,2) DEFAULT NULL,
  `featured_fee` decimal(10,2) DEFAULT NULL,
  `renew_featured_fee` decimal(10,2) DEFAULT NULL,
  `listing_days` int(11) DEFAULT NULL,
  `subcategory_type` enum('Events','Standard') DEFAULT 'Events',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `category_name`, `subcategory_name`, `subcategory_key`, `field_type_id`, `field_type_name`, `required`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `listing_fee`, `renew_fee`, `featured_fee`, `renew_featured_fee`, `listing_days`, `subcategory_type`, `created_at`, `updated_at`) VALUES
(1, 1, 'What\'s On', 'Live Gigs', 'live-gigs', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/whats-on-category-icon-blue-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, 30, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(2, 1, 'What\'s On', 'Live Theatre', 'live-theatre', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '3', 0, 'assets/icons-30/whats-on-category-icon-dark-yellow-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(3, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/whats-on-category-icon-green-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(4, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '4', 0, 'assets/icons-30/whats-on-category-icon-indigo-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(5, 1, 'What\'s On', 'Live Sport', 'live-sport', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '5', 0, 'assets/icons-30/whats-on-category-icon-orange-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(6, 1, 'What\'s On', 'Venues', 'venues', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '7', 0, 'assets/icons-30/whats-on-category-icon-violet-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(7, 1, 'What\'s On', 'Other Events', 'other-events', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '6', 0, 'assets/icons-30/whats-on-category-icon-red-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(8, 2, 'Opportunities', 'Stage Auditions', 'stage-auditions', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '6', 0, 'assets/icons-30/opportunities-category-icon-blue-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(9, 2, 'Opportunities', 'Screen Auditions', 'screen-auditions', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '5', 0, 'assets/icons-30/opportunities-category-icon-dark-yellow-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(10, 2, 'Opportunities', 'Clubs', 'clubs', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/opportunities-category-icon-green-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(11, 2, 'Opportunities', 'Jobs', 'jobs', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '3', 0, 'assets/icons-30/opportunities-category-icon-indigo-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(12, 2, 'Opportunities', 'Volunteers', 'volunteers', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '7', 0, 'assets/icons-30/opportunities-category-icon-orange-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(13, 2, 'Opportunities', 'Competitions', 'competitions', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/opportunities-category-icon-red-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(14, 2, 'Opportunities', 'Other Opportunities', 'other-opportunities', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '4', 0, 'assets/icons-30/opportunities-category-icon-violet-30.webp', '#F1C40F', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(15, 3, 'Learning', 'Tutors', 'tutors', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '4', 0, 'assets/icons-30/learning-category-icon-blue-30.webp', '#3498DB', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(16, 3, 'Learning', 'Education Centres', 'education-centres', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/learning-category-icon-dark-yellow-30.webp', '#3498DB', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(17, 3, 'Learning', 'Courses', 'courses', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/learning-category-icon-green-30.webp', '#3498DB', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(18, 3, 'Learning', 'Other Learning', 'other-learning', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '3', 0, 'assets/icons-30/learning-category-icon-red-30.webp', '#3498DB', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(19, 4, 'Buy and Sell', 'Wanted', 'wanted', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/Buy-and-sell-category-icon-orange-30.webp', '#2ECC71', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(20, 4, 'Buy and Sell', 'For Sale', 'for-sale', '1,2,14,12,9,15,13', 'Title, Description, Variant Pricing, Images, Location, Checkout, Coupon', '1,1,1,1,1,1,0', '3', 0, 'assets/icons-30/Buy-and-sell-category-icon-red-30.webp', '#2ECC71', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(21, 4, 'Buy and Sell', 'Freebies', 'freebies', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/Buy-and-sell-category-icon-violet-30.webp', '#2ECC71', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(22, 5, 'For Hire', 'Performers', 'performers', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/For-hire-category-icon-blue-30.webp', '#9B59B6', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(23, 5, 'For Hire', 'Staff', 'staff', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '3', 0, 'assets/icons-30/For-hire-category-icon-dark-yellow-30.webp', '#9B59B6', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15'),
(24, 5, 'For Hire', 'Goods and Services', 'goods-and-services', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/For-hire-category-icon-green-30.webp', '#9B59B6', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-11 12:59:15');

-- --------------------------------------------------------

--
-- Table structure for table `transactions`
--

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
-- Indexes for table `admin_settings`
--
ALTER TABLE `admin_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `idx_setting_key` (`setting_key`);

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
-- AUTO_INCREMENT for table `admin_settings`
--
ALTER TABLE `admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=710;

--
-- AUTO_INCREMENT for table `banned_words`
--
ALTER TABLE `banned_words`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=46;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `moderation_log`
--
ALTER TABLE `moderation_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_revisions`
--
ALTER TABLE `post_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `subcategories`
--
ALTER TABLE `subcategories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
