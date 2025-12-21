-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Dec 21, 2025 at 11:07 PM
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
(2, 'admin@funmap.com', '$2a$12$EED5zmTO8Eyhj0N/6F1W5.dyHyMlYbOABsWf6oTk0.j/Tv8rhOIU.', 'Administrator', '2025-10-22 01:00:41', NULL, '2025-12-01 04:17:56');

-- --------------------------------------------------------

--
-- Table structure for table `admin_messages`
--

CREATE TABLE `admin_messages` (
  `id` int(11) NOT NULL,
  `message_name` varchar(100) DEFAULT NULL,
  `message_key` varchar(100) NOT NULL COMMENT 'Unique identifier for the message',
  `message_type` enum('toast','error','success','warning','confirm','modal','email','label') NOT NULL DEFAULT 'toast' COMMENT 'Type of message',
  `message_category` varchar(50) DEFAULT NULL COMMENT 'Category grouping (auth, post, admin, member, etc)',
  `container_key` varchar(50) DEFAULT NULL COMMENT 'References layout_containers.container_key',
  `message_text` text NOT NULL COMMENT 'The actual message text',
  `message_description` varchar(255) DEFAULT NULL COMMENT 'Admin-facing description of where/when used',
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

INSERT INTO `admin_messages` (`id`, `message_name`, `message_key`, `message_type`, `message_category`, `container_key`, `message_text`, `message_description`, `supports_html`, `placeholders`, `is_active`, `is_visible`, `is_deletable`, `display_duration`, `created_at`, `updated_at`) VALUES
(1, 'Login Success Message', 'msg_auth_login_success', 'success', 'auth', 'msg_member', 'Welcome back, {name}!', 'Shown after successful login', 0, '[\"name\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-14 09:59:01'),
(2, 'Logout Success Message', 'msg_auth_logout_success', 'success', 'auth', 'msg_member', 'You have been logged out.', 'Shown after logout', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(3, 'Login Fields Empty Message', 'msg_auth_login_empty', 'error', 'auth', 'msg_member', 'Enter your email and password.', 'When login fields are empty', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(4, 'Incorrect Credentials Message', 'msg_auth_login_incorrect', 'error', 'auth', 'msg_member', 'Incorrect email or password. Try again.', 'When credentials are wrong', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(5, 'Login Failed Message', 'msg_auth_login_failed', 'error', 'auth', 'msg_member', 'Unable to verify credentials. Please try again.', 'When login request fails', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(6, 'Registration Success Message', 'msg_auth_register_success', 'success', 'auth', 'msg_member', 'Welcome, {name}!', 'Shown after successful registration', 0, '[\"name\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(7, 'Registration Fields Empty Message', 'msg_auth_register_empty', 'error', 'auth', 'msg_member', 'Please complete all required fields.', 'When registration fields are empty', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(8, 'Password Too Short Message', 'msg_auth_register_password_short', 'error', 'auth', 'msg_member', 'Password must be at least 4 characters.', 'Password too short', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(9, 'Passwords Don\'t Match Message', 'msg_auth_register_password_mismatch', 'error', 'auth', 'msg_member', 'Passwords do not match.', 'When passwords don\'t match', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(10, 'Registration Failed Message', 'msg_auth_register_failed', 'error', 'auth', 'msg_member', 'Registration failed.', 'When registration request fails', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(11, 'Settings Saved Message', 'msg_admin_saved', 'success', 'admin', 'msg_admin', 'Saved', 'Shown when admin settings are saved', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(12, 'Changes Discarded Message', 'msg_admin_discarded', 'toast', 'admin', 'msg_admin', 'Changes Discarded', 'Shown when changes are discarded', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(13, 'Server Connection Error Message', 'msg_admin_save_error_network', 'error', 'admin', 'msg_admin', 'Unable to reach the server. Please try again.', 'When save request fails', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(14, 'Save Response Error Message', 'msg_admin_save_error_response', 'error', 'admin', 'msg_admin', 'Unexpected response while saving changes.', 'When server returns invalid response', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(15, 'Unsaved Changes Dialog Title Message', 'msg_admin_unsaved_title', 'label', 'admin', 'msg_admin', 'Unsaved Changes', 'Title of unsaved changes dialog', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(16, 'Unsaved Changes Dialog Message', 'msg_admin_unsaved_message', 'label', 'admin', 'msg_admin', 'You have unsaved changes. Save before closing the admin panel?', 'Message in unsaved changes dialog', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(17, 'Listing Posted Successfully Message', 'msg_post_create_success', 'success', 'post', 'msg_member', 'Your listing has been posted!', 'When post is created successfully', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(18, 'Listing Posted With Images Message', 'msg_post_create_with_images', 'success', 'post', 'msg_member', 'Your listing and images have been posted!', 'When post with images is created', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(19, 'Listing Post Failed Message', 'msg_post_create_error', 'error', 'post', 'msg_member', 'Unable to post your listing. Please try again.', 'When post creation fails', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(20, 'Category Not Selected Message', 'msg_post_create_no_category', 'error', 'post', 'msg_member', 'Select a category and subcategory before posting.', 'When category not selected', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(21, 'Dropdown Selection Required Message', 'msg_post_validation_select', 'error', 'post', 'msg_member', 'Select an option for {field}.', 'Dropdown validation error', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(22, 'Field Required Message', 'msg_post_validation_required', 'error', 'post', 'msg_member', 'Enter a value for {field}.', 'Required field validation', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(23, 'Location Required Message', 'msg_post_validation_location', 'error', 'post', 'msg_member', 'Select a location for {field}.', 'Location field validation', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(24, 'Delete Item Confirmation Message', 'msg_confirm_delete_item', 'confirm', 'general', 'msg_admin', 'Are you sure you want to delete this item?', 'Generic delete confirmation', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(25, 'Delete Venue Confirmation Message', 'msg_confirm_delete_venue', 'confirm', 'post', 'msg_member', 'Are you sure you want to remove this venue?', 'Remove venue confirmation', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(26, 'Console Filter Enabled Confirmation Message', 'msg_confirm_console_filter_enable', 'confirm', 'admin', 'msg_admin', 'Console filter will be enabled on next page load. Reload now?', 'Enable console filter prompt', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(27, 'Console Filter Disabled Confirmation Message', 'msg_confirm_console_filter_disable', 'confirm', 'admin', 'msg_admin', 'Console filter will be disabled on next page load. Reload now?', 'Disable console filter prompt', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(28, 'Map Zoom Required Message', 'msg_map_zoom_required', 'toast', 'map', 'msg_user', 'Zoom the map to see post', 'Shown when zoom level too low', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-12-19 19:38:48'),
(29, 'No Listings Found Message', 'msg_posts_empty_state', 'label', 'post', 'msg_member', 'There are no posts here. Try moving the map or changing your filter settings.', 'Empty posts message', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(82, 'Terms and Conditions Message', 'msg-terms-conditions', 'modal', 'member', 'msg_member', '<h3>Terms and Conditions</h3>\n\n<p>By submitting a post to this platform, you agree to the following terms and conditions:</p>\n\n<h4>1. Content Responsibility</h4>\n<p>You are solely responsible for all content you post, including text, images, and any other materials. You warrant that you own or have the necessary rights to all content you submit.</p>\n\n<h4>2. Accurate Information</h4>\n<p>You agree to provide accurate, current, and complete information in your posts. Misleading, false, or fraudulent information is strictly prohibited.</p>\n\n<h4>3. Prohibited Content</h4>\n<p>You agree not to post content that:</p>\n<ul>\n<li>Is illegal, harmful, or violates any applicable laws or regulations</li>\n<li>Infringes on intellectual property rights of others</li>\n<li>Contains spam, unsolicited advertising, or promotional materials</li>\n<li>Is defamatory, harassing, abusive, or discriminatory</li>\n<li>Contains viruses, malware, or other harmful code</li>\n<li>Violates privacy rights of others</li>\n</ul>\n\n<h4>4. Platform Rules</h4>\n<p>You agree to comply with all platform rules and guidelines. The platform reserves the right to remove any content that violates these terms without notice.</p>\n\n<h4>5. Moderation</h4>\n<p>All posts are subject to review and moderation. The platform reserves the right to reject, edit, or remove any content at its sole discretion.</p>\n\n<h4>6. Payment and Fees</h4>\n<p>If applicable, you agree to pay all fees associated with your post submission. Fees are non-refundable unless otherwise stated.</p>\n\n<h4>7. Limitation of Liability</h4>\n<p>The platform is not responsible for any loss, damage, or liability arising from your use of the service or content posted by you or other users.</p>\n\n<h4>8. Indemnification</h4>\n<p>You agree to indemnify and hold harmless the platform, its operators, and affiliates from any claims, damages, or expenses arising from your content or violation of these terms.</p>\n\n<h4>9. Changes to Terms</h4>\n<p>These terms may be updated at any time. Continued use of the platform constitutes acceptance of any modified terms.</p>\n\n<h4>10. Account Termination</h4>\n<p>The platform reserves the right to suspend or terminate your account and remove your content if you violate these terms.</p>\n\n<p><strong>By checking the box below, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.</strong></p>', 'Terms and conditions text shown in modal for member forms', 1, NULL, 1, 1, 0, 0, '2025-12-08 16:16:29', '2025-12-09 06:37:44'),
(32, 'Member Login Reminder Message', 'msg_member_login_reminder', 'label', 'member', 'msg_member', 'When you log in as a member, I can remember your recent posts and favourites on any device.', 'Reminder shown to encourage member login', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(33, 'Member Unsaved Changes Dialog Title Message', 'msg_member_unsaved_title', 'label', 'member', 'msg_member', 'Unsaved Changes', 'Title of member unsaved changes dialog', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(34, 'Member Unsaved Changes Dialog Message', 'msg_member_unsaved_message', 'label', 'member', 'msg_member', 'You have unsaved changes. Save before closing the member panel?', 'Message in member unsaved changes dialog', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(35, 'Listing Submission Confirmation Error Message', 'msg_post_submit_confirm_error', 'error', 'post', 'msg_member', 'Unable to confirm your listing submission.', 'When post response cannot be read', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(36, 'Form Loading Message', 'msg_post_loading_form', 'toast', 'post', 'msg_member', 'Loading form fields…', 'Shown while loading form fields', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(37, 'Form Load Failed Message', 'msg_post_form_load_error', 'warning', 'post', 'msg_member', 'We couldn\'t load the latest form fields. You can continue with the defaults for now.', 'When form fields fail to load', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(38, 'Radio Selection Required Message', 'msg_post_validation_choose', 'error', 'post', 'msg_member', 'Choose an option for {field}.', 'Radio button validation error', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(39, 'File Upload Required Message', 'msg_post_validation_file_required', 'error', 'post', 'msg_member', 'Add at least one file for {field}.', 'File upload validation', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(40, 'Pricing Details Required Message', 'msg_post_validation_pricing', 'error', 'post', 'msg_member', 'Provide pricing details for {field}.', 'Pricing validation error', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(41, 'Price Tiers Required Message', 'msg_post_validation_pricing_tiers', 'error', 'post', 'msg_member', 'Add at least one price tier for {field}.', 'Pricing tiers validation', 0, '[\"field\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(42, 'Add Field Confirmation Message', 'msg_confirm_add_field', 'confirm', 'formbuilder', 'msg_admin', 'Add a new field to {subcategory}?', 'Confirmation to add new field', 0, '[\"subcategory\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(43, 'Add Subcategory Confirmation Message', 'msg_confirm_add_subcategory', 'confirm', 'formbuilder', 'msg_admin', 'Add a new subcategory to {category}?', 'Confirmation to add new subcategory', 0, '[\"category\"]', 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(44, 'Add Category Confirmation Message', 'msg_confirm_add_category', 'confirm', 'formbuilder', 'msg_admin', 'Add a new category to the formbuilder?', 'Confirmation to add new category', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(45, 'Delete Confirmation Dialog Title Message', 'msg_confirm_delete_title', 'label', 'formbuilder', 'msg_admin', 'Delete item?', 'Title for delete confirmation dialog', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(46, 'Cancel Button Label Message', 'msg_button_cancel', 'label', 'general', 'msg_admin', 'Cancel', 'Cancel button text', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(47, 'Delete Button Label Message', 'msg_button_delete', 'label', 'general', 'msg_admin', 'Delete', 'Delete button text', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(48, 'Save Button Label Message', 'msg_button_save', 'label', 'general', 'msg_admin', 'Save', 'Save button text', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(49, 'Discard Changes Button Label Message', 'msg_button_discard', 'label', 'general', 'msg_admin', 'Discard Changes', 'Discard changes button text', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(50, 'No Icons Found Error Message', 'msg_error_no_icons', 'error', 'admin', 'msg_admin', 'No icons found.<br><br>Please select the icon folder in the Admin Settings Tab.<br><br>Example: <code>assets/icons</code>', 'Shown when icon folder is empty or invalid', 1, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(51, 'Currency Required Error Message', 'msg_error_currency_required', 'error', 'post', 'msg_member', 'Please select a currency before entering a price.', 'Currency validation for pricing', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(52, 'Duplicate Session Time Error Message', 'msg_error_duplicate_session_time', 'error', 'post', 'msg_member', 'There is already a session for that time.', 'Duplicate session time validation', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(53, 'Member Create Intro Message', 'msg_member_create_intro', 'label', 'member', 'msg_member', 'Complete the form below to submit your post.', 'Intro text shown in member create post section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-16 12:30:31'),
(79, 'Delete Checkout Option Title', 'msg_confirm_delete_checkout_option_title', '', 'confirm', 'settings', 'Delete Checkout Option', 'Title for checkout option delete confirmation dialog', 0, NULL, 1, 1, 0, NULL, '2025-12-02 06:25:33', '2025-12-02 06:25:33'),
(55, 'Member Post Listing Button', 'msg_member_post_listing', 'label', 'member', 'msg_member', 'Submit Post', 'Button text to submit a new listing', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-16 12:13:35'),
(56, 'Member Tab Create', 'msg_member_tab_create', 'label', 'member', 'msg_member', 'Create Post', 'Tab label for create post section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(57, 'Member Tab My Posts', 'msg_member_tab_myposts', 'label', 'member', 'msg_member', 'My Posts', 'Tab label for my posts section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(58, 'Member Tab Profile', 'msg_member_tab_profile', 'label', 'member', 'msg_member', 'Profile', 'Tab label for profile section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(59, 'Member Auth Login Tab', 'msg_member_auth_login', 'label', 'member', 'msg_member', 'Login', 'Login tab label in member profile section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(60, 'Member Auth Register Tab', 'msg_member_auth_register', 'label', 'member', 'msg_member', 'Register', 'Register tab label in member profile section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(61, 'Member Label Email', 'msg_member_label_email', 'label', 'member', 'msg_member', 'Email', 'Email field label in member forms', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(62, 'Member Label Password', 'msg_member_label_password', 'label', 'member', 'msg_member', 'Password', 'Password field label in member forms', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(63, 'Member Button Log In', 'msg_member_btn_log_in', 'label', 'member', 'msg_member', 'Log In', 'Log in button text', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(64, 'Member Label Display Name', 'msg_member_label_display_name', 'label', 'member', 'msg_member', 'Display Name', 'Display name field label in registration form', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(65, 'Member Label Avatar URL', 'msg_member_label_avatar_url', 'label', 'member', 'msg_member', 'Avatar URL', 'Avatar URL field label in registration form', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(66, 'Member Button Create Account', 'msg_member_btn_create_account', 'label', 'member', 'msg_member', 'Create Account', 'Create account button text', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(67, 'Member Button Log Out', 'msg_member_btn_log_out', 'label', 'member', 'msg_member', 'Log Out', 'Log out button text', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(68, 'Link Copied Notification', 'msg_link_copied', 'toast', 'member', 'msg_member', 'Link Copied', 'Shown when user copies a post link', 0, NULL, 1, 1, 0, 2000, '2025-11-15 06:34:46', '2025-11-15 06:34:46'),
(69, 'Confirm Button', 'msg_button_confirm', 'label', 'admin', 'msg_admin', 'Confirm', 'Confirm button label', 0, NULL, 1, 1, 0, NULL, '2025-11-15 06:34:46', '2025-11-15 06:34:46'),
(70, 'No Icon Label', 'msg_label_no_icon', 'label', 'admin', 'msg_admin', 'No Icon', 'Label shown when no icon is selected', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(71, 'Change Icon Button', 'msg_button_change_icon', 'label', 'admin', 'msg_admin', 'Change Icon', 'Button to change existing icon', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(72, 'Choose Icon Button', 'msg_button_choose_icon', 'label', 'admin', 'msg_admin', 'Choose Icon', 'Button to choose new icon', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(73, 'Add Subcategory Button', 'msg_button_add_subcategory', 'label', 'admin', 'msg_admin', 'Add Subcategory', 'Button to add new subcategory', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(74, 'Delete Category Button', 'msg_button_delete_category', 'label', 'admin', 'msg_admin', 'Delete Category', 'Button to delete category', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(75, 'Delete Subcategory Button', 'msg_button_delete_subcategory', 'label', 'admin', 'msg_admin', 'Delete Subcategory', 'Button to delete subcategory', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(76, 'Add Field Button', 'msg_button_add_field', 'label', 'admin', 'msg_admin', 'Add Field', 'Button to add new field', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(77, 'Hide Category Label', 'msg_label_hide_category', 'label', 'admin', 'msg_admin', 'Hide Category', 'Label for hide category toggle', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(78, 'Hide Subcategory Label', 'msg_label_hide_subcategory', 'label', 'admin', 'msg_admin', 'Hide Subcategory', 'Label for hide subcategory toggle', 0, NULL, 1, 1, 0, NULL, '2025-11-15 07:25:02', '2025-11-15 07:25:02'),
(80, 'Delete Checkout Option Message', 'msg_confirm_delete_checkout_option', '', 'confirm', 'settings', 'Are you sure you want to delete this checkout option?', 'Message for checkout option delete confirmation dialog', 0, NULL, 1, 1, 0, NULL, '2025-12-02 06:25:33', '2025-12-02 06:25:33'),
(81, 'Admin Submit Without Payment Button', 'msg_admin_submit_without_payment', 'label', 'admin', 'msg_admin', 'Admin: Submit without Payment', 'Button text for admin to submit post without payment', 0, NULL, 1, 1, 0, 0, '2025-12-04 04:08:15', '2025-12-04 04:08:15');

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
(1, 'website_name', 'Funmap.com', 'string', NULL, '2025-12-19 21:56:40', '2025-12-20 03:30:34'),
(2, 'website_tagline', 'Find Stuff To Do', 'string', NULL, '2025-12-19 21:56:47', '2025-12-20 03:30:34'),
(3, 'website_currency', 'USD', 'string', NULL, '2025-12-19 22:24:32', '2025-12-20 05:09:13'),
(4, 'contact_email', '', 'string', 'Admin contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(5, 'support_email', '', 'string', 'Support contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(6, 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(7, 'welcome_enabled', 'false', 'boolean', 'Show welcome modal to new users', '2025-11-13 16:17:10', '2025-12-20 06:37:54'),
(8, 'welcome_title', 'Welcome to FunMap', 'string', 'Title shown in the welcome modal', '2025-11-13 16:17:10', '2025-12-08 14:16:17'),
(9, 'welcome_message', '\"<p>Welcome to Funmap! Choose an area on the map to search for events and listings. Click the <svg class=\\\"icon-search\\\" width=\\\"30\\\" height=\\\"30\\\" viewBox=\\\"0 0 24 24\\\" fill=\\\"none\\\" stroke=\\\"currentColor\\\" stroke-width=\\\"2\\\" role=\\\"img\\\" aria-label=\\\"Filters\\\"><circle cx=\\\"11\\\" cy=\\\"11\\\" r=\\\"8\\\"></circle><line x1=\\\"21\\\" y1=\\\"21\\\" x2=\\\"16.65\\\" y2=\\\"16.65\\\"></line></svg> button to refine your search.</p>\"', 'json', 'Main content of the welcome modal (supports HTML and SVG)', '2025-11-13 16:17:10', '2025-12-08 14:16:17'),
(10, 'map_shadow', '0', 'integer', 'Map Shadow', '2025-11-13 16:17:10', '2025-12-14 18:00:40'),
(11, 'console_filter', 'true', 'boolean', 'Enable/disable console filter on page load', '2025-11-13 16:17:10', '2025-12-02 03:25:58'),
(14, 'spin_on_load', 'true', 'boolean', 'Enable map spin on page load', '2025-11-13 16:17:10', '2025-12-10 05:02:00'),
(15, 'spin_load_type', 'everyone', 'string', 'Spin for: everyone or new_users', '2025-11-13 16:17:10', '2025-12-12 09:01:59'),
(16, 'spin_on_logo', 'true', 'boolean', 'Enable map spin when logo clicked', '2025-11-13 16:17:10', '2025-11-24 15:20:41'),
(17, 'spin_zoom_max', '4', 'integer', 'Maximum zoom spin threshold', '2025-11-13 16:17:10', '2025-12-10 05:57:38'),
(18, 'spin_speed', '0.2', 'decimal', 'Speed of globe spin rotation', '2025-11-13 16:17:10', '2025-12-20 07:58:46'),
(19, 'paypal_enabled', 'false', 'boolean', 'Enable PayPal payments', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(20, 'paypal_mode', 'sandbox', 'string', 'PayPal mode: sandbox or live', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(21, 'paypal_client_id', '', 'string', 'PayPal Client ID', '2025-11-13 16:17:10', '2025-12-20 05:49:08'),
(22, 'paypal_secret', NULL, 'string', 'PayPal Secret Key', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(23, 'admin_tab_order', '[\"settings\",\"forms\",\"map\",\"messages\"]', 'json', 'Order of admin panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(24, 'member_tab_order', '[\"create\",\"myposts\",\"profile\"]', 'json', 'Order of member panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(25, 'map_card_display', 'always', 'string', 'Map card display mode: hover_only or always', '2025-11-23 11:24:22', '2025-12-09 13:20:32'),
(26, 'map_shadow_mode', 'always', 'string', 'Map Shadow Mode: post_mode_only or always', '2025-11-24 14:41:59', '2025-12-12 07:55:23'),
(37, 'starting_address', '11050 W. G. Rogell Dr. Building 602, Detroit, MI 48242, USA', 'string', 'Default map starting location for new visitors (address or coordinates)', '2025-12-08 07:21:39', '2025-12-20 05:47:00'),
(38, 'starting_zoom', '2', 'integer', 'Default map zoom level for new visitors (1-18)', '2025-12-08 07:49:50', '2025-12-20 06:27:03'),
(39, 'starting_lat', '42.2132203', 'decimal', 'Starting location latitude coordinate', '2025-12-08 11:43:09', '2025-12-20 05:47:00'),
(40, 'starting_lng', '-83.3524824', 'decimal', 'Starting location longitude coordinate', '2025-12-08 11:43:09', '2025-12-20 05:47:00'),
(44, 'wait_for_map_tiles', 'false', 'boolean', NULL, '2025-12-10 05:16:15', '2025-12-20 06:20:56'),
(45, 'admin_autosave', 'false', 'string', 'Remember autosave toggle state in admin panel', '2025-12-19 18:12:20', '2025-12-19 22:24:49'),
(47, 'msg_category_user_name', 'User Messagess', 'string', NULL, '2025-12-19 19:34:16', '2025-12-19 19:34:16'),
(48, 'msg_category_order', '[\"member\",\"user\",\"admin\",\"email\",\"fieldset-tooltips\"]', 'string', NULL, '2025-12-19 20:18:16', '2025-12-19 20:18:16'),
(50, 'paypal_client_secret', '', 'string', NULL, '2025-12-19 20:52:17', '2025-12-20 05:49:08'),
(51, 'starting_pitch', '0', 'integer', NULL, '2025-12-20 06:10:19', '2025-12-20 06:24:36'),
(52, 'folder_category_icons', 'https://cdn.funmap.com/category-icons', 'string', 'Folder path for category/subcategory icons', '2025-11-13 16:17:10', '2025-12-21 11:59:21'),
(53, 'folder_system_images', 'https://cdn.funmap.com/system-images', 'string', 'Folder path for admin message category icons', '2025-11-13 16:17:10', '2025-12-21 11:59:21'),
(54, 'folder_amenities', 'https://cdn.funmap.com/amenities', 'string', 'Folder path for amenity icons', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(55, 'folder_avatars', 'https://cdn.funmap.com/avatars', 'string', 'Folder path for user avatars', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(56, 'folder_dummy_images', 'https://cdn.funmap.com/dummy-images', 'string', 'Folder path for dummy/test images', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(57, 'folder_flags', 'https://cdn.funmap.com/flags', 'string', 'Folder path for country flag icons', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(58, 'folder_post_images', 'https://cdn.funmap.com/post-images', 'string', 'Folder path for post images', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(59, 'folder_site_avatars', 'https://cdn.funmap.com/site-avatars', 'string', 'Folder path for site/library avatars', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(60, 'folder_site_images', 'https://cdn.funmap.com/site-images', 'string', 'Folder path for site-generated images', '2025-12-21 11:53:19', '2025-12-21 12:05:25'),
(90, 'post_mode_bg_opacity', '0.68', 'decimal', NULL, '2025-12-20 07:58:46', '2025-12-20 07:58:46');

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
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `categories`
--

INSERT INTO `categories` (`id`, `category_name`, `category_key`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `created_at`, `updated_at`) VALUES
(1, 'What\'s On', 'what-s-on', 1, 0, 'assets/category-icons/whats-on.svg', '#E74C3C', '2025-10-29 23:32:47', '2025-12-20 06:33:59'),
(2, 'Opportunities', 'opportunities', 4, 0, 'assets/category-icons/opportunities.svg', '#F1C40F', '2025-10-29 23:32:47', '2025-12-16 00:12:37'),
(3, 'Learning', 'learning', 3, 0, 'assets/category-icons/learning.svg', '#3498DB', '2025-10-29 23:32:47', '2025-12-16 00:12:37'),
(4, 'Buy and Sell', 'buy-and-sell', 5, 0, 'assets/category-icons/buy-and-sell.svg', '#2ECC71', '2025-10-29 23:32:47', '2025-12-16 00:12:37'),
(5, 'For Hire', 'for-hire', 2, 0, 'assets/category-icons/for-hire.svg', '#9B59B6', '2025-10-29 23:32:47', '2025-12-16 00:12:37'),
(6, 'Eat & Drink', 'eat-drink', 6, 0, 'assets/category-icons/eat-and-drink.svg', '#E67E22', '2025-12-15 00:11:53', '2025-12-19 12:14:52'),
(47, 'Test', 'test', 7, 0, 'assets/category-icons/opportunities.svg', NULL, '2025-11-17 04:45:27', '2025-12-19 12:19:13'),
(7, 'Stay', 'stay', 8, 0, 'assets/category-icons/stay.svg', '#1ABC9C', '2025-12-15 00:11:53', '2025-12-16 00:12:37'),
(8, 'Get Around', 'get-around', 9, 0, 'assets/category-icons/get-around.svg', '#34495E', '2025-12-15 00:11:53', '2025-12-16 00:12:37');

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
(1, 'free', 'Free', 'Standard post cards.', 'probably wont exist to prevent spam', 'USD', 0.00, NULL, 0.00, 0, 0, 1, 0, '2025-11-30 05:45:21', '2025-12-21 20:04:17'),
(2, 'standard', 'Standard', 'Standard post cards.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.15, 0.08, 0, 0, 2, 0, '2025-11-30 05:45:21', '2025-12-21 20:04:17'),
(3, 'featured', 'Featured', 'Featured post cards.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.30, 0.15, 1, 0, 3, 0, '2025-11-30 05:45:21', '2025-12-21 20:04:17'),
(4, 'premium', 'Premium', 'Featured Post Cards. Appearance on the Marquee.', 'General: 30 day and 365 presets at checkout. For new posts, flagfall applies. Basic Day Rate is for 364 days or less. Discount Day Rate is for 365 days or more. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Editing posts is free but increasing duration requires extra payment based on days added. Upgrading to a higher tier checkout option is priced at the difference in rates based on the number of days remaining or added. \n\nEvents: End of day in the world\'s final timezone marks the end of the listing in regards to pricing and at that time the event stops being displayed. The event continues to be searchable if people want to use the show expired events filter to see what they missed up to 12 months ago. After that, the event is not shown on the website at all. Upgrading to a new tier is the only option for events. The lowest tier pricing cannot be reduced through automation and requires manual intervention based on refund requests. Session cancellations resulting in a reduced listing period are the same situation. Refunds are at the discretion of the administrator and the terms and conditions checkbox makes the member agree to the refund policy before submission. Event Posts contain a venue menu and a session menu. Each extra venue is added at discount day rates for the final date of each venue. The longest season venue uses the basic Day Rate.\n\nStorefront: A subcategory type called \'storefront\' has a storefront menu instead of a session menu. If a post in this subcategory has more than one type of item for sale, the map marker becomes the avatar of the member. Pricing for this system is flagfall for first time listing the post + Basic Day Rates for first type of item + Discount Day Rates for every type of item after that. So listing a Tshirt that comes in red, blue and green with XS,S,M,L,XL,XXL,XXXL is one item type. Adding a new type would be pants. Upgrading to higher checkout tiers cannot be done for items only, only for the storefront. This could result in massive listing prices for storefronts, so to be fair, maybe there should be discounts. We\'ll see.', 'USD', 10.00, 0.40, 0.20, 1, 1, 4, 0, '2025-11-30 05:45:21', '2025-12-21 20:04:17');

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
  `input_type` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `min_length` int(11) DEFAULT NULL,
  `max_length` int(11) DEFAULT NULL,
  `show_limit` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `fields`
--

INSERT INTO `fields` (`id`, `field_key`, `input_type`, `min_length`, `max_length`, `show_limit`, `created_at`, `updated_at`) VALUES
(1, 'title', 'text', 3, 150, 1, '2025-10-29 23:32:47', '2025-12-07 03:13:38'),
(2, 'description', 'textarea', 10, 5000, 1, '2025-10-29 23:32:47', '2025-12-07 03:13:38'),
(3, 'images', 'images', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(4, 'venue-name', 'text', 3, 200, 1, '2025-10-29 23:32:47', '2025-12-08 16:59:48'),
(5, 'address-line', 'text', 5, 500, 1, '2025-10-29 23:32:47', '2025-12-07 03:13:38'),
(6, 'latitude', 'decimal', 3, 50, 0, '2025-10-29 23:32:47', '2025-12-08 17:00:04'),
(7, 'longitude', 'decimal', 3, 50, 0, '2025-10-29 23:32:47', '2025-12-08 17:00:11'),
(8, 'session-date', 'date', 3, 50, 0, '2025-10-29 23:32:47', '2025-12-08 17:00:22'),
(9, 'session-time', 'time', 3, 50, 0, '2025-10-29 23:32:47', '2025-12-08 17:00:27'),
(10, 'seating-area', 'text', 3, 100, 1, '2025-10-29 23:32:47', '2025-12-08 17:00:44'),
(11, 'pricing-tier', 'text', 3, 100, 1, '2025-10-29 23:32:47', '2025-12-08 17:00:48'),
(12, 'ticket-price', 'decimal(10,2)', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 17:01:05'),
(13, 'currency', 'dropdown', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(14, 'text-box', 'text', 3, 500, 1, '2025-10-30 17:11:57', '2025-12-08 17:01:12'),
(15, 'text-area', 'textarea', 10, 2000, 1, '2025-10-30 17:11:57', '2025-12-08 17:01:18'),
(16, 'dropdown', 'dropdown', 1, 500, 0, '2025-10-30 17:14:25', '2025-12-08 01:15:56'),
(17, 'radio', 'radio', 1, 500, 0, '2025-10-30 17:14:25', '2025-12-08 01:15:56'),
(18, 'email', 'email', 5, 254, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(19, 'phone', 'tel', 6, 30, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(20, 'website', 'url', 5, 500, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(21, 'item-name', 'text', 2, 200, 1, '2025-10-30 18:33:09', '2025-12-07 03:13:38'),
(23, 'item-price', 'decimal(10,2)', 1, 50, 0, '2025-10-30 18:39:14', '2025-12-08 01:15:56'),
(28, 'phone-prefix', 'dropdown', 1, 10, 0, '2025-12-08 03:17:25', '2025-12-08 03:17:25'),
(37, 'item-variant', 'text', 2, 200, 1, '2025-12-15 09:26:00', '2025-12-15 09:26:00'),
(35, 'city', 'text', 2, 200, 0, '2025-12-15 02:49:27', '2025-12-15 02:49:27'),
(36, 'amenities', 'checklist', 0, 100, 0, '2025-12-15 06:13:31', '2025-12-15 06:13:31'),
(38, 'country-code', 'text', 2, 2, 0, '2025-12-21 05:38:23', '2025-12-21 05:38:23');

-- --------------------------------------------------------

--
-- Table structure for table `fieldsets`
--

CREATE TABLE `fieldsets` (
  `id` int(11) NOT NULL,
  `fieldset_key` varchar(255) DEFAULT NULL,
  `fieldset_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`fieldset_fields`)),
  `fieldset_name` varchar(255) NOT NULL,
  `fieldset_options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`fieldset_options`)),
  `fieldset_placeholder` text DEFAULT NULL,
  `fieldset_tooltip` varchar(500) DEFAULT NULL COMMENT 'Custom tooltip/help text shown on hover for this fieldset',
  `fieldset_editable` tinyint(1) DEFAULT NULL,
  `sort_order` int(10) UNSIGNED DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `fieldsets`
--

INSERT INTO `fieldsets` (`id`, `fieldset_key`, `fieldset_fields`, `fieldset_name`, `fieldset_options`, `fieldset_placeholder`, `fieldset_tooltip`, `fieldset_editable`, `sort_order`, `created_at`, `updated_at`) VALUES
(1, 'title', '[\"title\"]', 'Title', NULL, 'eg. Summer Rain', 'Enter a clear, descriptive title for your listing. Make it catchy and informative.', 0, 1, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(2, 'description', '[\"description\"]', 'Description', NULL, 'eg. Come and Express Yourself!', 'Provide a detailed description of your event or listing. Include key information that helps visitors understand what you\'re offering.', 0, 2, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(3, 'text-box', '[\"text-box\"]', 'Text Box (editable)', NULL, 'eg. Diamonds and Pearls', 'Write stuff here.', 1, 100, '2025-10-29 19:03:05', '2025-12-06 19:54:22'),
(4, 'text-area', '[\"text-area\"]', 'Text Area (editable)', NULL, 'eg. Sing along!', 'Write more stuff here.', 1, 100, '2025-10-29 19:03:05', '2025-12-06 19:54:42'),
(5, 'dropdown', '[\"dropdown\"]', 'Dropdown (editable)', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'One,Two,Three', 'Select one option from the dropdown menu. Choose the option that best matches your listing.', 1, 100, '2025-10-29 19:03:05', '2025-12-07 11:26:39'),
(6, 'radio', '[\"radio\"]', 'Radio Toggle (editable)', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'Four,Five,Six', 'Choose one option from the radio buttons. Only one selection is allowed.', 1, 100, '2025-10-29 19:03:05', '2025-12-07 11:26:45'),
(7, 'email', '[\"email\"]', 'Email', NULL, 'you@there.com', 'Enter a valid email address where visitors can contact you. This will be displayed publicly.', 0, 7, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(8, 'phone', '[\"phone-prefix\", \"phone\"]', 'Phone', NULL, '+61 455 555 555', 'Enter a phone number where visitors can reach you. Include country code if applicable.', 0, 8, '2025-10-29 19:03:05', '2025-12-07 16:17:25'),
(9, 'address', '[\"address-line\", \"latitude\", \"longitude\", \"country-code\"]', 'Address', NULL, '123 Main Street, Suburb, City', 'Search for and select your street address. The map will help you find the exact spot.', 0, 9, '2025-10-29 19:03:05', '2025-12-20 18:38:23'),
(10, 'website-url', '[\"website\"]', 'Website (URL)', NULL, 'www.website.com', 'Enter the full website URL (including https://) where visitors can find more information.', 0, 10, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(11, 'tickets-url', '[\"website\"]', 'Tickets (URL)', NULL, 'www.tickets.com', 'Enter the full URL (including https://) where visitors can purchase tickets or make reservations.', 0, 11, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(12, 'images', '[\"images\"]', 'Images', NULL, 'images', 'Upload images that showcase your event or listing. Good quality photos help attract more visitors.', 0, 12, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(13, 'coupon', '[\"text-box\"]', 'Coupon', NULL, 'eg. FreeStuff', 'Enter a coupon or discount code if applicable. Visitors can use this code when making purchases.', 0, 13, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(14, 'item-pricing', '[\"item-name\", \"item-variant\", \"currency\", \"item-price\"]', 'Item Pricing', NULL, 'eg. T-Shirt - Large Red - $29.95', 'Add pricing information for individual items. Include item name, price, and currency for each item you\'re selling.', 0, 14, '2025-10-29 19:03:05', '2025-12-14 22:41:43'),
(15, 'venue-ticketing', '[\"venue-name\", \"address-line\", \"latitude\", \"longitude\", \"session-date\", \"session-time\", \"seating-area\", \"pricing-tier\", \"ticket-price\", \"currency\"]', 'Event Details', NULL, 'eg.VenueSessionPricing', 'Set up venue sessions with dates, times, seating areas, and pricing tiers. This is for events with multiple sessions or ticket types.', 0, 16, '2025-10-29 19:03:05', '2025-12-14 16:12:06'),
(16, 'city', '[\"city\", \"latitude\", \"longitude\", \"country-code\"]', 'City', NULL, 'eg. Brisbane, Sydney, Melbourne', 'Enter the city or town where your listing should appear. For online or private address listings.', 0, 9, '2025-12-14 15:49:27', '2025-12-20 18:38:23'),
(17, 'venue', '[\"venue-name\", \"address-line\", \"latitude\", \"longitude\", \"country-code\"]', 'Venue', NULL, 'Search or type venue name...', 'Search for your venue or type the name manually. If searching by address, the venue name will auto-fill if Google knows the business at that location.', 0, 9, '2025-12-14 18:30:38', '2025-12-20 18:38:23'),
(18, 'amenities', '[\"amenities\"]', 'Amenities', NULL, NULL, 'Select Yes or No for each amenity that applies to this listing.', 0, 17, '2025-12-14 19:13:31', '2025-12-14 19:13:31'),
(19, 'ticket-pricing', '[\"seating-area\", \"pricing-tier\", \"currency\", \"ticket-price\"]', 'Ticket Pricing', NULL, 'eg. Orchestra - Adult - $50', 'Add ticket pricing by seating area and pricing tier. Each row is one price point.', 0, 19, '2025-12-14 22:26:00', '2025-12-14 22:41:43'),
(20, 'sessions', '[\"session-date\", \"session-time\"]', 'Sessions', NULL, 'eg. 2025-01-15 7:00 PM', 'Add session dates and times for your event.', 0, 20, '2025-12-14 22:26:00', '2025-12-15 01:42:09');

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
  `country_code` varchar(2) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `backup_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `members`
--

INSERT INTO `members` (`id`, `email`, `password_hash`, `display_name`, `member_key`, `avatar_url`, `theme`, `language`, `currency`, `country_code`, `created_at`, `backup_json`, `updated_at`) VALUES
(1, 'test@funmap.com', '$2y$10$7ABTYshHSH4SsxEH2uXwkuv.FLxVlqwkOrtkxFioJFtrK6drCs.Lm', 'TestUser', 'testuser', NULL, NULL, NULL, NULL, NULL, '2025-10-22 01:27:04', NULL, '2025-10-30 05:10:15'),
(2, 'wikidata@funmap.com', '$2a$12$/TY3Fr3AjdRMunhyA1TLzuu6DubnXkLaWc7CpdvxGdkWFEeQwNi4G', 'Wikidata / Wikipedia (CC BY-SA 4.0)', 'wikidata-/-wikipedia-(cc-by-sa-4.0)', 'assets/avatars/wikipedia.png', NULL, NULL, NULL, NULL, '2025-10-25 19:00:27', NULL, '2025-11-06 13:07:35'),
(4, 'shs@funmap.com', '$2y$10$zUWx4bFAUhgzwk81yWDLzuW9gLmyh5zQGVioX/mpFMHhyISNZo1ra', 'hello', NULL, '', NULL, NULL, NULL, NULL, '2025-11-05 21:43:35', NULL, '2025-11-05 21:43:35');

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
  `reason` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- --------------------------------------------------------

--
-- Table structure for table `picklist`
--

CREATE TABLE `picklist` (
  `id` int(11) NOT NULL,
  `option_group` varchar(50) NOT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `picklist`
--

INSERT INTO `picklist` (`id`, `option_group`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'currency', 'af AFN', 'Afghan Afghani', 1, 1),
(2, 'currency', 'al ALL', 'Albanian Lek', 2, 1),
(3, 'currency', 'dz DZD', 'Algerian Dinar', 3, 1),
(4, 'currency', 'ao AOA', 'Angolan Kwanza', 4, 1),
(5, 'currency', 'ar ARS', 'Argentine Peso', 5, 1),
(6, 'currency', 'am AMD', 'Armenian Dram', 6, 1),
(7, 'currency', 'aw AWG', 'Aruban Florin', 7, 1),
(8, 'currency', 'au AUD', 'Australian Dollar', 8, 1),
(9, 'currency', 'az AZN', 'Azerbaijani Manat', 9, 1),
(10, 'currency', 'bs BSD', 'Bahamian Dollar', 10, 1),
(11, 'currency', 'bh BHD', 'Bahraini Dinar', 11, 1),
(12, 'currency', 'bd BDT', 'Bangladeshi Taka', 12, 1),
(13, 'currency', 'bb BBD', 'Barbadian Dollar', 13, 1),
(14, 'currency', 'by BYN', 'Belarusian Ruble', 14, 1),
(15, 'currency', 'bz BZD', 'Belize Dollar', 15, 1),
(16, 'currency', 'bm BMD', 'Bermudian Dollar', 16, 1),
(17, 'currency', 'bt BTN', 'Bhutanese Ngultrum', 17, 1),
(18, 'currency', 'bo BOB', 'Bolivian Boliviano', 18, 1),
(19, 'currency', 'ba BAM', 'Bosnian Mark', 19, 1),
(20, 'currency', 'bw BWP', 'Botswana Pula', 20, 1),
(21, 'currency', 'br BRL', 'Brazilian Real', 21, 1),
(22, 'currency', 'bn BND', 'Brunei Dollar', 22, 1),
(23, 'currency', 'bg BGN', 'Bulgarian Lev', 23, 1),
(24, 'currency', 'bi BIF', 'Burundian Franc', 24, 1),
(25, 'currency', 'kh KHR', 'Cambodian Riel', 25, 1),
(26, 'currency', 'ca CAD', 'Canadian Dollar', 26, 1),
(27, 'currency', 'cv CVE', 'Cape Verdean Escudo', 27, 1),
(28, 'currency', 'ky KYD', 'Cayman Islands Dollar', 28, 1),
(29, 'currency', 'cm XAF', 'Central African CFA', 29, 1),
(30, 'currency', 'nc XPF', 'CFP Franc', 30, 1),
(31, 'currency', 'cl CLP', 'Chilean Peso', 31, 1),
(32, 'currency', 'cn CNY', 'Chinese Yuan', 32, 1),
(33, 'currency', 'co COP', 'Colombian Peso', 33, 1),
(34, 'currency', 'km KMF', 'Comorian Franc', 34, 1),
(35, 'currency', 'cd CDF', 'Congolese Franc', 35, 1),
(36, 'currency', 'cr CRC', 'Costa Rican Colon', 36, 1),
(37, 'currency', 'hr HRK', 'Croatian Kuna', 37, 1),
(38, 'currency', 'cu CUP', 'Cuban Peso', 38, 1),
(39, 'currency', 'cz CZK', 'Czech Koruna', 39, 1),
(40, 'currency', 'dk DKK', 'Danish Krone', 40, 1),
(41, 'currency', 'dj DJF', 'Djiboutian Franc', 41, 1),
(42, 'currency', 'do DOP', 'Dominican Peso', 42, 1),
(43, 'currency', 'eg EGP', 'Egyptian Pound', 43, 1),
(44, 'currency', 'er ERN', 'Eritrean Nakfa', 44, 1),
(45, 'currency', 'et ETB', 'Ethiopian Birr', 45, 1),
(46, 'currency', 'eu EUR', 'Euro', 46, 1),
(47, 'currency', 'fk FKP', 'Falkland Islands Pound', 47, 1),
(48, 'currency', 'fj FJD', 'Fijian Dollar', 48, 1),
(49, 'currency', 'gm GMD', 'Gambian Dalasi', 49, 1),
(50, 'currency', 'ge GEL', 'Georgian Lari', 50, 1),
(51, 'currency', 'gh GHS', 'Ghanaian Cedi', 51, 1),
(52, 'currency', 'gi GIP', 'Gibraltar Pound', 52, 1),
(53, 'currency', 'gt GTQ', 'Guatemalan Quetzal', 53, 1),
(54, 'currency', 'gn GNF', 'Guinean Franc', 54, 1),
(55, 'currency', 'gy GYD', 'Guyanese Dollar', 55, 1),
(56, 'currency', 'ht HTG', 'Haitian Gourde', 56, 1),
(57, 'currency', 'hn HNL', 'Honduran Lempira', 57, 1),
(58, 'currency', 'hk HKD', 'Hong Kong Dollar', 58, 1),
(59, 'currency', 'hu HUF', 'Hungarian Forint', 59, 1),
(60, 'currency', 'is ISK', 'Icelandic Krona', 60, 1),
(61, 'currency', 'in INR', 'Indian Rupee', 61, 1),
(62, 'currency', 'id IDR', 'Indonesian Rupiah', 62, 1),
(63, 'currency', 'ir IRR', 'Iranian Rial', 63, 1),
(64, 'currency', 'iq IQD', 'Iraqi Dinar', 64, 1),
(65, 'currency', 'il ILS', 'Israeli Shekel', 65, 1),
(66, 'currency', 'jm JMD', 'Jamaican Dollar', 66, 1),
(67, 'currency', 'jp JPY', 'Japanese Yen', 67, 1),
(68, 'currency', 'jo JOD', 'Jordanian Dinar', 68, 1),
(69, 'currency', 'kz KZT', 'Kazakhstani Tenge', 69, 1),
(70, 'currency', 'ke KES', 'Kenyan Shilling', 70, 1),
(71, 'currency', 'kw KWD', 'Kuwaiti Dinar', 71, 1),
(72, 'currency', 'kg KGS', 'Kyrgyzstani Som', 72, 1),
(73, 'currency', 'la LAK', 'Lao Kip', 73, 1),
(74, 'currency', 'lb LBP', 'Lebanese Pound', 74, 1),
(75, 'currency', 'ls LSL', 'Lesotho Loti', 75, 1),
(76, 'currency', 'lr LRD', 'Liberian Dollar', 76, 1),
(77, 'currency', 'ly LYD', 'Libyan Dinar', 77, 1),
(78, 'currency', 'mo MOP', 'Macanese Pataca', 78, 1),
(79, 'currency', 'mk MKD', 'Macedonian Denar', 79, 1),
(80, 'currency', 'mg MGA', 'Malagasy Ariary', 80, 1),
(81, 'currency', 'mw MWK', 'Malawian Kwacha', 81, 1),
(82, 'currency', 'my MYR', 'Malaysian Ringgit', 82, 1),
(83, 'currency', 'mv MVR', 'Maldivian Rufiyaa', 83, 1),
(84, 'currency', 'mr MRU', 'Mauritanian Ouguiya', 84, 1),
(85, 'currency', 'mu MUR', 'Mauritian Rupee', 85, 1),
(86, 'currency', 'mx MXN', 'Mexican Peso', 86, 1),
(87, 'currency', 'md MDL', 'Moldovan Leu', 87, 1),
(88, 'currency', 'mn MNT', 'Mongolian Tugrik', 88, 1),
(89, 'currency', 'ma MAD', 'Moroccan Dirham', 89, 1),
(90, 'currency', 'mz MZN', 'Mozambican Metical', 90, 1),
(91, 'currency', 'mm MMK', 'Myanmar Kyat', 91, 1),
(92, 'currency', 'na NAD', 'Namibian Dollar', 92, 1),
(93, 'currency', 'np NPR', 'Nepalese Rupee', 93, 1),
(94, 'currency', 'nz NZD', 'New Zealand Dollar', 94, 1),
(95, 'currency', 'ni NIO', 'Nicaraguan Cordoba', 95, 1),
(96, 'currency', 'ng NGN', 'Nigerian Naira', 96, 1),
(97, 'currency', 'kp KPW', 'North Korean Won', 97, 1),
(98, 'currency', 'no NOK', 'Norwegian Krone', 98, 1),
(99, 'currency', 'om OMR', 'Omani Rial', 99, 1),
(100, 'currency', 'pk PKR', 'Pakistani Rupee', 100, 1),
(101, 'currency', 'pa PAB', 'Panamanian Balboa', 101, 1),
(102, 'currency', 'pg PGK', 'Papua New Guinean Kina', 102, 1),
(103, 'currency', 'py PYG', 'Paraguayan Guarani', 103, 1),
(104, 'currency', 'pe PEN', 'Peruvian Sol', 104, 1),
(105, 'currency', 'ph PHP', 'Philippine Peso', 105, 1),
(106, 'currency', 'pl PLN', 'Polish Zloty', 106, 1),
(107, 'currency', 'gb GBP', 'Pound Sterling', 107, 1),
(108, 'currency', 'qa QAR', 'Qatari Riyal', 108, 1),
(109, 'currency', 'ro RON', 'Romanian Leu', 109, 1),
(110, 'currency', 'ru RUB', 'Russian Ruble', 110, 1),
(111, 'currency', 'rw RWF', 'Rwandan Franc', 111, 1),
(112, 'currency', 'ws WST', 'Samoan Tala', 112, 1),
(113, 'currency', 'sa SAR', 'Saudi Riyal', 113, 1),
(114, 'currency', 'rs RSD', 'Serbian Dinar', 114, 1),
(115, 'currency', 'sc SCR', 'Seychellois Rupee', 115, 1),
(116, 'currency', 'sl SLL', 'Sierra Leonean Leone', 116, 1),
(117, 'currency', 'sg SGD', 'Singapore Dollar', 117, 1),
(118, 'currency', 'sb SBD', 'Solomon Islands Dollar', 118, 1),
(119, 'currency', 'so SOS', 'Somali Shilling', 119, 1),
(120, 'currency', 'za ZAR', 'South African Rand', 120, 1),
(121, 'currency', 'kr KRW', 'South Korean Won', 121, 1),
(122, 'currency', 'ss SSP', 'South Sudanese Pound', 122, 1),
(123, 'currency', 'lk LKR', 'Sri Lankan Rupee', 123, 1),
(124, 'currency', 'sd SDG', 'Sudanese Pound', 124, 1),
(125, 'currency', 'sr SRD', 'Surinamese Dollar', 125, 1),
(126, 'currency', 'sz SZL', 'Swazi Lilangeni', 126, 1),
(127, 'currency', 'se SEK', 'Swedish Krona', 127, 1),
(128, 'currency', 'ch CHF', 'Swiss Franc', 128, 1),
(129, 'currency', 'sy SYP', 'Syrian Pound', 129, 1),
(130, 'currency', 'tw TWD', 'Taiwan Dollar', 130, 1),
(131, 'currency', 'tj TJS', 'Tajikistani Somoni', 131, 1),
(132, 'currency', 'tz TZS', 'Tanzanian Shilling', 132, 1),
(133, 'currency', 'th THB', 'Thai Baht', 133, 1),
(134, 'currency', 'to TOP', 'Tongan Paanga', 134, 1),
(135, 'currency', 'tt TTD', 'Trinidad Dollar', 135, 1),
(136, 'currency', 'tn TND', 'Tunisian Dinar', 136, 1),
(137, 'currency', 'tr TRY', 'Turkish Lira', 137, 1),
(138, 'currency', 'tm TMT', 'Turkmenistani Manat', 138, 1),
(139, 'currency', 'ae AED', 'UAE Dirham', 139, 1),
(140, 'currency', 'ug UGX', 'Ugandan Shilling', 140, 1),
(141, 'currency', 'ua UAH', 'Ukrainian Hryvnia', 141, 1),
(142, 'currency', 'uy UYU', 'Uruguayan Peso', 142, 1),
(143, 'currency', 'us USD', 'US Dollar', 143, 1),
(144, 'currency', 'uz UZS', 'Uzbekistani Som', 144, 1),
(145, 'currency', 'vu VUV', 'Vanuatu Vatu', 145, 1),
(146, 'currency', 've VES', 'Venezuelan Bolivar', 146, 1),
(147, 'currency', 'vn VND', 'Vietnamese Dong', 147, 1),
(148, 'currency', 'sn XOF', 'West African CFA', 148, 1),
(149, 'currency', 'ye YER', 'Yemeni Rial', 149, 1),
(150, 'currency', 'zm ZMW', 'Zambian Kwacha', 150, 1),
(151, 'currency', 'zw ZWL', 'Zimbabwean Dollar', 151, 1),
(200, 'phone-prefix', 'af +93', 'Afghanistan', 1, 1),
(201, 'phone-prefix', 'al +355', 'Albania', 2, 1),
(202, 'phone-prefix', 'dz +213', 'Algeria', 3, 1),
(203, 'phone-prefix', 'ad +376', 'Andorra', 4, 1),
(204, 'phone-prefix', 'ao +244', 'Angola', 5, 1),
(205, 'phone-prefix', 'ag +1', 'Antigua and Barbuda', 6, 1),
(206, 'phone-prefix', 'ar +54', 'Argentina', 7, 1),
(207, 'phone-prefix', 'am +374', 'Armenia', 8, 1),
(208, 'phone-prefix', 'au +61', 'Australia', 9, 1),
(209, 'phone-prefix', 'at +43', 'Austria', 10, 1),
(210, 'phone-prefix', 'az +994', 'Azerbaijan', 11, 1),
(211, 'phone-prefix', 'bs +1', 'Bahamas', 12, 1),
(212, 'phone-prefix', 'bh +973', 'Bahrain', 13, 1),
(213, 'phone-prefix', 'bd +880', 'Bangladesh', 14, 1),
(214, 'phone-prefix', 'bb +1', 'Barbados', 15, 1),
(215, 'phone-prefix', 'by +375', 'Belarus', 16, 1),
(216, 'phone-prefix', 'be +32', 'Belgium', 17, 1),
(217, 'phone-prefix', 'bz +501', 'Belize', 18, 1),
(218, 'phone-prefix', 'bj +229', 'Benin', 19, 1),
(219, 'phone-prefix', 'bt +975', 'Bhutan', 20, 1),
(220, 'phone-prefix', 'bo +591', 'Bolivia', 21, 1),
(221, 'phone-prefix', 'ba +387', 'Bosnia and Herzegovina', 22, 1),
(222, 'phone-prefix', 'bw +267', 'Botswana', 23, 1),
(223, 'phone-prefix', 'br +55', 'Brazil', 24, 1),
(224, 'phone-prefix', 'bn +673', 'Brunei', 25, 1),
(225, 'phone-prefix', 'bg +359', 'Bulgaria', 26, 1),
(226, 'phone-prefix', 'bf +226', 'Burkina Faso', 27, 1),
(227, 'phone-prefix', 'bi +257', 'Burundi', 28, 1),
(228, 'phone-prefix', 'kh +855', 'Cambodia', 29, 1),
(229, 'phone-prefix', 'cm +237', 'Cameroon', 30, 1),
(230, 'phone-prefix', 'ca +1', 'Canada', 31, 1),
(231, 'phone-prefix', 'cv +238', 'Cape Verde', 32, 1),
(232, 'phone-prefix', 'cf +236', 'Central African Republic', 33, 1),
(233, 'phone-prefix', 'td +235', 'Chad', 34, 1),
(234, 'phone-prefix', 'cl +56', 'Chile', 35, 1),
(235, 'phone-prefix', 'cn +86', 'China', 36, 1),
(236, 'phone-prefix', 'co +57', 'Colombia', 37, 1),
(237, 'phone-prefix', 'km +269', 'Comoros', 38, 1),
(238, 'phone-prefix', 'cg +242', 'Congo', 39, 1),
(239, 'phone-prefix', 'cd +243', 'Congo (DRC)', 40, 1),
(240, 'phone-prefix', 'cr +506', 'Costa Rica', 41, 1),
(241, 'phone-prefix', 'hr +385', 'Croatia', 42, 1),
(242, 'phone-prefix', 'cu +53', 'Cuba', 43, 1),
(243, 'phone-prefix', 'cy +357', 'Cyprus', 44, 1),
(244, 'phone-prefix', 'cz +420', 'Czech Republic', 45, 1),
(245, 'phone-prefix', 'dk +45', 'Denmark', 46, 1),
(246, 'phone-prefix', 'dj +253', 'Djibouti', 47, 1),
(247, 'phone-prefix', 'dm +1', 'Dominica', 48, 1),
(248, 'phone-prefix', 'do +1', 'Dominican Republic', 49, 1),
(249, 'phone-prefix', 'ec +593', 'Ecuador', 50, 1),
(250, 'phone-prefix', 'eg +20', 'Egypt', 51, 1),
(251, 'phone-prefix', 'sv +503', 'El Salvador', 52, 1),
(252, 'phone-prefix', 'gq +240', 'Equatorial Guinea', 53, 1),
(253, 'phone-prefix', 'er +291', 'Eritrea', 54, 1),
(254, 'phone-prefix', 'ee +372', 'Estonia', 55, 1),
(255, 'phone-prefix', 'sz +268', 'Eswatini', 56, 1),
(256, 'phone-prefix', 'et +251', 'Ethiopia', 57, 1),
(257, 'phone-prefix', 'fj +679', 'Fiji', 58, 1),
(258, 'phone-prefix', 'fi +358', 'Finland', 59, 1),
(259, 'phone-prefix', 'fr +33', 'France', 60, 1),
(260, 'phone-prefix', 'ga +241', 'Gabon', 61, 1),
(261, 'phone-prefix', 'gm +220', 'Gambia', 62, 1),
(262, 'phone-prefix', 'ge +995', 'Georgia', 63, 1),
(263, 'phone-prefix', 'de +49', 'Germany', 64, 1),
(264, 'phone-prefix', 'gh +233', 'Ghana', 65, 1),
(265, 'phone-prefix', 'gr +30', 'Greece', 66, 1),
(266, 'phone-prefix', 'gd +1', 'Grenada', 67, 1),
(267, 'phone-prefix', 'gt +502', 'Guatemala', 68, 1),
(268, 'phone-prefix', 'gn +224', 'Guinea', 69, 1),
(269, 'phone-prefix', 'gw +245', 'Guinea-Bissau', 70, 1),
(270, 'phone-prefix', 'gy +592', 'Guyana', 71, 1),
(271, 'phone-prefix', 'ht +509', 'Haiti', 72, 1),
(272, 'phone-prefix', 'hn +504', 'Honduras', 73, 1),
(273, 'phone-prefix', 'hk +852', 'Hong Kong', 74, 1),
(274, 'phone-prefix', 'hu +36', 'Hungary', 75, 1),
(275, 'phone-prefix', 'is +354', 'Iceland', 76, 1),
(276, 'phone-prefix', 'in +91', 'India', 77, 1),
(277, 'phone-prefix', 'id +62', 'Indonesia', 78, 1),
(278, 'phone-prefix', 'ir +98', 'Iran', 79, 1),
(279, 'phone-prefix', 'iq +964', 'Iraq', 80, 1),
(280, 'phone-prefix', 'ie +353', 'Ireland', 81, 1),
(281, 'phone-prefix', 'il +972', 'Israel', 82, 1),
(282, 'phone-prefix', 'it +39', 'Italy', 83, 1),
(283, 'phone-prefix', 'ci +225', 'Ivory Coast', 84, 1),
(284, 'phone-prefix', 'jm +1', 'Jamaica', 85, 1),
(285, 'phone-prefix', 'jp +81', 'Japan', 86, 1),
(286, 'phone-prefix', 'jo +962', 'Jordan', 87, 1),
(287, 'phone-prefix', 'kz +7', 'Kazakhstan', 88, 1),
(288, 'phone-prefix', 'ke +254', 'Kenya', 89, 1),
(289, 'phone-prefix', 'ki +686', 'Kiribati', 90, 1),
(290, 'phone-prefix', 'xk +383', 'Kosovo', 91, 1),
(291, 'phone-prefix', 'kw +965', 'Kuwait', 92, 1),
(292, 'phone-prefix', 'kg +996', 'Kyrgyzstan', 93, 1),
(293, 'phone-prefix', 'la +856', 'Laos', 94, 1),
(294, 'phone-prefix', 'lv +371', 'Latvia', 95, 1),
(295, 'phone-prefix', 'lb +961', 'Lebanon', 96, 1),
(296, 'phone-prefix', 'ls +266', 'Lesotho', 97, 1),
(297, 'phone-prefix', 'lr +231', 'Liberia', 98, 1),
(298, 'phone-prefix', 'ly +218', 'Libya', 99, 1),
(299, 'phone-prefix', 'li +423', 'Liechtenstein', 100, 1),
(300, 'phone-prefix', 'lt +370', 'Lithuania', 101, 1),
(301, 'phone-prefix', 'lu +352', 'Luxembourg', 102, 1),
(302, 'phone-prefix', 'mo +853', 'Macau', 103, 1),
(303, 'phone-prefix', 'mg +261', 'Madagascar', 104, 1),
(304, 'phone-prefix', 'mw +265', 'Malawi', 105, 1),
(305, 'phone-prefix', 'my +60', 'Malaysia', 106, 1),
(306, 'phone-prefix', 'mv +960', 'Maldives', 107, 1),
(307, 'phone-prefix', 'ml +223', 'Mali', 108, 1),
(308, 'phone-prefix', 'mt +356', 'Malta', 109, 1),
(309, 'phone-prefix', 'mh +692', 'Marshall Islands', 110, 1),
(310, 'phone-prefix', 'mr +222', 'Mauritania', 111, 1),
(311, 'phone-prefix', 'mu +230', 'Mauritius', 112, 1),
(312, 'phone-prefix', 'mx +52', 'Mexico', 113, 1),
(313, 'phone-prefix', 'fm +691', 'Micronesia', 114, 1),
(314, 'phone-prefix', 'md +373', 'Moldova', 115, 1),
(315, 'phone-prefix', 'mc +377', 'Monaco', 116, 1),
(316, 'phone-prefix', 'mn +976', 'Mongolia', 117, 1),
(317, 'phone-prefix', 'me +382', 'Montenegro', 118, 1),
(318, 'phone-prefix', 'ma +212', 'Morocco', 119, 1),
(319, 'phone-prefix', 'mz +258', 'Mozambique', 120, 1),
(320, 'phone-prefix', 'mm +95', 'Myanmar', 121, 1),
(321, 'phone-prefix', 'na +264', 'Namibia', 122, 1),
(322, 'phone-prefix', 'nr +674', 'Nauru', 123, 1),
(323, 'phone-prefix', 'np +977', 'Nepal', 124, 1),
(324, 'phone-prefix', 'nl +31', 'Netherlands', 125, 1),
(325, 'phone-prefix', 'nz +64', 'New Zealand', 126, 1),
(326, 'phone-prefix', 'ni +505', 'Nicaragua', 127, 1),
(327, 'phone-prefix', 'ne +227', 'Niger', 128, 1),
(328, 'phone-prefix', 'ng +234', 'Nigeria', 129, 1),
(329, 'phone-prefix', 'kp +850', 'North Korea', 130, 1),
(330, 'phone-prefix', 'mk +389', 'North Macedonia', 131, 1),
(331, 'phone-prefix', 'no +47', 'Norway', 132, 1),
(332, 'phone-prefix', 'om +968', 'Oman', 133, 1),
(333, 'phone-prefix', 'pk +92', 'Pakistan', 134, 1),
(334, 'phone-prefix', 'pw +680', 'Palau', 135, 1),
(335, 'phone-prefix', 'ps +970', 'Palestine', 136, 1),
(336, 'phone-prefix', 'pa +507', 'Panama', 137, 1),
(337, 'phone-prefix', 'pg +675', 'Papua New Guinea', 138, 1),
(338, 'phone-prefix', 'py +595', 'Paraguay', 139, 1),
(339, 'phone-prefix', 'pe +51', 'Peru', 140, 1),
(340, 'phone-prefix', 'ph +63', 'Philippines', 141, 1),
(341, 'phone-prefix', 'pl +48', 'Poland', 142, 1),
(342, 'phone-prefix', 'pt +351', 'Portugal', 143, 1),
(343, 'phone-prefix', 'qa +974', 'Qatar', 144, 1),
(344, 'phone-prefix', 'ro +40', 'Romania', 145, 1),
(345, 'phone-prefix', 'ru +7', 'Russia', 146, 1),
(346, 'phone-prefix', 'rw +250', 'Rwanda', 147, 1),
(347, 'phone-prefix', 'kn +1', 'Saint Kitts and Nevis', 148, 1),
(348, 'phone-prefix', 'lc +1', 'Saint Lucia', 149, 1),
(349, 'phone-prefix', 'vc +1', 'Saint Vincent', 150, 1),
(350, 'phone-prefix', 'ws +685', 'Samoa', 151, 1),
(351, 'phone-prefix', 'sm +378', 'San Marino', 152, 1),
(352, 'phone-prefix', 'st +239', 'Sao Tome and Principe', 153, 1),
(353, 'phone-prefix', 'sa +966', 'Saudi Arabia', 154, 1),
(354, 'phone-prefix', 'sn +221', 'Senegal', 155, 1),
(355, 'phone-prefix', 'rs +381', 'Serbia', 156, 1),
(356, 'phone-prefix', 'sc +248', 'Seychelles', 157, 1),
(357, 'phone-prefix', 'sl +232', 'Sierra Leone', 158, 1),
(358, 'phone-prefix', 'sg +65', 'Singapore', 159, 1),
(359, 'phone-prefix', 'sk +421', 'Slovakia', 160, 1),
(360, 'phone-prefix', 'si +386', 'Slovenia', 161, 1),
(361, 'phone-prefix', 'sb +677', 'Solomon Islands', 162, 1),
(362, 'phone-prefix', 'so +252', 'Somalia', 163, 1),
(363, 'phone-prefix', 'za +27', 'South Africa', 164, 1),
(364, 'phone-prefix', 'kr +82', 'South Korea', 165, 1),
(365, 'phone-prefix', 'ss +211', 'South Sudan', 166, 1),
(366, 'phone-prefix', 'es +34', 'Spain', 167, 1),
(367, 'phone-prefix', 'lk +94', 'Sri Lanka', 168, 1),
(368, 'phone-prefix', 'sd +249', 'Sudan', 169, 1),
(369, 'phone-prefix', 'sr +597', 'Suriname', 170, 1),
(370, 'phone-prefix', 'se +46', 'Sweden', 171, 1),
(371, 'phone-prefix', 'ch +41', 'Switzerland', 172, 1),
(372, 'phone-prefix', 'sy +963', 'Syria', 173, 1),
(373, 'phone-prefix', 'tw +886', 'Taiwan', 174, 1),
(374, 'phone-prefix', 'tj +992', 'Tajikistan', 175, 1),
(375, 'phone-prefix', 'tz +255', 'Tanzania', 176, 1),
(376, 'phone-prefix', 'th +66', 'Thailand', 177, 1),
(377, 'phone-prefix', 'tl +670', 'Timor-Leste', 178, 1),
(378, 'phone-prefix', 'tg +228', 'Togo', 179, 1),
(379, 'phone-prefix', 'to +676', 'Tonga', 180, 1),
(380, 'phone-prefix', 'tt +1', 'Trinidad and Tobago', 181, 1),
(381, 'phone-prefix', 'tn +216', 'Tunisia', 182, 1),
(382, 'phone-prefix', 'tr +90', 'Turkey', 183, 1),
(383, 'phone-prefix', 'tm +993', 'Turkmenistan', 184, 1),
(384, 'phone-prefix', 'tv +688', 'Tuvalu', 185, 1),
(385, 'phone-prefix', 'ae +971', 'UAE', 186, 1),
(386, 'phone-prefix', 'ug +256', 'Uganda', 187, 1),
(387, 'phone-prefix', 'ua +380', 'Ukraine', 188, 1),
(388, 'phone-prefix', 'gb +44', 'United Kingdom', 189, 1),
(389, 'phone-prefix', 'us +1', 'United States', 190, 1),
(390, 'phone-prefix', 'uy +598', 'Uruguay', 191, 1),
(391, 'phone-prefix', 'uz +998', 'Uzbekistan', 192, 1),
(392, 'phone-prefix', 'vu +678', 'Vanuatu', 193, 1),
(393, 'phone-prefix', 'va +39', 'Vatican City', 194, 1),
(394, 'phone-prefix', 've +58', 'Venezuela', 195, 1),
(395, 'phone-prefix', 'vn +84', 'Vietnam', 196, 1),
(396, 'phone-prefix', 'ye +967', 'Yemen', 197, 1),
(397, 'phone-prefix', 'zm +260', 'Zambia', 198, 1),
(398, 'phone-prefix', 'zw +263', 'Zimbabwe', 199, 1),
(399, 'amenity', 'parking Parking', 'Vehicle parking available at or near this location', 1, 1),
(400, 'amenity', 'wheelchair Wheelchair Access', 'This location is wheelchair accessible', 2, 1),
(401, 'amenity', 'accessible-parking Accessible Parking', 'Designated accessible parking spaces available', 3, 1),
(402, 'amenity', 'food Food & Beverages', 'Food and beverages available for purchase', 10, 1),
(403, 'amenity', 'byo BYO Allowed', 'BYO food or beverages permitted', 11, 1),
(404, 'amenity', 'licensed Licensed Venue', 'Licensed to serve alcohol', 12, 1),
(405, 'amenity', 'alacarte À La Carte', 'À la carte menu available', 13, 1),
(406, 'amenity', 'takeaway Takeaway', 'Takeaway orders available', 14, 1),
(407, 'amenity', 'delivery Delivery', 'Delivery service available', 15, 1),
(408, 'amenity', 'reservations Reservations', 'Reservations accepted or required', 16, 1),
(409, 'amenity', 'kids Kid Friendly', 'Suitable for children', 20, 1),
(410, 'amenity', 'childminding Child Minding', 'Child minding services available', 21, 1),
(411, 'amenity', 'babychange Baby Change', 'Baby change facilities available', 22, 1),
(412, 'amenity', 'petfriendly Pet Friendly', 'Pets welcome', 23, 1),
(413, 'amenity', 'serviceanimals Service Animals', 'Service animals welcome', 24, 1),
(414, 'amenity', 'wifi WiFi', 'Free WiFi available', 30, 1),
(415, 'amenity', 'aircon Air Conditioning', 'Air conditioned venue', 31, 1),
(416, 'amenity', 'outdoor Outdoor Seating', 'Outdoor seating area available', 32, 1),
(417, 'amenity', 'smoking Smoking Area', 'Designated smoking area', 33, 1),
(418, 'amenity', 'restrooms Restrooms', 'Public restrooms available', 34, 1),
(419, 'amenity', 'atm ATM', 'ATM on premises', 35, 1),
(420, 'amenity', 'coatcheck Coat Check', 'Coat check service available', 36, 1),
(421, 'amenity', 'livemusic Live Music', 'Live music performances', 40, 1),
(422, 'amenity', 'dancefloor Dance Floor', 'Dance floor available', 41, 1),
(423, 'amenity', 'vip VIP Area', 'VIP or private area available', 42, 1),
(424, 'amenity', 'pool Swimming Pool', 'Swimming pool on site', 50, 1),
(425, 'amenity', 'gym Gym', 'Fitness center or gym available', 51, 1),
(426, 'amenity', 'breakfast Breakfast Included', 'Breakfast included with stay', 52, 1),
(427, 'amenity', 'kitchen Kitchen Facilities', 'Kitchen or kitchenette available', 53, 1),
(428, 'amenity', 'laundry Laundry', 'Laundry facilities available', 54, 1);

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
  `visibility` enum('paused','active','expired') DEFAULT 'paused',
  `moderation_status` enum('pending','clean','blurred','hidden') DEFAULT 'pending',
  `flag_reason` text DEFAULT NULL,
  `checkout_title` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','paid','failed','refunded') DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `post_children`
--

CREATE TABLE `post_children` (
  `id` int(11) NOT NULL,
  `map_card_id` int(11) NOT NULL,
  `session_date` date DEFAULT NULL,
  `session_time` time DEFAULT NULL,
  `seating_area` varchar(100) DEFAULT NULL,
  `pricing_tier` varchar(100) DEFAULT NULL,
  `variant_name` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
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
  `custom_text` varchar(500) DEFAULT NULL,
  `custom_textarea` text DEFAULT NULL,
  `custom_dropdown` varchar(255) DEFAULT NULL,
  `custom_radio` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `venue_name` varchar(255) DEFAULT NULL,
  `address_line` varchar(500) DEFAULT NULL,
  `latitude` decimal(10,7) NOT NULL,
  `longitude` decimal(10,7) NOT NULL,
  `country_code` varchar(2) DEFAULT NULL,
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
  `fieldset_ids` varchar(255) DEFAULT NULL,
  `fieldset_name` varchar(255) DEFAULT NULL,
  `required` varchar(255) DEFAULT NULL,
  `location_repeat` varchar(255) DEFAULT NULL,
  `must_repeat` varchar(255) DEFAULT NULL,
  `autofill_repeat` varchar(255) DEFAULT NULL,
  `checkout_surcharge` decimal(10,2) DEFAULT NULL,
  `sort_order` text DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `icon_path` varchar(255) DEFAULT NULL,
  `color_hex` varchar(7) DEFAULT NULL,
  `subcategory_type` varchar(20) DEFAULT NULL,
  `subcategory_type_logic` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `category_name`, `subcategory_name`, `subcategory_key`, `fieldset_ids`, `fieldset_name`, `required`, `location_repeat`, `must_repeat`, `autofill_repeat`, `checkout_surcharge`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `subcategory_type`, `subcategory_type_logic`, `created_at`, `updated_at`) VALUES
(1, 1, 'What\'s On', 'Live Gigs', 'live-gigs', '1,2,12,17,18,19,20', 'Title, Description, Images, Venue, Amenities, Ticket Pricing, Sessions', '1,1,1,1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/whats-on-blue.svg', '#E74C3C', 'Events', 'Sessions Menu shows dates/times. Date-driven pricing based on final session date. Listing expires after final session ends (searchable via expired filter for 12 months). Venue menu + Sessions menu.', '2025-10-29 12:32:47', '2025-12-20 05:38:28'),
(2, 1, 'What\'s On', 'Live Theatre', 'live-theatre', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/whats-on-yellow.svg', '#E74C3C', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(3, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/whats-on-green.svg', '#E74C3C', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(4, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/whats-on-purple.svg', '#E74C3C', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(5, 1, 'What\'s On', 'Live Sport', 'live-sport', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '5', 0, 'assets/category-icons/whats-on-orange.svg', '#E74C3C', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(6, 1, 'What\'s On', 'Venues', 'venues', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '7', 0, 'assets/category-icons/for-hire-green.svg', '#E74C3C', 'General', 'Entries Menu shows items/jobs/services/etc. Single entry: displays entry directly. Multi-entry: default view is About landing page (overview, not specific entry) until user selects an entry from the menu. Clicking entry changes summary info and may auto-switch image. Up to 10 images per entry. Venue menu + Entries menu.', '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(7, 1, 'What\'s On', 'Other Events', 'other-events', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '6', 0, 'assets/category-icons/whats-on-gray.svg', '#E74C3C', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-19 19:33:59'),
(8, 1, 'What\'s On', 'Festivals', 'festivals', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '8', 0, 'assets/category-icons/whats-on-red.svg', '#E74C3C', 'Events', NULL, '2025-12-14 13:12:42', '2025-12-19 19:33:59'),
(9, 1, 'What\'s On', 'Markets', 'markets', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '9', 0, 'assets/category-icons/whats-on-teal.svg', '#E74C3C', 'Events', NULL, '2025-12-14 13:12:42', '2025-12-19 19:33:59'),
(20, 2, 'Opportunities', 'Stage Auditions', 'stage-auditions', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '6', 0, 'assets/category-icons/opportunities-green.svg', '#F1C40F', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(21, 2, 'Opportunities', 'Screen Auditions', 'screen-auditions', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '5', 0, 'assets/category-icons/opportunities-orange.svg', '#F1C40F', 'Events', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(22, 2, 'Opportunities', 'Clubs', 'clubs', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/opportunities-purple.svg', '#F1C40F', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(23, 2, 'Opportunities', 'Jobs', 'jobs', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/opportunities-blue.svg', '#F1C40F', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(24, 2, 'Opportunities', 'Volunteers', 'volunteers', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '7', 0, 'assets/category-icons/opportunities-red.svg', '#F1C40F', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(25, 2, 'Opportunities', 'Competitions', 'competitions', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/opportunities-yellow.svg', '#F1C40F', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(26, 2, 'Opportunities', 'Other Opportunities', 'other-opportunities', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/opportunities-gray.svg', '#F1C40F', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(30, 3, 'Learning', 'Tutors', 'tutors', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/learning-green.svg', '#3498DB', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(31, 3, 'Learning', 'Education Centres', 'education-centres', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/learning-yellow.svg', '#3498DB', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(32, 3, 'Learning', 'Courses', 'courses', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/learning-blue.svg', '#3498DB', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(33, 3, 'Learning', 'Other Learning', 'other-learning', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/learning-red.svg', '#3498DB', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(40, 4, 'Buy and Sell', 'Wanted', 'wanted', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/buy-and-sell-yellow.svg', '#2ECC71', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(41, 4, 'Buy and Sell', 'For Sale', 'for-sale', '1,2,14,12,9', 'Title, Description, Item Pricing, Images, Address', '1,1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/buy-and-sell-blue.svg', '#2ECC71', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(42, 4, 'Buy and Sell', 'Freebies', 'freebies', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/buy-and-sell-purple.svg', '#2ECC71', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(50, 5, 'For Hire', 'Performers', 'performers', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/for-hire-blue.svg', '#9B59B6', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:12:37'),
(51, 5, 'For Hire', 'Staff', 'staff', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/for-hire-yellow.svg', '#9B59B6', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(52, 5, 'For Hire', 'Goods and Services', 'goods-and-services', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/for-hire-green.svg', '#9B59B6', 'General', NULL, '2025-10-29 12:32:47', '2025-12-15 13:19:17'),
(60, 6, 'Eat & Drink', 'Restaurants', 'restaurants', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/eat-and-drink-blue.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(61, 6, 'Eat & Drink', 'Bars & Pubs', 'bars-pubs', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/eat-and-drink-purple.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(62, 6, 'Eat & Drink', 'Cafes', 'cafes', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/eat-and-drink-yellow.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(63, 6, 'Eat & Drink', 'Nightclubs', 'nightclubs', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/eat-and-drink-red.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(64, 6, 'Eat & Drink', 'Takeaway', 'takeaway', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '5', 0, 'assets/category-icons/eat-and-drink-orange.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(65, 6, 'Eat & Drink', 'Other Eat & Drink', 'other-eat-drink', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '6', 0, 'assets/category-icons/eat-and-drink-gray.svg', '#E67E22', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(70, 7, 'Stay', 'Hotels & Resorts', 'hotels-resorts', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/stay-blue.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(71, 7, 'Stay', 'Motels', 'motels', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/stay-yellow.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(72, 7, 'Stay', 'Hostels', 'hostels', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/stay-green.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(73, 7, 'Stay', 'Holiday Rentals', 'holiday-rentals', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/stay-orange.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(74, 7, 'Stay', 'Caravan & Camping', 'caravan-camping', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '5', 0, 'assets/category-icons/stay-green.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(75, 7, 'Stay', 'Bed & Breakfast', 'bed-breakfast', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '6', 0, 'assets/category-icons/stay-pink.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(76, 7, 'Stay', 'Other Stay', 'other-stay', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '7', 0, 'assets/category-icons/stay-gray.svg', '#1ABC9C', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(80, 8, 'Get Around', 'Car Hire', 'car-hire', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/get-around-blue.svg', '#34495E', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:12:37'),
(81, 8, 'Get Around', 'Bike & Scooter', 'bike-scooter', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/get-around-yellow.svg', '#34495E', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(82, 8, 'Get Around', 'Tours & Experiences', 'tours-experiences', '1,2,12,15', 'Title, Description, Images, Event Details', '1,1,1,1', NULL, NULL, NULL, NULL, '3', 0, 'assets/category-icons/get-around-pink.svg', '#34495E', 'Events', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(83, 8, 'Get Around', 'Transfers', 'transfers', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '4', 0, 'assets/category-icons/get-around-orange.svg', '#34495E', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(84, 8, 'Get Around', 'Other Transport', 'other-transport', '1,2,12,9', 'Title, Description, Images, Address', '1,1,1,1', NULL, NULL, NULL, NULL, '5', 0, 'assets/category-icons/get-around-gray.svg', '#34495E', 'General', NULL, '2025-12-14 13:12:42', '2025-12-15 13:19:17'),
(1001, 47, 'Test', 'Test Subcategory', 'test-subcategory', '1,2,3,4,5,6,7,8,9,10,11,13,14,15,12', 'Title, Description, Text Box (editable), Text Area (editable), Dropdown (editable), Radio Toggle (editable), Email, Phone, Address, Website (URL), Tickets (URL), Coupon, Item Pricing, Event Details, Images', '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1', NULL, NULL, NULL, NULL, '1', 0, 'assets/category-icons/opportunities-pink.svg', NULL, 'General', NULL, '2025-11-16 17:46:29', '2025-12-15 13:19:17'),
(1002, 47, 'Test', 'Test 2 Subcategory', 'test-2-subcategory', '1,2,7,8,9,10,11,12,13,14,15,4,5,3,6', 'Title, Description, Email, Phone, Address, Website (URL), Tickets (URL), Images, Coupon, Item Pricing, Event Details, Text Area (editable), Dropdown (editable), Text Box (editable), Radio Toggle (editable)', '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1', NULL, NULL, NULL, NULL, '2', 0, 'assets/category-icons/opportunities-cyan.svg', NULL, 'General', NULL, '2025-12-07 08:14:46', '2025-12-15 13:19:17');

-- --------------------------------------------------------

--
-- Table structure for table `subcategory_edits`
--

CREATE TABLE `subcategory_edits` (
  `id` int(11) NOT NULL,
  `subcategory_key` varchar(255) DEFAULT NULL,
  `fieldset_key` varchar(255) DEFAULT NULL,
  `fieldset_name` varchar(255) DEFAULT NULL,
  `fieldset_options` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`fieldset_options`)),
  `fieldset_placeholder` text DEFAULT NULL,
  `fieldset_tooltip` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `subcategory_edits`
--

INSERT INTO `subcategory_edits` (`id`, `subcategory_key`, `fieldset_key`, `fieldset_name`, `fieldset_options`, `fieldset_placeholder`, `fieldset_tooltip`, `created_at`, `updated_at`) VALUES
(1258, 'live-gigss', 'text-box', 'Text Box (editable)', NULL, 'eg. Diamonds and Pearls', NULL, '2025-12-19 18:33:02', '2025-12-19 18:33:02'),
(1703, 'test-subcategory', 'text-box', 'Textify!', NULL, 'eg. Diamonds and Pearls', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1704, 'test-subcategory', 'text-area', 'Write an Essay', NULL, 'eg. Sing along!', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1705, 'test-subcategory', 'dropdown', 'Droppable', '[\"I Cant\",\"Do That\",\"Dave\"]', 'One,Two,Three', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1706, 'test-subcategory', 'radio', 'Radiothon', '[\"Wake Me Up\",\"Before You\",\"Go Go\"]', 'Four,Five,Six', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1707, 'test-2-subcategory', 'text-area', 'hlhlhText Area Name 2', NULL, 'eg. Sing along!', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1708, 'test-2-subcategory', 'dropdown', 'Dropdown Name 2', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'One,Two,Three', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1709, 'test-2-subcategory', 'text-box', 'Text Box (editable)', NULL, 'eg. Diamonds and Pearls', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17'),
(1710, 'test-2-subcategory', 'radio', 'Radicvcvvo Toggle (editable)', '[\"Four\",\"Five\",\"Six\"]', 'Four,Five,Six', NULL, '2025-12-21 09:04:17', '2025-12-21 09:04:17');

-- --------------------------------------------------------

--
-- Table structure for table `system_images`
--

CREATE TABLE `system_images` (
  `id` int(11) NOT NULL,
  `image_key` varchar(100) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `system_images`
--

INSERT INTO `system_images` (`id`, `image_key`, `filename`, `description`, `created_at`, `updated_at`) VALUES
(1, 'small_map_card_pill', '150x40-pill-70.webp', 'Path to small map card base pill image (150×40px)', '2025-11-25 16:59:26', '2025-11-29 08:35:15'),
(2, 'big_map_card_pill', '225x60-pill-2f3b73.webp', 'Path to big map card pill image (225×60px)', '2025-11-25 16:59:26', '2025-11-29 09:22:12'),
(3, 'multi_post_icon', 'multi-post-icon-50.webp', 'Path to multi-post icon image (30×30px small / 50×50px big)', '2025-11-25 16:59:26', '2025-12-12 03:49:49'),
(4, 'hover_map_card_pill', '150x40-pill-2f3b73.webp', 'Path to hover map card pill image (150×40px)', '2025-11-27 16:24:58', '2025-11-29 08:35:38'),
(5, 'msg_category_user_icon', 'user-messages.svg', 'Path to user messages category icon', '2025-11-27 21:40:22', '2025-12-11 02:53:09'),
(6, 'msg_category_member_icon', 'member-messages.svg', 'Path to member messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(7, 'msg_category_admin_icon', 'admin-messages.svg', 'Path to admin messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(8, 'msg_category_email_icon', 'email-messages.svg', 'Path to email messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(9, 'marker_cluster_icon', 'red-balloon-40.png', 'Path to marker cluster/balloon icon', '2025-11-27 21:40:22', '2025-11-29 06:55:06'),
(10, 'msg_category_fieldset-tooltips_icon', 'fieldset-tooltips.svg', 'Path to fieldset tooltips messages category icon', '2025-12-06 17:40:32', '2025-12-09 18:23:54'),
(11, 'big_logo', 'funmap welcome message 2025-12-10f.webp', 'Path to big logo', '2025-12-09 16:18:19', '2025-12-10 00:00:53'),
(12, 'small_logo', 'earth toy.png', 'Path to small logo', '2025-12-09 16:25:58', '2025-12-10 00:09:29'),
(13, 'favicon', 'favicon.ico', 'Path to favicon', '2025-12-10 00:10:23', '2025-12-10 00:52:30'),
(16, 'icon_filter', 'magnifying-glass.svg', 'Filter button icon filename', '2025-12-21 11:53:19', '2025-12-21 11:53:19'),
(17, 'icon_recents', 'recents-icon.svg', 'Recents mode button icon filename (clock icon)', '2025-12-21 11:53:19', '2025-12-21 11:53:19'),
(18, 'icon_posts', 'posts-icon.svg', 'Posts mode button icon filename (list icon)', '2025-12-21 11:53:19', '2025-12-21 11:53:19'),
(19, 'icon_map', 'map-icon.svg', 'Map mode button icon filename (location pin icon)', '2025-12-21 11:53:19', '2025-12-21 11:53:19');

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
-- Indexes for table `picklist`
--
ALTER TABLE `picklist`
  ADD PRIMARY KEY (`id`),
  ADD KEY `option_group` (`option_group`);

--
-- Indexes for table `posts`
--
ALTER TABLE `posts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_member_id` (`member_id`),
  ADD KEY `idx_subcategory_key` (`subcategory_key`),
  ADD KEY `idx_status` (`visibility`,`moderation_status`);

--
-- Indexes for table `post_children`
--
ALTER TABLE `post_children`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_map_card_id` (`map_card_id`),
  ADD KEY `session_date` (`session_date`),
  ADD KEY `price` (`price`);

--
-- Indexes for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_post_id` (`post_id`),
  ADD KEY `idx_subcategory_key` (`subcategory_key`),
  ADD KEY `idx_lat_lng` (`latitude`,`longitude`);

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
-- Indexes for table `subcategory_edits`
--
ALTER TABLE `subcategory_edits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `subcategory_fieldset` (`subcategory_key`,`fieldset_key`),
  ADD KEY `idx_subcategory_key` (`subcategory_key`),
  ADD KEY `idx_fieldset_key` (`fieldset_key`);

--
-- Indexes for table `system_images`
--
ALTER TABLE `system_images`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `image_key` (`image_key`);

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
-- AUTO_INCREMENT for table `admin_messages`
--
ALTER TABLE `admin_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=83;

--
-- AUTO_INCREMENT for table `admin_settings`
--
ALTER TABLE `admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=104;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `fieldsets`
--
ALTER TABLE `fieldsets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

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
-- AUTO_INCREMENT for table `picklist`
--
ALTER TABLE `picklist`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=429;

--
-- AUTO_INCREMENT for table `posts`
--
ALTER TABLE `posts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_children`
--
ALTER TABLE `post_children`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `post_map_cards`
--
ALTER TABLE `post_map_cards`
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1003;

--
-- AUTO_INCREMENT for table `subcategory_edits`
--
ALTER TABLE `subcategory_edits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1711;

--
-- AUTO_INCREMENT for table `system_images`
--
ALTER TABLE `system_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
