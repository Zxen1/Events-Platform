-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jan 23, 2026 at 05:32 AM
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
  `description` mediumtext DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `duration_days` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admins`
--

CREATE TABLE `admins` (
  `id` int(11) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `username_key` varchar(255) DEFAULT NULL,
  `account_email` varchar(255) NOT NULL,
  `avatar_file` varchar(255) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `map_lighting` varchar(20) DEFAULT 'day',
  `map_style` varchar(20) DEFAULT 'standard',
  `favorites` text DEFAULT NULL,
  `recent` text DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `preferred_currency` varchar(3) DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `backup_json` longtext DEFAULT NULL,
  `filters_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `filters_hash` char(40) DEFAULT NULL,
  `filters_version` int(11) NOT NULL DEFAULT 1,
  `filters_updated_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admins`
--

INSERT INTO `admins` (`id`, `username`, `username_key`, `account_email`, `avatar_file`, `password_hash`, `map_lighting`, `map_style`, `favorites`, `recent`, `country`, `preferred_currency`, `hidden`, `deleted_at`, `backup_json`, `filters_json`, `filters_hash`, `filters_version`, `filters_updated_at`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'administrator', 'admin@funmap.com', '00000001-avatar.png', '$2a$12$rVFSDdsbofrzJIphF2mx4ey3egEJp801Gp0OfLyWbydz15jUZ4mhK', 'dusk', 'standard', '[123,456,789]', '[{\"post_id\":456,\"viewed_at\":\"2025-12-28 12:34:56\"},{\"post_id\":123,\"viewed_at\":\"2025-12-28 11:02:10\"}]', NULL, NULL, 0, NULL, NULL, '{\"keyword\":\"\",\"minPrice\":\"\",\"maxPrice\":\"\",\"dateStart\":null,\"dateEnd\":null,\"expired\":false,\"favourites\":false,\"sort\":\"nearest\",\"categories\":{\"What\'s On\":{\"enabled\":true,\"subs\":{\"Live Gigs\":true,\"Screenings\":true,\"Live Theatre\":true,\"Artwork\":true,\"Live Sport\":true,\"Other Events\":true,\"Festivals\":true,\"Markets\":true}},\"For Hire\":{\"enabled\":true,\"subs\":{\"Goods and Services\":true,\"Performers\":true,\"Staff\":true}},\"Learning\":{\"enabled\":true,\"subs\":{\"Courses\":true,\"Education Centres\":true,\"Other Learning\":true,\"Tutors\":true}},\"Opportunities\":{\"enabled\":true,\"subs\":{\"Clubs\":true,\"Competitions\":true,\"Jobs\":true,\"Other Opportunities\":true,\"Screen Auditions\":true,\"Stage Auditions\":true,\"Volunteers\":true}},\"Buy and Sell\":{\"enabled\":true,\"subs\":{\"Freebies\":true,\"Wanted\":true,\"For Sale\":true}},\"Eat & Drink\":{\"enabled\":true,\"subs\":{\"Restaurants\":true,\"Bars & Pubs\":true,\"Cafes\":true,\"Nightclubs\":true,\"Takeaway\":true,\"Other Eat & Drink\":true,\"Venues\":true}},\"Test\":{\"enabled\":true,\"subs\":{\"Test Subcategory\":true}},\"Stay\":{\"enabled\":true,\"subs\":{\"Hotels & Resorts\":true,\"Motels\":true,\"Hostels\":true,\"Holiday Rentals\":true,\"Caravan & Camping\":true,\"Bed & Breakfast\":true,\"Other Stay\":true}},\"Get Around\":{\"enabled\":true,\"subs\":{\"Car Hire\":true,\"Bike & Scooter\":true,\"Tours & Experiences\":true,\"Transfers\":true,\"Other Transport\":true}}},\"map\":null,\"subcategoryKeys\":[\"live-gigs\",\"screenings\",\"live-theatre\",\"artwork\",\"live-sport\",\"other-events\",\"festivals\",\"markets\",\"goods-and-services\",\"performers\",\"staff\",\"courses\",\"education-centres\",\"other-learning\",\"tutors\",\"clubs\",\"competitions\",\"jobs\",\"other-opportunities\",\"screen-auditions\",\"stage-auditions\",\"volunteers\",\"freebies\",\"wanted\",\"for-sale\",\"restaurants\",\"bars-pubs\",\"cafes\",\"nightclubs\",\"takeaway\",\"other-eat-drink\",\"venues\",\"test-subcategory\",\"hotels-resorts\",\"motels\",\"hostels\",\"holiday-rentals\",\"caravan-camping\",\"bed-breakfast\",\"other-stay\",\"car-hire\",\"bike-scooter\",\"tours-experiences\",\"transfers\",\"other-transport\"]}', '08f590b9cdb723abf712b1f5afbbd0caf4cb96af', 1, '2026-01-23 00:31:44', '2025-10-22 01:00:41', '2026-01-23 00:31:44');

-- --------------------------------------------------------

--
-- Table structure for table `admin_messages`
--

