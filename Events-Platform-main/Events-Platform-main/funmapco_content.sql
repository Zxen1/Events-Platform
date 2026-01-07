-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jan 03, 2026 at 01:54 AM
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
-- Database: `funmapco_content`
--

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
-- Table structure for table `members`
--

CREATE TABLE `members` (
  `id` int(11) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `username_key` varchar(255) DEFAULT NULL,
  `account_email` varchar(255) NOT NULL,
  `avatar_file` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `map_lighting` varchar(20) DEFAULT 'day',
  `map_style` varchar(20) DEFAULT 'standard',
  `favorites` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `recent` text CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `backup_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `members`
--

INSERT INTO `members` (`id`, `username`, `username_key`, `account_email`, `avatar_file`, `password_hash`, `map_lighting`, `map_style`, `favorites`, `recent`, `country`, `hidden`, `deleted_at`, `backup_json`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'administrator', 'admin@funmap.com', '2-avatar.png', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', NULL, NULL, '[123,456,789]', '[{\"post_id\":456,\"viewed_at\":\"2025-12-28 12:34:56\"},{\"post_id\":123,\"viewed_at\":\"2025-12-28 11:02:10\"}]', NULL, 0, NULL, NULL, '2025-12-27 17:34:01', '2025-12-28 14:39:21'),
(2, 'Test', 'test', 'test@funmap.com', '0-avatar.png', '$2y$10$HGrZ8HMv6aPzQVGgXUN1yu6iWyGJwlvg2QtaXvK0G530OCLgvJFlu', 'dawn', 'standard', NULL, NULL, 'Australia', 0, NULL, NULL, '2025-12-30 04:51:12', '2025-12-30 18:17:06'),
(3, 'Test2', 'test2', 'test2@funmap.com', '3-avatar.png', '$2y$10$ZduCC1xwBOB.cg3xsWTIN.9WeHuoSUzMpcwHu4ckATtO.SqWjzdRS', 'day', 'standard', NULL, NULL, 'Australia', 0, NULL, NULL, '2025-12-30 13:49:07', '2025-12-30 14:03:37'),
(4, 'Test 3', 'test-3', 'test3@funmap.com', '4-avatar.png', '$2y$10$Y7PMuzUA.m8AffNIx3sgke.M8MrHmPymJ7xdw5ZeN7JxciZjsGyLy', 'night', 'standard', NULL, NULL, 'au', 0, NULL, NULL, '2026-01-01 00:10:15', '2026-01-01 00:31:45');

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
  `post_key` varchar(255) DEFAULT NULL,
  `member_id` int(11) NOT NULL,
  `member_name` varchar(255) DEFAULT NULL,
  `subcategory_key` varchar(255) NOT NULL,
  `loc_qty` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `visibility` enum('paused','active','expired') DEFAULT 'paused',
  `moderation_status` enum('pending','clean','blurred','hidden') DEFAULT 'pending',
  `flag_reason` text DEFAULT NULL,
  `checkout_title` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `post_key`, `member_id`, `member_name`, `subcategory_key`, `loc_qty`, `visibility`, `moderation_status`, `flag_reason`, `checkout_title`, `payment_status`, `expires_at`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, NULL, 1, 'Administrator', 'Live Gigs', 1, 'paused', 'pending', NULL, NULL, 'pending', NULL, NULL, '2025-12-31 16:29:46', '2025-12-31 16:29:46'),
(2, NULL, 1, 'Administrator', 'Live Gigs', 1, 'paused', 'pending', NULL, NULL, 'pending', NULL, NULL, '2025-12-31 16:32:00', '2025-12-31 16:32:00'),
(3, NULL, 4, 'Test 3', 'Test 2 Subcategory', 1, 'paused', 'pending', NULL, NULL, 'pending', NULL, NULL, '2026-01-01 06:12:51', '2026-01-01 06:12:51'),
(4, NULL, 4, 'Test 3', 'Live Gigs', 1, 'paused', 'pending', NULL, NULL, 'pending', NULL, NULL, '2026-01-01 06:52:46', '2026-01-01 06:52:46');

-- --------------------------------------------------------

--
-- Table structure for table `post_item_pricing`
--

CREATE TABLE `post_item_pricing` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `item_name` varchar(200) DEFAULT NULL,
  `item_variant` varchar(100) DEFAULT NULL,
  `item_price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_map_cards`
--

CREATE TABLE `post_map_cards` (
  `id` int(11) NOT NULL,
  `post_id` int(11) NOT NULL,
  `subcategory_key` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `media_ids` text DEFAULT NULL,
  `custom_text` varchar(500) DEFAULT NULL,
  `custom_textarea` text DEFAULT NULL,
  `custom_dropdown` varchar(255) DEFAULT NULL,
  `custom_radio` varchar(255) DEFAULT NULL,
  `public_email` varchar(255) DEFAULT NULL,
  `phone_prefix` varchar(20) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `address_line` varchar(500) DEFAULT NULL,
  `city` varchar(200) DEFAULT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `country_code` varchar(2) DEFAULT NULL,
  `amenities` text DEFAULT NULL,
  `website_url` varchar(500) DEFAULT NULL,
  `tickets_url` varchar(500) DEFAULT NULL,
  `coupon_code` varchar(100) DEFAULT NULL,
  `checkout_title` varchar(255) DEFAULT NULL,
  `session_summary` varchar(255) DEFAULT NULL,
  `price_summary` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_media`
--

CREATE TABLE `post_media` (
  `id` int(11) NOT NULL,
  `member_id` int(11) DEFAULT NULL,
  `post_id` int(11) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_url` varchar(500) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `uploaded_at` datetime DEFAULT current_timestamp(),
  `backup_json` longtext DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `data_json` longtext DEFAULT NULL CHECK (json_valid(`data_json`)),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_sessions`
--

CREATE TABLE `post_sessions` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `session_date` date DEFAULT NULL,
  `session_time` time DEFAULT NULL,
  `ticket_group_key` varchar(50) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_ticket_pricing`
--

CREATE TABLE `post_ticket_pricing` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `ticket_group_key` varchar(50) NOT NULL,
  `seating_area` varchar(100) DEFAULT NULL,
  `pricing_tier` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
-- Indexes for table `commissions`
--
ALTER TABLE `commissions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transaction_id` (`transaction_id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `member_id` (`member_id`);

--
-- Indexes for table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `members`
--
ALTER TABLE `members`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_account_email` (`account_email`),
  ADD UNIQUE KEY `idx_username_key` (`username_key`),
  ADD KEY `idx_deleted_at` (`deleted_at`);

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
  ADD KEY `idx_member_id` (`member_id`),
  ADD KEY `idx_subcategory_key` (`subcategory_key`),
  ADD KEY `idx_status` (`visibility`,`moderation_status`),
  ADD KEY `idx_deleted_at` (`deleted_at`),
  ADD KEY `idx_payment_status` (`payment_status`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_active_posts` (`visibility`,`deleted_at`,`payment_status`);

--
-- Indexes for table `post_item_pricing`
--
ALTER TABLE `post_item_pricing`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `price` (`item_price`);

--
-- Indexes for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_post_id` (`post_id`),
  ADD KEY `idx_subcategory_key` (`subcategory_key`),
  ADD KEY `idx_lat_lng` (`latitude`,`longitude`),
  ADD KEY `idx_country_code` (`country_code`);

--
-- Indexes for table `post_media`
--
ALTER TABLE `post_media`
  ADD PRIMARY KEY (`id`),
  ADD KEY `member_id` (`member_id`),
  ADD KEY `post_id` (`post_id`);

--
-- Indexes for table `post_revisions`
--
ALTER TABLE `post_revisions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `post_id` (`post_id`),
  ADD KEY `editor_id` (`editor_id`);

--
-- Indexes for table `post_sessions`
--
ALTER TABLE `post_sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `idx_session_date` (`session_date`),
  ADD KEY `idx_ticket_group_key` (`ticket_group_key`);

--
-- Indexes for table `post_ticket_pricing`
--
ALTER TABLE `post_ticket_pricing`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_group_line` (`map_card_id`,`ticket_group_key`,`seating_area`,`pricing_tier`,`price`,`currency`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `idx_price_currency` (`price`,`currency`),
  ADD KEY `idx_ticket_group_key` (`ticket_group_key`);

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
-- AUTO_INCREMENT for table `commissions`
--
ALTER TABLE `commissions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `post_item_pricing`
--
ALTER TABLE `post_item_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `post_media`
--
ALTER TABLE `post_media`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `post_revisions`
--
ALTER TABLE `post_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_sessions`
--
ALTER TABLE `post_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_ticket_pricing`
--
ALTER TABLE `post_ticket_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `posts`
--
ALTER TABLE `posts`
  ADD CONSTRAINT `fk_posts_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `post_item_pricing`
--
ALTER TABLE `post_item_pricing`
  ADD CONSTRAINT `fk_post_children_map_card` FOREIGN KEY (`map_card_id`) REFERENCES `post_map_cards` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
  ADD CONSTRAINT `fk_post_map_cards_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `post_media`
--
ALTER TABLE `post_media`
  ADD CONSTRAINT `fk_post_media_member` FOREIGN KEY (`member_id`) REFERENCES `members` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_post_media_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `post_revisions`
--
ALTER TABLE `post_revisions`
  ADD CONSTRAINT `fk_post_revisions_post` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