CREATE TABLE `admin_messages` (
  `id` int(11) NOT NULL,
  `message_name` varchar(100) DEFAULT NULL,
  `message_key` varchar(100) NOT NULL COMMENT 'Unique identifier for the message',
  `container_key` varchar(50) DEFAULT NULL COMMENT 'References layout_containers.container_key',
  `message_text` text NOT NULL COMMENT 'The actual message text',
  `message_description` varchar(255) DEFAULT NULL COMMENT 'Admin-facing description of where/when used',
  `message_type` enum('toast','error','success','warning','confirm','modal','email','label') NOT NULL DEFAULT 'toast' COMMENT 'Type of message',
  `message_category` varchar(50) DEFAULT NULL COMMENT 'Category grouping (auth, post, admin, member, etc)',
  `supports_html` tinyint(1) DEFAULT 0 COMMENT 'Whether HTML is allowed in this message',
  `placeholders` text DEFAULT NULL COMMENT 'JSON array of available placeholders like {name}, {field}',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'Enable/disable this message',
  `is_visible` tinyint(1) DEFAULT 1 COMMENT 'Show/hide from users',
  `is_deletable` tinyint(1) DEFAULT 0 COMMENT 'Allow deletion (0=prevent delete, 1=allow delete)',
  `display_duration` int(11) DEFAULT 3000 COMMENT 'Duration in ms for toast messages (null = use default)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_messages`
--

INSERT INTO `admin_messages` (`id`, `message_name`, `message_key`, `container_key`, `message_text`, `message_description`, `message_type`, `message_category`, `supports_html`, `placeholders`, `is_active`, `is_visible`, `is_deletable`, `display_duration`, `created_at`, `updated_at`) VALUES
(200, 'Login Success Message', 'msg_auth_login_success', 'msg_member', 'Welcome back, {name}!', 'Shown after successful login', 'success', 'auth', 0, '[\"name\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(201, 'Logout Success Message', 'msg_auth_logout_success', 'msg_member', 'You have been logged out.', 'Shown after logout', 'success', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(202, 'Login Fields Empty Message', 'msg_auth_login_empty', 'msg_member', 'Enter your email and password.', 'When login fields are empty', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(203, 'Incorrect Credentials Message', 'msg_auth_login_incorrect', 'msg_member', 'Incorrect email or password. Try again.', 'When credentials are wrong', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(204, 'Login Failed Message', 'msg_auth_login_failed', 'msg_member', 'Unable to verify credentials. Please try again.', 'When login request fails', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(205, 'Registration Success Message', 'msg_auth_register_success', 'msg_member', 'Welcome, {name}!', 'Shown after successful registration', 'success', 'auth', 0, '[\"name\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(206, 'Registration Fields Empty Message', 'msg_auth_register_empty', 'msg_member', 'Please complete all required fields.', 'When registration fields are empty', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(207, 'Password Too Short Message', 'msg_auth_register_password_short', 'msg_member', 'Password must be at least 4 characters.', 'Password too short', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(208, 'Passwords Don\'t Match Message', 'msg_auth_register_password_mismatch', 'msg_member', 'Passwords do not match.', 'When passwords don\'t match', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(209, 'Registration Failed Message', 'msg_auth_register_failed', 'msg_member', 'Registration failed.', 'When registration request fails', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(300, 'Settings Saved Message', 'msg_admin_saved', 'msg_admin', 'Saved', 'Shown when admin settings are saved', 'success', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(301, 'Changes Discarded Message', 'msg_admin_discarded', 'msg_admin', 'Changes Discarded', 'Shown when changes are discarded', 'toast', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(302, 'Server Connection Error Message', 'msg_admin_save_error_network', 'msg_admin', 'Unable to reach the server. Please try again.', 'When save request fails', 'error', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(303, 'Save Response Error Message', 'msg_admin_save_error_response', 'msg_admin', 'Unexpected response while saving changes.', 'When server returns invalid response', 'error', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(304, 'Unsaved Changes Dialog Title Message', 'msg_admin_unsaved_title', 'msg_admin', 'Unsaved Changes', 'Title of unsaved changes dialog', 'label', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(305, 'Unsaved Changes Dialog Message', 'msg_admin_unsaved_message', 'msg_admin', 'You have unsaved changes. Save before closing the admin panel?', 'Message in unsaved changes dialog', 'label', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(210, 'Listing Posted Successfully Message', 'msg_post_create_success', 'msg_member', 'Your listing has been posted!', 'When post is created successfully', 'success', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(211, 'Listing Posted With Images Message', 'msg_post_create_with_images', 'msg_member', 'Your listing and images have been posted!', 'When post with images is created', 'success', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(212, 'Listing Post Failed Message', 'msg_post_create_error', 'msg_member', 'Unable to post your listing. Please try again.', 'When post creation fails', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(213, 'Category Not Selected Message', 'msg_post_create_no_category', 'msg_member', 'Select a category and subcategory before posting.', 'When category not selected', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(214, 'Dropdown Selection Required Message', 'msg_post_validation_select', 'msg_member', 'Select an option for {field}.', 'Dropdown validation error', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(215, 'Field Required Message', 'msg_post_validation_required', 'msg_member', 'Enter a value for {field}.', 'Required field validation', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(216, 'Location Required Message', 'msg_post_validation_location', 'msg_member', 'Select a location for {field}.', 'Location field validation', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(306, 'Delete Item Confirmation Message', 'msg_confirm_delete_item', 'msg_admin', 'Are you sure you want to delete this item?', 'Generic delete confirmation', 'confirm', 'general', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(217, 'Delete Venue Confirmation Message', 'msg_confirm_delete_venue', 'msg_member', 'Are you sure you want to remove this venue?', 'Remove venue confirmation', 'confirm', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(307, 'Console Filter Enabled Confirmation Message', 'msg_confirm_console_filter_enable', 'msg_admin', 'Console filter will be enabled on next page load. Reload now?', 'Enable console filter prompt', 'confirm', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(308, 'Console Filter Disabled Confirmation Message', 'msg_confirm_console_filter_disable', 'msg_admin', 'Console filter will be disabled on next page load. Reload now?', 'Disable console filter prompt', 'confirm', 'admin', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(100, 'Map Zoom Required Message', 'msg_map_zoom_required', 'msg_user', 'Zoom the map to see posts', 'Shown when zoom level too low', 'toast', 'map', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 05:53:29'),
(218, 'No Listings Found Message', 'msg_posts_empty_state', 'msg_member', 'There are no posts here. Try moving the map or changing your filter settings.', 'Empty posts message', 'label', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-29 04:11:11'),
(246, 'Terms and Conditions Message', 'msg-terms-conditions', 'msg_member', '<h3>Terms and Conditions</h3>\n\n<p>By submitting a post to this platform, you agree to the following terms and conditions:</p>\n\n<h4>1. Content Responsibility</h4>\n<p>You are solely responsible for all content you post, including text, images, and any other materials. You warrant that you own or have the necessary rights to all content you submit.</p>\n\n<h4>2. Accurate Information</h4>\n<p>You agree to provide accurate, current, and complete information in your posts. Misleading, false, or fraudulent information is strictly prohibited.</p>\n\n<h4>3. Prohibited Content</h4>\n<p>You agree not to post content that:</p>\n<ul>\n<li>Is illegal, harmful, or violates any applicable laws or regulations</li>\n<li>Infringes on intellectual property rights of others</li>\n<li>Contains spam, unsolicited advertising, or promotional materials</li>\n<li>Is defamatory, harassing, abusive, or discriminatory</li>\n<li>Contains viruses, malware, or other harmful code</li>\n<li>Violates privacy rights of others</li>\n</ul>\n\n<h4>4. Platform Rules</h4>\n<p>You agree to comply with all platform rules and guidelines. The platform reserves the right to remove any content that violates these terms without notice.</p>\n\n<h4>5. Moderation</h4>\n<p>All posts are subject to review and moderation. The platform reserves the right to reject, edit, or remove any content at its sole discretion.</p>\n\n<h4>6. Payment and Fees</h4>\n<p>If applicable, you agree to pay all fees associated with your post submission. Fees are non-refundable unless otherwise stated.</p>\n\n<h4>7. Limitation of Liability</h4>\n<p>The platform is not responsible for any loss, damage, or liability arising from your use of the service or content posted by you or other users.</p>\n\n<h4>8. Indemnification</h4>\n<p>You agree to indemnify and hold harmless the platform, its operators, and affiliates from any claims, damages, or expenses arising from your content or violation of these terms.</p>\n\n<h4>9. Changes to Terms</h4>\n<p>These terms may be updated at any time. Continued use of the platform constitutes acceptance of any modified terms.</p>\n\n<h4>10. Account Termination</h4>\n<p>The platform reserves the right to suspend or terminate your account and remove your content if you violate these terms.</p>\n\n<p><strong>By checking the box below, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</strong></p>', 'Terms and conditions text shown in modal for member forms', 'modal', 'member', 1, NULL, 1, 1, 0, 0, '2025-12-08 16:16:29', '2025-12-29 04:11:11'),
(219, 'Recent Footer Message', 'msg_recent_footer', 'msg_member', 'When you log in as a member, I can remember your recent posts and favourites on any device.', 'Reminder shown to encourage member login', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(220, 'Member Unsaved Changes Dialog Title Message', 'msg_member_unsaved_title', 'msg_member', 'Unsaved Changes', 'Title of member unsaved changes dialog', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(221, 'Member Unsaved Changes Dialog Message', 'msg_member_unsaved_message', 'msg_member', 'You have unsaved changes. Save before closing the member panel?', 'Message in member unsaved changes dialog', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(222, 'Listing Submission Confirmation Error Message', 'msg_post_submit_confirm_error', 'msg_member', 'Unable to confirm your listing submission.', 'When post response cannot be read', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(223, 'Form Loading Message', 'msg_post_loading_form', 'msg_member', 'Loading form fields…', 'Shown while loading form fields', 'toast', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(224, 'Form Load Failed Message', 'msg_post_form_load_error', 'msg_member', 'We couldn\'t load the latest form fields. You can continue with the defaults for now.', 'When form fields fail to load', 'warning', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(225, 'Radio Selection Required Message', 'msg_post_validation_choose', 'msg_member', 'Choose an option for {field}.', 'Radio button validation error', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(226, 'File Upload Required Message', 'msg_post_validation_file_required', 'msg_member', 'Add at least one file for {field}.', 'File upload validation', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(227, 'Pricing Details Required Message', 'msg_post_validation_pricing', 'msg_member', 'Provide pricing details for {field}.', 'Pricing validation error', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(228, 'Price Tiers Required Message', 'msg_post_validation_pricing_tiers', 'msg_member', 'Add at least one price tier for {field}.', 'Pricing tiers validation', 'error', 'post', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(309, 'Add Field Confirmation Message', 'msg_confirm_add_field', 'msg_admin', 'Add a new field to {subcategory}?', 'Confirmation to add new field', 'confirm', 'formbuilder', 0, '[\"subcategory\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(310, 'Add Subcategory Confirmation Message', 'msg_confirm_add_subcategory', 'msg_admin', 'Add a new subcategory to {category}?', 'Confirmation to add new subcategory', 'confirm', 'formbuilder', 0, '[\"category\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(311, 'Add Category Confirmation Message', 'msg_confirm_add_category', 'msg_admin', 'Add a new category to the formbuilder?', 'Confirmation to add new category', 'confirm', 'formbuilder', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(312, 'Delete Confirmation Dialog Title Message', 'msg_confirm_delete_title', 'msg_admin', 'Delete item?', 'Title for delete confirmation dialog', 'label', 'formbuilder', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(313, 'Cancel Button Label Message', 'msg_button_cancel', 'msg_admin', 'Cancel', 'Cancel button text', 'label', 'general', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(314, 'Delete Button Label Message', 'msg_button_delete', 'msg_admin', 'Delete', 'Delete button text', 'label', 'general', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(315, 'Save Button Label Message', 'msg_button_save', 'msg_admin', 'Save', 'Save button text', 'label', 'general', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(316, 'Discard Changes Button Label Message', 'msg_button_discard', 'msg_admin', 'Discard Changes', 'Discard changes button text', 'label', 'general', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(317, 'No Icons Found Error Message', 'msg_error_no_icons', 'msg_admin', 'No icons found.<br><br>Please select the icon folder in the Admin Settings Tab.<br><br>Example: <code>assets/icons</code>', 'Shown when icon folder is empty or invalid', 'error', 'admin', 1, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(229, 'Currency Required Error Message', 'msg_error_currency_required', 'msg_member', 'Please select a currency before entering a price.', 'Currency validation for pricing', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(230, 'Duplicate Session Time Error Message', 'msg_error_duplicate_session_time', 'msg_member', 'There is already a session for that time.', 'Duplicate session time validation', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-12-29 04:11:11'),
(231, 'Member Create Intro Message', 'msg_member_create_intro', 'msg_member', 'Complete the form below to submit your post.', 'Intro text shown in member create post section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(329, 'Delete Checkout Option Title', 'msg_confirm_delete_checkout_option_title', 'msg_admin', 'Delete Checkout Option', 'Title for checkout option delete confirmation dialog', '', 'confirm', 0, NULL, 1, 1, 0, NULL, '2025-12-02 06:25:33', '2025-12-29 04:20:11'),
(232, 'Member Post Listing Button', 'msg_member_post_listing', 'msg_member', 'Submit Post', 'Button text to submit a new listing', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(233, 'Member Tab Create', 'msg_member_tab_create', 'msg_member', 'Create Post', 'Tab label for create post section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(234, 'Member Tab My Posts', 'msg_member_tab_myposts', 'msg_member', 'My Posts', 'Tab label for my posts section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(235, 'Member Tab Profile', 'msg_member_tab_profile', 'msg_member', 'Profile', 'Tab label for profile section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(236, 'Member Auth Login Tab', 'msg_member_auth_login', 'msg_member', 'Login', 'Login tab label in member profile section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(237, 'Member Auth Register Tab', 'msg_member_auth_register', 'msg_member', 'Support FunMap', 'Register tab label in member profile section', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(238, 'Member Label Email', 'msg_member_label_email', 'msg_member', 'Email', 'Email field label in member forms', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(239, 'Member Label Password', 'msg_member_label_password', 'msg_member', 'Password', 'Password field label in member forms', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(240, 'Member Button Log In', 'msg_member_btn_log_in', 'msg_member', 'Log In', 'Log in button text', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(241, 'Member Label Display Name', 'msg_member_label_display_name', 'msg_member', 'Display Name', 'Display name field label in registration form', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(242, 'Member Label Avatar URL', 'msg_member_label_avatar_url', 'msg_member', 'Avatar URL', 'Avatar URL field label in registration form', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(243, 'Member Button Create Account', 'msg_member_btn_create_account', 'msg_member', 'Create Account', 'Create account button text', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(244, 'Member Button Log Out', 'msg_member_btn_log_out', 'msg_member', 'Log Out', 'Log out button text', 'label', 'member', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-12-29 04:11:11'),
(245, 'Link Copied Notification', 'msg_link_copied', 'msg_member', 'Link Copied', 'Shown when user copies a post link', 'toast', 'member', 0, NULL, 1, 1, 0, 2000, '2025-11-15 06:34:46', '2025-12-29 04:11:11'),
(318, 'Confirm Button', 'msg_button_confirm', 'msg_admin', 'Confirm', 'Confirm button label', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 06:34:46', '2025-12-29 04:11:11'),
(319, 'No Icon Label', 'msg_label_no_icon', 'msg_admin', 'No Icon', 'Label shown when no icon is selected', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(320, 'Change Icon Button', 'msg_button_change_icon', 'msg_admin', 'Change Icon', 'Button to change existing icon', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(321, 'Choose Icon Button', 'msg_button_choose_icon', 'msg_admin', 'Choose Icon', 'Button to choose new icon', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(322, 'Add Subcategory Button', 'msg_button_add_subcategory', 'msg_admin', 'Add Subcategory', 'Button to add new subcategory', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(323, 'Delete Category Button', 'msg_button_delete_category', 'msg_admin', 'Delete Category', 'Button to delete category', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(324, 'Delete Subcategory Button', 'msg_button_delete_subcategory', 'msg_admin', 'Delete Subcategory', 'Button to delete subcategory', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(325, 'Add Field Button', 'msg_button_add_field', 'msg_admin', 'Add Field', 'Button to add new field', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(326, 'Hide Category Label', 'msg_label_hide_category', 'msg_admin', 'Hide Category', 'Label for hide category toggle', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(327, 'Hide Subcategory Label', 'msg_label_hide_subcategory', 'msg_admin', 'Hide Subcategory', 'Label for hide subcategory toggle', 'label', 'admin', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-12-29 04:11:11'),
(330, 'Delete Checkout Option Message', 'msg_confirm_delete_checkout_option', 'msg_admin', 'Are you sure you want to delete this checkout option?', 'Message for checkout option delete confirmation dialog', '', 'confirm', 0, NULL, 1, 1, 0, NULL, '2025-12-02 06:25:33', '2025-12-29 04:20:11'),
(328, 'Admin Submit Without Payment Button', 'msg_admin_submit_without_payment', 'msg_admin', 'Admin: Submit without Payment', 'Button text for admin to submit post without payment', 'label', 'admin', 0, NULL, 1, 1, 0, 0, '2025-12-04 04:08:15', '2025-12-29 04:11:11'),
(247, 'Registration Invalid Email', 'msg_auth_register_email_invalid', 'msg_member', 'Please enter a valid email address.', 'Register: invalid email format', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-12-24 10:12:56', '2025-12-29 04:11:11'),
(248, 'Registration Email Taken', 'msg_auth_register_email_taken', 'msg_member', 'That email is already registered.', 'Register: duplicate email', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2025-12-24 10:12:56', '2025-12-29 04:11:11'),
(249, 'Support FunMap Explainer (Member Tab)', 'msg_member_supporter_message', 'msg_member', 'Thank you for supporting FunMap.com!\n<p>\nTo protect this site from spambots and ensure all our members and posts are genuine, we have implemented a paywall for registration.\n<p>\nYou can become a member in two ways:\n<br>1. Create a post\n<br>2. Complete this registration form\n<p>\nYour site settings, favorites and search history will be remembered across all devices when you are logged in.\n<p>\nYour contribution will help us maintain and grow this awesome platform.\n', 'Shown at top of Support FunMap tab above amount/email', 'label', 'member', 0, NULL, 1, 1, 0, NULL, '2025-12-27 12:48:54', '2025-12-29 04:11:11'),
(250, 'Supporter Payment Required', 'msg_supporter_payment_required', 'msg_member', 'Supporter signup is not available until the payment gateway is active.', 'Shown when Support FunMap submit is blocked because payment is not approved', 'error', 'member', 0, NULL, 1, 1, 0, 3000, '2025-12-27 12:53:58', '2025-12-29 04:11:11'),
(251, 'Terms Agreement Required', 'msg_post_terms_required', 'msg_member', 'Please agree to the terms and conditions.', 'When terms checkbox not checked before posting', 'error', 'post', 0, NULL, 1, 1, 0, 3000, '2025-12-29 18:42:33', '2025-12-29 18:48:26'),
(252, 'Profile Hidden Updated', 'msg_profile_hidden_updated', 'msg_member', 'Account visibility updated.', 'When hide account toggle is changed', 'success', 'profile', 0, NULL, 1, 1, 0, 3000, '2025-12-30 03:09:35', '2025-12-30 03:09:35'),
(253, 'Confirm Delete Account', 'msg_confirm_delete_account', 'msg_member', 'Delete the account \"{name}\"? This action cannot be undone.', 'Confirmation dialog for account deletion', 'confirm', 'profile', 0, '[\"name\"]', 1, 1, 0, NULL, '2025-12-30 03:09:35', '2025-12-30 03:09:35'),
(254, 'Account Deleted', 'msg_account_deleted', 'msg_member', 'Your account has been deleted.', 'After successful account deletion', 'success', 'profile', 0, NULL, 1, 1, 0, 3000, '2025-12-30 03:09:35', '2025-12-30 03:09:35'),
(255, 'Account Delete Failed', 'msg_account_delete_failed', 'msg_member', 'Unable to delete account. Please try again.', 'When account deletion fails', 'error', 'profile', 0, NULL, 1, 1, 0, 3000, '2025-12-30 03:09:35', '2025-12-30 03:09:35'),
(256, 'Active Posts Block Delete', 'msg_delete_blocked_active_posts', 'msg_member', 'You have {count} active post(s). Please delete them before deleting your account.', 'Shown when member tries to delete account but has active posts', 'error', 'profile', 0, '[\"count\"]', 1, 1, 0, 5000, '2025-12-30 03:25:47', '2025-12-30 03:25:47'),
(257, 'Account Scheduled Delete', 'msg_account_scheduled_delete', 'msg_member', 'Your account has been scheduled for deletion. You have 30 days to reactivate by logging in.', 'Shown after soft delete is initiated', 'success', 'profile', 0, NULL, 1, 1, 0, 5000, '2025-12-30 03:25:47', '2025-12-30 03:25:47'),
(258, 'Account Reactivated', 'msg_account_reactivated', 'msg_member', 'Welcome back! Your account has been reactivated.', 'Shown when a soft-deleted member logs back in', 'success', 'profile', 0, NULL, 1, 1, 0, 3000, '2025-12-30 03:25:47', '2025-12-30 03:25:47'),
(332, 'Password Too Short', 'msg_auth_password_too_short', 'msg_member', 'Password must be at least {min} characters.', 'Password below minimum length', 'error', 'auth', 0, '[\"min\"]', 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(333, 'Password Too Long', 'msg_auth_password_too_long', 'msg_member', 'Password must be no more than {max} characters.', 'Password above maximum length', 'error', 'auth', 0, '[\"max\"]', 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(334, 'Password Requires Lowercase', 'msg_auth_password_require_lowercase', 'msg_member', 'Password must contain a lowercase letter (a-z).', 'Password missing lowercase', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(335, 'Password Requires Uppercase', 'msg_auth_password_require_uppercase', 'msg_member', 'Password must contain an uppercase letter (A-Z).', 'Password missing uppercase', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(336, 'Password Requires Number', 'msg_auth_password_require_number', 'msg_member', 'Password must contain a number (0-9).', 'Password missing number', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(337, 'Password Requires Symbol', 'msg_auth_password_require_symbol', 'msg_member', 'Password must contain a special character (!@#$%^&*).', 'Password missing symbol', 'error', 'auth', 0, NULL, 1, 1, 0, 3000, '2026-01-03 06:44:21', '2026-01-03 06:44:21'),
(259, 'Location Explainer Message', 'msg_post_location_explainer', 'msg_member', 'This post can appear in multiple locations around the world. \nYour second location onwards is charged at a reduced rate. ', 'Shown when user selects multiple locations in post creation', 'label', 'post', 0, NULL, 1, 1, 0, 3000, '2026-01-03 09:47:18', '2026-01-05 19:15:40'),
(340, 'Timezone System Info', 'msg_timezone_info', 'msg_admin', 'Event times display exactly as entered by the poster in the event\'s local timezone. The \"Time Remaining\" and \"Time Expired\" countdowns are calculated automatically using the visitor\'s browser time. Listings remain visible until the event date ends in UTC-12 (the world\'s final timezone), giving all locations maximum visibility before expiration.', 'Explains how the timezone system works', 'label', 'timezone', 0, NULL, 1, 1, 0, NULL, '2026-01-06 02:22:41', '2026-01-06 02:22:41');

-- --------------------------------------------------------

--
-- Table structure for table `admin_settings`
--

CREATE TABLE `admin_settings` (
  `id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','boolean','integer','decimal','json','dropdown') DEFAULT 'string',
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `admin_settings`
--

INSERT INTO `admin_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `created_at`, `updated_at`) VALUES
(1, 'website_name', 'Funmap.com', 'string', NULL, '2025-12-19 21:56:40', '2025-12-30 05:15:01'),
(2, 'website_tagline', 'Find Stuff To Do', 'string', NULL, '2025-12-19 21:56:47', '2025-12-20 03:30:34'),
(3, 'website_currency', 'USD', 'string', NULL, '2025-12-19 22:24:32', '2026-01-10 01:54:33'),
(4, 'contact_email', '', 'string', 'Admin contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(5, 'support_email', '', 'string', 'Support contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(6, 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(7, 'welcome_enabled', 'false', 'boolean', 'Show welcome modal to new users', '2025-11-13 16:17:10', '2025-12-30 15:52:39'),
(8, 'welcome_title', 'Welcome to FunMap', 'string', 'Title shown in the welcome modal', '2025-11-13 16:17:10', '2025-12-08 14:16:17'),
(9, 'welcome_message', '\"<p>Welcome to Funmap! Choose an area on the map to search for events and listings. Click the <svg class=\\\"icon-search\\\" width=\\\"30\\\" height=\\\"30\\\" viewBox=\\\"0 0 24 24\\\" fill=\\\"none\\\" stroke=\\\"currentColor\\\" stroke-width=\\\"2\\\" role=\\\"img\\\" aria-label=\\\"Filters\\\"><circle cx=\\\"11\\\" cy=\\\"11\\\" r=\\\"8\\\"></circle><line x1=\\\"21\\\" y1=\\\"21\\\" x2=\\\"16.65\\\" y2=\\\"16.65\\\"></line></svg> button to refine your search.</p>\"', 'json', 'Main content of the welcome modal (supports HTML and SVG)', '2025-11-13 16:17:10', '2025-12-08 14:16:17'),
(11, 'console_filter', 'false', 'boolean', 'Enable/disable console filter on page load', '2025-11-13 16:17:10', '2025-12-26 07:05:53'),
(19, 'paypal_enabled', 'false', 'boolean', 'Enable PayPal payments', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(20, 'paypal_mode', 'sandbox', 'string', 'PayPal mode: sandbox or live', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(21, 'paypal_client_id', '', 'string', 'PayPal Client ID', '2025-11-13 16:17:10', '2025-12-20 05:49:08'),
(22, 'paypal_secret', NULL, 'string', 'PayPal Secret Key', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(23, 'admin_tab_order', '[\"settings\",\"forms\",\"map\",\"messages\"]', 'json', 'Order of admin panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(24, 'member_tab_order', '[\"create\",\"myposts\",\"profile\"]', 'json', 'Order of member panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(45, 'admin_autosave', 'false', 'string', 'Remember autosave toggle state in admin panel', '2025-12-19 18:12:20', '2026-01-12 00:05:48'),
(47, 'msg_category_user_name', 'User Messages', 'string', NULL, '2025-12-19 19:34:16', '2025-12-23 03:25:59'),
(48, 'msg_category_order', '[\"member\",\"user\",\"admin\",\"email\",\"fieldset-tooltips\"]', 'string', NULL, '2025-12-19 20:18:16', '2025-12-19 20:18:16'),
(50, 'paypal_client_secret', '', 'string', NULL, '2025-12-19 20:52:17', '2025-12-20 05:49:08'),
(61, 'storage_api_key', '4e411191-8bc0-48a1-97ab6fea3ec9-404c-4810', 'string', 'Bunny Storage Zone Password (Read-Only) for API authentication', '2025-12-21 13:33:49', '2025-12-24 05:18:34'),
(62, 'storage_zone_name', 'funmap', 'string', 'Bunny Storage Zone Name', '2025-12-21 13:33:49', '2025-12-21 13:37:03'),
(70, 'countdown_posts', 'true', 'boolean', 'Show countdown/expired time inside posts', '2026-01-06 02:31:16', '2026-01-06 02:31:16'),
(71, 'countdown_postcards', 'true', 'boolean', 'Show countdown/expired time on postcards', '2026-01-06 02:31:16', '2026-01-06 02:31:16'),
(72, 'countdown_postcards_mode', 'soonest_only', 'string', 'all = all postcards, soonest_only = only when using Soonest sort order', '2026-01-06 02:31:16', '2026-01-06 02:31:16'),
(100, 'folder_amenities', 'https://cdn.funmap.com/amenities', 'string', 'Folder path for amenity icons', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(101, 'folder_avatars', 'https://cdn.funmap.com/avatars', 'string', 'Folder path for user avatars', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(102, 'folder_category_icons', 'https://cdn.funmap.com/category-icons', 'string', 'Folder path for category/subcategory icons', '2025-11-13 16:17:10', '2025-12-29 02:44:01'),
(103, 'folder_countries', 'https://cdn.funmap.com/countries', 'string', NULL, '2025-12-28 05:42:49', '2025-12-29 02:44:01'),
(104, 'folder_currencies', 'https://cdn.funmap.com/currencies', 'string', NULL, '2025-12-21 18:54:32', '2025-12-29 02:44:01'),
(105, 'folder_dummy_images', 'https://cdn.funmap.com/dummy-images', 'string', 'Folder path for dummy/test images', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(106, 'folder_phone_prefixes', 'https://cdn.funmap.com/phone-prefixes', 'string', NULL, '2025-12-21 18:54:32', '2025-12-29 02:44:01'),
(107, 'folder_post_images', 'https://cdn.funmap.com/post-images', 'string', 'Folder path for post images', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(108, 'folder_site_avatars', 'https://cdn.funmap.com/site-avatars', 'string', 'Folder path for site/library avatars', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(109, 'folder_site_images', 'https://cdn.funmap.com/site-images', 'string', 'Folder path for site-generated images', '2025-12-21 11:53:19', '2025-12-29 02:44:01'),
(110, 'folder_system_images', 'https://cdn.funmap.com/system-images', 'string', 'Folder path for admin message category icons', '2025-11-13 16:17:10', '2025-12-29 02:44:01'),
(111, 'folder_post_system_images', 'https://cdn.funmap.com/system-images', 'string', 'Folder path for Post system images', '2025-12-29 03:38:23', '2025-12-29 03:44:45'),
(112, 'folder_recent_system_images', 'https://cdn.funmap.com/system-images', 'string', 'Folder path for Recent system images', '2025-12-29 03:38:23', '2025-12-29 03:44:45'),
(113, 'folder_age_ratings', 'https://cdn.funmap.com/age-ratings', 'string', 'Folder path for age rating icons', '2026-01-05 20:51:20', '2026-01-05 20:56:53'),
(200, 'big_logo', 'funmap welcome message 2025-12-10c.webp', 'string', 'Path to big logo', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(201, 'big_map_card_pill', '225x60-pill-172554.webp', 'string', 'Path to big map card pill image (225×60px)', '2025-12-21 16:28:13', '2026-01-15 01:25:32'),
(202, 'favicon', 'favicon.ico', 'string', 'Path to favicon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(203, 'hover_map_card_pill', '150x40-pill-172554.webp', 'string', 'Path to hover map card pill image (150×40px)', '2025-12-21 16:28:13', '2026-01-15 01:26:24'),
(204, 'icon_add_image', 'icon-camera.svg', 'string', 'Icon: Add Image (shared for avatar + images fieldset)', '2025-12-25 10:14:26', '2025-12-29 02:44:01'),
(205, 'icon_admin', 'icon-admin.svg', 'string', 'Header admin button icon filename', '2025-12-24 23:26:45', '2025-12-29 02:44:01'),
(206, 'icon_clear', 'icon-clear.svg', 'string', 'Clear (X) icon filename', '2025-12-25 00:27:58', '2025-12-29 02:44:01'),
(207, 'icon_close', 'icon-close.svg', 'string', 'Panel close icon filename', '2025-12-25 00:27:58', '2025-12-29 02:44:01'),
(208, 'icon_compass', 'icon-compass-white-blue.svg', 'string', 'Map control compass icon filename', '2025-12-24 23:50:06', '2026-01-06 08:24:05'),
(209, 'icon_discard', 'icon-discard.svg', 'string', 'Panel discard icon filename', '2025-12-25 00:27:58', '2025-12-29 02:44:01'),
(210, 'icon_favourites', 'icon-favourites.svg', 'string', 'Favourites (star) icon filename', '2025-12-25 00:27:58', '2025-12-29 02:44:01'),
(211, 'icon_filter', 'icon-filter.svg', 'string', 'Filter button icon filename', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(212, 'icon_fullscreen', 'icon-fullscreen.svg', 'string', 'Header fullscreen button icon filename', '2025-12-24 23:26:45', '2025-12-29 02:44:01'),
(213, 'icon_fullscreen_exit', 'icon-fullscreen-exit.svg', 'string', 'Header fullscreen-exit icon filename', '2025-12-24 23:26:45', '2025-12-29 02:44:01'),
(214, 'icon_geolocate', 'icon-geolocate-24.svg', 'string', 'Map control geolocate icon filename', '2025-12-24 23:50:06', '2026-01-06 08:25:40'),
(215, 'icon_lighting_dawn', 'icon-map-lighting-dawn.svg', 'string', 'Map lighting icon filename (Sunrise/Dawn)', '2025-12-25 00:08:10', '2025-12-29 02:44:01'),
(216, 'icon_lighting_day', 'icon-map-lighting-day.svg', 'string', 'Map lighting icon filename (Day)', '2025-12-25 00:08:10', '2025-12-29 02:44:01'),
(217, 'icon_lighting_dusk', 'icon-map-lighting-dusk.svg', 'string', 'Map lighting icon filename (Sunset/Dusk)', '2025-12-25 00:08:10', '2025-12-29 02:44:01'),
(218, 'icon_lighting_night', 'icon-map-lighting-night.svg', 'string', 'Map lighting icon filename (Night)', '2025-12-25 00:08:10', '2025-12-29 02:44:01'),
(219, 'icon_map', 'icon-map.svg', 'string', 'Map mode button icon filename (location pin icon)', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(220, 'icon_member', 'icon-member.svg', 'string', 'Header member button icon filename', '2025-12-24 23:26:45', '2025-12-29 02:44:01'),
(221, 'icon_posts', 'icon-posts.svg', 'string', 'Posts mode button icon filename (list icon)', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(222, 'icon_recent', 'icon-recents.svg', 'string', 'Recent mode button icon filename (clock icon)', '2025-12-21 16:28:13', '2025-12-29 03:38:23'),
(223, 'icon_save', 'icon-save.svg', 'string', 'Panel save icon filename', '2025-12-25 00:27:58', '2025-12-29 02:44:01'),
(224, 'marker_cluster_icon', 'red-balloon-40.png', 'string', 'Path to marker cluster/balloon icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(225, 'msg_category_admin_icon', 'admin-messages.svg', 'string', 'Path to admin messages category icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(226, 'msg_category_email_icon', 'email-messages.svg', 'string', 'Path to email messages category icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(227, 'msg_category_fieldset-tooltips_icon', 'fieldset-tooltips.svg', 'string', 'Path to fieldset tooltips messages category icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(228, 'msg_category_member_icon', 'member-messages.svg', 'string', 'Path to member messages category icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(229, 'msg_category_user_icon', 'user-messages.svg', 'string', 'Path to user messages category icon', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(230, 'multi_post_icon', 'multi-post-icon-50.webp', 'string', 'Path to multi-post icon image (30×30px small / 50×50px big)', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(231, 'small_logo', 'earth toy.png', 'string', 'Path to small logo', '2025-12-21 16:28:13', '2025-12-29 02:44:01'),
(232, 'small_map_card_pill', '150x40-pill-70.webp', 'string', 'Path to small map card base pill image (150×40px)', '2025-12-21 16:28:13', '2026-01-15 01:26:24'),
(233, 'post_panel_empty_image', 'Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png', 'string', 'System image filename for Post Empty Image (uses folder_post_system_images)', '2025-12-29 03:38:23', '2025-12-29 03:47:17'),
(234, 'recent_panel_footer_image', 'Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png', 'string', 'System image filename for Recent Footer Image (uses folder_recent_system_images)', '2025-12-29 03:38:23', '2025-12-29 03:47:17'),
(235, 'icon_ticket', 'Icon-ticket.svg', 'string', 'System image filename for Ticket Icon (uses folder_system_images)', '2026-01-01 15:43:20', '2026-01-01 16:14:21'),
(236, 'icon_plus', 'icon-plus.svg', 'string', 'System image filename for Plus Icon (uses folder_system_images)', '2026-01-07 01:00:00', '2026-01-07 03:58:22'),
(237, 'icon_minus', 'icon-minus.svg', 'string', 'System image filename for Minus Icon (uses folder_system_images)', '2026-01-07 01:00:00', '2026-01-07 03:58:22'),
(238, 'icon_checkmark', 'icon-checkmark-3.svg', 'string', 'Icon: Checkmark (SVG filename)', '2026-01-07 22:50:43', '2026-01-11 03:58:30'),
(239, 'icon_checkbox', 'icon-checkbox.svg', 'string', 'Icon: Checkbox (SVG filename)', '2026-01-07 22:50:43', '2026-01-08 01:23:49'),
(240, 'icon_radio', 'icon-radio.svg', 'string', 'Icon: Radio (SVG filename)', '2026-01-11 04:45:19', '2026-01-11 04:45:19'),
(241, 'icon_radio_selected', 'icon-radio-selected.svg', 'string', 'Icon: Radio Selected (SVG filename)', '2026-01-11 04:45:19', '2026-01-11 04:45:19'),
(242, 'msg_category_field-tooltips_icon', 'fieldset-tooltips.svg', 'string', 'Path to field tooltips messages category icon', '2026-01-19 05:05:18', '2026-01-19 05:05:18'),
(243, 'icon_arrow_down', 'icon_arrow_down.svg', 'string', 'Dropdown menu arrow icon', '2026-01-20 12:28:17', '2026-01-20 12:32:57'),
(244, 'icon_edit', 'icon_edit.svg', 'string', 'Edit/pencil icon for editing', '2026-01-20 12:28:17', '2026-01-20 12:32:57'),
(245, 'icon_info', 'icon_info.svg', 'string', 'Info icon for tooltips', '2026-01-20 12:28:17', '2026-01-20 12:32:57'),
(246, 'icon_share', 'icon_share.svg', 'string', 'Share button icon', '2026-01-20 12:28:17', '2026-01-20 12:32:57'),
(247, 'icon_drag_handle', 'icon_drag_handle.svg', 'string', 'Drag handle icon for sortable rows', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(248, 'icon_more_dots', 'icon_more_dots.svg', 'string', 'Vertical dots menu icon', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(249, 'icon_search', 'icon-filter.svg', 'string', 'Search magnifying glass icon', '2026-01-20 13:13:42', '2026-01-20 19:15:16'),
(250, 'icon_reactivate', 'icon_reactivate.svg', 'string', 'Reactivate/refresh circular arrow icon', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(251, 'icon_trash', 'icon_trash.svg', 'string', 'Trash/delete icon', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(252, 'icon_flag', 'icon_flag.svg', 'string', 'Flag icon for flagged items', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(253, 'icon_tick', 'icon_tick.svg', 'string', 'Tick/approve icon for actions', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(254, 'icon_hide', 'icon_hide.svg', 'string', 'Hide icon (eye with slash)', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(255, 'icon_show', 'icon_show.svg', 'string', 'Show icon (eye)', '2026-01-20 13:13:42', '2026-01-20 13:13:42'),
(300, 'map_lighting', 'dusk', 'string', 'Mapbox lighting preset: dawn, day, dusk, or night', '2025-12-23 02:44:08', '2025-12-30 06:36:36'),
(301, 'map_style', 'standard', 'string', 'Mapbox style: standard or standard-satellite', '2025-12-23 02:44:08', '2025-12-30 07:08:27'),
(302, 'spin_on_load', 'true', 'boolean', 'Enable map spin on page load', '2025-11-13 16:17:10', '2025-12-30 07:07:27'),
(303, 'spin_load_type', 'everyone', 'string', 'Spin for: everyone or new_users', '2025-11-13 16:17:10', '2025-12-30 06:22:01'),
(304, 'spin_on_logo', 'true', 'boolean', 'Enable map spin when logo clicked', '2025-11-13 16:17:10', '2025-12-30 06:22:01'),
(305, 'spin_zoom_max', '4', 'integer', 'Maximum zoom spin threshold', '2025-11-13 16:17:10', '2025-12-30 06:22:01'),
(306, 'spin_speed', '0.2', 'decimal', 'Speed of globe spin rotation', '2025-11-13 16:17:10', '2025-12-30 06:22:01'),
(307, 'map_card_display', 'always', 'string', 'Map card display mode: hover_only or always', '2025-11-23 11:24:22', '2025-12-30 06:22:01'),
(308, 'starting_address', 'Perth, Western Australia, Australia', 'string', 'Default map starting location for new visitors (address or coordinates)', '2025-12-08 07:21:39', '2026-01-14 23:15:40'),
(309, 'starting_zoom', '2', 'integer', 'Default map zoom level for new visitors (1-18)', '2025-12-08 07:49:50', '2025-12-30 06:22:01'),
(310, 'starting_lat', '-31.951263', 'decimal', 'Starting location latitude coordinate', '2025-12-08 11:43:09', '2026-01-14 23:15:40'),
(311, 'starting_lng', '115.85805', 'decimal', 'Starting location longitude coordinate', '2025-12-08 11:43:09', '2026-01-14 23:15:40'),
(312, 'starting_pitch', '0', 'integer', NULL, '2025-12-20 06:10:19', '2025-12-30 06:22:01'),
(313, 'wait_for_map_tiles', 'true', 'boolean', NULL, '2025-12-10 05:16:15', '2026-01-06 11:03:58'),
(314, 'location_wallpaper_mode', 'orbit', 'string', 'Location wallpaper mode: off|orbit|still', '2026-01-08 22:27:47', '2026-01-09 03:14:30'),
(315, 'location_wallpaper_dimmer', '50', 'integer', 'Location wallpaper dimmer overlay opacity (0-100)', '2026-01-09 12:12:36', '2026-01-09 17:59:23'),
(316, 'map_card_breakpoint', '9', 'integer', 'Zoom level breakpoint where map markers switch from clusters/dots to full Map Cards.', '2026-01-18 06:53:40', '2026-01-21 08:40:32'),
(400, 'image_min_width', '1000', 'integer', 'Minimum post image width in pixels', '2026-01-03 08:20:33', '2026-01-03 08:24:27'),
(401, 'image_min_height', '1000', 'integer', 'Minimum post image height in pixels', '2026-01-03 08:20:33', '2026-01-03 08:24:27'),
(402, 'image_max_size', '5242880', 'integer', 'Maximum post image file size in bytes (5MB)', '2026-01-03 08:20:33', '2026-01-03 08:24:27'),
(403, 'avatar_min_width', '1000', 'integer', 'Minimum avatar width in pixels', '2026-01-03 08:20:33', '2026-01-03 08:24:27'),
(404, 'avatar_min_height', '1000', 'integer', 'Minimum avatar height in pixels', '2026-01-03 08:20:33', '2026-01-03 08:24:27'),
(405, 'avatar_max_size', '5242880', 'integer', 'Maximum avatar file size in bytes (5MB)', '2026-01-03 08:20:33', '2026-01-03 08:24:27');

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
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `banned_words`
--

INSERT INTO `banned_words` (`id`, `word`, `language`, `reason`, `created_at`) VALUES
(1, 'fuck', 'en', 'profanity', '2025-12-07 03:13:38'),
(2, 'cunt', 'en', 'profanity', '2025-12-07 03:13:38');

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
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `category_name`, `category_key`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `created_at`, `updated_at`) VALUES
(1, 'What\'s On', 'what-s-on', 1, 0, 'whats-on.svg', '#E74C3C', '2025-10-29 23:32:47', '2026-01-18 08:07:06'),
(2, 'Opportunities', 'opportunities', 4, 0, 'opportunities.svg', '#F1C40F', '2025-10-29 23:32:47', '2025-12-22 06:25:10'),
(3, 'Learning', 'learning', 3, 0, 'learning.svg', '#3498DB', '2025-10-29 23:32:47', '2025-12-22 06:25:10'),
(4, 'Buy and Sell', 'buy-and-sell', 5, 0, 'buy-and-sell.svg', '#2ECC71', '2025-10-29 23:32:47', '2025-12-22 06:25:10'),
(5, 'For Hire', 'for-hire', 2, 0, 'for-hire.svg', '#9B59B6', '2025-10-29 23:32:47', '2025-12-22 06:25:10'),
(6, 'Eat & Drink', 'eat-drink', 6, 0, 'eat-and-drink.svg', '#E67E22', '2025-12-15 00:11:53', '2025-12-22 06:25:10'),
(47, 'Test', 'test', 7, 0, 'opportunities.svg', NULL, '2025-11-17 04:45:27', '2025-12-22 06:25:10'),
(7, 'Stay', 'stay', 8, 0, 'stay.svg', '#1ABC9C', '2025-12-15 00:11:53', '2025-12-22 06:25:10'),
(8, 'Get Around', 'get-around', 9, 0, 'get-around.svg', '#34495E', '2025-12-15 00:11:53', '2025-12-22 06:25:10'),
(9, 'Venues', 'venues', 2, 0, 'venues.svg', '#E91E63', '2026-01-23 00:11:04', '2026-01-23 00:11:04');

-- --------------------------------------------------------

--
-- Table structure for table `checkout_options`
--

CREATE TABLE `checkout_options` (
  `id` int(11) NOT NULL,
  `checkout_key` varchar(100) NOT NULL,
  `checkout_title` varchar(255) NOT NULL,
  `checkout_description` text DEFAULT NULL,
  `checkout_logic` text DEFAULT NULL,
  `checkout_currency` varchar(10) NOT NULL,
  `checkout_flagfall_price` decimal(10,2) NOT NULL,
  `checkout_basic_day_rate` decimal(10,2) DEFAULT NULL,
  `checkout_discount_day_rate` decimal(10,2) DEFAULT NULL,
  `checkout_featured` tinyint(1) DEFAULT 0,
  `checkout_sidebar_ad` tinyint(1) DEFAULT 0,
  `sort_order` tinyint(3) UNSIGNED DEFAULT 1,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `checkout_options`
--

INSERT INTO `checkout_options` (`id`, `checkout_key`, `checkout_title`, `checkout_description`, `checkout_logic`, `checkout_currency`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `hidden`, `created_at`, `updated_at`) VALUES
(1, 'free-listing', 'Free Listing', 'Standard post cards.', 'probably wont exist to prevent spam', 'USD', 0.00, NULL, 0.00, 0, 0, 1, 1, '2025-11-30 05:45:21', '2026-01-21 19:40:32'),
(2, 'standard-listing', 'Standard Listing', 'Post Cards and Map Cards are shown as normal below Featured and Premium Listings. Map Cards are not shown in high population areas.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.15, 0.08, 0, 0, 2, 0, '2025-11-30 05:45:21', '2026-01-21 19:40:32'),
(3, 'featured-listing', 'Featured Listing', 'Post Cards appear above Standard listings in the default \'Recommended\' Sort Order. Map Cards receive priority in high population areas.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.30, 0.15, 1, 0, 3, 0, '2025-11-30 05:45:21', '2026-01-21 19:40:32'),
(4, 'premium-listing', 'Premium Listing', 'Post Cards appear above Standard and Featured listings in the default \'Recommended\' Sort Order. Map Cards receive the highest priority in high population areas. Your listing also appears in the Marquee panel for maximum exposure on wider monitors.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.40, 0.20, 1, 1, 4, 0, '2025-11-30 05:45:21', '2026-01-21 19:40:32');

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
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `fields`
--

CREATE TABLE `fields` (
  `id` int(11) NOT NULL,
  `field_key` varchar(255) DEFAULT NULL,
  `input_type` varchar(255) DEFAULT NULL,
  `field_placeholder` mediumtext DEFAULT NULL,
  `field_tooltip` mediumtext DEFAULT NULL,
  `min_length` int(11) DEFAULT NULL,
  `max_length` int(11) DEFAULT NULL,
  `show_limit` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fields`
--

INSERT INTO `fields` (`id`, `field_key`, `input_type`, `field_placeholder`, `field_tooltip`, `min_length`, `max_length`, `show_limit`, `created_at`, `updated_at`) VALUES
(1, 'title', 'text', 'eg. Summer Rain', 'Enter a clear, descriptive title for your listing.', 3, 150, 1, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(2, 'description', 'textarea', 'eg. Come and Express Yourself!', 'Provide a detailed description of your event or listing.', 10, 5000, 1, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(4, 'venue-name', 'text', 'eg. The Grand Theatre', 'The name of the venue where the event is held.', 3, 200, 1, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(5, 'address-line', 'text', 'eg. 123 Main Street, Suburb', 'The physical street address of the venue.', 5, 500, 1, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(6, 'latitude', 'decimal', '0.000000', 'The geographic latitude coordinate.', 3, 50, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(7, 'longitude', 'decimal', '0.000000', 'The geographic longitude coordinate.', 3, 50, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(8, 'session-date', 'date', 'Select Date', 'The calendar date for this session.', NULL, NULL, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(9, 'session-time', 'time', 'HH:MM', 'The starting time for this session (24-hour format).', NULL, NULL, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(10, 'ticket-area', 'text', 'eg. Stalls, Balcony, VIP Area', 'Specify the seating area or zone (e.g., Stalls, VIP, Camping).', 3, 100, 1, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(11, 'pricing-tier', 'text', 'eg. Adult, Concession', 'The demographic or ticket type (e.g., Adult, Student).', 3, 100, 1, '2025-10-29 23:32:47', '2026-01-22 17:17:20'),
(12, 'ticket-price', 'decimal(10,2)', '0.00', 'The cost of a single ticket in this tier.', 1, 50, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(13, 'currency', 'dropdown', 'Select Currency', 'The currency used for pricing.', 1, 50, 0, '2025-10-29 23:32:47', '2026-01-19 15:53:03'),
(14, 'text-box', 'text', 'Enter text...', 'Enter the required information.', 3, 500, 1, '2025-10-30 17:11:57', '2026-01-19 15:53:03'),
(15, 'text-area', 'textarea', 'Enter detailed description...', 'Enter a detailed explanation.', 10, 2000, 1, '2025-10-30 17:11:57', '2026-01-19 15:53:03'),
(16, 'dropdown', 'dropdown', 'Please Select', 'Select the most appropriate option from the list.', NULL, NULL, 0, '2025-10-30 17:14:25', '2026-01-19 15:53:03'),
(17, 'radio', 'radio', 'Choose one', 'Select one of the available options.', NULL, NULL, 0, '2025-10-30 17:14:25', '2026-01-19 15:53:03'),
(18, 'email', 'email', 'eg. you@example.com', 'A valid email address for contact purposes.', 5, 50, 1, '2025-10-30 17:25:10', '2026-01-19 15:53:03'),
(19, 'phone', 'tel', NULL, 'A contact phone number including area code.', 6, 30, 1, '2025-10-30 17:25:10', '2026-01-22 17:17:05'),
(20, 'website', 'url', 'eg. https://www.website.com', 'The full URL of the official website.', 5, 500, 1, '2025-10-30 17:25:10', '2026-01-19 15:53:03'),
(21, 'item-name', 'text', 'eg. T-Shirt', 'The name of the item or product being offered.', 2, 200, 1, '2025-10-30 18:33:09', '2026-01-19 15:53:03'),
(23, 'item-price', 'decimal(10,2)', '0.00', 'The unit price of the item.', 1, 50, 0, '2025-10-30 18:39:14', '2026-01-19 15:53:03'),
(28, 'phone-prefix', 'dropdown', '+61', 'The international calling code for your country.', NULL, NULL, 0, '2025-12-08 03:17:25', '2026-01-19 15:53:03'),
(37, 'item-variant', 'text', 'eg. Large, Red', 'Specific options like size, color, or material.', 2, 200, 1, '2025-12-15 09:26:00', '2026-01-19 15:53:03'),
(35, 'city', 'text', 'eg. Brisbane, Sydney, Melbourne', 'The city or town where this listing is located.', 2, 200, 0, '2025-12-15 02:49:27', '2026-01-19 15:53:03'),
(36, 'amenities', 'checklist', 'Select all that apply', 'Check all features and facilities that are available.', NULL, NULL, 0, '2025-12-15 06:13:31', '2026-01-19 15:53:03'),
(38, 'country-code', 'text', 'eg. AU', 'The two-letter ISO country code.', 2, 2, 0, '2025-12-21 05:38:23', '2026-01-19 15:53:03'),
(39, 'username', 'text', 'eg. UrbanExplorer', 'Choose a unique name to represent you on the platform.', 3, 50, 1, '2025-12-31 03:30:08', '2026-01-19 15:53:03'),
(40, 'password', 'password', '••••••••', 'Choose a secure password for your account.', 4, 50, 0, '2025-12-31 03:30:08', '2026-01-19 15:53:03'),
(41, 'confirm-password', 'password', '••••••••', 'Type your password again to ensure it is correct.', 4, 50, 0, '2025-12-31 03:30:08', '2026-01-19 15:53:03'),
(42, 'checklist', 'checklist', 'Select options', 'Select multiple options from the list.', NULL, NULL, 0, '2026-01-08 09:50:42', '2026-01-19 15:53:03');

-- --------------------------------------------------------

--
-- Table structure for table `fieldsets`
--

CREATE TABLE `fieldsets` (
  `id` int(11) NOT NULL,
  `fieldset_name` varchar(255) NOT NULL,
  `fieldset_key` varchar(255) DEFAULT NULL,
  `fieldset_type` enum('subcategory','auth') NOT NULL DEFAULT 'subcategory',
  `sort_order` int(10) UNSIGNED DEFAULT 0,
  `fieldset_fields` longtext DEFAULT NULL CHECK (json_valid(`fieldset_fields`)),
  `fieldset_options` longtext DEFAULT NULL CHECK (json_valid(`fieldset_options`)),
  `fieldset_placeholder` mediumtext DEFAULT NULL,
  `fieldset_tooltip` mediumtext DEFAULT NULL COMMENT 'Custom tooltip/help text shown on hover for this fieldset',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `fieldsets`
--

INSERT INTO `fieldsets` (`id`, `fieldset_name`, `fieldset_key`, `fieldset_type`, `sort_order`, `fieldset_fields`, `fieldset_options`, `fieldset_placeholder`, `fieldset_tooltip`, `created_at`, `updated_at`) VALUES
(1, 'Title', 'title', 'subcategory', 1, '[\"title\"]', NULL, 'eg. Summer Rain', 'Enter a clear, descriptive title for your listing. Make it catchy and informative.', '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(2, 'Description', 'description', 'subcategory', 2, '[\"description\"]', NULL, 'eg. Come and Express Yourself!', 'Provide a detailed description of your event or listing. Include key information that helps visitors understand what you\'re offering.', '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(3, 'Custom Text', 'custom_text', 'subcategory', 50, '[\"text-box\"]', NULL, 'eg. Diamonds and Pearls', 'Write stuff here.', '2025-10-29 19:03:05', '2026-01-01 10:25:11'),
(4, 'Custom TextArea', 'custom_textarea', 'subcategory', 50, '[\"text-area\"]', NULL, 'eg. Sing along!', 'Write more stuff here.', '2025-10-29 19:03:05', '2026-01-01 10:25:34'),
(5, 'Custom Dropdown', 'custom_dropdown', 'subcategory', 50, '[\"dropdown\"]', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'Please Select', 'Select one option from the dropdown menu. Choose the option that best matches your listing.', '2025-10-29 19:03:05', '2026-01-07 22:09:42'),
(6, 'Custom Radio', 'custom_radio', 'subcategory', 50, '[\"radio\"]', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'Four,Five,Six', 'Choose one option from the radio buttons. Only one selection is allowed.', '2025-10-29 19:03:05', '2026-01-01 10:25:56'),
(8, 'Public Phone', 'public_phone', 'subcategory', 4, '[\"phone-prefix\", \"phone\"]', NULL, '400 000 000', 'Enter a phone number where visitors can reach you. Include country code if applicable.', '2025-10-29 19:03:05', '2026-01-22 08:06:33'),
(9, 'Address', 'address', 'subcategory', 6, '[\"address-line\", \"latitude\", \"longitude\", \"country-code\"]', NULL, '123 Main Street, Suburb, City', 'Search for and select your street address. The map will help you find the exact spot.', '2025-10-29 19:03:05', '2026-01-01 08:41:37'),
(10, 'Website (URL)', 'website-url', 'subcategory', 8, '[\"website\"]', NULL, 'www.website.com', 'Enter the full website URL (including https://) where visitors can find more information.', '2025-10-29 19:03:05', '2026-01-01 08:41:37'),
(11, 'Tickets (URL)', 'tickets-url', 'subcategory', 9, '[\"website\"]', NULL, 'www.tickets.com', 'Enter the full URL (including https://) where visitors can purchase tickets or make reservations.', '2025-10-29 19:03:05', '2026-01-01 08:41:37'),
(12, 'Images', 'images', 'subcategory', 10, '[]', NULL, 'images', 'At least one image is required. Maximum ten images. Click on any image to use the crop tool. Square images will be shown everywhere on this website except in the image viewer of your post.', '2025-10-29 19:03:05', '2026-01-05 21:39:44'),
(13, 'Coupon', 'coupon', 'subcategory', 11, '[\"text-box\"]', NULL, 'eg. FreeStuff', 'Enter a coupon or discount code if applicable. Visitors can use this code when making purchases.', '2025-10-29 19:03:05', '2026-01-01 08:41:37'),
(14, 'Item Pricing', 'item-pricing', 'subcategory', 12, '[\"item-name\", \"item-variant\", \"currency\", \"item-price\"]', NULL, 'eg. T-Shirt - Large Red - $29.95', 'Add pricing information for individual items. Include item name, price, and currency for each item you\'re selling.', '2025-10-29 19:03:05', '2026-01-01 08:41:37'),
(16, 'City', 'city', 'subcategory', 5, '[\"city\", \"latitude\", \"longitude\", \"country-code\"]', NULL, 'eg. Brisbane, Sydney, Melbourne', 'Enter the city or town where your listing should appear. For online or private address listings.', '2025-12-14 15:49:27', '2026-01-01 08:41:37'),
(17, 'Venue', 'venue', 'subcategory', 7, '[\"venue-name\", \"address-line\", \"latitude\", \"longitude\", \"country-code\"]', NULL, 'Search or type venue name...', 'Search for your venue or type the name manually. If searching by address, the venue name will auto-fill if Google knows the business at that location.', '2025-12-14 18:30:38', '2026-01-01 08:41:37'),
(18, 'Amenities', 'amenities', 'subcategory', 14, '[\"amenities\"]', NULL, NULL, 'Select Yes or No for each amenity that applies to this listing.', '2025-12-14 19:13:31', '2026-01-01 08:41:37'),
(19, 'Age Rating', 'age_rating', 'subcategory', 16, '[]', NULL, NULL, 'Select the appropriate age rating for this listing.', '2026-01-05 21:42:49', '2026-01-05 21:42:49'),
(21, 'Session Pricing', 'session_pricing', 'subcategory', 17, '[\"session-date\",\"session-time\",\"ticket-area\",\"pricing-tier\",\"currency\",\"ticket-price\"]', NULL, 'eg. Sessions with pricing', '1. Click the first date box to show the calendar.\n2. Choose all your event dates to create the table.\n3. Fill out your 24hr starting times for each date.\n4. Click the Ticket Pricing button to set prices.\n5. Add extra pricing groups if you need them.', '2026-01-01 12:54:10', '2026-01-19 04:47:05'),
(27, 'Public Email', 'public_email', 'subcategory', 3, '[\"email\"]', NULL, 'you@there.com', 'Enter a valid email address where visitors can contact you. This will be displayed publicly.', '2026-01-01 07:54:19', '2026-01-01 08:41:37'),
(100, 'Account Email', 'account_email', 'auth', NULL, '[\"email\"]', NULL, 'you@there.com', 'Your login email for this website. This is how admins will contact you. ', '2025-10-29 19:03:05', '2026-01-03 06:34:01'),
(101, 'Username', 'username', 'auth', NULL, '[\"username\"]', NULL, 'eg. Rolls Royce', 'Create a Username to use on this website.', '2025-12-30 16:30:08', '2026-01-01 08:41:37'),
(102, 'Password', 'password', 'auth', NULL, '[\"password\"]', NULL, 'Choose a password', 'Choose a password to protect your account.', '2025-12-30 16:30:08', '2026-01-01 08:41:37'),
(103, 'Confirm Password', 'confirm-password', 'auth', NULL, '[\"confirm-password\"]', NULL, 'Repeat your password', 'Type the same password again to confirm.', '2025-12-30 16:30:08', '2026-01-01 10:24:19'),
(104, 'New Password', 'new-password', 'auth', NULL, '[\"password\"]', NULL, 'Choose a new password', 'Only fill this in if you want to change your password.', '2025-12-30 16:37:37', '2026-01-01 08:41:37'),
(105, 'Avatar', 'avatar', 'auth', NULL, '[]', NULL, NULL, 'Choose an avatar from this menu or upload your own. Click on an avatar to open the crop tool. Choosing a new avatar overwrites your previous one.', '2025-12-30 17:10:32', '2026-01-01 08:41:37'),
(106, 'Country', 'country', 'auth', NULL, '[]', NULL, NULL, 'This is a quick survey. Which country are you in right now? ', '2025-12-30 17:10:32', '2026-01-01 08:41:37'),
(107, 'Custom Checklist', 'custom_checklist', 'subcategory', 50, '[\"checklist\"]', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'Select all that apply', 'Choose one or more options from the checklist.', '2026-01-07 22:50:42', '2026-01-07 22:50:42');

-- --------------------------------------------------------

--
-- Table structure for table `layout_containers`
--

CREATE TABLE `layout_containers` (
  `id` int(11) NOT NULL,
  `tab_id` int(11) NOT NULL COMMENT 'References layout_tabs.id',
  `tab_name` varchar(100) DEFAULT NULL COMMENT 'Display reference (denormalized for readability)',
  `container_key` varchar(100) NOT NULL COMMENT 'HTML ID/class or invented key',
  `container_name` varchar(100) NOT NULL COMMENT 'Display name',
  `icon_path` varchar(255) DEFAULT NULL COMMENT 'Path to icon',
  `sort_order` int(11) NOT NULL DEFAULT 1 COMMENT 'Order within tab',
  `is_visible` tinyint(1) DEFAULT 1 COMMENT 'Show/hide from users',
  `is_deletable` tinyint(1) DEFAULT 0 COMMENT 'Allow deletion (0=prevent delete, 1=allow delete)',
  `is_collapsible` tinyint(1) DEFAULT 0 COMMENT 'Has dropdown/collapse UI',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'System enable/disable (db-only)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `layout_containers`
--

INSERT INTO `layout_containers` (`id`, `tab_id`, `tab_name`, `container_key`, `container_name`, `icon_path`, `sort_order`, `is_visible`, `is_deletable`, `is_collapsible`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 4, 'Messages', 'msg_user', 'User Messages', 'assets/admin-icons/user-messages.svg', 1, 1, 0, 1, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(2, 4, 'Messages', 'msg_member', 'Member Messages', 'assets/admin-icons/member-messages.svg', 2, 1, 0, 1, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(3, 4, 'Messages', 'msg_admin', 'Admin Messages', 'assets/admin-icons/admin-messages.svg', 3, 1, 0, 1, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(4, 4, 'Messages', 'msg_email', 'Email Messages', 'assets/admin-icons/email-messages.svg', 4, 1, 0, 1, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(5, 3, 'Map', 'map-spin-container', 'Map Spin Settings', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(6, 1, 'Settings', 'map_shadow_container', 'Map Shadow', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-24 15:02:52'),
(7, 1, 'Settings', 'settings-welcome-container', 'Welcome Message', NULL, 2, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(8, 1, 'Settings', 'settings-paypal-container', 'PayPal Settings', NULL, 3, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(9, 1, 'Settings', 'settings-icon-folders-container', 'Icon Folders', NULL, 4, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(10, 1, 'Settings', 'container_console_filter', 'Console Filter', NULL, 5, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(11, 8, 'Filter Panel', 'filter-basics-container', 'Filter Basics', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33'),
(12, 8, 'Filter Panel', 'filter-category-container', 'Filter Categories', NULL, 2, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33'),
(13, 5, 'Create Post', 'member-create-selects', 'Category Selection', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33'),
(14, 5, 'Create Post', 'member-create-form', 'Post Form', NULL, 2, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33'),
(15, 7, 'Profile', 'member-auth', 'Authentication', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33'),
(16, 9, 'Advert Panel', 'ad-panel', 'Advertisement Panel', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:58:57', '2025-11-13 16:46:33');

-- --------------------------------------------------------

--
-- Table structure for table `layout_rows`
--

CREATE TABLE `layout_rows` (
  `id` int(11) NOT NULL,
  `container_id` int(11) NOT NULL COMMENT 'References layout_containers.id',
  `container_name` varchar(100) DEFAULT NULL COMMENT 'Display reference (denormalized for readability)',
  `row_key` varchar(100) NOT NULL COMMENT 'row_icon_folder, row_spin_on_load',
  `row_name` varchar(100) NOT NULL COMMENT 'Display name',
  `is_visible` tinyint(1) DEFAULT 1 COMMENT 'Show/hide from users',
  `is_deletable` tinyint(1) DEFAULT 0 COMMENT 'Allow deletion (0=prevent delete, 1=allow delete)',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'System enable/disable (db-only)',
  `metadata` text DEFAULT NULL COMMENT 'JSON for additional config',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `layout_rows`
--

INSERT INTO `layout_rows` (`id`, `container_id`, `container_name`, `row_key`, `row_name`, `is_visible`, `is_deletable`, `is_active`, `metadata`, `created_at`, `updated_at`) VALUES
(1, 9, 'Icon Folders', 'row_icon_folder', 'Icon Folder', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(2, 9, 'Icon Folders', 'row_admin_icon_folder', 'Admin Icon Folder', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(3, 10, 'Console Filter', 'row_console_filter', 'Enable Console Filter', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(4, 6, 'Map Shadow', 'row_map_shadow', 'Map Shadow Slider', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-24 14:50:33'),
(5, 7, 'Welcome Message', 'row_welcome_message', 'Welcome Message Editor', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(6, 8, 'PayPal Settings', 'row_paypal_client_id', 'PayPal Client ID', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(7, 8, 'PayPal Settings', 'row_paypal_secret', 'PayPal Client Secret', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(8, 5, 'Map Spin Settings', 'row_spin_on_load', 'Spin on Load', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(9, 5, 'Map Spin Settings', 'row_spin_on_logo', 'Spin on Logo', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(10, 5, 'Map Spin Settings', 'row_spin_type', 'Spin Type', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(11, 5, 'Map Spin Settings', 'row_spin_max_zoom', 'Spin Max Zoom', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(12, 5, 'Map Spin Settings', 'row_spin_speed', 'Spin Speed', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(13, 13, 'Category Selection', 'row_member_category', 'Category Dropdown', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(14, 13, 'Category Selection', 'row_member_subcategory', 'Subcategory Dropdown', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(15, 11, 'Filter Basics', 'row_filter_keyword', 'Keywords', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(16, 11, 'Filter Basics', 'row_filter_price', 'Price Range', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(17, 11, 'Filter Basics', 'row_filter_daterange', 'Date Range', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
(18, 11, 'Filter Basics', 'row_filter_expired', 'Show Expired Events', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33');

-- --------------------------------------------------------

--
-- Table structure for table `layout_tabs`
--

CREATE TABLE `layout_tabs` (
  `id` int(11) NOT NULL,
  `tab_key` varchar(100) NOT NULL COMMENT 'admin_settings, member_create, etc.',
  `panel_key` enum('admin','member','filter','advert') NOT NULL COMMENT 'Which panel this tab belongs to',
  `tab_name` varchar(100) NOT NULL COMMENT 'Display name',
  `sort_order` int(11) NOT NULL DEFAULT 1 COMMENT 'Order within panel',
  `is_visible` tinyint(1) DEFAULT 1 COMMENT 'Show/hide from users',
  `is_deletable` tinyint(1) DEFAULT 0 COMMENT 'Allow deletion (0=prevent delete, 1=allow delete)',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'System enable/disable (db-only)',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `layout_tabs`
--

INSERT INTO `layout_tabs` (`id`, `tab_key`, `panel_key`, `tab_name`, `sort_order`, `is_visible`, `is_deletable`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'admin_settings', 'admin', 'Settings', 1, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(2, 'admin_forms', 'admin', 'Forms', 2, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(3, 'admin_map', 'admin', 'Map', 3, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(4, 'admin_messages', 'admin', 'Messages', 4, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(5, 'member_create', 'member', 'Create Post', 1, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(6, 'member_myposts', 'member', 'My Posts', 2, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(7, 'member_profile', 'member', 'Profile', 3, 1, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
(8, 'filter_main', 'filter', 'Filter Panel', 1, 1, 0, 1, '2025-11-13 15:24:48', '2025-11-13 16:46:33'),
(9, 'advert_main', 'advert', 'Advert Panel', 1, 1, 0, 1, '2025-11-13 15:24:48', '2025-11-13 16:46:33');

-- --------------------------------------------------------

--
-- Table structure for table `list_age_ratings`
--

CREATE TABLE `list_age_ratings` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_age_ratings`
--

INSERT INTO `list_age_ratings` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'age-rating-all.svg', 'all', 'All Ages', 1, 1),
(2, 'age-rating-7.svg', '7', '7+', 2, 1),
(3, 'age-rating-12.svg', '12', '12+', 3, 1),
(4, 'age-rating-15.svg', '15', '15+', 4, 1),
(5, 'age-rating-18.svg', '18', '18+', 5, 1),
(6, 'age-rating-21.svg', '21', '21+', 6, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_amenities`
--

CREATE TABLE `list_amenities` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_amenities`
--

INSERT INTO `list_amenities` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'parking.svg', 'Parking', 'Vehicle parking available at or near this location', 1, 1),
(2, 'wheelchair.svg', 'Wheelchair Access', 'This location is wheelchair accessible', 2, 1),
(3, 'accessible-parking.svg', 'Accessible Parking', 'Designated accessible parking spaces available', 3, 1),
(4, 'food.svg', 'Food & Beverages', 'Food and beverages available for purchase', 10, 1),
(5, 'byo.svg', 'BYO Allowed', 'BYO food or beverages permitted', 11, 1),
(6, 'licensed.svg', 'Licensed Venue', 'Licensed to serve alcohol', 12, 1),
(7, 'alacarte.svg', 'À La Carte', 'À la carte menu available', 13, 1),
(8, 'takeaway.svg', 'Takeaway', 'Takeaway orders available', 14, 1),
(9, 'delivery.svg', 'Delivery', 'Delivery service available', 15, 1),
(10, 'reservations.svg', 'Reservations', 'Reservations accepted or required', 16, 1),
(11, 'kids.svg', 'Kid Friendly', 'Suitable for children', 20, 1),
(12, 'childminding.svg', 'Child Minding', 'Child minding services available', 21, 1),
(13, 'babychange.svg', 'Baby Change', 'Baby change facilities available', 22, 1),
(14, 'petfriendly.svg', 'Pet Friendly', 'Pets welcome', 23, 1),
(15, 'serviceanimals.svg', 'Service Animals', 'Service animals welcome', 24, 1),
(16, 'wifi.svg', 'WiFi', 'Free WiFi available', 30, 1),
(17, 'aircon.svg', 'Air Conditioning', 'Air conditioned venue', 31, 1),
(18, 'outdoor.svg', 'Outdoor Seating', 'Outdoor seating area available', 32, 1),
(19, 'smoking.svg', 'Smoking Area', 'Designated smoking area', 33, 1),
(20, 'restrooms.svg', 'Restrooms', 'Public restrooms available', 34, 1),
(21, 'atm.svg', 'ATM', 'ATM on premises', 35, 1),
(22, 'coatcheck.svg', 'Coat Check', 'Coat check service available', 36, 1),
(23, 'livemusic.svg', 'Live Music', 'Live music performances', 40, 1),
(24, 'dancefloor.svg', 'Dance Floor', 'Dance floor available', 41, 1),
(25, 'vip.svg', 'VIP Area', 'VIP or private area available', 42, 1),
(26, 'pool.svg', 'Swimming Pool', 'Swimming pool on site', 50, 1),
(27, 'gym.svg', 'Gym', 'Fitness center or gym available', 51, 1),
(28, 'breakfast.svg', 'Breakfast Included', 'Breakfast included with stay', 52, 1),
(29, 'kitchen.svg', 'Kitchen Facilities', 'Kitchen or kitchenette available', 53, 1),
(30, 'laundry.svg', 'Laundry', 'Laundry facilities available', 54, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_category_icons`
--

CREATE TABLE `list_category_icons` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_category_icons`
--

INSERT INTO `list_category_icons` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'buy-and-sell-blue.svg', 'buy-and-sell-blue.svg', '', 0, 1),
(2, 'buy-and-sell-cyan.svg', 'buy-and-sell-cyan.svg', '', 0, 1),
(3, 'buy-and-sell-gray.svg', 'buy-and-sell-gray.svg', '', 0, 1),
(4, 'buy-and-sell-green.svg', 'buy-and-sell-green.svg', '', 0, 1),
(5, 'buy-and-sell-orange.svg', 'buy-and-sell-orange.svg', '', 0, 1),
(6, 'buy-and-sell-pink.svg', 'buy-and-sell-pink.svg', '', 0, 1),
(7, 'buy-and-sell-purple.svg', 'buy-and-sell-purple.svg', '', 0, 1),
(8, 'buy-and-sell-red.svg', 'buy-and-sell-red.svg', '', 0, 1),
(9, 'buy-and-sell-teal.svg', 'buy-and-sell-teal.svg', '', 0, 1),
(10, 'buy-and-sell-yellow.svg', 'buy-and-sell-yellow.svg', '', 0, 1),
(11, 'buy-and-sell.svg', 'buy-and-sell.svg', '', 0, 1),
(12, 'eat-and-drink-blue.svg', 'eat-and-drink-blue.svg', '', 0, 1),
(13, 'eat-and-drink-cyan.svg', 'eat-and-drink-cyan.svg', '', 0, 1),
(14, 'eat-and-drink-gray.svg', 'eat-and-drink-gray.svg', '', 0, 1),
(15, 'eat-and-drink-green.svg', 'eat-and-drink-green.svg', '', 0, 1),
(16, 'eat-and-drink-orange.svg', 'eat-and-drink-orange.svg', '', 0, 1),
(17, 'eat-and-drink-pink.svg', 'eat-and-drink-pink.svg', '', 0, 1),
(18, 'eat-and-drink-purple.svg', 'eat-and-drink-purple.svg', '', 0, 1),
(19, 'eat-and-drink-red.svg', 'eat-and-drink-red.svg', '', 0, 1),
(20, 'eat-and-drink-teal.svg', 'eat-and-drink-teal.svg', '', 0, 1),
(21, 'eat-and-drink-yellow.svg', 'eat-and-drink-yellow.svg', '', 0, 1),
(22, 'eat-and-drink.svg', 'eat-and-drink.svg', '', 0, 1),
(23, 'for-hire-blue.svg', 'for-hire-blue.svg', '', 0, 1),
(24, 'for-hire-cyan.svg', 'for-hire-cyan.svg', '', 0, 1),
(25, 'for-hire-gray.svg', 'for-hire-gray.svg', '', 0, 1),
(26, 'for-hire-green.svg', 'for-hire-green.svg', '', 0, 1),
(27, 'for-hire-orange.svg', 'for-hire-orange.svg', '', 0, 1),
(28, 'for-hire-pink.svg', 'for-hire-pink.svg', '', 0, 1),
(29, 'for-hire-purple.svg', 'for-hire-purple.svg', '', 0, 1),
(30, 'for-hire-red.svg', 'for-hire-red.svg', '', 0, 1),
(31, 'for-hire-teal.svg', 'for-hire-teal.svg', '', 0, 1),
(32, 'for-hire-yellow.svg', 'for-hire-yellow.svg', '', 0, 1),
(33, 'for-hire.svg', 'for-hire.svg', '', 0, 1),
(34, 'get-around-blue.svg', 'get-around-blue.svg', '', 0, 1),
(35, 'get-around-cyan.svg', 'get-around-cyan.svg', '', 0, 1),
(36, 'get-around-gray.svg', 'get-around-gray.svg', '', 0, 1),
(37, 'get-around-green.svg', 'get-around-green.svg', '', 0, 1),
(38, 'get-around-orange.svg', 'get-around-orange.svg', '', 0, 1),
(39, 'get-around-pink.svg', 'get-around-pink.svg', '', 0, 1),
(40, 'get-around-purple.svg', 'get-around-purple.svg', '', 0, 1),
(41, 'get-around-red.svg', 'get-around-red.svg', '', 0, 1),
(42, 'get-around-teal.svg', 'get-around-teal.svg', '', 0, 1),
(43, 'get-around-yellow.svg', 'get-around-yellow.svg', '', 0, 1),
(44, 'get-around.svg', 'get-around.svg', '', 0, 1),
(45, 'learning-blue.svg', 'learning-blue.svg', '', 0, 1),
(46, 'learning-cyan.svg', 'learning-cyan.svg', '', 0, 1),
(47, 'learning-gray.svg', 'learning-gray.svg', '', 0, 1),
(48, 'learning-green.svg', 'learning-green.svg', '', 0, 1),
(49, 'learning-orange.svg', 'learning-orange.svg', '', 0, 1),
(50, 'learning-pink.svg', 'learning-pink.svg', '', 0, 1),
(51, 'learning-purple.svg', 'learning-purple.svg', '', 0, 1),
(52, 'learning-red.svg', 'learning-red.svg', '', 0, 1),
(53, 'learning-teal.svg', 'learning-teal.svg', '', 0, 1),
(54, 'learning-yellow.svg', 'learning-yellow.svg', '', 0, 1),
(55, 'learning.svg', 'learning.svg', '', 0, 1),
(56, 'opportunities-blue.svg', 'opportunities-blue.svg', '', 0, 1),
(57, 'opportunities-cyan.svg', 'opportunities-cyan.svg', '', 0, 1),
(58, 'opportunities-gray.svg', 'opportunities-gray.svg', '', 0, 1),
(59, 'opportunities-green.svg', 'opportunities-green.svg', '', 0, 1),
(60, 'opportunities-orange.svg', 'opportunities-orange.svg', '', 0, 1),
(61, 'opportunities-pink.svg', 'opportunities-pink.svg', '', 0, 1),
(62, 'opportunities-purple.svg', 'opportunities-purple.svg', '', 0, 1),
(63, 'opportunities-red.svg', 'opportunities-red.svg', '', 0, 1),
(64, 'opportunities-teal.svg', 'opportunities-teal.svg', '', 0, 1),
(65, 'opportunities-yellow.svg', 'opportunities-yellow.svg', '', 0, 1),
(66, 'opportunities.svg', 'opportunities.svg', '', 0, 1),
(67, 'stay-blue.svg', 'stay-blue.svg', '', 0, 1),
(68, 'stay-cyan.svg', 'stay-cyan.svg', '', 0, 1),
(69, 'stay-gray.svg', 'stay-gray.svg', '', 0, 1),
(70, 'stay-green.svg', 'stay-green.svg', '', 0, 1),
(71, 'stay-orange.svg', 'stay-orange.svg', '', 0, 1),
(72, 'stay-pink.svg', 'stay-pink.svg', '', 0, 1),
(73, 'stay-purple.svg', 'stay-purple.svg', '', 0, 1),
(74, 'stay-red.svg', 'stay-red.svg', '', 0, 1),
(75, 'stay-teal.svg', 'stay-teal.svg', '', 0, 1),
(76, 'stay-yellow.svg', 'stay-yellow.svg', '', 0, 1),
(77, 'stay.svg', 'stay.svg', '', 0, 1),
(78, 'whats-on-blue.svg', 'whats-on-blue.svg', '', 0, 1),
(79, 'whats-on-cyan.svg', 'whats-on-cyan.svg', '', 0, 1),
(80, 'whats-on-gray.svg', 'whats-on-gray.svg', '', 0, 1),
(81, 'whats-on-green.svg', 'whats-on-green.svg', '', 0, 1),
(82, 'whats-on-orange.svg', 'whats-on-orange.svg', '', 0, 1),
(83, 'whats-on-pink.svg', 'whats-on-pink.svg', '', 0, 1),
(84, 'whats-on-purple.svg', 'whats-on-purple.svg', '', 0, 1),
(85, 'whats-on-red.svg', 'whats-on-red.svg', '', 0, 1),
(86, 'whats-on-teal.svg', 'whats-on-teal.svg', '', 0, 1),
(87, 'whats-on-yellow.svg', 'whats-on-yellow.svg', '', 0, 1),
(88, 'whats-on.svg', 'whats-on.svg', '', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_countries`
--

CREATE TABLE `list_countries` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_countries`
--

INSERT INTO `list_countries` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'af.svg', 'af', 'Afghanistan', 1, 1),
(2, 'ax.svg', 'ax', 'Åland Islands', 2, 1),
(3, 'al.svg', 'al', 'Albania', 3, 1),
(4, 'dz.svg', 'dz', 'Algeria', 4, 1),
(5, 'as.svg', 'as', 'American Samoa', 5, 1),
(6, 'ad.svg', 'ad', 'Andorra', 6, 1),
(7, 'ao.svg', 'ao', 'Angola', 7, 1),
(8, 'ai.svg', 'ai', 'Anguilla', 8, 1),
(9, 'aq.svg', 'aq', 'Antarctica', 9, 1),
(10, 'ag.svg', 'ag', 'Antigua and Barbuda', 10, 1),
(11, 'ar.svg', 'ar', 'Argentina', 11, 1),
(12, 'am.svg', 'am', 'Armenia', 12, 1),
(13, 'aw.svg', 'aw', 'Aruba', 13, 1),
(14, 'sh-ac.svg', 'sh', 'Ascension Island', 14, 1),
(15, 'au.svg', 'au', 'Australia', 15, 1),
(16, 'at.svg', 'at', 'Austria', 16, 1),
(17, 'az.svg', 'az', 'Azerbaijan', 17, 1),
(18, 'bs.svg', 'bs', 'Bahamas', 18, 1),
(19, 'bh.svg', 'bh', 'Bahrain', 19, 1),
(20, 'bd.svg', 'bd', 'Bangladesh', 20, 1),
(21, 'bb.svg', 'bb', 'Barbados', 21, 1),
(22, 'es-pv.svg', 'es', 'Basque Country', 22, 1),
(23, 'by.svg', 'by', 'Belarus', 23, 1),
(24, 'be.svg', 'be', 'Belgium', 24, 1),
(25, 'bz.svg', 'bz', 'Belize', 25, 1),
(26, 'bj.svg', 'bj', 'Benin', 26, 1),
(27, 'bm.svg', 'bm', 'Bermuda', 27, 1),
(28, 'bt.svg', 'bt', 'Bhutan', 28, 1),
(29, 'bo.svg', 'bo', 'Bolivia', 29, 1),
(30, 'bq.svg', 'bq', 'Bonaire, Sint Eustatius and Saba', 30, 1),
(31, 'ba.svg', 'ba', 'Bosnia and Herzegovina', 31, 1),
(32, 'bw.svg', 'bw', 'Botswana', 32, 1),
(33, 'bv.svg', 'bv', 'Bouvet Island', 33, 1),
(34, 'br.svg', 'br', 'Brazil', 34, 1),
(35, 'io.svg', 'io', 'British Indian Ocean Territory', 35, 1),
(36, 'vg.svg', 'vg', 'British Virgin Islands', 36, 1),
(37, 'bn.svg', 'bn', 'Brunei', 37, 1),
(38, 'bg.svg', 'bg', 'Bulgaria', 38, 1),
(39, 'bf.svg', 'bf', 'Burkina Faso', 39, 1),
(40, 'bi.svg', 'bi', 'Burundi', 40, 1),
(41, 'kh.svg', 'kh', 'Cambodia', 41, 1),
(42, 'cm.svg', 'cm', 'Cameroon', 42, 1),
(43, 'ca.svg', 'ca', 'Canada', 43, 1),
(44, 'cv.svg', 'cv', 'Cape Verde', 44, 1),
(45, 'es-ct.svg', 'es', 'Catalonia', 45, 1),
(46, 'ky.svg', 'ky', 'Cayman Islands', 46, 1),
(47, 'cf.svg', 'cf', 'Central African Republic', 47, 1),
(48, 'td.svg', 'td', 'Chad', 48, 1),
(49, 'cl.svg', 'cl', 'Chile', 49, 1),
(50, 'cn.svg', 'cn', 'China', 50, 1),
(51, 'cx.svg', 'cx', 'Christmas Island', 51, 1),
(52, 'cc.svg', 'cc', 'Cocos (Keeling) Islands', 52, 1),
(53, 'co.svg', 'co', 'Colombia', 53, 1),
(54, 'km.svg', 'km', 'Comoros', 54, 1),
(55, 'cg.svg', 'cg', 'Congo', 55, 1),
(56, 'cd.svg', 'cd', 'Congo (DRC)', 56, 1),
(57, 'ck.svg', 'ck', 'Cook Islands', 57, 1),
(58, 'cr.svg', 'cr', 'Costa Rica', 58, 1),
(59, 'hr.svg', 'hr', 'Croatia', 59, 1),
(60, 'cu.svg', 'cu', 'Cuba', 60, 1),
(61, 'cw.svg', 'cw', 'Curaçao', 61, 1),
(62, 'cy.svg', 'cy', 'Cyprus', 62, 1),
(63, 'cz.svg', 'cz', 'Czech Republic', 63, 1),
(64, 'dk.svg', 'dk', 'Denmark', 64, 1),
(65, 'dj.svg', 'dj', 'Djibouti', 65, 1),
(66, 'dm.svg', 'dm', 'Dominica', 66, 1),
(67, 'do.svg', 'do', 'Dominican Republic', 67, 1),
(68, 'ec.svg', 'ec', 'Ecuador', 68, 1),
(69, 'eg.svg', 'eg', 'Egypt', 69, 1),
(70, 'sv.svg', 'sv', 'El Salvador', 70, 1),
(71, 'gb-eng.svg', 'gb', 'England', 71, 1),
(72, 'gq.svg', 'gq', 'Equatorial Guinea', 72, 1),
(73, 'er.svg', 'er', 'Eritrea', 73, 1),
(74, 'ee.svg', 'ee', 'Estonia', 74, 1),
(75, 'sz.svg', 'sz', 'Eswatini', 75, 1),
(76, 'et.svg', 'et', 'Ethiopia', 76, 1),
(77, 'fk.svg', 'fk', 'Falkland Islands', 77, 1),
(78, 'fo.svg', 'fo', 'Faroe Islands', 78, 1),
(79, 'fj.svg', 'fj', 'Fiji', 79, 1),
(80, 'fi.svg', 'fi', 'Finland', 80, 1),
(81, 'fr.svg', 'fr', 'France', 81, 1),
(82, 'gf.svg', 'gf', 'French Guiana', 82, 1),
(83, 'pf.svg', 'pf', 'French Polynesia', 83, 1),
(84, 'tf.svg', 'tf', 'French Southern Territories', 84, 1),
(85, 'ga.svg', 'ga', 'Gabon', 85, 1),
(86, 'es-ga.svg', 'es', 'Galicia', 86, 1),
(87, 'gm.svg', 'gm', 'Gambia', 87, 1),
(88, 'ge.svg', 'ge', 'Georgia', 88, 1),
(89, 'de.svg', 'de', 'Germany', 89, 1),
(90, 'gh.svg', 'gh', 'Ghana', 90, 1),
(91, 'gi.svg', 'gi', 'Gibraltar', 91, 1),
(92, 'gr.svg', 'gr', 'Greece', 92, 1),
(93, 'gl.svg', 'gl', 'Greenland', 93, 1),
(94, 'gd.svg', 'gd', 'Grenada', 94, 1),
(95, 'gp.svg', 'gp', 'Guadeloupe', 95, 1),
(96, 'gu.svg', 'gu', 'Guam', 96, 1),
(97, 'gt.svg', 'gt', 'Guatemala', 97, 1),
(98, 'gg.svg', 'gg', 'Guernsey', 98, 1),
(99, 'gn.svg', 'gn', 'Guinea', 99, 1),
(100, 'gw.svg', 'gw', 'Guinea-Bissau', 100, 1),
(101, 'gy.svg', 'gy', 'Guyana', 101, 1),
(102, 'ht.svg', 'ht', 'Haiti', 102, 1),
(103, 'hm.svg', 'hm', 'Heard Island and McDonald Islands', 103, 1),
(104, 'hn.svg', 'hn', 'Honduras', 104, 1),
(105, 'hk.svg', 'hk', 'Hong Kong', 105, 1),
(106, 'hu.svg', 'hu', 'Hungary', 106, 1),
(107, 'is.svg', 'is', 'Iceland', 107, 1),
(108, 'in.svg', 'in', 'India', 108, 1),
(109, 'id.svg', 'id', 'Indonesia', 109, 1),
(110, 'ir.svg', 'ir', 'Iran', 110, 1),
(111, 'iq.svg', 'iq', 'Iraq', 111, 1),
(112, 'ie.svg', 'ie', 'Ireland', 112, 1),
(113, 'im.svg', 'im', 'Isle of Man', 113, 1),
(114, 'il.svg', 'il', 'Israel', 114, 1),
(115, 'it.svg', 'it', 'Italy', 115, 1),
(116, 'ci.svg', 'ci', 'Ivory Coast', 116, 1),
(117, 'jm.svg', 'jm', 'Jamaica', 117, 1),
(118, 'jp.svg', 'jp', 'Japan', 118, 1),
(119, 'je.svg', 'je', 'Jersey', 119, 1),
(120, 'jo.svg', 'jo', 'Jordan', 120, 1),
(121, 'kz.svg', 'kz', 'Kazakhstan', 121, 1),
(122, 'ke.svg', 'ke', 'Kenya', 122, 1),
(123, 'ki.svg', 'ki', 'Kiribati', 123, 1),
(124, 'xk.svg', 'xk', 'Kosovo', 124, 1),
(125, 'kw.svg', 'kw', 'Kuwait', 125, 1),
(126, 'kg.svg', 'kg', 'Kyrgyzstan', 126, 1),
(127, 'la.svg', 'la', 'Laos', 127, 1),
(128, 'lv.svg', 'lv', 'Latvia', 128, 1),
(129, 'lb.svg', 'lb', 'Lebanon', 129, 1),
(130, 'ls.svg', 'ls', 'Lesotho', 130, 1),
(131, 'lr.svg', 'lr', 'Liberia', 131, 1),
(132, 'ly.svg', 'ly', 'Libya', 132, 1),
(133, 'li.svg', 'li', 'Liechtenstein', 133, 1),
(134, 'lt.svg', 'lt', 'Lithuania', 134, 1),
(135, 'lu.svg', 'lu', 'Luxembourg', 135, 1),
(136, 'mo.svg', 'mo', 'Macau', 136, 1),
(137, 'mg.svg', 'mg', 'Madagascar', 137, 1),
(138, 'mw.svg', 'mw', 'Malawi', 138, 1),
(139, 'my.svg', 'my', 'Malaysia', 139, 1),
(140, 'mv.svg', 'mv', 'Maldives', 140, 1),
(141, 'ml.svg', 'ml', 'Mali', 141, 1),
(142, 'mt.svg', 'mt', 'Malta', 142, 1),
(143, 'mh.svg', 'mh', 'Marshall Islands', 143, 1),
(144, 'mq.svg', 'mq', 'Martinique', 144, 1),
(145, 'mr.svg', 'mr', 'Mauritania', 145, 1),
(146, 'mu.svg', 'mu', 'Mauritius', 146, 1),
(147, 'yt.svg', 'yt', 'Mayotte', 147, 1),
(148, 'mx.svg', 'mx', 'Mexico', 148, 1),
(149, 'fm.svg', 'fm', 'Micronesia', 149, 1),
(150, 'md.svg', 'md', 'Moldova', 150, 1),
(151, 'mc.svg', 'mc', 'Monaco', 151, 1),
(152, 'mn.svg', 'mn', 'Mongolia', 152, 1),
(153, 'me.svg', 'me', 'Montenegro', 153, 1),
(154, 'ms.svg', 'ms', 'Montserrat', 154, 1),
(155, 'ma.svg', 'ma', 'Morocco', 155, 1),
(156, 'mz.svg', 'mz', 'Mozambique', 156, 1),
(157, 'mm.svg', 'mm', 'Myanmar', 157, 1),
(158, 'na.svg', 'na', 'Namibia', 158, 1),
(159, 'nr.svg', 'nr', 'Nauru', 159, 1),
(160, 'np.svg', 'np', 'Nepal', 160, 1),
(161, 'nl.svg', 'nl', 'Netherlands', 161, 1),
(162, 'nc.svg', 'nc', 'New Caledonia', 162, 1),
(163, 'nz.svg', 'nz', 'New Zealand', 163, 1),
(164, 'ni.svg', 'ni', 'Nicaragua', 164, 1),
(165, 'ne.svg', 'ne', 'Niger', 165, 1),
(166, 'ng.svg', 'ng', 'Nigeria', 166, 1),
(167, 'nu.svg', 'nu', 'Niue', 167, 1),
(168, 'nf.svg', 'nf', 'Norfolk Island', 168, 1),
(169, 'kp.svg', 'kp', 'North Korea', 169, 1),
(170, 'mk.svg', 'mk', 'North Macedonia', 170, 1),
(171, 'gb-nir.svg', 'gb', 'Northern Ireland', 171, 1),
(172, 'mp.svg', 'mp', 'Northern Mariana Islands', 172, 1),
(173, 'no.svg', 'no', 'Norway', 173, 1),
(174, 'om.svg', 'om', 'Oman', 174, 1),
(175, 'pk.svg', 'pk', 'Pakistan', 175, 1),
(176, 'pw.svg', 'pw', 'Palau', 176, 1),
(177, 'ps.svg', 'ps', 'Palestine', 177, 1),
(178, 'pa.svg', 'pa', 'Panama', 178, 1),
(179, 'pg.svg', 'pg', 'Papua New Guinea', 179, 1),
(180, 'py.svg', 'py', 'Paraguay', 180, 1),
(181, 'pe.svg', 'pe', 'Peru', 181, 1),
(182, 'ph.svg', 'ph', 'Philippines', 182, 1),
(183, 'pn.svg', 'pn', 'Pitcairn Islands', 183, 1),
(184, 'pl.svg', 'pl', 'Poland', 184, 1),
(185, 'pt.svg', 'pt', 'Portugal', 185, 1),
(186, 'pr.svg', 'pr', 'Puerto Rico', 186, 1),
(187, 'qa.svg', 'qa', 'Qatar', 187, 1),
(188, 're.svg', 're', 'Réunion', 188, 1),
(189, 'ro.svg', 'ro', 'Romania', 189, 1),
(190, 'ru.svg', 'ru', 'Russia', 190, 1),
(191, 'rw.svg', 'rw', 'Rwanda', 191, 1),
(192, 'bl.svg', 'bl', 'Saint Barthélemy', 192, 1),
(193, 'sh-hl.svg', 'sh', 'Saint Helena', 193, 1),
(194, 'sh.svg', 'sh', 'Saint Helena', 194, 1),
(195, 'kn.svg', 'kn', 'Saint Kitts and Nevis', 195, 1),
(196, 'lc.svg', 'lc', 'Saint Lucia', 196, 1),
(197, 'mf.svg', 'mf', 'Saint Martin', 197, 1),
(198, 'pm.svg', 'pm', 'Saint Pierre and Miquelon', 198, 1),
(199, 'vc.svg', 'vc', 'Saint Vincent', 199, 1),
(200, 'ws.svg', 'ws', 'Samoa', 200, 1),
(201, 'sm.svg', 'sm', 'San Marino', 201, 1),
(202, 'st.svg', 'st', 'Sao Tome and Principe', 202, 1),
(203, 'sa.svg', 'sa', 'Saudi Arabia', 203, 1),
(204, 'gb-sct.svg', 'gb', 'Scotland', 204, 1),
(205, 'sn.svg', 'sn', 'Senegal', 205, 1),
(206, 'rs.svg', 'rs', 'Serbia', 206, 1),
(207, 'sc.svg', 'sc', 'Seychelles', 207, 1),
(208, 'sl.svg', 'sl', 'Sierra Leone', 208, 1),
(209, 'sg.svg', 'sg', 'Singapore', 209, 1),
(210, 'sx.svg', 'sx', 'Sint Maarten', 210, 1),
(211, 'sk.svg', 'sk', 'Slovakia', 211, 1),
(212, 'si.svg', 'si', 'Slovenia', 212, 1),
(213, 'sb.svg', 'sb', 'Solomon Islands', 213, 1),
(214, 'so.svg', 'so', 'Somalia', 214, 1),
(215, 'za.svg', 'za', 'South Africa', 215, 1),
(216, 'gs.svg', 'gs', 'South Georgia and the South Sandwich Islands', 216, 1),
(217, 'kr.svg', 'kr', 'South Korea', 217, 1),
(218, 'ss.svg', 'ss', 'South Sudan', 218, 1),
(219, 'es.svg', 'es', 'Spain', 219, 1),
(220, 'lk.svg', 'lk', 'Sri Lanka', 220, 1),
(221, 'sd.svg', 'sd', 'Sudan', 221, 1),
(222, 'sr.svg', 'sr', 'Suriname', 222, 1),
(223, 'sj.svg', 'sj', 'Svalbard and Jan Mayen', 223, 1),
(224, 'se.svg', 'se', 'Sweden', 224, 1),
(225, 'ch.svg', 'ch', 'Switzerland', 225, 1),
(226, 'sy.svg', 'sy', 'Syria', 226, 1),
(227, 'tw.svg', 'tw', 'Taiwan', 227, 1),
(228, 'tj.svg', 'tj', 'Tajikistan', 228, 1),
(229, 'tz.svg', 'tz', 'Tanzania', 229, 1),
(230, 'th.svg', 'th', 'Thailand', 230, 1),
(231, 'tl.svg', 'tl', 'Timor-Leste', 231, 1),
(232, 'tg.svg', 'tg', 'Togo', 232, 1),
(233, 'tk.svg', 'tk', 'Tokelau', 233, 1),
(234, 'to.svg', 'to', 'Tonga', 234, 1),
(235, 'tt.svg', 'tt', 'Trinidad and Tobago', 235, 1),
(236, 'sh-ta.svg', 'sh', 'Tristan da Cunha', 236, 1),
(237, 'tn.svg', 'tn', 'Tunisia', 237, 1),
(238, 'tr.svg', 'tr', 'Turkey', 238, 1),
(239, 'tm.svg', 'tm', 'Turkmenistan', 239, 1),
(240, 'tc.svg', 'tc', 'Turks and Caicos Islands', 240, 1),
(241, 'tv.svg', 'tv', 'Tuvalu', 241, 1),
(242, 'um.svg', 'um', 'U.S. Minor Outlying Islands', 242, 1),
(243, 'vi.svg', 'vi', 'U.S. Virgin Islands', 243, 1),
(244, 'ae.svg', 'ae', 'UAE', 244, 1),
(245, 'ug.svg', 'ug', 'Uganda', 245, 1),
(246, 'ua.svg', 'ua', 'Ukraine', 246, 1),
(247, 'gb.svg', 'gb', 'United Kingdom', 247, 1),
(248, 'us.svg', 'us', 'United States', 248, 1),
(249, 'uy.svg', 'uy', 'Uruguay', 249, 1),
(250, 'uz.svg', 'uz', 'Uzbekistan', 250, 1),
(251, 'vu.svg', 'vu', 'Vanuatu', 251, 1),
(252, 'va.svg', 'va', 'Vatican City', 252, 1),
(253, 've.svg', 've', 'Venezuela', 253, 1),
(254, 'vn.svg', 'vn', 'Vietnam', 254, 1),
(255, 'gb-wls.svg', 'gb', 'Wales', 255, 1),
(256, 'wf.svg', 'wf', 'Wallis and Futuna', 256, 1),
(257, 'eh.svg', 'eh', 'Western Sahara', 257, 1),
(258, 'ye.svg', 'ye', 'Yemen', 258, 1),
(259, 'zm.svg', 'zm', 'Zambia', 259, 1),
(260, 'zw.svg', 'zw', 'Zimbabwe', 260, 1),
(261, 'arab.svg', 'arab.svg', '', 0, 1),
(262, 'asean.svg', 'asean.svg', '', 0, 1),
(263, 'cefta.svg', 'cefta.svg', '', 0, 1),
(264, 'cp.svg', 'cp.svg', '', 0, 1),
(265, 'dg.svg', 'dg.svg', '', 0, 1),
(266, 'eac.svg', 'eac.svg', '', 0, 1),
(267, 'eu.svg', 'eu.svg', '', 0, 1),
(268, 'ic.svg', 'ic.svg', '', 0, 1),
(269, 'pc.svg', 'pc.svg', '', 0, 1),
(270, 'un.svg', 'un.svg', '', 0, 1),
(271, 'xx.svg', 'xx.svg', '', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_currencies`
--

CREATE TABLE `list_currencies` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `option_symbol` varchar(10) DEFAULT NULL,
  `option_symbol_position` enum('left','right') DEFAULT 'left',
  `option_decimal_separator` char(1) DEFAULT '.',
  `option_decimal_places` tinyint(1) DEFAULT 2,
  `option_thousands_separator` char(1) DEFAULT ',',
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_currencies`
--

INSERT INTO `list_currencies` (`id`, `option_filename`, `option_value`, `option_label`, `option_symbol`, `option_symbol_position`, `option_decimal_separator`, `option_decimal_places`, `option_thousands_separator`, `sort_order`, `is_active`) VALUES
(1, 'af.svg', 'AFN', 'Afghan Afghani', '؋', 'right', '.', 2, ',', 1, 1),
(2, 'al.svg', 'ALL', 'Albanian Lek', 'L', 'right', '.', 2, ',', 2, 1),
(3, 'dz.svg', 'DZD', 'Algerian Dinar', 'د.ج', 'right', '.', 2, ',', 3, 1),
(4, 'ao.svg', 'AOA', 'Angolan Kwanza', 'Kz', 'right', '.', 2, ',', 4, 1),
(5, 'ar.svg', 'ARS', 'Argentine Peso', '$', 'right', ',', 2, '.', 5, 1),
(6, 'am.svg', 'AMD', 'Armenian Dram', '֏', 'right', '.', 2, ',', 6, 1),
(7, 'aw.svg', 'AWG', 'Aruban Florin', 'ƒ', 'left', '.', 2, ',', 7, 1),
(8, 'au.svg', 'AUD', 'Australian Dollar', '$', 'left', '.', 2, ',', 8, 1),
(9, 'az.svg', 'AZN', 'Azerbaijani Manat', '₼', 'right', '.', 2, ',', 9, 1),
(10, 'bs.svg', 'BSD', 'Bahamian Dollar', '$', 'left', '.', 2, ',', 10, 1),
(11, 'bh.svg', 'BHD', 'Bahraini Dinar', '.د.ب', 'right', '.', 3, ',', 11, 1),
(12, 'bd.svg', 'BDT', 'Bangladeshi Taka', '৳', 'right', '.', 2, ',', 12, 1),
(13, 'bb.svg', 'BBD', 'Barbadian Dollar', '$', 'left', '.', 2, ',', 13, 1),
(14, 'by.svg', 'BYN', 'Belarusian Ruble', 'Br', 'right', ',', 2, '.', 14, 1),
(15, 'bz.svg', 'BZD', 'Belize Dollar', '$', 'left', '.', 2, ',', 15, 1),
(16, 'bm.svg', 'BMD', 'Bermudian Dollar', '$', 'left', '.', 2, ',', 16, 1),
(17, 'bt.svg', 'BTN', 'Bhutanese Ngultrum', 'Nu.', 'right', '.', 2, ',', 17, 1),
(18, 'bo.svg', 'BOB', 'Bolivian Boliviano', 'Bs.', 'right', ',', 2, '.', 18, 1),
(19, 'ba.svg', 'BAM', 'Bosnian Mark', 'KM', 'right', ',', 2, '.', 19, 1),
(20, 'bw.svg', 'BWP', 'Botswana Pula', 'P', 'right', '.', 2, ',', 20, 1),
(21, 'br.svg', 'BRL', 'Brazilian Real', 'R$', 'left', ',', 2, '.', 21, 1),
(22, 'bn.svg', 'BND', 'Brunei Dollar', '$', 'left', '.', 2, ',', 22, 1),
(23, 'bg.svg', 'BGN', 'Bulgarian Lev', 'лв', 'right', ',', 2, '.', 23, 1),
(24, 'bi.svg', 'BIF', 'Burundian Franc', 'FBu', 'right', '.', 0, ',', 24, 1),
(25, 'kh.svg', 'KHR', 'Cambodian Riel', '៛', 'right', '.', 2, ',', 25, 1),
(26, 'ca.svg', 'CAD-L', 'Canadian Dollar ($ left)', '$', 'left', '.', 2, ',', 26, 1),
(28, 'cv.svg', 'CVE', 'Cape Verdean Escudo', '$', 'left', '.', 2, ',', 28, 1),
(29, 'ky.svg', 'KYD', 'Cayman Islands Dollar', '$', 'left', '.', 2, ',', 29, 1),
(30, 'cm.svg', 'XAF', 'Central African CFA', 'FCFA', 'right', '.', 0, '', 30, 1),
(31, 'nc.svg', 'XPF', 'CFP Franc', '₣', 'right', '.', 0, ',', 31, 1),
(32, 'cl.svg', 'CLP', 'Chilean Peso', '$', 'right', ',', 0, '.', 32, 1),
(33, 'cn.svg', 'CNY', 'Chinese Yuan', '¥', 'left', '.', 2, ',', 33, 1),
(34, 'co.svg', 'COP', 'Colombian Peso', '$', 'right', ',', 2, '.', 34, 1),
(35, 'km.svg', 'KMF', 'Comorian Franc', 'CF', 'left', '.', 0, ',', 35, 1),
(36, 'cd.svg', 'CDF', 'Congolese Franc', 'FC', 'right', '.', 2, ',', 36, 1),
(37, 'cr.svg', 'CRC', 'Costa Rican Colon', '₡', 'right', '.', 2, ',', 37, 1),
(38, 'hr.svg', 'HRK', 'Croatian Kuna', 'kn', 'right', ',', 2, '.', 38, 1),
(39, 'cu.svg', 'CUP', 'Cuban Peso', '$', 'right', '.', 2, ',', 39, 1),
(40, 'cz.svg', 'CZK', 'Czech Koruna', 'Kč', 'right', ',', 2, '.', 40, 1),
(41, 'dk.svg', 'DKK', 'Danish Krone', 'kr', 'right', ',', 2, '.', 41, 1),
(42, 'dj.svg', 'DJF', 'Djiboutian Franc', 'Fdj', 'left', '.', 0, ',', 42, 1),
(43, 'do.svg', 'DOP', 'Dominican Peso', 'RD$', 'right', '.', 2, ',', 43, 1),
(44, 'ag.svg', 'XCD', 'East Caribbean Dollar', '$', 'left', '.', 2, ',', 44, 1),
(45, 'eg.svg', 'EGP', 'Egyptian Pound', 'E£', 'right', '.', 2, ',', 45, 1),
(46, 'er.svg', 'ERN', 'Eritrean Nakfa', 'Nfk', 'right', '.', 2, ',', 46, 1),
(47, 'et.svg', 'ETB', 'Ethiopian Birr', 'Br', 'right', '.', 2, ',', 47, 1),
(48, 'eu.svg', 'EUR-R', 'Euro (right €)', '€', 'right', ',', 2, '.', 48, 1),
(50, 'fk.svg', 'FKP', 'Falkland Islands Pound', '£', 'left', '.', 2, ',', 50, 1),
(51, 'fj.svg', 'FJD', 'Fijian Dollar', '$', 'left', '.', 2, ',', 51, 1),
(52, 'gm.svg', 'GMD', 'Gambian Dalasi', 'D', 'left', '.', 2, ',', 52, 1),
(53, 'ge.svg', 'GEL', 'Georgian Lari', '₾', 'right', '.', 2, ',', 53, 1),
(54, 'gh.svg', 'GHS', 'Ghanaian Cedi', '₵', 'left', '.', 2, ',', 54, 1),
(55, 'gi.svg', 'GIP', 'Gibraltar Pound', '£', 'left', '.', 2, ',', 55, 1),
(56, 'gt.svg', 'GTQ', 'Guatemalan Quetzal', 'Q', 'right', '.', 2, ',', 56, 1),
(57, 'gn.svg', 'GNF', 'Guinean Franc', 'FG', 'left', '.', 0, ',', 57, 1),
(58, 'gy.svg', 'GYD', 'Guyanese Dollar', '$', 'left', '.', 2, ',', 58, 1),
(59, 'ht.svg', 'HTG', 'Haitian Gourde', 'G', 'right', '.', 2, ',', 59, 1),
(60, 'hn.svg', 'HNL', 'Honduran Lempira', 'L', 'right', '.', 2, ',', 60, 1),
(61, 'hk.svg', 'HKD', 'Hong Kong Dollar', '$', 'left', '.', 2, ',', 61, 1),
(62, 'hu.svg', 'HUF', 'Hungarian Forint', 'Ft', 'right', ',', 2, '.', 62, 1),
(63, 'is.svg', 'ISK', 'Icelandic Krona', 'kr', 'right', '.', 0, ',', 63, 1),
(64, 'in.svg', 'INR', 'Indian Rupee', '₹', 'left', '.', 2, ',', 64, 1),
(65, 'id.svg', 'IDR', 'Indonesian Rupiah', 'Rp', 'right', ',', 2, '.', 65, 1),
(66, 'ir.svg', 'IRR', 'Iranian Rial', '﷼', 'right', '.', 2, ',', 66, 1),
(67, 'iq.svg', 'IQD', 'Iraqi Dinar', 'ع.د', 'right', '.', 3, ',', 67, 1),
(68, 'il.svg', 'ILS', 'Israeli Shekel', '₪', 'left', '.', 2, ',', 68, 1),
(69, 'jm.svg', 'JMD', 'Jamaican Dollar', '$', 'left', '.', 2, ',', 69, 1),
(70, 'jp.svg', 'JPY', 'Japanese Yen', '¥', 'left', '.', 0, ',', 70, 1),
(71, 'jo.svg', 'JOD', 'Jordanian Dinar', 'د.ا', 'right', '.', 3, ',', 71, 1),
(72, 'kz.svg', 'KZT', 'Kazakhstani Tenge', '₸', 'right', '.', 2, ',', 72, 1),
(73, 'ke.svg', 'KES', 'Kenyan Shilling', 'KSh', 'left', '.', 2, ',', 73, 1),
(74, 'kw.svg', 'KWD', 'Kuwaiti Dinar', 'د.ك', 'right', '.', 3, ',', 74, 1),
(75, 'kg.svg', 'KGS', 'Kyrgyzstani Som', 'с', 'right', '.', 2, ',', 75, 1),
(76, 'la.svg', 'LAK', 'Lao Kip', '₭', 'right', '.', 2, ',', 76, 1),
(77, 'lb.svg', 'LBP', 'Lebanese Pound', 'ل.ل', 'right', '.', 2, ',', 77, 1),
(78, 'ls.svg', 'LSL', 'Lesotho Loti', 'L', 'right', '.', 2, ',', 78, 1),
(79, 'lr.svg', 'LRD', 'Liberian Dollar', '$', 'left', '.', 2, ',', 79, 1),
(80, 'ly.svg', 'LYD', 'Libyan Dinar', 'ل.د', 'right', '.', 3, ',', 80, 1),
(81, 'mo.svg', 'MOP', 'Macanese Pataca', 'MOP$', 'left', '.', 2, ',', 81, 1),
(82, 'mk.svg', 'MKD', 'Macedonian Denar', 'ден', 'right', ',', 2, '.', 82, 1),
(83, 'mg.svg', 'MGA', 'Malagasy Ariary', 'Ar', 'right', '.', 2, ',', 83, 1),
(84, 'mw.svg', 'MWK', 'Malawian Kwacha', 'MK', 'right', '.', 2, ',', 84, 1),
(85, 'my.svg', 'MYR', 'Malaysian Ringgit', 'RM', 'left', '.', 2, ',', 85, 1),
(86, 'mv.svg', 'MVR', 'Maldivian Rufiyaa', 'Rf', 'right', '.', 2, ',', 86, 1),
(87, 'mr.svg', 'MRU', 'Mauritanian Ouguiya', 'UM', 'left', '.', 2, ',', 87, 1),
(88, 'mu.svg', 'MUR', 'Mauritian Rupee', '₨', 'right', '.', 2, ',', 88, 1),
(89, 'mx.svg', 'MXN', 'Mexican Peso', '$', 'left', '.', 2, ',', 89, 1),
(90, 'md.svg', 'MDL', 'Moldovan Leu', 'L', 'right', ',', 2, '.', 90, 1),
(91, 'mn.svg', 'MNT', 'Mongolian Tugrik', '₮', 'right', '.', 2, ',', 91, 1),
(92, 'ma.svg', 'MAD', 'Moroccan Dirham', 'د.م.', 'right', '.', 2, ',', 92, 1),
(93, 'mz.svg', 'MZN', 'Mozambican Metical', 'MT', 'right', '.', 2, ',', 93, 1),
(94, 'mm.svg', 'MMK', 'Myanmar Kyat', 'K', 'right', '.', 2, ',', 94, 1),
(95, 'na.svg', 'NAD', 'Namibian Dollar', '$', 'left', '.', 2, ',', 95, 1),
(96, 'np.svg', 'NPR', 'Nepalese Rupee', '₨', 'right', '.', 2, ',', 96, 1),
(97, 'cw.svg', 'ANG', 'Netherlands Antillean Guilder', 'ƒ', 'left', '.', 2, ',', 97, 1),
(98, 'nz.svg', 'NZD', 'New Zealand Dollar', '$', 'left', '.', 2, ',', 98, 1),
(99, 'ni.svg', 'NIO', 'Nicaraguan Cordoba', 'C$', 'right', '.', 2, ',', 99, 1),
(100, 'ng.svg', 'NGN', 'Nigerian Naira', '₦', 'left', '.', 2, ',', 100, 1),
(101, 'kp.svg', 'KPW', 'North Korean Won', '₩', 'right', '.', 2, ',', 101, 1),
(102, 'no.svg', 'NOK', 'Norwegian Krone', 'kr', 'right', ',', 2, '.', 102, 1),
(103, 'om.svg', 'OMR', 'Omani Rial', 'ر.ع.', 'right', '.', 3, ',', 103, 1),
(104, 'pk.svg', 'PKR', 'Pakistani Rupee', '₨', 'right', '.', 2, ',', 104, 1),
(105, 'pa.svg', 'PAB', 'Panamanian Balboa', 'B/.', 'left', '.', 2, ',', 105, 1),
(106, 'pg.svg', 'PGK', 'Papua New Guinean Kina', 'K', 'right', '.', 2, ',', 106, 1),
(107, 'py.svg', 'PYG', 'Paraguayan Guarani', '₲', 'right', ',', 0, '.', 107, 1),
(108, 'pe.svg', 'PEN', 'Peruvian Sol', 'S/', 'right', ',', 2, '.', 108, 1),
(109, 'ph.svg', 'PHP', 'Philippine Peso', '₱', 'left', '.', 2, ',', 109, 1),
(110, 'pl.svg', 'PLN', 'Polish Zloty', 'zł', 'right', ',', 2, '.', 110, 1),
(111, 'gb.svg', 'GBP', 'Pound Sterling', '£', 'left', '.', 2, ',', 111, 1),
(112, 'qa.svg', 'QAR', 'Qatari Riyal', 'ر.ق', 'right', '.', 2, ',', 112, 1),
(113, 'ro.svg', 'RON', 'Romanian Leu', 'lei', 'right', ',', 2, '.', 113, 1),
(114, 'ru.svg', 'RUB', 'Russian Ruble', '₽', 'right', ',', 2, '.', 114, 1),
(115, 'rw.svg', 'RWF', 'Rwandan Franc', 'FRw', 'right', '.', 0, ',', 115, 1),
(116, 'sh.svg', 'SHP', 'Saint Helena Pound', '£', 'left', '.', 2, ',', 116, 1),
(117, 'ws.svg', 'WST', 'Samoan Tala', 'T', 'right', '.', 2, ',', 117, 1),
(118, 'st.svg', 'STN', 'São Tomé Dobra', 'Db', 'right', ',', 2, '.', 118, 1),
(119, 'sa.svg', 'SAR', 'Saudi Riyal', 'ر.س', 'right', '.', 2, ',', 119, 1),
(120, 'rs.svg', 'RSD', 'Serbian Dinar', 'дин.', 'right', ',', 2, '.', 120, 1),
(121, 'sc.svg', 'SCR', 'Seychellois Rupee', '₨', 'right', '.', 2, ',', 121, 1),
(122, 'sl.svg', 'SLL', 'Sierra Leonean Leone', 'Le', 'left', '.', 2, ',', 122, 1),
(123, 'sg.svg', 'SGD', 'Singapore Dollar', '$', 'left', '.', 2, ',', 123, 1),
(124, 'sb.svg', 'SBD', 'Solomon Islands Dollar', '$', 'left', '.', 2, ',', 124, 1),
(125, 'so.svg', 'SOS', 'Somali Shilling', 'S', 'right', '.', 2, ',', 125, 1),
(126, 'za.svg', 'ZAR', 'South African Rand', 'R', 'left', '.', 2, ',', 126, 1),
(127, 'kr.svg', 'KRW', 'South Korean Won', '₩', 'right', '.', 0, ',', 127, 1),
(128, 'ss.svg', 'SSP', 'South Sudanese Pound', '£', 'left', '.', 2, ',', 128, 1),
(129, 'lk.svg', 'LKR', 'Sri Lankan Rupee', 'Rs', 'right', '.', 2, ',', 129, 1),
(130, 'sd.svg', 'SDG', 'Sudanese Pound', 'ج.س.', 'right', '.', 2, ',', 130, 1),
(131, 'sr.svg', 'SRD', 'Surinamese Dollar', '$', 'left', '.', 2, ',', 131, 1),
(132, 'sz.svg', 'SZL', 'Swazi Lilangeni', 'E', 'right', '.', 2, ',', 132, 1),
(133, 'se.svg', 'SEK', 'Swedish Krona', 'kr', 'right', ',', 2, '.', 133, 1),
(134, 'ch.svg', 'CHF-L', 'Swiss Franc (CHF left)', 'CHF', 'left', '.', 2, '\'', 134, 1),
(136, 'sy.svg', 'SYP', 'Syrian Pound', '£', 'right', '.', 2, ',', 136, 1),
(137, 'tw.svg', 'TWD', 'Taiwan Dollar', 'NT$', 'left', '.', 2, ',', 137, 1),
(138, 'tj.svg', 'TJS', 'Tajikistani Somoni', 'SM', 'right', '.', 2, ',', 138, 1),
(139, 'tz.svg', 'TZS', 'Tanzanian Shilling', 'TSh', 'right', '.', 2, ',', 139, 1),
(140, 'th.svg', 'THB', 'Thai Baht', '฿', 'left', '.', 2, ',', 140, 1),
(141, 'to.svg', 'TOP', 'Tongan Paanga', 'T$', 'right', '.', 2, ',', 141, 1),
(142, 'tt.svg', 'TTD', 'Trinidad Dollar', '$', 'left', '.', 2, ',', 142, 1),
(143, 'tn.svg', 'TND', 'Tunisian Dinar', 'د.ت', 'right', '.', 3, ',', 143, 1),
(144, 'tr.svg', 'TRY', 'Turkish Lira', '₺', 'right', '.', 2, ',', 144, 1),
(145, 'tm.svg', 'TMT', 'Turkmenistani Manat', 'm', 'right', '.', 2, ',', 145, 1),
(146, 'ae.svg', 'AED', 'UAE Dirham', 'د.إ', 'right', '.', 2, ',', 146, 1),
(147, 'ug.svg', 'UGX', 'Ugandan Shilling', 'USh', 'right', '.', 0, ',', 147, 1),
(148, 'ua.svg', 'UAH', 'Ukrainian Hryvnia', '₴', 'right', ',', 2, '.', 148, 1),
(149, 'uy.svg', 'UYU', 'Uruguayan Peso', '$', 'right', ',', 2, '.', 149, 1),
(150, 'us.svg', 'USD', 'US Dollar', '$', 'left', '.', 2, ',', 150, 1),
(151, 'uz.svg', 'UZS', 'Uzbekistani Som', 'soʻm', 'right', '.', 2, ',', 151, 1),
(152, 'vu.svg', 'VUV', 'Vanuatu Vatu', 'VT', 'right', '.', 0, ',', 152, 1),
(153, 've.svg', 'VES', 'Venezuelan Bolivar', 'Bs.', 'right', ',', 2, '.', 153, 1),
(154, 'vn.svg', 'VND', 'Vietnamese Dong', '₫', 'right', ',', 0, '.', 154, 1),
(155, 'sn.svg', 'XOF', 'West African CFA', 'CFA', 'right', '.', 0, '', 155, 1),
(156, 'ye.svg', 'YER', 'Yemeni Rial', '﷼', 'right', '.', 2, ',', 156, 1),
(157, 'zm.svg', 'ZMW', 'Zambian Kwacha', 'ZK', 'right', '.', 2, ',', 157, 1),
(158, 'zw.svg', 'ZWL', 'Zimbabwean Dollar', '$', 'left', '.', 2, ',', 158, 1),
(256, 'ad.svg', 'ad.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(258, 'ai.svg', 'ai.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(259, 'aq.svg', 'aq.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(260, 'arab.svg', 'arab.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(261, 'as.svg', 'as.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(262, 'asean.svg', 'asean.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(263, 'at.svg', 'at.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(264, 'ax.svg', 'ax.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(265, 'be.svg', 'be.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(266, 'bf.svg', 'bf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(267, 'bj.svg', 'bj.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(268, 'bl.svg', 'bl.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(269, 'bq.svg', 'bq.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(270, 'bv.svg', 'bv.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(271, 'cc.svg', 'cc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(272, 'cefta.svg', 'cefta.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(273, 'cf.svg', 'cf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(274, 'cg.svg', 'cg.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(275, 'ci.svg', 'ci.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(276, 'ck.svg', 'ck.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(277, 'cp.svg', 'cp.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(279, 'cx.svg', 'cx.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(280, 'cy.svg', 'cy.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(281, 'de.svg', 'de.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(282, 'dg.svg', 'dg.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(283, 'dm.svg', 'dm.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(284, 'eac.svg', 'eac.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(285, 'ec.svg', 'ec.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(286, 'ee.svg', 'ee.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(287, 'eh.svg', 'eh.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(288, 'es-ct.svg', 'es-ct.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(289, 'es-ga.svg', 'es-ga.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(290, 'es-pv.svg', 'es-pv.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(291, 'es.svg', 'es.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(292, 'fi.svg', 'fi.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(293, 'fm.svg', 'fm.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(294, 'fo.svg', 'fo.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(295, 'fr.svg', 'fr.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(296, 'ga.svg', 'ga.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(297, 'gb-eng.svg', 'gb-eng.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(298, 'gb-nir.svg', 'gb-nir.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(299, 'gb-sct.svg', 'gb-sct.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(300, 'gb-wls.svg', 'gb-wls.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(301, 'gd.svg', 'gd.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(302, 'gf.svg', 'gf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(303, 'gg.svg', 'gg.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(304, 'gl.svg', 'gl.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(305, 'gp.svg', 'gp.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(306, 'gq.svg', 'gq.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(307, 'gr.svg', 'gr.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(308, 'gs.svg', 'gs.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(309, 'gu.svg', 'gu.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(310, 'gw.svg', 'gw.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(311, 'hm.svg', 'hm.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(312, 'ic.svg', 'ic.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(313, 'ie.svg', 'ie.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(314, 'im.svg', 'im.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(315, 'io.svg', 'io.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(316, 'it.svg', 'it.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(317, 'je.svg', 'je.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(318, 'ki.svg', 'ki.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(319, 'kn.svg', 'kn.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(320, 'lc.svg', 'lc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(321, 'li.svg', 'li.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(322, 'lt.svg', 'lt.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(323, 'lu.svg', 'lu.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(324, 'lv.svg', 'lv.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(325, 'mc.svg', 'mc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(326, 'me.svg', 'me.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(327, 'mf.svg', 'mf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(328, 'mh.svg', 'mh.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(329, 'ml.svg', 'ml.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(330, 'mp.svg', 'mp.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(331, 'mq.svg', 'mq.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(332, 'ms.svg', 'ms.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(333, 'mt.svg', 'mt.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(334, 'ne.svg', 'ne.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(335, 'nf.svg', 'nf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(336, 'nl.svg', 'nl.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(337, 'nr.svg', 'nr.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(338, 'nu.svg', 'nu.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(339, 'pc.svg', 'pc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(340, 'pf.svg', 'pf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(341, 'pm.svg', 'pm.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(342, 'pn.svg', 'pn.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(343, 'pr.svg', 'pr.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(344, 'ps.svg', 'ps.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(345, 'pt.svg', 'pt.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(346, 'pw.svg', 'pw.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(347, 're.svg', 're.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(348, 'sh-ac.svg', 'sh-ac.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(349, 'sh-hl.svg', 'sh-hl.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(350, 'sh-ta.svg', 'sh-ta.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(352, 'si.svg', 'si.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(353, 'sj.svg', 'sj.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(354, 'sk.svg', 'sk.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(355, 'sm.svg', 'sm.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(357, 'sv.svg', 'sv.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(358, 'sx.svg', 'sx.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(359, 'tc.svg', 'tc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(360, 'td.svg', 'td.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(361, 'tf.svg', 'tf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(362, 'tg.svg', 'tg.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(363, 'tk.svg', 'tk.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(364, 'tl.svg', 'tl.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(365, 'tv.svg', 'tv.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(366, 'um.svg', 'um.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(367, 'un.svg', 'un.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(368, 'va.svg', 'va.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(369, 'vc.svg', 'vc.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(370, 'vg.svg', 'vg.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(371, 'vi.svg', 'vi.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(372, 'wf.svg', 'wf.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(373, 'xk.svg', 'xk.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(374, 'xx.svg', 'xx.svg', '', NULL, 'left', '.', 2, ',', 0, 1),
(375, 'yt.svg', 'yt.svg', '', NULL, 'left', '.', 2, ',', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_phone_prefixes`
--

CREATE TABLE `list_phone_prefixes` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_phone_prefixes`
--

INSERT INTO `list_phone_prefixes` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'af.svg', '+93', 'Afghanistan', 1, 1),
(2, 'al.svg', '+355', 'Albania', 2, 1),
(3, 'dz.svg', '+213', 'Algeria', 3, 1),
(4, 'ad.svg', '+376', 'Andorra', 4, 1),
(5, 'ao.svg', '+244', 'Angola', 5, 1),
(6, 'ag.svg', '+1', 'Antigua and Barbuda', 6, 1),
(7, 'ar.svg', '+54', 'Argentina', 7, 1),
(8, 'am.svg', '+374', 'Armenia', 8, 1),
(9, 'au.svg', '+61', 'Australia', 9, 1),
(10, 'at.svg', '+43', 'Austria', 10, 1),
(11, 'az.svg', '+994', 'Azerbaijan', 11, 1),
(12, 'bs.svg', '+1', 'Bahamas', 12, 1),
(13, 'bh.svg', '+973', 'Bahrain', 13, 1),
(14, 'bd.svg', '+880', 'Bangladesh', 14, 1),
(15, 'bb.svg', '+1', 'Barbados', 15, 1),
(16, 'by.svg', '+375', 'Belarus', 16, 1),
(17, 'be.svg', '+32', 'Belgium', 17, 1),
(18, 'bz.svg', '+501', 'Belize', 18, 1),
(19, 'bj.svg', '+229', 'Benin', 19, 1),
(20, 'bt.svg', '+975', 'Bhutan', 20, 1),
(21, 'bo.svg', '+591', 'Bolivia', 21, 1),
(22, 'ba.svg', '+387', 'Bosnia and Herzegovina', 22, 1),
(23, 'bw.svg', '+267', 'Botswana', 23, 1),
(24, 'br.svg', '+55', 'Brazil', 24, 1),
(25, 'bn.svg', '+673', 'Brunei', 25, 1),
(26, 'bg.svg', '+359', 'Bulgaria', 26, 1),
(27, 'bf.svg', '+226', 'Burkina Faso', 27, 1),
(28, 'bi.svg', '+257', 'Burundi', 28, 1),
(29, 'kh.svg', '+855', 'Cambodia', 29, 1),
(30, 'cm.svg', '+237', 'Cameroon', 30, 1),
(31, 'ca.svg', '+1', 'Canada', 31, 1),
(32, 'cv.svg', '+238', 'Cape Verde', 32, 1),
(33, 'cf.svg', '+236', 'Central African Republic', 33, 1),
(34, 'td.svg', '+235', 'Chad', 34, 1),
(35, 'cl.svg', '+56', 'Chile', 35, 1),
(36, 'cn.svg', '+86', 'China', 36, 1),
(37, 'co.svg', '+57', 'Colombia', 37, 1),
(38, 'km.svg', '+269', 'Comoros', 38, 1),
(39, 'cg.svg', '+242', 'Congo', 39, 1),
(40, 'cd.svg', '+243', 'Congo (DRC)', 40, 1),
(41, 'cr.svg', '+506', 'Costa Rica', 41, 1),
(42, 'hr.svg', '+385', 'Croatia', 42, 1),
(43, 'cu.svg', '+53', 'Cuba', 43, 1),
(44, 'cy.svg', '+357', 'Cyprus', 44, 1),
(45, 'cz.svg', '+420', 'Czech Republic', 45, 1),
(46, 'dk.svg', '+45', 'Denmark', 46, 1),
(47, 'dj.svg', '+253', 'Djibouti', 47, 1),
(48, 'dm.svg', '+1', 'Dominica', 48, 1),
(49, 'do.svg', '+1', 'Dominican Republic', 49, 1),
(50, 'ec.svg', '+593', 'Ecuador', 50, 1),
(51, 'eg.svg', '+20', 'Egypt', 51, 1),
(52, 'sv.svg', '+503', 'El Salvador', 52, 1),
(53, 'gq.svg', '+240', 'Equatorial Guinea', 53, 1),
(54, 'er.svg', '+291', 'Eritrea', 54, 1),
(55, 'ee.svg', '+372', 'Estonia', 55, 1),
(56, 'sz.svg', '+268', 'Eswatini', 56, 1),
(57, 'et.svg', '+251', 'Ethiopia', 57, 1),
(58, 'fj.svg', '+679', 'Fiji', 58, 1),
(59, 'fi.svg', '+358', 'Finland', 59, 1),
(60, 'fr.svg', '+33', 'France', 60, 1),
(61, 'ga.svg', '+241', 'Gabon', 61, 1),
(62, 'gm.svg', '+220', 'Gambia', 62, 1),
(63, 'ge.svg', '+995', 'Georgia', 63, 1),
(64, 'de.svg', '+49', 'Germany', 64, 1),
(65, 'gh.svg', '+233', 'Ghana', 65, 1),
(66, 'gr.svg', '+30', 'Greece', 66, 1),
(67, 'gd.svg', '+1', 'Grenada', 67, 1),
(68, 'gt.svg', '+502', 'Guatemala', 68, 1),
(69, 'gn.svg', '+224', 'Guinea', 69, 1),
(70, 'gw.svg', '+245', 'Guinea-Bissau', 70, 1),
(71, 'gy.svg', '+592', 'Guyana', 71, 1),
(72, 'ht.svg', '+509', 'Haiti', 72, 1),
(73, 'hn.svg', '+504', 'Honduras', 73, 1),
(74, 'hk.svg', '+852', 'Hong Kong', 74, 1),
(75, 'hu.svg', '+36', 'Hungary', 75, 1),
(76, 'is.svg', '+354', 'Iceland', 76, 1),
(77, 'in.svg', '+91', 'India', 77, 1),
(78, 'id.svg', '+62', 'Indonesia', 78, 1),
(79, 'ir.svg', '+98', 'Iran', 79, 1),
(80, 'iq.svg', '+964', 'Iraq', 80, 1),
(81, 'ie.svg', '+353', 'Ireland', 81, 1),
(82, 'il.svg', '+972', 'Israel', 82, 1),
(83, 'it.svg', '+39', 'Italy', 83, 1),
(84, 'ci.svg', '+225', 'Ivory Coast', 84, 1),
(85, 'jm.svg', '+1', 'Jamaica', 85, 1),
(86, 'jp.svg', '+81', 'Japan', 86, 1),
(87, 'jo.svg', '+962', 'Jordan', 87, 1),
(88, 'kz.svg', '+7', 'Kazakhstan', 88, 1),
(89, 'ke.svg', '+254', 'Kenya', 89, 1),
(90, 'ki.svg', '+686', 'Kiribati', 90, 1),
(91, 'xk.svg', '+383', 'Kosovo', 91, 1),
(92, 'kw.svg', '+965', 'Kuwait', 92, 1),
(93, 'kg.svg', '+996', 'Kyrgyzstan', 93, 1),
(94, 'la.svg', '+856', 'Laos', 94, 1),
(95, 'lv.svg', '+371', 'Latvia', 95, 1),
(96, 'lb.svg', '+961', 'Lebanon', 96, 1),
(97, 'ls.svg', '+266', 'Lesotho', 97, 1),
(98, 'lr.svg', '+231', 'Liberia', 98, 1),
(99, 'ly.svg', '+218', 'Libya', 99, 1),
(100, 'li.svg', '+423', 'Liechtenstein', 100, 1),
(101, 'lt.svg', '+370', 'Lithuania', 101, 1),
(102, 'lu.svg', '+352', 'Luxembourg', 102, 1),
(103, 'mo.svg', '+853', 'Macau', 103, 1),
(104, 'mg.svg', '+261', 'Madagascar', 104, 1),
(105, 'mw.svg', '+265', 'Malawi', 105, 1),
(106, 'my.svg', '+60', 'Malaysia', 106, 1),
(107, 'mv.svg', '+960', 'Maldives', 107, 1),
(108, 'ml.svg', '+223', 'Mali', 108, 1),
(109, 'mt.svg', '+356', 'Malta', 109, 1),
(110, 'mh.svg', '+692', 'Marshall Islands', 110, 1),
(111, 'mr.svg', '+222', 'Mauritania', 111, 1),
(112, 'mu.svg', '+230', 'Mauritius', 112, 1),
(113, 'mx.svg', '+52', 'Mexico', 113, 1),
(114, 'fm.svg', '+691', 'Micronesia', 114, 1),
(115, 'md.svg', '+373', 'Moldova', 115, 1),
(116, 'mc.svg', '+377', 'Monaco', 116, 1),
(117, 'mn.svg', '+976', 'Mongolia', 117, 1),
(118, 'me.svg', '+382', 'Montenegro', 118, 1),
(119, 'ma.svg', '+212', 'Morocco', 119, 1),
(120, 'mz.svg', '+258', 'Mozambique', 120, 1),
(121, 'mm.svg', '+95', 'Myanmar', 121, 1),
(122, 'na.svg', '+264', 'Namibia', 122, 1),
(123, 'nr.svg', '+674', 'Nauru', 123, 1),
(124, 'np.svg', '+977', 'Nepal', 124, 1),
(125, 'nl.svg', '+31', 'Netherlands', 125, 1),
(126, 'nz.svg', '+64', 'New Zealand', 126, 1),
(127, 'ni.svg', '+505', 'Nicaragua', 127, 1),
(128, 'ne.svg', '+227', 'Niger', 128, 1),
(129, 'ng.svg', '+234', 'Nigeria', 129, 1),
(130, 'kp.svg', '+850', 'North Korea', 130, 1),
(131, 'mk.svg', '+389', 'North Macedonia', 131, 1),
(132, 'no.svg', '+47', 'Norway', 132, 1),
(133, 'om.svg', '+968', 'Oman', 133, 1),
(134, 'pk.svg', '+92', 'Pakistan', 134, 1),
(135, 'pw.svg', '+680', 'Palau', 135, 1),
(136, 'ps.svg', '+970', 'Palestine', 136, 1),
(137, 'pa.svg', '+507', 'Panama', 137, 1),
(138, 'pg.svg', '+675', 'Papua New Guinea', 138, 1),
(139, 'py.svg', '+595', 'Paraguay', 139, 1),
(140, 'pe.svg', '+51', 'Peru', 140, 1),
(141, 'ph.svg', '+63', 'Philippines', 141, 1),
(142, 'pl.svg', '+48', 'Poland', 142, 1),
(143, 'pt.svg', '+351', 'Portugal', 143, 1),
(144, 'qa.svg', '+974', 'Qatar', 144, 1),
(145, 'ro.svg', '+40', 'Romania', 145, 1),
(146, 'ru.svg', '+7', 'Russia', 146, 1),
(147, 'rw.svg', '+250', 'Rwanda', 147, 1),
(148, 'kn.svg', '+1', 'Saint Kitts and Nevis', 148, 1),
(149, 'lc.svg', '+1', 'Saint Lucia', 149, 1),
(150, 'vc.svg', '+1', 'Saint Vincent', 150, 1),
(151, 'ws.svg', '+685', 'Samoa', 151, 1),
(152, 'sm.svg', '+378', 'San Marino', 152, 1),
(153, 'st.svg', '+239', 'Sao Tome and Principe', 153, 1),
(154, 'sa.svg', '+966', 'Saudi Arabia', 154, 1),
(155, 'sn.svg', '+221', 'Senegal', 155, 1),
(156, 'rs.svg', '+381', 'Serbia', 156, 1),
(157, 'sc.svg', '+248', 'Seychelles', 157, 1),
(158, 'sl.svg', '+232', 'Sierra Leone', 158, 1),
(159, 'sg.svg', '+65', 'Singapore', 159, 1),
(160, 'sk.svg', '+421', 'Slovakia', 160, 1),
(161, 'si.svg', '+386', 'Slovenia', 161, 1),
(162, 'sb.svg', '+677', 'Solomon Islands', 162, 1),
(163, 'so.svg', '+252', 'Somalia', 163, 1),
(164, 'za.svg', '+27', 'South Africa', 164, 1),
(165, 'kr.svg', '+82', 'South Korea', 165, 1),
(166, 'ss.svg', '+211', 'South Sudan', 166, 1),
(167, 'es.svg', '+34', 'Spain', 167, 1),
(168, 'lk.svg', '+94', 'Sri Lanka', 168, 1),
(169, 'sd.svg', '+249', 'Sudan', 169, 1),
(170, 'sr.svg', '+597', 'Suriname', 170, 1),
(171, 'se.svg', '+46', 'Sweden', 171, 1),
(172, 'ch.svg', '+41', 'Switzerland', 172, 1),
(173, 'sy.svg', '+963', 'Syria', 173, 1),
(174, 'tw.svg', '+886', 'Taiwan', 174, 1),
(175, 'tj.svg', '+992', 'Tajikistan', 175, 1),
(176, 'tz.svg', '+255', 'Tanzania', 176, 1),
(177, 'th.svg', '+66', 'Thailand', 177, 1),
(178, 'tl.svg', '+670', 'Timor-Leste', 178, 1),
(179, 'tg.svg', '+228', 'Togo', 179, 1),
(180, 'to.svg', '+676', 'Tonga', 180, 1),
(181, 'tt.svg', '+1', 'Trinidad and Tobago', 181, 1),
(182, 'tn.svg', '+216', 'Tunisia', 182, 1),
(183, 'tr.svg', '+90', 'Turkey', 183, 1),
(184, 'tm.svg', '+993', 'Turkmenistan', 184, 1),
(185, 'tv.svg', '+688', 'Tuvalu', 185, 1),
(186, 'ae.svg', '+971', 'UAE', 186, 1),
(187, 'ug.svg', '+256', 'Uganda', 187, 1),
(188, 'ua.svg', '+380', 'Ukraine', 188, 1),
(189, 'gb.svg', '+44', 'United Kingdom', 189, 1),
(190, 'us.svg', '+1', 'United States', 190, 1),
(191, 'uy.svg', '+598', 'Uruguay', 191, 1),
(192, 'uz.svg', '+998', 'Uzbekistan', 192, 1),
(193, 'vu.svg', '+678', 'Vanuatu', 193, 1),
(194, 'va.svg', '+39', 'Vatican City', 194, 1),
(195, 've.svg', '+58', 'Venezuela', 195, 1),
(196, 'vn.svg', '+84', 'Vietnam', 196, 1),
(197, 'ye.svg', '+967', 'Yemen', 197, 1),
(198, 'zm.svg', '+260', 'Zambia', 198, 1),
(199, 'zw.svg', '+263', 'Zimbabwe', 199, 1),
(200, 'ai.svg', 'ai.svg', '', 0, 1),
(201, 'aq.svg', 'aq.svg', '', 0, 1),
(202, 'arab.svg', 'arab.svg', '', 0, 1),
(203, 'as.svg', 'as.svg', '', 0, 1),
(204, 'asean.svg', 'asean.svg', '', 0, 1),
(205, 'aw.svg', 'aw.svg', '', 0, 1),
(206, 'ax.svg', 'ax.svg', '', 0, 1),
(207, 'bl.svg', 'bl.svg', '', 0, 1),
(208, 'bm.svg', 'bm.svg', '', 0, 1),
(209, 'bq.svg', 'bq.svg', '', 0, 1),
(210, 'bv.svg', 'bv.svg', '', 0, 1),
(211, 'cc.svg', 'cc.svg', '', 0, 1),
(212, 'cefta.svg', 'cefta.svg', '', 0, 1),
(213, 'ck.svg', 'ck.svg', '', 0, 1),
(214, 'cp.svg', 'cp.svg', '', 0, 1),
(215, 'cw.svg', 'cw.svg', '', 0, 1),
(216, 'cx.svg', 'cx.svg', '', 0, 1),
(217, 'dg.svg', 'dg.svg', '', 0, 1),
(218, 'eac.svg', 'eac.svg', '', 0, 1),
(219, 'eh.svg', 'eh.svg', '', 0, 1),
(220, 'es-ct.svg', 'es-ct.svg', '', 0, 1),
(221, 'es-ga.svg', 'es-ga.svg', '', 0, 1),
(222, 'es-pv.svg', 'es-pv.svg', '', 0, 1),
(223, 'eu.svg', 'eu.svg', '', 0, 1),
(224, 'fk.svg', 'fk.svg', '', 0, 1),
(225, 'fo.svg', 'fo.svg', '', 0, 1),
(226, 'gb-eng.svg', 'gb-eng.svg', '', 0, 1),
(227, 'gb-nir.svg', 'gb-nir.svg', '', 0, 1),
(228, 'gb-sct.svg', 'gb-sct.svg', '', 0, 1),
(229, 'gb-wls.svg', 'gb-wls.svg', '', 0, 1),
(230, 'gf.svg', 'gf.svg', '', 0, 1),
(231, 'gg.svg', 'gg.svg', '', 0, 1),
(232, 'gi.svg', 'gi.svg', '', 0, 1),
(233, 'gl.svg', 'gl.svg', '', 0, 1),
(234, 'gp.svg', 'gp.svg', '', 0, 1),
(235, 'gs.svg', 'gs.svg', '', 0, 1),
(236, 'gu.svg', 'gu.svg', '', 0, 1),
(237, 'hm.svg', 'hm.svg', '', 0, 1),
(238, 'ic.svg', 'ic.svg', '', 0, 1),
(239, 'im.svg', 'im.svg', '', 0, 1),
(240, 'io.svg', 'io.svg', '', 0, 1),
(241, 'je.svg', 'je.svg', '', 0, 1),
(242, 'ky.svg', 'ky.svg', '', 0, 1),
(243, 'mf.svg', 'mf.svg', '', 0, 1),
(244, 'mp.svg', 'mp.svg', '', 0, 1),
(245, 'mq.svg', 'mq.svg', '', 0, 1),
(246, 'ms.svg', 'ms.svg', '', 0, 1),
(247, 'nc.svg', 'nc.svg', '', 0, 1),
(248, 'nf.svg', 'nf.svg', '', 0, 1),
(249, 'nu.svg', 'nu.svg', '', 0, 1),
(250, 'pc.svg', 'pc.svg', '', 0, 1),
(251, 'pf.svg', 'pf.svg', '', 0, 1),
(252, 'pm.svg', 'pm.svg', '', 0, 1),
(253, 'pn.svg', 'pn.svg', '', 0, 1),
(254, 'pr.svg', 'pr.svg', '', 0, 1),
(255, 're.svg', 're.svg', '', 0, 1),
(256, 'sh-ac.svg', 'sh-ac.svg', '', 0, 1),
(257, 'sh-hl.svg', 'sh-hl.svg', '', 0, 1),
(258, 'sh-ta.svg', 'sh-ta.svg', '', 0, 1),
(259, 'sh.svg', 'sh.svg', '', 0, 1),
(260, 'sj.svg', 'sj.svg', '', 0, 1),
(261, 'sx.svg', 'sx.svg', '', 0, 1),
(262, 'tc.svg', 'tc.svg', '', 0, 1),
(263, 'tf.svg', 'tf.svg', '', 0, 1),
(264, 'tk.svg', 'tk.svg', '', 0, 1),
(265, 'um.svg', 'um.svg', '', 0, 1),
(266, 'un.svg', 'un.svg', '', 0, 1),
(267, 'vg.svg', 'vg.svg', '', 0, 1),
(268, 'vi.svg', 'vi.svg', '', 0, 1),
(269, 'wf.svg', 'wf.svg', '', 0, 1),
(270, 'xx.svg', 'xx.svg', '', 0, 1),
(271, 'yt.svg', 'yt.svg', '', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `list_system_images`
--

CREATE TABLE `list_system_images` (
  `id` int(11) NOT NULL,
  `option_filename` varchar(255) DEFAULT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `list_system_images`
--

INSERT INTO `list_system_images` (`id`, `option_filename`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, '150x40-pill-2f3b73.webp', '150x40-pill-2f3b73.webp', '', 0, 1),
(2, '150x40-pill-70.webp', '150x40-pill-70.webp', '', 0, 1),
(3, '225x60-pill-2f3b73.webp', '225x60-pill-2f3b73.webp', '', 0, 1),
(4, 'admin-messages.svg', 'admin-messages.svg', '', 0, 1),
(5, 'android-chrome-192x192.png', 'android-chrome-192x192.png', '', 0, 1),
(6, 'android-chrome-512x512.png', 'android-chrome-512x512.png', '', 0, 1),
(7, 'apple-touch-icon.png', 'apple-touch-icon.png', '', 0, 1),
(8, 'earth toy.png', 'earth toy.png', '', 0, 1),
(9, 'email-messages.svg', 'email-messages.svg', '', 0, 1),
(10, 'favicon-16x16.png', 'favicon-16x16.png', '', 0, 1),
(11, 'favicon-32x32.png', 'favicon-32x32.png', '', 0, 1),
(12, 'favicon.ico', 'favicon.ico', '', 0, 1),
(13, 'fieldset-tooltips.svg', 'fieldset-tooltips.svg', '', 0, 1),
(14, 'funmap logo square 2025-12-09.webp', 'funmap logo square 2025-12-09.webp', '', 0, 1),
(15, 'funmap logo square 2025-12-09b.webp', 'funmap logo square 2025-12-09b.webp', '', 0, 1),
(16, 'funmap welcome message 2025-12-10.webp', 'funmap welcome message 2025-12-10.webp', '', 0, 1),
(17, 'funmap welcome message 2025-12-10b.webp', 'funmap welcome message 2025-12-10b.webp', '', 0, 1),
(18, 'funmap welcome message 2025-12-10c.webp', 'funmap welcome message 2025-12-10c.webp', '', 0, 1),
(19, 'funmap welcome message 2025-12-10d.webp', 'funmap welcome message 2025-12-10d.webp', '', 0, 1),
(20, 'funmap welcome message 2025-12-10e.webp', 'funmap welcome message 2025-12-10e.webp', '', 0, 1),
(21, 'funmap welcome message 2025-12-10f.webp', 'funmap welcome message 2025-12-10f.webp', '', 0, 1),
(22, 'funmap-logo-big-1338x210.webp', 'funmap-logo-big-1338x210.webp', '', 0, 1),
(23, 'funmap-logo-small-40x40.png', 'funmap-logo-small-40x40.png', '', 0, 1),
(24, 'icon-admin.svg', 'icon-admin.svg', '', 0, 1),
(25, 'icon-close.svg', 'icon-close.svg', '', 0, 1),
(26, 'icon-discard.svg', 'icon-discard.svg', '', 0, 1),
(27, 'icon-filter.svg', 'icon-filter.svg', '', 0, 1),
(28, 'icon-fullscreen-exit.svg', 'icon-fullscreen-exit.svg', '', 0, 1),
(29, 'icon-fullscreen.svg', 'icon-fullscreen.svg', '', 0, 1),
(30, 'icon-map.svg', 'icon-map.svg', '', 0, 1),
(31, 'icon-member.svg', 'icon-member.svg', '', 0, 1),
(32, 'icon-posts.svg', 'icon-posts.svg', '', 0, 1),
(33, 'icon-recents.svg', 'icon-recents.svg', '', 0, 1),
(34, 'icon-save.svg', 'icon-save.svg', '', 0, 1),
(36, 'member-messages.svg', 'member-messages.svg', '', 0, 1),
(37, 'multi-post-icon-50.webp', 'multi-post-icon-50.webp', '', 0, 1),
(38, 'red-balloon-40.png', 'red-balloon-40.png', '', 0, 1),
(39, 'user-messages.svg', 'user-messages.svg', '', 0, 1),
(45, 'icon-camera.svg', 'icon-camera.svg', '', 0, 1),
(46, 'icon-chevron-down.svg', 'icon-chevron-down.svg', '', 0, 1),
(47, 'icon-clear.svg', 'icon-clear.svg', '', 0, 1),
(48, 'icon-compass-20.svg', 'icon-compass-20.svg', '', 0, 1),
(49, 'icon-compass-24.svg', 'icon-compass-24.svg', '', 0, 1),
(50, 'icon-geolocate-20.svg', 'icon-geolocate-20.svg', '', 0, 1),
(51, 'icon-geolocate-24.svg', 'icon-geolocate-24.svg', '', 0, 1),
(52, 'icon-minus.svg', 'icon-minus.svg', '', 0, 1),
(53, 'icon-plus.svg', 'icon-plus.svg', '', 0, 1),
(54, 'icon-search.svg', 'icon-search.svg', '', 0, 1),
(55, 'icon-map-lighting-dawn.svg', 'icon-map-lighting-dawn.svg', '', 0, 1),
(56, 'icon-map-lighting-day.svg', 'icon-map-lighting-day.svg', '', 0, 1),
(57, 'icon-map-lighting-dusk.svg', 'icon-map-lighting-dusk.svg', '', 0, 1),
(58, 'icon-map-lighting-night.svg', 'icon-map-lighting-night.svg', '', 0, 1),
(59, 'icon-favourites.svg', 'icon-favourites.svg', '', 0, 1),
(60, 'Firefly_cute-little-monkey-in-red-cape-pointing-up-937096.png', 'Firefly_cute-little-monkey-in-red-cape-pointing-up', '', 0, 1),
(61, 'Firefly_cute-little-monkey-in-red-cape-with-arms-outstretched-in-welcome-609041-600.png', 'Firefly_cute-little-monkey-in-red-cape-with-arms-o', '', 0, 1),
(62, 'Icon-ticket.svg', 'Icon-ticket.svg', '', 0, 1),
(63, 'icon-compass-white-blue.svg', 'icon-compass-white-blue.svg', '', 0, 1),
(64, 'icon-compass-white-grey.svg', 'icon-compass-white-grey.svg', '', 0, 1),
(65, 'icon-checkbox.svg', 'icon-checkbox.svg', '', 0, 1),
(66, 'icon-checkmark.svg', 'icon-checkmark.svg', '', 0, 1),
(67, 'icon-checkmark-2.svg', 'icon-checkmark-2.svg', '', 0, 1),
(68, 'icon-checkmark-3.svg', 'icon-checkmark-3.svg', '', 0, 1),
(69, 'icon-radio-selected.svg', 'icon-radio-selected.svg', '', 0, 1),
(70, 'icon-radio.svg', 'icon-radio.svg', '', 0, 1),
(71, '150x40-pill-172554.webp', '150x40-pill-172554.webp', '', 0, 1),
(72, '150x40-pill-1e3b8a.webp', '150x40-pill-1e3b8a.webp', '', 0, 1),
(73, '225x60-pill-172554.webp', '225x60-pill-172554.webp', '', 0, 1),
(74, '225x60-pill-1e3b8a.webp', '225x60-pill-1e3b8a.webp', '', 0, 1),
(75, 'icon_arrow_down.svg', 'icon_arrow_down.svg', '', 0, 1),
(76, 'icon_edit.svg', 'icon_edit.svg', '', 0, 1),
(77, 'icon_info.svg', 'icon_info.svg', '', 0, 1),
(78, 'icon_share.svg', 'icon_share.svg', '', 0, 1),
(79, 'icon_drag_handle.svg', 'icon_drag_handle.svg', '', 0, 1),
(80, 'icon_flag.svg', 'icon_flag.svg', '', 0, 1),
(81, 'icon_hide.svg', 'icon_hide.svg', '', 0, 1),
(82, 'icon_more_dots.svg', 'icon_more_dots.svg', '', 0, 1),
(83, 'icon_reactivate.svg', 'icon_reactivate.svg', '', 0, 1),
(84, 'icon_search.svg', 'icon_search.svg', '', 0, 1),
(85, 'icon_show.svg', 'icon_show.svg', '', 0, 1),
(86, 'icon_tick.svg', 'icon_tick.svg', '', 0, 1),
(87, 'icon_trash.svg', 'icon_trash.svg', '', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `logs`
--

CREATE TABLE `logs` (
  `id` int(11) NOT NULL,
  `actor_type` enum('admin','member','codex','system') DEFAULT 'codex',
  `actor_id` int(11) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `description` mediumtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `favorites` text DEFAULT NULL,
  `recent` text DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `preferred_currency` varchar(3) DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `deleted_at` datetime DEFAULT NULL,
  `backup_json` longtext DEFAULT NULL,
  `filters_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `filters_hash` char(40) DEFAULT NULL,
  `filters_version` int(11) NOT NULL DEFAULT 1,
  `filters_updated_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `members`
--

INSERT INTO `members` (`id`, `username`, `username_key`, `account_email`, `avatar_file`, `password_hash`, `map_lighting`, `map_style`, `favorites`, `recent`, `country`, `preferred_currency`, `hidden`, `deleted_at`, `backup_json`, `filters_json`, `filters_hash`, `filters_version`, `filters_updated_at`, `created_at`, `updated_at`) VALUES
(1, 'Administrator', 'administrator', 'admin@funmap.com', '00000001-avatar.jpg', '$2a$12$rVFSDdsbofrzJIphF2mx4ey3egEJp801Gp0OfLyWbydz15jUZ4mhK', NULL, NULL, '[123,456,789]', '[{\"post_id\":456,\"viewed_at\":\"2025-12-28 12:34:56\"},{\"post_id\":123,\"viewed_at\":\"2025-12-28 11:02:10\"}]', NULL, NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2025-12-27 17:34:01', '2026-01-22 14:53:37'),
(2, 'UrbanExplorer', 'urban-explorer', 'member2@funmap.com', '00000002-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(3, 'VibeHunter_Melb', 'vibe-hunter-melb', 'member3@funmap.com', '00000003-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(4, 'SydneyFoodie', 'sydney-foodie', 'member4@funmap.com', '00000004-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(5, 'LondonGigGuide', 'london-gig-guide', 'member5@funmap.com', '00000005-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(6, 'NYCVenueSpotter', 'nyc-venue-spotter', 'member6@funmap.com', '00000006-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(7, 'ParisCulture', 'paris-culture', 'member7@funmap.com', '00000007-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'France', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(8, 'BerlinBeats', 'berlin-gigs', 'member8@funmap.com', '00000008-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Germany', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(9, 'TokyoTrends', 'tokyo-trends', 'member9@funmap.com', '00000009-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'satellite', '[]', '[]', 'Japan', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(10, 'LAVibeCheck', 'la-vibe-check', 'member10@funmap.com', '00000010-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(11, 'MelbourneArt', 'melbourne-art', 'member11@funmap.com', '00000011-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(12, 'RomeRoamer', 'rome-roamer', 'member12@funmap.com', '00000012-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'Italy', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(13, 'DublinPubs', 'dublin-pubs', 'member13@funmap.com', '00000013-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Ireland', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(14, 'MadridEvents', 'madrid-events', 'member14@funmap.com', '00000014-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Spain', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(15, 'ChicagoSound', 'chicago-sound', 'member15@funmap.com', '00000015-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(16, 'SydneySurf', 'sydney-surf', 'member16@funmap.com', '00000016-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(17, 'TorontoScene', 'toronto-scene', 'member17@funmap.com', '00000017-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Canada', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(18, 'BrisbaneBites', 'brisbane-bites', 'member18@funmap.com', '00000018-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(19, 'StockholmStyle', 'stockholm-style', 'member19@funmap.com', '00000019-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'Sweden', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(20, 'AustinAnthems', 'austin-sound', 'member20@funmap.com', '00000020-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(21, 'AucklandActive', 'auckland-active', 'member21@funmap.com', '00000021-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'New Zealand', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:42:25', '2026-01-21 13:53:17'),
(22, 'HikingHunter', 'hiking-hunter', 'member22@funmap.com', '00000022-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Canada', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(23, 'ParisienneVibe', 'parisienne-vibe', 'member23@funmap.com', '00000023-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'France', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(24, 'TokyoNights', 'tokyo-nights', 'member24@funmap.com', '00000024-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Japan', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(25, 'LA_Storyteller', 'la-storyteller', 'member25@funmap.com', '00000025-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(26, 'LondonLurker', 'london-lurker', 'member26@funmap.com', '00000026-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(27, 'BerlinBound', 'berlin-bound', 'member27@funmap.com', '00000027-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Germany', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(28, 'RomeRevelry', 'rome-revelry', 'member28@funmap.com', '00000028-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'Italy', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(29, 'SydneySights', 'sydney-sights', 'member29@funmap.com', '00000029-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(30, 'MelbMusicFan', 'melb-music-fan', 'member30@funmap.com', '00000030-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(31, 'NYCNightlife', 'nyc-nightlife', 'member31@funmap.com', '00000031-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(32, 'DublinersGuide', 'dubliners-guide', 'member32@funmap.com', '00000032-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Ireland', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(33, 'MadridMover', 'madrid-mover', 'member33@funmap.com', '00000033-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Spain', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(34, 'ChicagoCuts', 'chicago-cuts', 'member34@funmap.com', '00000034-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(35, 'TorontoTalks', 'toronto-talks', 'member35@funmap.com', '00000035-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Canada', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(36, 'BrisbaneBeats', 'brisbane-beats', 'member36@funmap.com', '00000036-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(37, 'StockholmSoul', 'stockholm-soul', 'member37@funmap.com', '00000037-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'dawn', 'standard', '[]', '[]', 'Sweden', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(38, 'AustinAdventurer', 'austin-adventurer', 'member38@funmap.com', '00000038-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(39, 'AucklandArts', 'auckland-arts', 'member39@funmap.com', '00000039-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'New Zealand', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(40, 'OsloOutdoor', 'oslo-outdoor', 'member40@funmap.com', '00000040-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Norway', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(41, 'PraguePromenade', 'prague-promenade', 'member41@funmap.com', '00000041-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Czech Republic', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(42, 'ViennaViews', 'vienna-views', 'member42@funmap.com', '00000042-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Austria', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(43, 'SwissSpotter', 'swiss-spotter', 'member43@funmap.com', '00000043-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Switzerland', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(44, 'DutchDiscover', 'dutch-discover', 'member44@funmap.com', '00000044-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Netherlands', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(45, 'BrusselsBites', 'brussels-bites', 'member45@funmap.com', '00000045-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Belgium', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(46, 'LisbonLife', 'lisbon-life', 'member46@funmap.com', '00000046-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Portugal', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(47, 'AthensArt', 'athens-art', 'member47@funmap.com', '00000047-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Greece', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(48, 'SeoulScene', 'seloul-scene', 'member48@funmap.com', '00000048-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'South Korea', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(49, 'BangkokBound', 'bangkok-bound', 'member49@funmap.com', '00000049-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Thailand', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(50, 'MumbaiMusic', 'mumbai-music', 'member50@funmap.com', '00000050-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'India', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(51, 'SingaporeStyle', 'singapore-style', 'member51@funmap.com', '00000051-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Singapore', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(52, 'DubiaDazzle', 'dubai-dazzle', 'member52@funmap.com', '00000052-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'satellite', '[]', '[]', 'United Arab Emirates', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(53, 'CapeTownCulture', 'cape-town-culture', 'member53@funmap.com', '00000053-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'South Africa', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(54, 'RioRhythm', 'rio-rhythm', 'member54@funmap.com', '00000054-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Brazil', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(55, 'BAsound', 'ba-sound', 'member55@funmap.com', '00000055-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Argentina', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(56, 'MexicoCityMover', 'mexico-city-mover', 'member56@funmap.com', '00000056-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Mexico', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(57, 'MontrealMagic', 'montreal-magic', 'member57@funmap.com', '00000057-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Canada', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(58, 'VancouverVibe', 'vancouver-vibe', 'member58@funmap.com', '00000058-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Canada', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(59, 'SeattleSound', 'seattle-sound', 'member59@funmap.com', '00000059-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(60, 'PortlandPick', 'portland-pick', 'member60@funmap.com', '00000060-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(61, 'SF_Spotlight', 'sf-spotlight', 'member61@funmap.com', '00000061-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(62, 'VegasVibe', 'vegas-vibe', 'member62@funmap.com', '00000062-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(63, 'DenverDiscover', 'denver-discover', 'member63@funmap.com', '00000063-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(64, 'MiamiMusic', 'miami-music', 'member64@funmap.com', '00000064-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(65, 'AtlantaArts', 'atlanta-arts', 'member65@funmap.com', '00000065-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(66, 'NashvilleNotes', 'nashville-notes', 'member66@funmap.com', '00000066-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(67, 'BostonBeats', 'boston-beats', 'member67@funmap.com', '00000067-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(68, 'PhillyPhase', 'philly-phase', 'member68@funmap.com', '00000068-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(69, 'D_C_Discover', 'dc-discover', 'member69@funmap.com', '00000069-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United States', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(70, 'EdinburghEcho', 'edinburgh-echo', 'member70@funmap.com', '00000070-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(71, 'GlasgowGig', 'glasgow-gig', 'member71@funmap.com', '00000071-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(72, 'ManchesterMusic', 'manchester-music', 'member72@funmap.com', '00000072-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(73, 'LiverpoolListen', 'liverpool-listen', 'member73@funmap.com', '00000073-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(74, 'BrumBeats', 'brum-beats', 'member74@funmap.com', '00000074-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'United Kingdom', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(75, 'LyonLookout', 'lyon-lookout', 'member75@funmap.com', '00000075-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'France', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(76, 'MarseilleMusic', 'marseille-music', 'member76@funmap.com', '00000076-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'France', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(77, 'MunichMagic', 'munich-magic', 'member77@funmap.com', '00000077-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Germany', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(78, 'HamburgHip', 'hamburg-hip', 'member78@funmap.com', '00000078-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Germany', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(79, 'CologneCulture', 'cologne-culture', 'member79@funmap.com', '00000079-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Germany', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(80, 'MilanMove', 'milan-move', 'member80@funmap.com', '00000080-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Italy', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(81, 'FlorenceFan', 'florence-fan', 'member81@funmap.com', '00000081-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Italy', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(82, 'VeniceVibe', 'venice-vibe', 'member82@funmap.com', '00000082-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Italy', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(83, 'BarcelonaBeat', 'barcelona-beat', 'member83@funmap.com', '00000083-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Spain', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(84, 'SevilleSoul', 'seville-soul', 'member84@funmap.com', '00000084-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Spain', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(85, 'ValenciaVoice', 'valencia-voice', 'member85@funmap.com', '00000085-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Spain', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(86, 'KyotoKult', 'kyoto-kult', 'member86@funmap.com', '00000086-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Japan', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(87, 'OsakaOut', 'osaka-out', 'member87@funmap.com', '00000087-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Japan', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(88, 'SeoulSpotter', 'seoul-spotter', 'member88@funmap.com', '00000088-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'South Korea', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(89, 'HK_High', 'hk-high', 'member89@funmap.com', '00000089-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'night', 'standard', '[]', '[]', 'Hong Kong', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(90, 'TaipeiTrends', 'taipei-trends', 'member90@funmap.com', '00000090-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Taiwan', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(91, 'PerthPulse', 'perth-pulse', 'member91@funmap.com', '00000091-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(92, 'AdelaideActive', 'adelaide-active', 'member92@funmap.com', '00000092-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(93, 'HobartHip', 'hobart-hip', 'member93@funmap.com', '00000093-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(94, 'GoldCoastGig', 'gold-coast-gig', 'member94@funmap.com', '00000094-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(95, 'DarwinDiscover', 'darwin-discover', 'member95@funmap.com', '00000095-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Australia', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(96, 'WellingtonWay', 'wellington-way', 'member96@funmap.com', '00000096-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'New Zealand', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(97, 'ChristchurchCuts', 'christchurch-cuts', 'member97@funmap.com', '00000097-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'New Zealand', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(98, 'CapeTownCuts', 'capetown-cuts', 'member98@funmap.com', '00000098-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'South Africa', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(99, 'JoburgJam', 'joburg-jam', 'member99@funmap.com', '00000099-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'South Africa', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17'),
(100, 'LagosLife', 'lagos-life', 'member100@funmap.com', '00000100-avatar.jpg', '$2a$12$8kr4zPlj7KmkePoWg5IwyuvehJmRfxFGfuM0e35Qe/NJQ6TcVcCr.', 'day', 'standard', '[]', '[]', 'Nigeria', NULL, 0, NULL, NULL, NULL, NULL, 1, NULL, '2026-01-18 21:46:35', '2026-01-21 13:53:17');

-- --------------------------------------------------------

--
-- Table structure for table `member_settings`
--

CREATE TABLE `member_settings` (
  `member_setting_key` varchar(100) NOT NULL,
  `member_setting_value` text NOT NULL,
  `member_setting_type` varchar(20) NOT NULL DEFAULT 'string',
  `member_setting_description` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `member_settings`
--

INSERT INTO `member_settings` (`member_setting_key`, `member_setting_value`, `member_setting_type`, `member_setting_description`, `created_at`, `updated_at`) VALUES
('allow_username_login', '0', 'bool', 'Allow login with username instead of email', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('display_name_max_length', '50', 'int', 'Maximum display name length in characters', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('display_name_min_length', '2', 'int', 'Minimum display name length in characters', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('login_lockout_duration', '15', 'int', 'Account lockout duration in minutes', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('login_max_attempts', '5', 'int', 'Maximum failed login attempts before lockout', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_max_length', '128', 'int', 'Maximum password length in characters', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_min_length', '8', 'int', 'Minimum password length in characters', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_require_lowercase', '0', 'bool', 'Require at least one lowercase letter (a-z)', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_require_number', '0', 'bool', 'Require at least one number (0-9)', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_require_symbol', '0', 'bool', 'Require at least one special character (!@#$%^&*)', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_require_uppercase', '0', 'bool', 'Require at least one uppercase letter (A-Z)', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('password_reset_expiry', '60', 'int', 'Password reset link expiry in minutes', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('registration_enabled', '1', 'bool', 'Allow new member registrations', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('registration_require_approval', '0', 'bool', 'Require admin approval before account activation', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('registration_require_avatar', '0', 'bool', 'Require avatar URL during registration', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('registration_require_email_verify', '0', 'bool', 'Require email verification before account activation', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('remember_me_duration', '43200', 'int', 'Remember me duration in minutes (43200 = 30 days)', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('require_terms_agreement', '1', 'bool', 'Require terms and conditions agreement during registration', '2025-12-18 22:54:25', '2025-12-18 22:54:25'),
('session_timeout', '1440', 'int', 'Session timeout in minutes (1440 = 24 hours)', '2025-12-18 22:54:25', '2025-12-18 22:54:25');

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
  `reason` mediumtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  `checkout_key` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `posts`
--

INSERT INTO `posts` (`id`, `post_key`, `member_id`, `member_name`, `subcategory_key`, `loc_qty`, `visibility`, `moderation_status`, `flag_reason`, `checkout_key`, `payment_status`, `expires_at`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 'the-british-museum', 2, 'UrbanExplorer', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(2, 'natural-history-museum-london', 3, 'VibeHunter_Melb', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(3, 'tower-of-london', 4, 'SydneyFoodie', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(4, 'westminster-abbey', 5, 'LondonGigGuide', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(5, 'tate-modern', 6, 'NYCVenueSpotter', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(6, 'buckingham-palace', 7, 'ParisCulture', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(7, 'st-pauls-cathedral', 8, 'BerlinBeats', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(8, 'victoria-albert-museum', 9, 'TokyoTrends', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(9, 'london-eye', 10, 'LAVibeCheck', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(10, 'science-museum-london', 11, 'MelbourneArt', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(11, '11-sadsadasdass', 1, 'Administrator', 'live-gigs', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:48:31', '2026-01-21 15:52:55'),
(12, '12-4tretghdhg', 1, 'Administrator', 'venues', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 15:56:18', '2026-01-21 15:56:18'),
(13, '13-rsfgsgrs', 1, 'Administrator', 'live-gigs', 2, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(14, '14-little-bo-peep-has-lost-his-sheep', 1, 'Administrator', 'live-gigs', 3, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(15, '15-ujjtdrfyjtr', 1, 'Administrator', 'live-gigs', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', NULL, NULL, '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(16, '16-sydney-opera-house', 2, 'UrbanExplorer', 'theatres-concert-halls', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', '2046-01-01 00:00:00', NULL, '2026-01-23 04:52:55', '2026-01-23 05:20:04'),
(17, '17-sydney-harbour-bridge', 3, 'VibeHunter_Melb', 'landmarks', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', '2046-01-01 00:00:00', NULL, '2026-01-23 04:52:55', '2026-01-23 05:20:04'),
(18, '18-bondi-beach', 4, 'SydneyFoodie', 'parks-nature', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', '2046-01-01 00:00:00', NULL, '2026-01-23 04:52:55', '2026-01-23 05:20:04'),
(19, '19-taronga-zoo', 5, 'LondonGigGuide', 'zoos-aquariums-wildlife', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', '2046-01-01 00:00:00', NULL, '2026-01-23 04:52:55', '2026-01-23 05:20:04'),
(20, '20-royal-botanic-garden-sydney', 6, 'NYCVenueSpotter', 'parks-nature', 1, 'active', 'clean', NULL, 'premium-listing', 'paid', '2046-01-01 00:00:00', NULL, '2026-01-23 04:52:55', '2026-01-23 05:20:04');

-- --------------------------------------------------------

--
-- Table structure for table `post_amenities`
--

CREATE TABLE `post_amenities` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `amenity_key` varchar(50) NOT NULL,
  `value` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `post_amenities`
--

INSERT INTO `post_amenities` (`id`, `map_card_id`, `amenity_key`, `value`, `created_at`, `updated_at`) VALUES
(1, 11, 'parking', 1, '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(2, 11, 'wheelchair_access', 1, '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(3, 11, 'kid_friendly', 1, '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(4, 13, 'parking', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(5, 13, 'wheelchair_access', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(6, 13, 'kid_friendly', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(7, 14, 'parking', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(8, 14, 'wheelchair_access', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(9, 14, 'kid_friendly', 1, '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(10, 15, 'parking', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(11, 15, 'wheelchair_access', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(12, 15, 'kid_friendly', 0, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(13, 16, 'parking', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(14, 16, 'wheelchair_access', 0, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(15, 16, 'kid_friendly', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(16, 17, 'parking', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(17, 17, 'wheelchair_access', 0, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(18, 17, 'kid_friendly', 1, '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(19, 18, 'parking', 1, '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(20, 18, 'wheelchair_access', 1, '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(21, 18, 'kid_friendly', 1, '2026-01-22 15:14:14', '2026-01-22 15:14:14');

--
-- Triggers `post_amenities`
--
DELIMITER $$
CREATE TRIGGER `trg_post_amenities_after_delete` AFTER DELETE ON `post_amenities` FOR EACH ROW BEGIN
  UPDATE post_map_cards 
  SET amenity_summary = (
    SELECT IF(COUNT(*) > 0,
      JSON_ARRAYAGG(JSON_OBJECT('amenity', amenity_key, 'value', CAST(value AS CHAR))),
      NULL
    )
    FROM post_amenities 
    WHERE map_card_id = OLD.map_card_id
  )
  WHERE id = OLD.map_card_id;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_post_amenities_after_insert` AFTER INSERT ON `post_amenities` FOR EACH ROW BEGIN
  UPDATE post_map_cards 
  SET amenity_summary = (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT('amenity', amenity_key, 'value', CAST(value AS CHAR))
    )
    FROM post_amenities 
    WHERE map_card_id = NEW.map_card_id
  )
  WHERE id = NEW.map_card_id;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_post_amenities_after_update` AFTER UPDATE ON `post_amenities` FOR EACH ROW BEGIN
  UPDATE post_map_cards 
  SET amenity_summary = (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT('amenity', amenity_key, 'value', CAST(value AS CHAR))
    )
    FROM post_amenities 
    WHERE map_card_id = NEW.map_card_id
  )
  WHERE id = NEW.map_card_id;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `post_item_pricing`
--

CREATE TABLE `post_item_pricing` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `item_name` varchar(200) DEFAULT NULL,
  `item_variants` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`item_variants`)),
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
  `custom_checklist` text DEFAULT NULL,
  `custom_radio` varchar(255) DEFAULT NULL,
  `public_email` varchar(255) DEFAULT NULL,
  `phone_prefix` varchar(20) DEFAULT NULL,
  `public_phone` varchar(50) DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `address_line` varchar(500) DEFAULT NULL,
  `city` varchar(200) DEFAULT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `country_code` varchar(2) DEFAULT NULL,
  `timezone` varchar(50) DEFAULT NULL,
  `age_rating` varchar(50) DEFAULT NULL,
  `website_url` varchar(500) DEFAULT NULL,
  `tickets_url` varchar(500) DEFAULT NULL,
  `coupon_code` varchar(100) DEFAULT NULL,
  `session_summary` varchar(255) DEFAULT NULL COMMENT 'REFERENCE ONLY (UI/debug). Do NOT use for filtering, querying, or business logic. Source-of-truth is post_sessions.',
  `price_summary` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Pre-formatted price display string for fast frontend rendering.',
  `amenity_summary` text DEFAULT NULL COMMENT 'REFERENCE ONLY (UI/debug). Do NOT use for filtering, querying, or business logic. Source-of-truth is post_amenities.',
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `post_map_cards`
--

INSERT INTO `post_map_cards` (`id`, `post_id`, `subcategory_key`, `title`, `description`, `media_ids`, `custom_text`, `custom_textarea`, `custom_dropdown`, `custom_checklist`, `custom_radio`, `public_email`, `phone_prefix`, `public_phone`, `venue_name`, `address_line`, `city`, `latitude`, `longitude`, `country_code`, `timezone`, `age_rating`, `website_url`, `tickets_url`, `coupon_code`, `session_summary`, `price_summary`, `amenity_summary`, `created_at`, `updated_at`) VALUES
(1, 1, 'venues', 'The British Museum', 'The British Museum stands as one of the world\'s most comprehensive museums dedicated to human history, art, and culture. Located in the Bloomsbury district of London, the museum houses a permanent collection of approximately eight million works, making it one of the largest and most extensive collections in existence. The museum was established in 1753 and first opened to the public in 1759, operating from its current location on Great Russell Street since 1857.\n\nThe museum\'s collection spans over two million years of human history and includes iconic artifacts such as the Rosetta Stone, the Elgin Marbles from the Parthenon, and Egyptian mummies that draw millions of visitors annually. The architecture itself is noteworthy, featuring the Great Court designed by Norman Foster - a stunning glass-roofed courtyard that serves as the largest covered public square in Europe.\n\nAdmission to the British Museum is free, though donations are welcomed. The museum offers both permanent galleries and rotating special exhibitions throughout the year. Visitors can explore collections organized by region and era, including Ancient Egypt, Ancient Greece and Rome, Asia, and the Middle East. Audio guides and guided tours are available for those seeking deeper context about the collections.\n\nPhoto: Dale Cruse (CC BY 2.0)', '1', NULL, NULL, NULL, NULL, NULL, 'information@britishmuseum.org', '+44', '20 7323 8299', 'The British Museum', 'Great Russell St, London WC1B 3DG, UK', 'London', 51.5194133, -0.1269566, 'GB', NULL, NULL, 'https://www.britishmuseum.org', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(2, 2, 'venues', 'Natural History Museum', 'The Natural History Museum in London is one of the world\'s foremost centres for natural science research and home to an extraordinary collection of over 80 million specimens. Located in the South Kensington district, the museum occupies a magnificent Romanesque-style building designed by Alfred Waterhouse, which opened in 1881. The building itself is a masterpiece of Victorian architecture, featuring terracotta tiles depicting plants and animals throughout its facade and interior.\n\nThe museum\'s collection includes specimens collected by Charles Darwin and continues to be an active research institution where hundreds of scientists work on projects ranging from biodiversity to planetary science. The iconic Hintze Hall, formerly dominated by the beloved Diplodocus skeleton nicknamed \"Dippy,\" now showcases a spectacular blue whale skeleton suspended from the ceiling, representing the museum\'s shift toward highlighting living species and conservation.\n\nEntry to the permanent galleries is free, with special exhibitions requiring tickets. The museum offers extensive educational programs, behind-the-scenes tours, and interactive experiences for visitors of all ages. Popular exhibits include the dinosaur gallery, the vault of rare gems and minerals, and the wildlife garden that provides a green oasis in the heart of London.\n\nPhoto: Chiuchihmin (CC BY-SA 3.0)', '2', NULL, NULL, NULL, NULL, NULL, 'feedback@nhm.ac.uk', '+44', '20 7942 5000', 'Natural History Museum', 'Cromwell Road, London SW7 5BD, UK', 'London', 51.4967150, -0.1763670, 'GB', NULL, NULL, 'https://www.nhm.ac.uk', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(3, 3, 'venues', 'Tower of London', 'The Tower of London, officially Her Majesty\'s Royal Palace and Fortress of the Tower of London, stands as one of England\'s most iconic historical landmarks. Founded in 1066 as part of the Norman Conquest, the fortress has served variously as a royal residence, prison, armoury, treasury, and even a zoo. The central White Tower, which gives the entire castle its name, was built by William the Conqueror in 1078 and remains one of the finest examples of Norman military architecture in the country.\n\nThe Tower is perhaps best known for its role as a notorious prison and execution site, having held famous prisoners including Anne Boleyn, Sir Walter Raleigh, and Guy Fawkes. Today, the Tower houses the Crown Jewels of England, one of the world\'s most valuable collections of ceremonial regalia, which remains a working collection used by the Royal Family for state occasions. The iconic Yeoman Warders, known as \"Beefeaters,\" have guarded the Tower since Tudor times and now serve as tour guides sharing centuries of history.\n\nThe Tower is a UNESCO World Heritage Site and welcomes millions of visitors annually. Don\'t miss the legendary ravens - according to legend, if they ever leave the Tower, the kingdom will fall. Guided tours by Yeoman Warders are included with admission and offer entertaining and informative walks through nearly a thousand years of British history.\n\nPhoto: Interfase (CC BY-SA 4.0)', '3', NULL, NULL, NULL, NULL, NULL, 'visitorServices.TOL@hrp.org.uk', '+44', '20 3166 6000', 'Tower of London', 'London EC3N 4AB, UK', 'London', 51.5085300, -0.0761320, 'GB', NULL, NULL, 'https://www.hrp.org.uk/tower-of-london', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(4, 4, 'venues', 'Westminster Abbey', 'Westminster Abbey, formally titled the Collegiate Church of Saint Peter at Westminster, is one of Britain\'s most significant religious buildings and a masterpiece of medieval Gothic architecture. Founded in 960 AD and rebuilt in the Gothic style between 1245 and 1272, the Abbey has been the coronation church for English and British monarchs since 1066 and has hosted seventeen royal weddings, including the marriage of Prince William and Catherine Middleton in 2011.\n\nThe Abbey serves as the final resting place for over 3,300 notable figures, including seventeen monarchs, poets such as Geoffrey Chaucer and Charles Dickens in Poets\' Corner, and scientists including Isaac Newton, Charles Darwin, and Stephen Hawking. The Henry VII Lady Chapel, completed in 1519, is considered one of the finest examples of late Perpendicular Gothic architecture, featuring an extraordinary fan vault ceiling that appears to defy gravity.\n\nWestminster Abbey continues to function as an active church holding daily services while welcoming over one million visitors annually. Audio guides are available in multiple languages, and verger-led tours offer deeper insights into the Abbey\'s history and architecture. The Abbey\'s Cloisters and Chapter House, along with the Queen\'s Diamond Jubilee Galleries located high above the nave, provide additional spaces to explore this UNESCO World Heritage Site.\n\nPhoto: Wikimedia Commons (CC BY 2.0)', '4', NULL, NULL, NULL, NULL, NULL, 'info@westminster-abbey.org', '+44', '20 7222 5152', 'Westminster Abbey', '20 Dean\'s Yard, London SW1P 3PA, UK', 'London', 51.4993619, -0.1273998, 'GB', NULL, NULL, 'https://www.westminster-abbey.org', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(5, 5, 'venues', 'Tate Modern', 'Tate Modern is Britain\'s national gallery of international modern and contemporary art, housed in the former Bankside Power Station on the south bank of the River Thames. Opened in 2000, the gallery transformed the industrial building designed by Sir Giles Gilbert Scott into one of the world\'s most visited modern art museums. The dramatic Turbine Hall, the building\'s former engine room, serves as a vast entrance space that hosts monumental commissioned artworks and installations.\n\nThe collection spans from 1900 to the present day and includes major works by artists such as Pablo Picasso, Salvador Dalí, Andy Warhol, Mark Rothko, and Louise Bourgeois. The displays are arranged thematically rather than chronologically, encouraging visitors to make connections across different periods and movements. In 2016, the Switch House extension (now the Blavatnik Building) added ten floors of gallery space, including a spectacular viewing platform offering panoramic views across London.\n\nEntry to the permanent collection is free, with special exhibitions requiring tickets. The gallery is connected to St Paul\'s Cathedral on the opposite bank by the Millennium Bridge, making it easy to combine visits. Multiple restaurants, cafes, and an excellent art bookshop complement the visitor experience, while late openings on Fridays and Saturdays allow for evening cultural outings.\n\nPhoto: Wikimedia Commons (CC BY-SA 4.0)', '5', NULL, NULL, NULL, NULL, NULL, 'visiting.modern@tate.org.uk', '+44', '20 7887 8888', 'Tate Modern', 'Bankside, London SE1 9TG, UK', 'London', 51.5075940, -0.0993510, 'GB', NULL, NULL, 'https://www.tate.org.uk/visit/tate-modern', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(6, 6, 'venues', 'Buckingham Palace', 'Buckingham Palace has served as the official London residence of British sovereigns since 1837 and stands as one of the world\'s most recognizable buildings. Originally known as Buckingham House, it was built in 1703 for the Duke of Buckingham and subsequently acquired by King George III in 1761 as a private residence for Queen Charlotte. The palace was significantly enlarged and remodeled in the 19th century, with the famous East Front (the public face of the palace) added in 1847.\n\nThe palace contains 775 rooms, including 19 State Rooms, 52 royal and guest bedrooms, 188 staff bedrooms, 92 offices, and 78 bathrooms. The State Rooms are lavishly furnished with some of the greatest treasures from the Royal Collection, including paintings by Rembrandt, Rubens, and Vermeer. The Changing of the Guard ceremony, held in the palace forecourt, is one of London\'s most popular tourist attractions, showcasing British pageantry with precision military movements and traditional music.\n\nThe State Rooms are open to visitors during the summer months when the King is not in residence, typically from late July to early October. Tickets must be booked in advance and include access to the magnificent State Rooms and the 39-acre garden, home to over 350 species of wildflowers and the famous lake. The Royal Mews and the Queen\'s Gallery, both located nearby, offer additional insights into royal life and the extraordinary Royal Collection.\n\nPhoto: Ell Brown (CC BY-SA 2.0)', '6', NULL, NULL, NULL, NULL, NULL, NULL, '+44', '303 123 7300', 'Buckingham Palace', 'London SW1A 1AA, UK', 'London', 51.5008413, -0.1429878, 'GB', NULL, NULL, 'https://www.rct.uk/visit/buckingham-palace', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 15:13:09'),
(7, 7, 'venues', 'St Paul\'s Cathedral', 'St Paul\'s Cathedral is an Anglican cathedral and one of London\'s most famous and recognizable landmarks, sitting at the highest point of the City of London. The present cathedral, dating from the late 17th century, was designed by Sir Christopher Wren as part of a major rebuilding program following the Great Fire of London in 1666. Its magnificent dome, inspired by St Peter\'s Basilica in Rome, rises 365 feet to the cross at its summit and has dominated the London skyline for over 300 years.\n\nThe cathedral has been the site of many significant events in British history, including the funerals of Lord Nelson, the Duke of Wellington, and Sir Winston Churchill, as well as the wedding of Prince Charles and Lady Diana Spencer in 1981. The interior features stunning mosaics, intricate carvings by Grinling Gibbons, and the famous Whispering Gallery, where whispers against its walls can be heard clearly on the opposite side, 112 feet away.\n\nVisitors can climb 528 steps to reach the Golden Gallery at the top of the dome for breathtaking panoramic views of London. The cathedral offers guided tours, multimedia guides, and regular services and concerts. The crypt houses memorials and tombs of notable figures including Wren himself, whose epitaph reads: \"Reader, if you seek his monument, look around you.\"\n\nPhoto: Wikimedia Commons (CC BY-SA 4.0)', '7', NULL, NULL, NULL, NULL, NULL, 'reception@stpaulscathedral.org.uk', '+44', '20 7246 8350', 'St Paul\'s Cathedral', 'St Paul\'s Churchyard, London EC4M 8AD, UK', 'London', 51.5137872, -0.0984506, 'GB', NULL, NULL, 'https://www.stpauls.co.uk', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(8, 8, 'venues', 'Victoria and Albert Museum', 'The Victoria and Albert Museum, known as the V&A, is the world\'s largest museum of decorative arts, design, and sculpture, housing a permanent collection of over 2.27 million objects spanning 5,000 years of human creativity. Founded in 1852 following the Great Exhibition of 1851, the museum was renamed in honour of Queen Victoria and Prince Albert in 1899. The stunning building itself, with its ornate terracotta facade and grand entrance, is a work of art representing Victorian ambition and craftsmanship.\n\nThe museum\'s collection is extraordinarily diverse, encompassing ceramics, glass, textiles, costumes, silver, ironwork, jewellery, furniture, medieval objects, sculpture, prints, drawings, photographs, and more. Highlights include the Raphael Cartoons, the largest collection of post-classical Italian sculpture outside Italy, extensive Asian art collections, and world-renowned fashion and textile galleries. The recently opened Photography Centre and the transformed Cast Courts displaying full-size plaster replicas of major monuments showcase the museum\'s commitment to innovation.\n\nAdmission to the permanent collection is free, with ticketed temporary exhibitions. The museum includes a beautiful central courtyard garden, multiple cafes and restaurants including the stunning original Victorian refreshment rooms, and an excellent design shop. The V&A also hosts late-night Friday events combining gallery access with live music, talks, and special activities.\n\nPhoto: Diliff (CC BY-SA 3.0)', '8', NULL, NULL, NULL, NULL, NULL, 'hello@vam.ac.uk', '+44', '20 7942 2000', 'Victoria and Albert Museum', 'Cromwell Road, London SW7 2RL, UK', 'London', 51.4966670, -0.1719440, 'GB', NULL, NULL, 'https://www.vam.ac.uk', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(9, 9, 'venues', 'London Eye', 'The London Eye, originally known as the Millennium Wheel, is a cantilevered observation wheel on the South Bank of the River Thames and one of London\'s most iconic modern landmarks. Standing 135 metres tall, it was the world\'s tallest Ferris wheel when it opened in 2000 and remained the tallest in Europe until 2006. Designed by architects David Marks and Julia Barfield, the wheel was intended to operate for just five years but has become a permanent fixture of the London skyline due to its immense popularity.\n\nThe wheel carries 32 sealed and air-conditioned passenger capsules, each weighing 10 tonnes and capable of holding up to 25 people, representing the 32 London boroughs. A complete rotation takes approximately 30 minutes, during which passengers enjoy spectacular views extending up to 40 kilometres on clear days, encompassing landmarks including the Houses of Parliament, Buckingham Palace, and St Paul\'s Cathedral. The wheel rotates continuously at a slow enough speed to allow passengers to walk on and off at ground level.\n\nVarious ticket options are available, including standard, fast track, and champagne experiences. The London Eye is particularly magical at sunset and after dark when the wheel is illuminated and London\'s lights sparkle below. Adjacent attractions include the SEA LIFE London Aquarium and the London Dungeon, making the South Bank area perfect for a full day of sightseeing.\n\nPhoto: Fred Romero (CC BY 2.0)', '9', NULL, NULL, NULL, NULL, NULL, 'customer.services@londoneye.com', '+44', '20 7967 8021', 'London Eye', 'Riverside Building, County Hall, Westminster Bridge Road, London SE1 7PB, UK', 'London', 51.5033000, -0.1197000, 'GB', NULL, NULL, 'https://www.londoneye.com', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(10, 10, 'venues', 'Science Museum', 'The Science Museum in South Kensington is one of the world\'s most celebrated science museums, welcoming over three million visitors annually with its remarkable collection of scientific, technological, engineering, and medical achievements. Founded in 1857, the museum holds over 300,000 items including iconic objects such as Stephenson\'s Rocket, the first jet engine, and the Apollo 10 command module. The museum\'s mission is to inspire visitors with the wonders of science and technology and their impact on our lives.\n\nThe museum spans seven floors and covers topics from space exploration to medical history, from computing to climate science. Interactive galleries encourage hands-on learning, while the Wonderlab gallery provides immersive experiments with light, sound, and forces. The IMAX cinema shows stunning 3D documentaries, and the flight simulator offers thrilling experiences. Historic galleries house beautifully preserved machinery and instruments that trace the evolution of human innovation.\n\nEntry to the permanent collection is free, with charges for special exhibitions, IMAX films, and simulator experiences. The museum hosts popular science nights for adults, family sleepovers under the aircraft in the Flight gallery, and extensive educational programs for school groups. Located on Exhibition Road alongside the Natural History Museum and V&A, it forms part of an exceptional cultural quarter that can easily fill several days of exploration.\n\nPhoto: Wikimedia Commons (CC BY 2.0)', '10', NULL, NULL, NULL, NULL, NULL, 'info@sciencemuseum.ac.uk', '+44', '330 058 0058', 'Science Museum', 'Exhibition Road, South Kensington, London SW7 2DD, UK', 'London', 51.4977780, -0.1747220, 'GB', NULL, NULL, 'https://www.sciencemuseum.org.uk', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 15:13:10'),
(11, 11, 'live-gigs', 'sadsadasdass', 'asdsadasasdasdasdsa', '11', NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, 'Sydney Opera House', 'Bennelong Point, Sydney NSW 2000, Australia', NULL, -33.8567844, 151.2152967, 'AU', NULL, NULL, '', '', '', 'Fri 23 Jan - Tue 27 Jan', '[us] $23', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"1\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-21 15:48:31', '2026-01-21 21:59:12'),
(12, 12, 'venues', '4tretghdhg', 'dghdghdghhghgdh', '12', NULL, NULL, NULL, NULL, NULL, 'gdhgdhhgd@fhash.sgsf', '+213', '5534635', 'Sydney Opera House', 'Bennelong Point, Sydney NSW 2000, Australia', NULL, -33.8567844, 151.2152967, 'AU', NULL, NULL, 'https://safaga.hsfghd', NULL, NULL, NULL, NULL, NULL, '2026-01-21 15:56:18', '2026-01-21 15:56:21'),
(13, 13, 'live-gigs', 'rsfgsgrs', 'rsgrsgrsgsrgsg', '13,14,15', NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, 'Sydney Opera House', 'Bennelong Point, Sydney NSW 2000, Australia', NULL, -33.8567844, 151.2152967, 'AU', NULL, NULL, '', '', '', 'Thu 29 Jan - Sun 19 Apr', '[us] $34 - $877', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"1\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-21 18:58:35', '2026-01-21 21:59:12'),
(14, 13, 'live-gigs', 'rsfgsgrs', 'rsgrsgrsgsrgsg', '13,14,15', NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, 'Federation Square, Melbourne VIC 3000, Australia', 'Federation Square, Melbourne VIC 3000, Australia', NULL, -37.8179789, 144.9690576, 'AU', NULL, NULL, '', '', '', 'Fri 30 Jan - Tue 17 Feb', '[us] $34 - $877', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"1\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-21 18:58:35', '2026-01-21 21:59:12'),
(15, 14, 'live-gigs', 'Little Bo Peep has lost his sheep.', 'Her sheep. I don\'t know why I said his sheep. I don\'t think I did. I think the machine just misheard me.', '16,17,18,19,20', NULL, NULL, NULL, NULL, NULL, '', '+61', '5464564564', 'The Guild Theatre', '87 Railway St &, Walz St, Rockdale NSW 2216, Australia', NULL, -33.9515886, 151.1361615, 'AU', NULL, NULL, '', '', '', 'Wed 21 Jan - Thu 23 Apr', '[au] $25 - $456', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"1\"},{\"amenity\": \"kid_friendly\", \"value\": \"0\"}]', '2026-01-21 22:04:52', '2026-01-21 22:05:06'),
(16, 14, 'live-gigs', 'Little Bo Peep has lost his sheep.', 'Her sheep. I don\'t know why I said his sheep. I don\'t think I did. I think the machine just misheard me.', '16,17,18,19,20', NULL, NULL, NULL, NULL, NULL, '', '+61', '5464564564', 'Melbourne Exhibition Centre, South Wharf VIC 3006, Australia', 'Melbourne Exhibition Centre, South Wharf VIC 3006, Australia', NULL, -37.8255785, 144.9541305, 'AU', NULL, NULL, '', '', '', 'Sun 22 Feb - Mon 27 Apr', '[us] $25 - $456', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"0\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-21 22:04:52', '2026-01-21 22:05:06'),
(17, 14, 'live-gigs', 'Little Bo Peep has lost his sheep.', 'Her sheep. I don\'t know why I said his sheep. I don\'t think I did. I think the machine just misheard me.', '16,17,18,19,20', NULL, NULL, NULL, NULL, NULL, '', '+61', '5464564564', 'Adelaide Parklands', '5006, North Terrace, Adelaide SA 5000, Australia', NULL, -34.9195059, 138.5912962, 'AU', NULL, NULL, '', '', '', 'Thu 29 Jan - Tue 24 Feb', '[us] $25 - $456', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"0\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-21 22:04:52', '2026-01-21 22:05:06'),
(18, 15, 'live-gigs', 'ujjtdrfyjtr', 'tjrrttjrtjtrrjrrtj', '21,22,23,24,25', NULL, NULL, NULL, NULL, NULL, '', NULL, NULL, 'FGHT T06 UTM skudai', 'Skudai, 80990 Johor Bahru, Johor, Malaysia', NULL, 1.5619170, 103.6556344, 'MY', NULL, NULL, '', '', '', 'Wed 28 Jan - Mon 23 Feb', '[dz] 34 Ø¯.Ø¬', '[{\"amenity\": \"parking\", \"value\": \"1\"},{\"amenity\": \"wheelchair_access\", \"value\": \"1\"},{\"amenity\": \"kid_friendly\", \"value\": \"1\"}]', '2026-01-22 15:14:14', '2026-01-22 15:14:28'),
(19, 16, 'theatres-concert-halls', 'Sydney Opera House', 'The Sydney Opera House is a multi-venue performing arts centre in Sydney, New South Wales, Australia. Located on the foreshore of Sydney Harbour, it is widely regarded as one of the world\'s most famous and distinctive buildings, and a masterpiece of 20th-century architecture. \n\nThe building was designed by Danish architect Jørn Utzon and formally opened by Queen Elizabeth II on 20 October 1973. The Opera House comprises multiple performance venues, with the Concert Hall being the largest, seating 2,679 people. The Joan Sutherland Theatre is the second largest venue, primarily used for opera and ballet performances. The complex also includes the Drama Theatre, the Playhouse, and the intimate Studio venue, making it one of the busiest performing arts centres in the world. \n\nThe distinctive sail-shaped roof shells have become an iconic symbol of both Sydney and Australia. The building was inscribed as a UNESCO World Heritage Site in 2007, recognizing its outstanding universal value as a masterpiece of human creative genius. The Opera House hosts over 1,500 performances each year attended by more than 1.2 million people. \n\nPhoto: Bernard Spragg (CC0); BennyG3255 (CC BY-SA 4.0); MorePix (CC BY-SA 4.0)', '41,42,43', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sydney', -33.8568100, 151.2151400, 'AU', NULL, NULL, 'https://www.sydneyoperahouse.com', NULL, NULL, NULL, NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:31:39'),
(20, 17, 'landmarks', 'Sydney Harbour Bridge', 'The Sydney Harbour Bridge is a steel through arch bridge spanning Sydney Harbour, connecting the Sydney central business district to the North Shore. Nicknamed \"the Coathanger\" because of its arch-based design, the bridge carries eight lanes of road traffic, two railway lines, a footway, and a cycleway. It is one of the most photographed landmarks in Australia.\n\nThe bridge was designed and built by British firm Dorman Long of Middlesbrough and opened in 1932 after eight years of construction. At the time of its completion, it was the world\'s widest long-span bridge and remains the world\'s largest steel arch bridge, with the top of the arch standing 134 metres above the harbour.\n\nVisitors can climb to the summit of the bridge through the BridgeClimb experience, which offers spectacular 360-degree views of Sydney Harbour, the Opera House, and the city skyline. The Pylon Lookout museum within the southeast pylon provides exhibits about the bridge\'s construction and history.\n\nPhoto: Bookish Worm (CC BY-SA 4.0); Rodney Haywood (Attribution); JJ Harrison (CC BY-SA 3.0)', '44,45,46', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sydney', -33.8522200, 151.2105600, 'AU', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:12:05'),
(21, 18, 'parks-nature', 'Bondi Beach', 'Bondi Beach is one of Australia\'s most famous beaches and a major tourist destination located just 7 kilometres east of the Sydney central business district. The beach is approximately one kilometre long and receives millions of visitors each year, drawn by its golden sand, consistent waves, and vibrant coastal atmosphere.\n\nThe beach is home to the Bondi Icebergs Club, one of the oldest swimming clubs in Australia, famous for its ocean pool carved into the rocks at the southern end. The Bondi to Coogee coastal walk, stretching 6 kilometres along dramatic sandstone cliffs, is one of Sydney\'s most popular walking trails.\n\nBondi has a rich surf culture and was one of the first beaches in the world to establish a surf life saving club in 1907. The Bondi Beach Markets operate every Sunday, offering local crafts, fashion, and food. The area is also known for its cafes, restaurants, and street art, particularly the famous Bondi Beach Graffiti Wall.\n\nPhoto: Nick Ang (CC BY-SA 4.0); Chen Hualin (CC BY-SA 4.0); Nicolas Lannuzel (CC BY-SA 2.0)', '47,48,49', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sydney', -33.8910000, 151.2780000, 'AU', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:12:05'),
(22, 19, 'zoos-aquariums-wildlife', 'Taronga Zoo', 'Taronga Zoo Sydney is a world-renowned zoological park located on the shores of Sydney Harbour in the suburb of Mosman. Opened in 1916, the zoo is home to over 4,000 animals representing more than 350 species, many of which are rare and endangered. The name \"Taronga\" is an Aboriginal word meaning \"beautiful view.\"\n\nThe zoo offers spectacular views of the Sydney Harbour and city skyline, with many exhibits designed to showcase animals against this stunning backdrop. Key attractions include the Australian Walkabout, where visitors can encounter kangaroos and wallabies, and the Great Southern Oceans exhibit featuring Australian sea lions and Little Penguins.\n\nTaronga is actively involved in conservation efforts and participates in breeding programs for endangered species including the Sumatran Tiger, Asian Elephant, and various Australian native animals. The zoo can be reached by a scenic 12-minute ferry ride from Circular Quay, followed by a cable car journey through the grounds.\n\nPhoto: Alex Dawson (CC BY-SA 2.0); Todd (Public domain); Maksym Kozlenko (CC BY-SA 4.0)', '50,51,52', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sydney', -33.8433300, 151.2411100, 'AU', NULL, NULL, 'https://taronga.org.au/taronga-zoo', NULL, NULL, NULL, NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:12:05'),
(23, 20, 'parks-nature', 'Royal Botanic Garden, Sydney', 'The Royal Botanic Garden Sydney is a magnificent 30-hectare garden located in the heart of Sydney, adjacent to the Sydney Opera House and overlooking Sydney Harbour. Established in 1816, it is Australia\'s oldest scientific institution and one of the most important historic botanical institutions in the world.\n\nThe garden is home to an outstanding collection of plants from Australia and around the world, including rare and threatened species. Highlights include the Calyx, a stunning indoor exhibition space, the Fernery, and the Palm Grove featuring a beautiful collection of palms from around the globe. The garden also contains significant heritage buildings and monuments.\n\nThe Royal Botanic Garden is open every day of the year and admission is free. Visitors can enjoy guided walks, take an Aboriginal Heritage Tour to learn about the traditional uses of native plants, or simply relax on the lawns with views of the harbour and Opera House. The Domain, an adjacent parkland, extends the green space and hosts major public events.\n\nPhoto: Bidgee (CC BY-SA 3.0); Photographic Collection from Australia (CC BY 2.0); Harveychl (CC BY-SA 4.0)', '53,54,55', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Sydney', -33.8638900, 151.2169400, 'AU', NULL, NULL, 'https://www.botanicgardens.org.au/royal-botanic-garden-sydney', NULL, NULL, NULL, NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:12:05');

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
  `settings_json` longtext DEFAULT NULL,
  `backup_json` longtext DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `post_media`
--

INSERT INTO `post_media` (`id`, `member_id`, `post_id`, `file_name`, `file_url`, `file_size`, `settings_json`, `backup_json`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 2, 1, '1-British_Museum_2018.jpg', 'https://cdn.funmap.com/post-images/2026-01/1-British_Museum_2018.jpg', 8500000, '{\"file_name\":\"British_Museum_from_NE_2_(cropped).jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(2, 3, 2, '2-Natural_History_Museum_London_UK.jpg', 'https://cdn.funmap.com/post-images/2026-01/2-Natural_History_Museum_London_UK.jpg', 6140000, '{\"file_name\":\"Natural_History_Museum_London_Jan_2006.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(3, 4, 3, '3-Tower_of_London_48.jpg', 'https://cdn.funmap.com/post-images/2026-01/3-Tower_of_London_48.jpg', 4500000, '{\"file_name\":\"Tower_of_London_viewed_from_the_River_Thames.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(4, 5, 4, '4-Westminster-Abbey.jpg', 'https://cdn.funmap.com/post-images/2026-01/4-Westminster-Abbey.jpg', 13000000, '{\"file_name\":\"Westminster_Abbey_-_West_Door.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(5, 6, 5, '5-Tate_Modern_exterior.jpg', 'https://cdn.funmap.com/post-images/2026-01/5-Tate_Modern_exterior.jpg', 12200000, '{\"file_name\":\"Tate_Modern_-_Bankside_Power_Station.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(6, 7, 6, '6-Buckingham_Palace_from_gardens.jpg', 'https://cdn.funmap.com/post-images/2026-01/6-Buckingham_Palace_from_gardens.jpg', 4200000, '{\"file_name\":\"Buckingham_Palace_from_gardens,_London,_UK_-_Diliff.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(7, 8, 7, '7-St_Pauls_Cathedral_in_London.jpg', 'https://cdn.funmap.com/post-images/2026-01/7-St_Pauls_Cathedral_in_London.jpg', 10630000, '{\"file_name\":\"St_Paul\'s_Cathedral,_London,_England_-_Jan_2010.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:09', '2026-01-21 16:43:40'),
(8, 9, 8, '8-Victoria_and_Albert_Museum_London.jpg', 'https://cdn.funmap.com/post-images/2026-01/8-Victoria_and_Albert_Museum_London.jpg', 8850000, '{\"file_name\":\"Victoria_and_Albert_Museum_Entrance,_London,_UK_-_Diliff.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 16:43:40'),
(9, 10, 9, '9-London_Eye_River_Thames.jpg', 'https://cdn.funmap.com/post-images/2026-01/9-London_Eye_River_Thames.jpg', 7030000, '{\"file_name\":\"London_Eye_Twilight_April_2006.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 16:43:40'),
(10, 11, 10, '10-Science_Museum_London.jpg', 'https://cdn.funmap.com/post-images/2026-01/10-Science_Museum_London.jpg', 3740000, '{\"file_name\":\"Science_Museum,_Exhibition_Road,_London_SW7_-_geograph.org.uk_-_1125595.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":null,\"crop\":null}', NULL, NULL, '2026-01-21 15:13:10', '2026-01-21 16:43:40'),
(11, 1, 11, '11-0dfea7.jpg', 'https://cdn.funmap.com/post-images/2026-01/11-0dfea7.jpg', 988605, '{\"file_name\":\"Firefly_colourful balloons with sky 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":988605,\"crop\":null}', NULL, NULL, '2026-01-21 15:48:34', '2026-01-21 15:48:34'),
(12, 1, 12, '12-bf703d.jpg', 'https://cdn.funmap.com/post-images/2026-01/12-bf703d.jpg', 988605, '{\"file_name\":\"Firefly_colourful balloons with sky 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":988605,\"crop\":null}', NULL, NULL, '2026-01-21 15:56:21', '2026-01-21 15:56:21'),
(13, 1, 13, '13-62420d.jpg', 'https://cdn.funmap.com/post-images/2026-01/13-62420d.jpg', 823246, '{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 609041.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":823246,\"crop\":null}', NULL, NULL, '2026-01-21 18:58:37', '2026-01-21 18:58:37'),
(14, 1, 13, '13-3c6287.jpg', 'https://cdn.funmap.com/post-images/2026-01/13-3c6287.jpg', 823246, '{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 609041 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":823246,\"crop\":null}', NULL, NULL, '2026-01-21 18:58:40', '2026-01-21 18:58:40'),
(15, 1, 13, '13-c8290a.jpg', 'https://cdn.funmap.com/post-images/2026-01/13-c8290a.jpg', 781823, '{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 946979.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":781823,\"crop\":null}', NULL, NULL, '2026-01-21 18:58:42', '2026-01-21 18:58:42'),
(16, 1, 14, '14-1fb850.jpg', 'https://cdn.funmap.com/post-images/2026-01/14-1fb850.jpg', 1092469, '{\"file_name\":\"Firefly_earth with balloons everywhere 604889.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1092469,\"crop\":null}', NULL, NULL, '2026-01-21 22:04:55', '2026-01-21 22:04:55'),
(17, 1, 14, '14-51be3b.jpg', 'https://cdn.funmap.com/post-images/2026-01/14-51be3b.jpg', 1103812, '{\"file_name\":\"Firefly_earth with balloons everywhere 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1103812,\"crop\":null}', NULL, NULL, '2026-01-21 22:04:58', '2026-01-21 22:04:58'),
(18, 1, 14, '14-c664ad.jpg', 'https://cdn.funmap.com/post-images/2026-01/14-c664ad.jpg', 1543241, '{\"file_name\":\"Firefly_earth with balloons everywhere 135867 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1543241,\"crop\":null}', NULL, NULL, '2026-01-21 22:05:01', '2026-01-21 22:05:01'),
(19, 1, 14, '14-289606.jpg', 'https://cdn.funmap.com/post-images/2026-01/14-289606.jpg', 864224, '{\"file_name\":\"Firefly_earth with balloons everywhere 135867.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":864224,\"crop\":null}', NULL, NULL, '2026-01-21 22:05:03', '2026-01-21 22:05:03'),
(20, 1, 14, '14-803da0.jpg', 'https://cdn.funmap.com/post-images/2026-01/14-803da0.jpg', 1055349, '{\"file_name\":\"Firefly_colourful balloons with sky in top half 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1055349,\"crop\":null}', NULL, NULL, '2026-01-21 22:05:06', '2026-01-21 22:05:06'),
(21, 1, 15, '15-45bfe8.jpg', 'https://cdn.funmap.com/post-images/2026-01/15-45bfe8.jpg', 966239, '{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 609041.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":966239,\"crop\":null}', NULL, NULL, '2026-01-22 15:14:17', '2026-01-22 15:14:17'),
(22, 1, 15, '15-379498.jpg', 'https://cdn.funmap.com/post-images/2026-01/15-379498.jpg', 1151956, '{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 623313 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1151956,\"crop\":null}', NULL, NULL, '2026-01-22 15:14:20', '2026-01-22 15:14:20'),
(23, 1, 15, '15-a3b713.jpg', 'https://cdn.funmap.com/post-images/2026-01/15-a3b713.jpg', 1151956, '{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 623313.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1151956,\"crop\":null}', NULL, NULL, '2026-01-22 15:14:22', '2026-01-22 15:14:22'),
(24, 1, 15, '15-f9c6a1.jpg', 'https://cdn.funmap.com/post-images/2026-01/15-f9c6a1.jpg', 907759, '{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 407711.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":907759,\"crop\":null}', NULL, NULL, '2026-01-22 15:14:25', '2026-01-22 15:14:25'),
(25, 1, 15, '15-787e28.jpg', 'https://cdn.funmap.com/post-images/2026-01/15-787e28.jpg', 955719, '{\"file_name\":\"Firefly_cute little monkey in red cape scratching head 407711.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":955719,\"crop\":null}', NULL, NULL, '2026-01-22 15:14:28', '2026-01-22 15:14:28'),
(41, 2, 16, '00000016-Sydney_Australia._(21339175489).jpg', 'https://cdn.funmap.com/post-images/2026-01/00000016-Sydney_Australia._(21339175489).jpg', 4588171, '{\"file_name\":\"Sydney_Australia.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":4588171,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(42, 2, 16, '00000016-Interior_of_Sydney_Opera_House_Concert_Hall_during_performance.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000016-Interior_of_Sydney_Opera_House_Concert_Hall_during_performance.jpg', 2926435, '{\"file_name\":\"Sydney_Opera_House_Concert_Hall.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":2926435,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(43, 2, 16, '00000016-Joan_Sutherland_Theatre_Interior.JPG', 'https://cdn.funmap.com/post-images/2026-01/00000016-Joan_Sutherland_Theatre_Interior.JPG', 1051991, '{\"file_name\":\"Joan_Sutherland_Theatre_Interior.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":1051991,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(44, 3, 17, '00000017-Sydney_Harbour_Bridge-2022.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge-2022.jpg', 1521976, '{\"file_name\":\"Sydney_Harbour_Bridge.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":1521976,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(45, 3, 17, '00000017-Sydney_Harbour_Bridge_from_the_air.JPG', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge_from_the_air.JPG', 734525, '{\"file_name\":\"Sydney_Harbour_Bridge_Aerial.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":734525,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(46, 3, 17, '00000017-Sydney_Harbour_Bridge_from_Circular_Quay.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge_from_Circular_Quay.jpg', 8177508, '{\"file_name\":\"Sydney_Harbour_Bridge_Circular_Quay.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":8177508,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(47, 4, 18, '00000018-Bondi_from_above.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-Bondi_from_above.jpg', 7345306, '{\"file_name\":\"Bondi_Beach_Aerial.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":7345306,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:01:09'),
(48, 4, 18, '00000018-A_rip_current_pouring_over_the_people_standing_on_rock_shore_at_the_northern_end_of_Bondi_beach.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-A_rip_current_pouring_over_the_people_standing_on_rock_shore_at_the_northern_end_of_Bondi_beach.jpg', 391684, '{\"file_name\":\"Bondi_Beach_Rip_Current.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":391684,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(49, 4, 18, '00000018-Bondi_Beach,_Sydney_(15175458494).jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-Bondi_Beach,_Sydney_(15175458494).jpg', 780475, '{\"file_name\":\"Bondi_Beach_Sydney.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":780475,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(50, 5, 19, '00000019-Taronga_Park_Zoo_-7Sept2008.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-Taronga_Park_Zoo_-7Sept2008.jpg', 835461, '{\"file_name\":\"Taronga_Zoo.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":835461,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(51, 5, 19, '00000019-Rusticbridge.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-Rusticbridge.jpg', 1033829, '{\"file_name\":\"Taronga_Zoo_Rustic_Bridge.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":1033829,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:01:09'),
(52, 5, 19, '00000019-2022-06-25_Giraffes_in_Taronga_Zoo.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-2022-06-25_Giraffes_in_Taronga_Zoo.jpg', 4677850, '{\"file_name\":\"Taronga_Zoo_Giraffes.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":4677850,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(53, 6, 20, '00000020-Gates_at_Royal_Botanic_Gardens_viewed_from_Art_Gallery_Road.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000020-Gates_at_Royal_Botanic_Gardens_viewed_from_Art_Gallery_Road.jpg', 5603754, '{\"file_name\":\"Royal_Botanic_Garden_Gates.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":5603754,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(54, 6, 20, '00000020-After_the_fire_-_The_Garden_Palace_(8005393749).jpg', 'https://cdn.funmap.com/post-images/2026-01/00000020-After_the_fire_-_The_Garden_Palace_(8005393749).jpg', 375021, '{\"file_name\":\"Garden_Palace_Historical.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":375021,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46'),
(55, 6, 20, '00000020-A_view_of_Royal_Botanic_Garden_taken_from_Sydney_Tower.jpeg', 'https://cdn.funmap.com/post-images/2026-01/00000020-A_view_of_Royal_Botanic_Garden_taken_from_Sydney_Tower.jpeg', 6504334, '{\"file_name\":\"Royal_Botanic_Garden_View.jpg\",\"file_type\":\"image/jpeg\",\"file_size\":6504334,\"crop\":null}', NULL, NULL, '2026-01-23 04:52:55', '2026-01-23 05:05:46');

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

--
-- Dumping data for table `post_revisions`
--

INSERT INTO `post_revisions` (`id`, `post_id`, `post_title`, `editor_id`, `editor_name`, `edited_at`, `change_type`, `change_summary`, `data_json`, `created_at`, `updated_at`) VALUES
(1, 11, 'sadsadasdass', 1, 'Administrator', '2026-01-21 15:48:34', 'create', 'Created', '{\"subcategory_key\":\"live-gigs\",\"member_id\":1,\"member_name\":\"Administrator\",\"member_type\":\"admin\",\"skip_payment\":false,\"loc_qty\":1,\"fields\":[{\"key\":\"title\",\"type\":\"title\",\"name\":\"Title\",\"value\":\"sadsadasdass\",\"location_number\":1},{\"key\":\"description\",\"type\":\"description\",\"name\":\"Description\",\"value\":\"asdsadasasdasdasdsa\",\"location_number\":1},{\"key\":\"images\",\"type\":\"images\",\"name\":\"Images\",\"value\":[{\"file_name\":\"Firefly_colourful balloons with sky 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":988605,\"crop\":null}],\"location_number\":1},{\"key\":\"public_phone\",\"type\":\"public_phone\",\"name\":\"Public Phone\",\"value\":\"\",\"location_number\":1},{\"key\":\"public_email\",\"type\":\"public_email\",\"name\":\"Public Email\",\"value\":\"\",\"location_number\":1},{\"key\":\"website-url\",\"type\":\"website-url\",\"name\":\"Website (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"tickets-url\",\"type\":\"tickets-url\",\"name\":\"Tickets (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"coupon\",\"type\":\"coupon\",\"name\":\"Coupon\",\"value\":\"\",\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue\",\"value\":{\"venue_name\":\"Sydney Opera House\",\"address_line\":\"Bennelong Point, Sydney NSW 2000, Australia\",\"latitude\":\"-33.856784399999995\",\"longitude\":\"151.21529669999998\",\"country_code\":\"AU\"},\"location_number\":1},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"1\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":1},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-23\",\"times\":[{\"time\":\"02:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-01-27\",\"times\":[{\"time\":\"02:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Awdadfw\",\"tiers\":[{\"pricing_tier\":\"Awddwdwwd\",\"currency\":\"USD\",\"price\":\"23\"}]}]},\"age_ratings\":{\"A\":\"12\"},\"session_summary\":\"Fri 23 Jan - Tue 27 Jan\",\"price_summary\":\"[us] $23\"},\"location_number\":1},{\"key\":\"checkout\",\"type\":\"checkout\",\"name\":\"Checkout Options\",\"value\":{\"value\":\"4\",\"option_id\":\"4\",\"days\":6,\"price\":null},\"location_number\":1}]}', '2026-01-21 15:48:34', '2026-01-21 15:48:34'),
(2, 12, '4tretghdhg', 1, 'Administrator', '2026-01-21 15:56:21', 'create', 'Created', '{\"subcategory_key\":\"venues\",\"member_id\":1,\"member_name\":\"Administrator\",\"member_type\":\"admin\",\"skip_payment\":false,\"loc_qty\":1,\"fields\":[{\"key\":\"title\",\"type\":\"title\",\"name\":\"Title\",\"value\":\"4tretghdhg\",\"location_number\":1},{\"key\":\"description\",\"type\":\"description\",\"name\":\"Description\",\"value\":\"dghdghdghhghgdh\",\"location_number\":1},{\"key\":\"images\",\"type\":\"images\",\"name\":\"Images\",\"value\":[{\"file_name\":\"Firefly_colourful balloons with sky 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":988605,\"crop\":null}],\"location_number\":1},{\"key\":\"public_phone\",\"type\":\"public_phone\",\"name\":\"Public Phone\",\"value\":{\"phone_prefix\":\"+213\",\"public_phone\":\"5534635\"},\"location_number\":1},{\"key\":\"public_email\",\"type\":\"public_email\",\"name\":\"Public Email\",\"value\":\"gdhgdhhgd@fhash.sgsf\",\"location_number\":1},{\"key\":\"website-url\",\"type\":\"website-url\",\"name\":\"Website (URL)\",\"value\":\"https:\\/\\/safaga.hsfghd\",\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue\",\"value\":{\"venue_name\":\"Sydney Opera House\",\"address_line\":\"Bennelong Point, Sydney NSW 2000, Australia\",\"latitude\":\"-33.856784399999995\",\"longitude\":\"151.21529669999998\",\"country_code\":\"AU\"},\"location_number\":1},{\"key\":\"checkout\",\"type\":\"checkout\",\"name\":\"Checkout Options\",\"value\":{\"value\":\"4-365\",\"option_id\":\"4\",\"days\":365,\"price\":83},\"location_number\":1}]}', '2026-01-21 15:56:21', '2026-01-21 15:56:21'),
(3, 13, 'rsfgsgrs', 1, 'Administrator', '2026-01-21 18:58:42', 'create', 'Created', '{\"subcategory_key\":\"live-gigs\",\"member_id\":1,\"member_name\":\"Administrator\",\"member_type\":\"admin\",\"skip_payment\":false,\"loc_qty\":2,\"fields\":[{\"key\":\"title\",\"type\":\"title\",\"name\":\"Title\",\"value\":\"rsfgsgrs\",\"location_number\":1},{\"key\":\"description\",\"type\":\"description\",\"name\":\"Description\",\"value\":\"rsgrsgrsgsrgsg\",\"location_number\":1},{\"key\":\"images\",\"type\":\"images\",\"name\":\"Images\",\"value\":[{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 609041.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":823246,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 609041 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":823246,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape with arms outstretched in welcome 946979.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":781823,\"crop\":null}],\"location_number\":1},{\"key\":\"public_phone\",\"type\":\"public_phone\",\"name\":\"Public Phone\",\"value\":\"\",\"location_number\":1},{\"key\":\"public_email\",\"type\":\"public_email\",\"name\":\"Public Email\",\"value\":\"\",\"location_number\":1},{\"key\":\"website-url\",\"type\":\"website-url\",\"name\":\"Website (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"tickets-url\",\"type\":\"tickets-url\",\"name\":\"Tickets (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"coupon\",\"type\":\"coupon\",\"name\":\"Coupon\",\"value\":\"\",\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue\",\"value\":{\"venue_name\":\"Sydney Opera House\",\"address_line\":\"Bennelong Point, Sydney NSW 2000, Australia\",\"latitude\":\"-33.856784399999995\",\"longitude\":\"151.21529669999998\",\"country_code\":\"AU\"},\"location_number\":1},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"1\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":1},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-29\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-17\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-22\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-04-19\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Etwr\",\"tiers\":[{\"pricing_tier\":\"Wttwtt\",\"currency\":\"USD\",\"price\":\"34\"},{\"pricing_tier\":\"Ghfdfh\",\"currency\":\"USD\",\"price\":\"877\"}]}]},\"age_ratings\":{\"A\":\"all\"},\"session_summary\":\"Thu 29 Jan - Sun 19 Apr\",\"price_summary\":\"[us] $34 - $877\"},\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue 2\",\"value\":{\"venue_name\":\"Federation Square, Melbourne VIC 3000, Australia\",\"address_line\":\"Federation Square, Melbourne VIC 3000, Australia\",\"latitude\":\"-37.8179789\",\"longitude\":\"144.96905759999999\",\"country_code\":\"AU\"},\"location_number\":2},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"1\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":2},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-30\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-09\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-17\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Etwr\",\"tiers\":[{\"pricing_tier\":\"Wttwtt\",\"currency\":\"USD\",\"price\":\"34\"},{\"pricing_tier\":\"Ghfdfh\",\"currency\":\"USD\",\"price\":\"877\"}]}]},\"age_ratings\":{\"A\":\"all\"},\"session_summary\":\"Fri 30 Jan - Tue 17 Feb\",\"price_summary\":\"[us] $34 - $877\"},\"location_number\":2},{\"key\":\"checkout\",\"type\":\"checkout\",\"name\":\"Checkout Options\",\"value\":{\"value\":\"4\",\"option_id\":\"4\",\"days\":89,\"price\":null},\"location_number\":1}]}', '2026-01-21 18:58:42', '2026-01-21 18:58:42'),
(4, 14, 'Little Bo Peep has lost his sheep.', 1, 'Administrator', '2026-01-21 22:05:06', 'create', 'Created', '{\"subcategory_key\":\"live-gigs\",\"member_id\":1,\"member_name\":\"Administrator\",\"member_type\":\"admin\",\"skip_payment\":false,\"loc_qty\":3,\"fields\":[{\"key\":\"title\",\"type\":\"title\",\"name\":\"Title\",\"value\":\"Little Bo Peep has lost his sheep. \",\"location_number\":1},{\"key\":\"description\",\"type\":\"description\",\"name\":\"Description\",\"value\":\"Her sheep. I don\'t know why I said his sheep. I don\'t think I did. I think the machine just misheard me.\",\"location_number\":1},{\"key\":\"images\",\"type\":\"images\",\"name\":\"Images\",\"value\":[{\"file_name\":\"Firefly_earth with balloons everywhere 604889.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1092469,\"crop\":null},{\"file_name\":\"Firefly_earth with balloons everywhere 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1103812,\"crop\":null},{\"file_name\":\"Firefly_earth with balloons everywhere 135867 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1543241,\"crop\":null},{\"file_name\":\"Firefly_earth with balloons everywhere 135867.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":864224,\"crop\":null},{\"file_name\":\"Firefly_colourful balloons with sky in top half 113384.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1055349,\"crop\":null}],\"location_number\":1},{\"key\":\"public_phone\",\"type\":\"public_phone\",\"name\":\"Public Phone\",\"value\":{\"phone_prefix\":\"+61\",\"public_phone\":\"5464564564\"},\"location_number\":1},{\"key\":\"public_email\",\"type\":\"public_email\",\"name\":\"Public Email\",\"value\":\"\",\"location_number\":1},{\"key\":\"website-url\",\"type\":\"website-url\",\"name\":\"Website (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"tickets-url\",\"type\":\"tickets-url\",\"name\":\"Tickets (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"coupon\",\"type\":\"coupon\",\"name\":\"Coupon\",\"value\":\"\",\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue\",\"value\":{\"venue_name\":\"The Guild Theatre\",\"address_line\":\"87 Railway St &, Walz St, Rockdale NSW 2216, Australia\",\"latitude\":\"-33.9515886\",\"longitude\":\"151.1361615\",\"country_code\":\"AU\"},\"location_number\":1},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"1\"},{\"amenity\":\"Kid Friendly\",\"value\":\"0\"}],\"location_number\":1},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-21\",\"times\":[{\"time\":\"19:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-01-31\",\"times\":[{\"time\":\"19:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-22\",\"times\":[{\"time\":\"19:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-04-08\",\"times\":[{\"time\":\"19:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-04-23\",\"times\":[{\"time\":\"19:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Kklljhlh\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"AUD\",\"price\":\"56\"},{\"pricing_tier\":\"Eytey\",\"currency\":\"AUD\",\"price\":\"55\"},{\"pricing_tier\":\"Wttt\",\"currency\":\"AUD\",\"price\":\"25\"}]},{\"allocated_areas\":1,\"ticket_area\":\"5rtwttwt\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"AUD\",\"price\":\"456\"}]}]},\"age_ratings\":{\"A\":\"7\"},\"session_summary\":\"Wed 21 Jan - Thu 23 Apr\",\"price_summary\":\"[au] $25 - $456\"},\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue 2\",\"value\":{\"venue_name\":\"Melbourne Exhibition Centre, South Wharf VIC 3006, Australia\",\"address_line\":\"Melbourne Exhibition Centre, South Wharf VIC 3006, Australia\",\"latitude\":\"-37.8255785\",\"longitude\":\"144.9541305\",\"country_code\":\"AU\"},\"location_number\":2},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"0\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":2},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-02-22\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-03-13\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-04-13\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-04-27\",\"times\":[{\"time\":\"05:00\",\"ticket_group_key\":\"A\"},{\"time\":\"22:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Kklljhlh\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"USD\",\"price\":\"56\"},{\"pricing_tier\":\"Eytey\",\"currency\":\"USD\",\"price\":\"55\"},{\"pricing_tier\":\"Wttt\",\"currency\":\"USD\",\"price\":\"25\"}]},{\"allocated_areas\":1,\"ticket_area\":\"5rtwttwt\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"USD\",\"price\":\"456\"}]}]},\"age_ratings\":{\"A\":\"7\"},\"session_summary\":\"Sun 22 Feb - Mon 27 Apr\",\"price_summary\":\"[us] $25 - $456\"},\"location_number\":2},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue 3\",\"value\":{\"venue_name\":\"Adelaide Parklands\",\"address_line\":\"5006, North Terrace, Adelaide SA 5000, Australia\",\"latitude\":\"-34.9195059\",\"longitude\":\"138.5912962\",\"country_code\":\"AU\"},\"location_number\":3},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"0\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":3},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-29\",\"times\":[{\"time\":\"23:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-03\",\"times\":[{\"time\":\"23:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-24\",\"times\":[{\"time\":\"23:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Kklljhlh\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"USD\",\"price\":\"56\"},{\"pricing_tier\":\"Eytey\",\"currency\":\"USD\",\"price\":\"55\"},{\"pricing_tier\":\"Wttt\",\"currency\":\"USD\",\"price\":\"25\"}]},{\"allocated_areas\":1,\"ticket_area\":\"5rtwttwt\",\"tiers\":[{\"pricing_tier\":\"Wtwrrtw\",\"currency\":\"USD\",\"price\":\"456\"}]}]},\"age_ratings\":{\"A\":\"7\"},\"session_summary\":\"Thu 29 Jan - Tue 24 Feb\",\"price_summary\":\"[us] $25 - $456\"},\"location_number\":3},{\"key\":\"checkout\",\"type\":\"checkout\",\"name\":\"Checkout Options\",\"value\":{\"value\":\"4\",\"option_id\":\"4\",\"days\":97,\"price\":null},\"location_number\":1}]}', '2026-01-21 22:05:06', '2026-01-21 22:05:06'),
(5, 15, 'ujjtdrfyjtr', 1, 'Administrator', '2026-01-22 15:14:28', 'create', 'Created', '{\"subcategory_key\":\"live-gigs\",\"member_id\":1,\"member_name\":\"Administrator\",\"member_type\":\"admin\",\"skip_payment\":false,\"loc_qty\":1,\"fields\":[{\"key\":\"title\",\"type\":\"title\",\"name\":\"Title\",\"value\":\"ujjtdrfyjtr\",\"location_number\":1},{\"key\":\"description\",\"type\":\"description\",\"name\":\"Description\",\"value\":\"tjrrttjrtjtrrjrrtj\",\"location_number\":1},{\"key\":\"images\",\"type\":\"images\",\"name\":\"Images\",\"value\":[{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 609041.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":966239,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 623313 (1).jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1151956,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 623313.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":1151956,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape pointing up 407711.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":907759,\"crop\":null},{\"file_name\":\"Firefly_cute little monkey in red cape scratching head 407711.jpg\",\"file_type\":\"image\\/jpeg\",\"file_size\":955719,\"crop\":null}],\"location_number\":1},{\"key\":\"public_phone\",\"type\":\"public_phone\",\"name\":\"Public Phone\",\"value\":\"\",\"location_number\":1},{\"key\":\"public_email\",\"type\":\"public_email\",\"name\":\"Public Email\",\"value\":\"\",\"location_number\":1},{\"key\":\"website-url\",\"type\":\"website-url\",\"name\":\"Website (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"tickets-url\",\"type\":\"tickets-url\",\"name\":\"Tickets (URL)\",\"value\":\"\",\"location_number\":1},{\"key\":\"coupon\",\"type\":\"coupon\",\"name\":\"Coupon\",\"value\":\"\",\"location_number\":1},{\"key\":\"venue\",\"type\":\"venue\",\"name\":\"Venue\",\"value\":{\"venue_name\":\"FGHT T06 UTM skudai\",\"address_line\":\"Skudai, 80990 Johor Bahru, Johor, Malaysia\",\"latitude\":\"1.561917\",\"longitude\":\"103.6556344\",\"country_code\":\"MY\"},\"location_number\":1},{\"key\":\"amenities\",\"type\":\"amenities\",\"name\":\"Amenities\",\"value\":[{\"amenity\":\"Parking\",\"value\":\"1\"},{\"amenity\":\"Wheelchair Access\",\"value\":\"1\"},{\"amenity\":\"Kid Friendly\",\"value\":\"1\"}],\"location_number\":1},{\"key\":\"session_pricing\",\"type\":\"session_pricing\",\"name\":\"Session Pricing\",\"value\":{\"sessions\":[{\"date\":\"2026-01-28\",\"times\":[{\"time\":\"02:00\",\"ticket_group_key\":\"A\"},{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-18\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]},{\"date\":\"2026-02-23\",\"times\":[{\"time\":\"03:00\",\"ticket_group_key\":\"A\"}]}],\"pricing_groups\":{\"A\":[{\"allocated_areas\":1,\"ticket_area\":\"Dfssddffsff\",\"tiers\":[{\"pricing_tier\":\"Sffdsfsdfsdsfd\",\"currency\":\"DZD\",\"price\":\"34\"}]}]},\"age_ratings\":{\"A\":\"15\"},\"session_summary\":\"Wed 28 Jan - Mon 23 Feb\",\"price_summary\":\"[dz] 34 Ø¯.Ø¬\"},\"location_number\":1},{\"key\":\"checkout\",\"type\":\"checkout\",\"name\":\"Checkout Options\",\"value\":{\"value\":\"4\",\"option_id\":\"4\",\"days\":32,\"price\":null},\"location_number\":1}]}', '2026-01-22 15:14:28', '2026-01-22 15:14:28');

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

--
-- Dumping data for table `post_sessions`
--

INSERT INTO `post_sessions` (`id`, `map_card_id`, `session_date`, `session_time`, `ticket_group_key`, `created_at`, `updated_at`) VALUES
(1, 11, '2026-01-23', '02:00:00', 'A', '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(2, 11, '2026-01-27', '02:00:00', 'A', '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(3, 13, '2026-01-29', '03:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(4, 13, '2026-02-17', '03:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(5, 13, '2026-02-22', '03:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(6, 13, '2026-04-19', '03:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(7, 14, '2026-01-30', '05:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(8, 14, '2026-02-09', '05:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(9, 14, '2026-02-17', '05:00:00', 'A', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(10, 15, '2026-01-21', '19:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(11, 15, '2026-01-31', '19:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(12, 15, '2026-02-22', '19:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(13, 15, '2026-04-08', '19:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(14, 15, '2026-04-23', '19:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(15, 16, '2026-02-22', '05:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(16, 16, '2026-03-13', '05:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(17, 16, '2026-04-13', '05:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(18, 16, '2026-04-27', '05:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(19, 16, '2026-04-27', '22:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(20, 17, '2026-01-29', '23:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(21, 17, '2026-02-03', '23:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(22, 17, '2026-02-24', '23:00:00', 'A', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(23, 18, '2026-01-28', '02:00:00', 'A', '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(24, 18, '2026-01-28', '03:00:00', 'A', '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(25, 18, '2026-02-18', '03:00:00', 'A', '2026-01-22 15:14:14', '2026-01-22 15:14:14'),
(26, 18, '2026-02-23', '03:00:00', 'A', '2026-01-22 15:14:14', '2026-01-22 15:14:14');

-- --------------------------------------------------------

--
-- Table structure for table `post_ticket_pricing`
--

CREATE TABLE `post_ticket_pricing` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `ticket_group_key` varchar(50) NOT NULL,
  `age_rating` varchar(50) DEFAULT NULL,
  `allocated_areas` tinyint(1) NOT NULL DEFAULT 0,
  `ticket_area` varchar(100) DEFAULT NULL,
  `pricing_tier` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `post_ticket_pricing`
--

INSERT INTO `post_ticket_pricing` (`id`, `map_card_id`, `ticket_group_key`, `age_rating`, `allocated_areas`, `ticket_area`, `pricing_tier`, `price`, `currency`, `created_at`, `updated_at`) VALUES
(1, 11, 'A', '12', 1, 'Awdadfw', 'Awddwdwwd', 23.00, 'USD', '2026-01-21 15:48:31', '2026-01-21 15:48:31'),
(2, 13, 'A', 'all', 1, 'Etwr', 'Wttwtt', 34.00, 'USD', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(3, 13, 'A', 'all', 1, 'Etwr', 'Ghfdfh', 877.00, 'USD', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(4, 14, 'A', 'all', 1, 'Etwr', 'Wttwtt', 34.00, 'USD', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(5, 14, 'A', 'all', 1, 'Etwr', 'Ghfdfh', 877.00, 'USD', '2026-01-21 18:58:35', '2026-01-21 18:58:35'),
(6, 15, 'A', '7', 1, 'Kklljhlh', 'Wtwrrtw', 56.00, 'AUD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(7, 15, 'A', '7', 1, 'Kklljhlh', 'Eytey', 55.00, 'AUD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(8, 15, 'A', '7', 1, 'Kklljhlh', 'Wttt', 25.00, 'AUD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(9, 15, 'A', '7', 1, '5rtwttwt', 'Wtwrrtw', 456.00, 'AUD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(10, 16, 'A', '7', 1, 'Kklljhlh', 'Wtwrrtw', 56.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(11, 16, 'A', '7', 1, 'Kklljhlh', 'Eytey', 55.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(12, 16, 'A', '7', 1, 'Kklljhlh', 'Wttt', 25.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(13, 16, 'A', '7', 1, '5rtwttwt', 'Wtwrrtw', 456.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(14, 17, 'A', '7', 1, 'Kklljhlh', 'Wtwrrtw', 56.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(15, 17, 'A', '7', 1, 'Kklljhlh', 'Eytey', 55.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(16, 17, 'A', '7', 1, 'Kklljhlh', 'Wttt', 25.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(17, 17, 'A', '7', 1, '5rtwttwt', 'Wtwrrtw', 456.00, 'USD', '2026-01-21 22:04:52', '2026-01-21 22:04:52'),
(18, 18, 'A', '15', 1, 'Dfssddffsff', 'Sffdsfsdfsdsfd', 34.00, 'DZD', '2026-01-22 15:14:14', '2026-01-22 15:14:14');

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
  `fieldset_ids` varchar(255) DEFAULT NULL,
  `fieldset_name` varchar(255) DEFAULT NULL,
  `required` varchar(255) DEFAULT NULL,
  `fieldset_mods` longtext DEFAULT NULL CHECK (json_valid(`fieldset_mods`)),
  `location_specific` varchar(255) DEFAULT NULL,
  `checkout_surcharge` decimal(10,2) DEFAULT NULL,
  `sort_order` mediumtext DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `icon_path` varchar(255) DEFAULT NULL,
  `color_hex` varchar(7) DEFAULT NULL,
  `subcategory_type` varchar(20) DEFAULT NULL,
  `subcategory_type_logic` mediumtext DEFAULT NULL,
  `location_type` enum('Venue','City','Address') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `category_name`, `subcategory_name`, `subcategory_key`, `fieldset_ids`, `fieldset_name`, `required`, `fieldset_mods`, `location_specific`, `checkout_surcharge`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `subcategory_type`, `subcategory_type_logic`, `location_type`, `created_at`, `updated_at`) VALUES
(101, 1, 'What\'s On', 'Live Gigs', 'live-gigs', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '1', 0, 'whats-on-blue.svg', '#E74C3C', 'Events', 'Sessions Menu shows dates/times. Date-driven pricing based on final session date. Listing expires after final session ends (searchable via expired filter for 12 months). Venue menu + Sessions menu.', 'Venue', '2025-10-29 12:32:47', '2026-01-18 01:35:15'),
(102, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '2', 0, 'whats-on-green.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-10-29 12:32:47', '2026-01-17 21:07:06'),
(103, 1, 'What\'s On', 'Live Theatre', 'live-theatre', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '3', 0, 'whats-on-yellow.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-10-29 12:32:47', '2026-01-17 21:07:06'),
(104, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '4', 0, 'whats-on-purple.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-10-29 12:32:47', '2026-01-17 21:07:06'),
(105, 1, 'What\'s On', 'Live Sport', 'live-sport', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '5', 0, 'whats-on-orange.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-10-29 12:32:47', '2026-01-17 21:07:06'),
(106, 1, 'What\'s On', 'Other Events', 'other-events', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '6', 0, 'whats-on-gray.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-10-29 12:32:47', '2026-01-17 21:07:06'),
(108, 1, 'What\'s On', 'Festivals', 'festivals', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '7', 0, 'whats-on-red.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-12-14 13:12:42', '2026-01-17 21:07:06'),
(109, 1, 'What\'s On', 'Markets', 'markets', '1,2,12,8,27,10,11,13,17,18,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Tickets (URL), Coupon, Venue, Amenities, Session Pricing', '1,1,1,0,0,0,0,0,1,1,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Kid Friendly\"]}}', '0,0,0,0,0,0,0,0,1,1,1', NULL, '8', 0, 'whats-on-teal.svg', '#E74C3C', 'Events', NULL, 'Venue', '2025-12-14 13:12:42', '2026-01-17 21:07:06'),
(201, 2, 'Opportunities', 'Clubs', 'clubs', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'opportunities-purple.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(202, 2, 'Opportunities', 'Competitions', 'competitions', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'opportunities-yellow.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(203, 2, 'Opportunities', 'Jobs', 'jobs', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'opportunities-blue.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(204, 2, 'Opportunities', 'Other Opportunities', 'other-opportunities', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'opportunities-gray.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(205, 2, 'Opportunities', 'Screen Auditions', 'screen-auditions', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '5', 0, 'opportunities-orange.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(206, 2, 'Opportunities', 'Stage Auditions', 'stage-auditions', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '6', 0, 'opportunities-green.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(207, 2, 'Opportunities', 'Volunteers', 'volunteers', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '7', 0, 'opportunities-red.svg', '#F1C40F', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(301, 3, 'Learning', 'Courses', 'courses', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'learning-blue.svg', '#3498DB', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(302, 3, 'Learning', 'Education Centres', 'education-centres', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'learning-yellow.svg', '#3498DB', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(303, 3, 'Learning', 'Other Learning', 'other-learning', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'learning-red.svg', '#3498DB', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(304, 3, 'Learning', 'Tutors', 'tutors', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'learning-green.svg', '#3498DB', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(401, 4, 'Buy and Sell', 'Freebies', 'freebies', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'buy-and-sell-purple.svg', '#2ECC71', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(402, 4, 'Buy and Sell', 'Wanted', 'wanted', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'buy-and-sell-yellow.svg', '#2ECC71', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(403, 4, 'Buy and Sell', 'For Sale', 'for-sale', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'buy-and-sell-blue.svg', '#2ECC71', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(501, 5, 'For Hire', 'Goods and Services', 'goods-and-services', '1,2,12,8,27,10,9,21', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Address, Session Pricing', '1,1,1,0,0,0,1,1', NULL, '0,0,0,0,0,0,1,1', NULL, '1', 0, 'for-hire-green.svg', '#9B59B6', 'General', NULL, 'Address', '2025-10-29 12:32:47', '2026-01-13 20:02:13'),
(502, 5, 'For Hire', 'Performers', 'performers', '1,2,12,8,27,10,9,5', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Address, Custom Dropdown', '1,1,1,0,0,0,1,1', '{\"custom_dropdown\":{\"name\":\"Dropify\",\"options\":[\"Who\",\"Let\",\"The\",\"Dogs\",\"Out\"]}}', '0,0,0,0,0,0,1,1', NULL, '2', 0, 'for-hire-blue.svg', '#9B59B6', 'General', NULL, 'Address', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(503, 5, 'For Hire', 'Staff', 'staff', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'for-hire-yellow.svg', '#9B59B6', 'General', NULL, 'City', '2025-10-29 12:32:47', '2026-01-05 15:43:47'),
(601, 6, 'Eat & Drink', 'Restaurants', 'restaurants', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'eat-and-drink-blue.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(602, 6, 'Eat & Drink', 'Bars & Pubs', 'bars-pubs', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'eat-and-drink-purple.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(603, 6, 'Eat & Drink', 'Cafes', 'cafes', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'eat-and-drink-yellow.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(604, 6, 'Eat & Drink', 'Nightclubs', 'nightclubs', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'eat-and-drink-red.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(605, 6, 'Eat & Drink', 'Takeaway', 'takeaway', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '5', 0, 'eat-and-drink-orange.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(606, 6, 'Eat & Drink', 'Other Eat & Drink', 'other-eat-drink', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '6', 0, 'eat-and-drink-gray.svg', '#E67E22', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(607, 6, 'Eat & Drink', 'Venues', 'venues', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '7', 0, 'eat-and-drink-green.svg', '#E74C3C', 'General', 'Entries Menu shows items/jobs/services/etc. Single entry: displays entry directly. Multi-entry: default view is About landing page (overview, not specific entry) until user selects an entry from the menu. Clicking entry changes summary info and may auto-switch image. Up to 10 images per entry. Venue menu + Entries menu.', 'Venue', '2025-10-29 12:32:47', '2026-01-21 02:57:03'),
(701, 7, 'Stay', 'Hotels & Resorts', 'hotels-resorts', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'stay-blue.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(702, 7, 'Stay', 'Motels', 'motels', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'stay-yellow.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(703, 7, 'Stay', 'Hostels', 'hostels', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'stay-green.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(704, 7, 'Stay', 'Holiday Rentals', 'holiday-rentals', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'stay-orange.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(705, 7, 'Stay', 'Caravan & Camping', 'caravan-camping', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '5', 0, 'stay-green.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(706, 7, 'Stay', 'Bed & Breakfast', 'bed-breakfast', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '6', 0, 'stay-pink.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(707, 7, 'Stay', 'Other Stay', 'other-stay', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '7', 0, 'stay-gray.svg', '#1ABC9C', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(801, 8, 'Get Around', 'Car Hire', 'car-hire', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'get-around-blue.svg', '#34495E', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(802, 8, 'Get Around', 'Bike & Scooter', 'bike-scooter', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'get-around-yellow.svg', '#34495E', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(803, 8, 'Get Around', 'Tours & Experiences', 'tours-experiences', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'get-around-pink.svg', '#34495E', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(804, 8, 'Get Around', 'Transfers', 'transfers', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'get-around-orange.svg', '#34495E', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(805, 8, 'Get Around', 'Other Transport', 'other-transport', '1,2,12,8,27,10,16', 'Title, Description, Images, Public Phone, Public Email, Website (URL), City', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '5', 0, 'get-around-gray.svg', '#34495E', 'General', NULL, 'City', '2025-12-14 13:12:42', '2026-01-05 15:43:47'),
(901, 9, 'Venues', 'Theme Parks & Attractions', 'theme-parks-attractions', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '1', 0, 'venues-pink.svg', '#E91E63', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(902, 9, 'Venues', 'Stadiums & Arenas', 'stadiums-arenas', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '2', 0, 'venues-red.svg', '#E74C3C', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(903, 9, 'Venues', 'Theatres & Concert Halls', 'theatres-concert-halls', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '3', 0, 'venues-purple.svg', '#9B59B6', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(904, 9, 'Venues', 'Museums & Galleries', 'museums-galleries', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '4', 0, 'venues-blue.svg', '#3498DB', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(905, 9, 'Venues', 'Zoos, Aquariums & Wildlife', 'zoos-aquariums-wildlife', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '5', 0, 'venues-green.svg', '#2ECC71', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(906, 9, 'Venues', 'Parks & Nature', 'parks-nature', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '6', 0, 'venues-teal.svg', '#1ABC9C', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(907, 9, 'Venues', 'Landmarks', 'landmarks', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '7', 0, 'venues-orange.svg', '#E67E22', 'General', NULL, 'Venue', '2026-01-22 13:11:04', '2026-01-22 13:11:04'),
(908, 9, 'Venues', 'Other Venues', 'other-venues', '1,2,12,8,27,10,17', 'Title, Description, Images, Public Phone, Public Email, Website (URL), Venue', '1,1,1,0,0,0,1', NULL, '0,0,0,0,0,0,1', NULL, '8', 0, 'venues-gray.svg', '#34495E', 'General', NULL, 'Venue', '2026-01-22 13:59:49', '2026-01-22 13:59:49'),
(4701, 47, 'Test', 'Test Subcategory', 'test-subcategory', '1,2,12,27,8,11,13,14,18,19,3,4,5,6,107,10,16', 'Title, Description, Images, Public Email, Public Phone, Tickets (URL), Coupon, Item Pricing, Amenities, Age Rating, Custom Text, Custom TextArea, Custom Dropdown, Custom Radio, Custom Checklist, Website (URL), City', '1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1', '{\"amenities\":{\"selectedAmenities\":[\"Parking\",\"Wheelchair Access\",\"Accessible Parking\",\"Food & Beverages\",\"BYO Allowed\",\"Licensed Venue\"]},\"custom_dropdown\":{\"options\":[\"1fewwfa\",\"rawfwrfarwf\",\"rawfrwrfwwfr\",\"wrffrawrfaw\",\"awrffrwrffwrfr\",\"awfwarrwf\",\"rfawraarwrfrfa\",\"awrfrrrwfra\"]},\"custom_radio\":{\"options\":[\"awrfarwf\",\"awrfwrfarwrfa\",\"awrfrwrw\",\"afarwf wfa r awr rwrar fr arwf\",\"rawfrw wrfwffrwfrwrf\"]},\"custom_checklist\":{\"name\":\"cxvvvx\",\"options\":[\"vxcvcxvxcvxcv\",\"vcvxcxcxvcxvxvvvv\",\"cvvv C cdDcecCEc  ecEA\",\"eda aDE  EDDE  DA\",\"edaEDea eA DEA EAEAEDD\",\"ead aeaeD   EAEDA\"]}}', '0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1', NULL, '1', 0, 'opportunities-pink.svg', NULL, 'General', NULL, 'City', '2025-11-16 17:46:29', '2026-01-13 17:15:19');

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
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

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
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_account_email` (`account_email`) USING HASH,
  ADD UNIQUE KEY `idx_username_key` (`username_key`) USING HASH,
  ADD KEY `idx_deleted_at` (`deleted_at`);

--
-- Indexes for table `admin_messages`
--
ALTER TABLE `admin_messages`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `message_key` (`message_key`),
  ADD KEY `idx_message_type` (`message_type`),
  ADD KEY `idx_message_category` (`message_category`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_category_key` (`container_key`);

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
-- Indexes for table `checkout_options`
--
ALTER TABLE `checkout_options`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `checkout_key` (`checkout_key`);

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
-- Indexes for table `layout_containers`
--
ALTER TABLE `layout_containers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `container_key` (`container_key`),
  ADD KEY `idx_tab_id` (`tab_id`),
  ADD KEY `idx_sort_order` (`sort_order`);

--
-- Indexes for table `layout_rows`
--
ALTER TABLE `layout_rows`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `row_key` (`row_key`),
  ADD KEY `idx_container_id` (`container_id`);

--
-- Indexes for table `layout_tabs`
--
ALTER TABLE `layout_tabs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `tab_key` (`tab_key`),
  ADD KEY `idx_panel` (`panel_key`),
  ADD KEY `idx_sort_order` (`sort_order`);

--
-- Indexes for table `list_age_ratings`
--
ALTER TABLE `list_age_ratings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `list_amenities`
--
ALTER TABLE `list_amenities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `list_category_icons`
--
ALTER TABLE `list_category_icons`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `list_countries`
--
ALTER TABLE `list_countries`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `list_currencies`
--
ALTER TABLE `list_currencies`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `list_phone_prefixes`
--
ALTER TABLE `list_phone_prefixes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

--
-- Indexes for table `list_system_images`
--
ALTER TABLE `list_system_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_filename` (`option_filename`),
  ADD KEY `idx_active` (`is_active`);

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
-- Indexes for table `member_settings`
--
ALTER TABLE `member_settings`
  ADD PRIMARY KEY (`member_setting_key`);

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
-- Indexes for table `post_amenities`
--
ALTER TABLE `post_amenities`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_map_card_amenity` (`map_card_id`,`amenity_key`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `idx_amenity_key` (`amenity_key`),
  ADD KEY `idx_amenity_value_map_card` (`amenity_key`,`value`,`map_card_id`);

--
-- Indexes for table `post_item_pricing`
--
ALTER TABLE `post_item_pricing`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `price` (`item_price`),
  ADD KEY `idx_price_currency` (`item_price`,`currency`),
  ADD KEY `idx_map_card_item_price` (`map_card_id`,`item_price`);

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
  ADD KEY `idx_ticket_group_key` (`ticket_group_key`),
  ADD KEY `idx_session_date_map_card` (`session_date`,`map_card_id`),
  ADD KEY `idx_map_card_date` (`map_card_id`,`session_date`);

--
-- Indexes for table `post_ticket_pricing`
--
ALTER TABLE `post_ticket_pricing`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_group_line` (`map_card_id`,`ticket_group_key`,`ticket_area`,`pricing_tier`,`price`,`currency`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `idx_price_currency` (`price`,`currency`),
  ADD KEY `idx_ticket_group_key` (`ticket_group_key`),
  ADD KEY `idx_map_card_price` (`map_card_id`,`price`);

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
-- AUTO_INCREMENT for table `admin_messages`
--
ALTER TABLE `admin_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=341;

--
-- AUTO_INCREMENT for table `admin_settings`
--
ALTER TABLE `admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=470;

--
-- AUTO_INCREMENT for table `banned_words`
--
ALTER TABLE `banned_words`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `categories`
--
ALTER TABLE `categories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=48;

--
-- AUTO_INCREMENT for table `checkout_options`
--
ALTER TABLE `checkout_options`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `fieldsets`
--
ALTER TABLE `fieldsets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=108;

--
-- AUTO_INCREMENT for table `layout_containers`
--
ALTER TABLE `layout_containers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `layout_rows`
--
ALTER TABLE `layout_rows`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `layout_tabs`
--
ALTER TABLE `layout_tabs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `list_age_ratings`
--
ALTER TABLE `list_age_ratings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `list_amenities`
--
ALTER TABLE `list_amenities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `list_category_icons`
--
ALTER TABLE `list_category_icons`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=90;

--
-- AUTO_INCREMENT for table `list_countries`
--
ALTER TABLE `list_countries`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=272;

--
-- AUTO_INCREMENT for table `list_currencies`
--
ALTER TABLE `list_currencies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=383;

--
-- AUTO_INCREMENT for table `list_phone_prefixes`
--
ALTER TABLE `list_phone_prefixes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=272;

--
-- AUTO_INCREMENT for table `list_system_images`
--
ALTER TABLE `list_system_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=88;

--
-- AUTO_INCREMENT for table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `members`
--
ALTER TABLE `members`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=102;

--
-- AUTO_INCREMENT for table `moderation_log`
--
ALTER TABLE `moderation_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `post_amenities`
--
ALTER TABLE `post_amenities`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `post_item_pricing`
--
ALTER TABLE `post_item_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `post_media`
--
ALTER TABLE `post_media`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=56;

--
-- AUTO_INCREMENT for table `post_revisions`
--
ALTER TABLE `post_revisions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `post_sessions`
--
ALTER TABLE `post_sessions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `post_ticket_pricing`
--
ALTER TABLE `post_ticket_pricing`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=19;

--
-- AUTO_INCREMENT for table `subcategories`
--
ALTER TABLE `subcategories`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4703;

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
-- Constraints for table `post_amenities`
--
ALTER TABLE `post_amenities`
  ADD CONSTRAINT `fk_post_amenities_map_card` FOREIGN KEY (`map_card_id`) REFERENCES `post_map_cards` (`id`) ON DELETE CASCADE;

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
