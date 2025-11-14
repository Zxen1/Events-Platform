-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Nov 15, 2025 at 03:06 AM
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
(28, 'Map Zoom Required Message', 'msg_map_zoom_required', 'toast', 'map', 'msg_user', 'Zoom the map to see posts', 'Shown when zoom level too low', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(29, 'No Listings Found Message', 'msg_posts_empty_state', 'label', 'post', 'msg_member', 'There are no posts here. Try moving the map or changing your filter settings.', 'Empty posts message', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:34:06', '2025-11-13 15:45:07'),
(30, 'Welcome Modal Title Message', 'msg_welcome_title', 'label', 'welcome', 'msg_user', 'Welcome to FunMap', 'Title shown in the welcome modal', 0, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
(31, 'Welcome Modal Content Message', 'msg_welcome_body', 'modal', 'welcome', 'msg_user', '<p>Welcome to Funmap! Choose an area on the map to search for events and listings. Click the <svg class=\"icon-search\" width=\"30\" height=\"30\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" role=\"img\" aria-label=\"Filters\"><circle cx=\"11\" cy=\"11\" r=\"8\"></circle><line x1=\"21\" y1=\"21\" x2=\"16.65\" y2=\"16.65\"></line></svg> button to refine your search.</p>', 'Main content of the welcome modal (supports HTML and SVG)', 1, NULL, 1, 1, 0, 3000, '2025-11-13 10:43:39', '2025-11-13 15:45:07'),
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
(53, 'Member Create Intro Message', 'msg_member_create_intro', 'label', 'member', 'msg_member', 'Choose the subcategory and subcategory for your post.', 'Intro text shown in member create post section', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:05:52'),
(54, 'Member Create Empty State Message', 'msg_member_create_empty', 'label', 'member', 'msg_member', 'Select a category and subcategory to begin.', 'Empty state message when no category/subcategory selected', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
(55, 'Member Post Listing Button', 'msg_member_post_listing', 'label', 'member', 'msg_member', 'Post Listing', 'Button text to submit a new listing', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49'),
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
(67, 'Member Button Log Out', 'msg_member_btn_log_out', 'label', 'member', 'msg_member', 'Log Out', 'Log out button text', 0, NULL, 1, 1, 0, 3000, '2025-11-14 16:04:49', '2025-11-14 16:04:49');

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
(1, 'site_name', 'FunMap.com', 'string', 'Site name', '2025-11-13 16:17:10', '2025-11-14 09:57:22'),
(2, 'site_tagline', 'The place to find stuff to do.', 'string', 'Site tagline/slogan', '2025-11-13 16:17:10', '2025-11-14 09:23:36'),
(3, 'site_currency', 'USD', 'string', 'Universal currency for all listings', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(4, 'contact_email', '', 'string', 'Admin contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(5, 'support_email', '', 'string', 'Support contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(6, 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(7, 'welcome_enabled', 'true', 'boolean', 'Show welcome modal to new users', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(8, 'welcome_title', 'Welcome to FunMap', 'string', 'Welcome modal title', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(9, 'welcome_message', NULL, 'json', 'Welcome modal content (JSON)', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(10, 'post_mode_shadow', '0.7', 'decimal', 'Opacity/shadow value for post mode background overlay', '2025-11-13 16:17:10', '2025-11-14 14:17:32'),
(11, 'console_filter', 'true', 'boolean', 'Enable/disable console filter on page load', '2025-11-13 16:17:10', '2025-11-14 13:43:32'),
(12, 'icon_folder', 'assets/icons-30', 'string', 'Folder path for category/subcategory icons', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(13, 'admin_icon_folder', 'assets/admin-icons', 'string', 'Folder path for admin message category icons', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(14, 'spin_on_load', 'true', 'boolean', 'Enable map spin on page load', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(15, 'spin_load_type', 'new_users', 'string', 'Spin for: everyone or new_users', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(16, 'spin_on_logo', 'true', 'boolean', 'Enable map spin when logo clicked', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(17, 'spin_zoom_max', '4', 'integer', 'Maximum zoom spin threshold', '2025-11-13 16:17:10', '2025-11-13 18:02:54'),
(18, 'spin_speed', '0.3', 'decimal', 'Speed of globe spin rotation', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(19, 'paypal_enabled', 'false', 'boolean', 'Enable PayPal payments', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(20, 'paypal_mode', 'sandbox', 'string', 'PayPal mode: sandbox or live', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(21, 'paypal_client_id', NULL, 'string', 'PayPal Client ID', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(22, 'paypal_secret', NULL, 'string', 'PayPal Secret Key', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(23, 'admin_tab_order', '[\"settings\",\"forms\",\"map\",\"messages\"]', 'json', 'Order of admin panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(24, 'member_tab_order', '[\"create\",\"myposts\",\"profile\"]', 'json', 'Order of member panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10');

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
(1, 'What\'s On', 'whats-on', 1, 0, 'assets/icons-30/whats-on-category-icon-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-11-14 09:08:51'),
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
(6, 1, 'Settings', 'post-mode-background-field', 'Post Mode Shadow', NULL, 1, 1, 0, 0, 1, '2025-11-13 15:19:02', '2025-11-13 16:46:33'),
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
(4, 6, 'Post Mode Shadow', 'row_post_mode_shadow', 'Post Mode Shadow Slider', 1, 0, 1, NULL, '2025-11-13 16:26:31', '2025-11-13 16:46:33'),
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
(1, 1, 'What\'s On', 'Live Gigs', 'live-gigs', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '1', 0, 'assets/icons-30/whats-on-category-icon-blue-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, 30, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(2, 1, 'What\'s On', 'Live Theatre', 'live-theatre', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '3', 0, 'assets/icons-30/whats-on-category-icon-dark-yellow-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(3, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '2', 0, 'assets/icons-30/whats-on-category-icon-green-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(4, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '4', 0, 'assets/icons-30/whats-on-category-icon-indigo-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(5, 1, 'What\'s On', 'Live Sport', 'live-sport', '1,2,12,16,15', 'Title, Description, Images, Venue Ticketing, Checkout', '1,1,1,1,1', '5', 0, 'assets/icons-30/whats-on-category-icon-orange-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(6, 1, 'What\'s On', 'Venues', 'venues', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '7', 0, 'assets/icons-30/whats-on-category-icon-violet-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, 30, 'Standard', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
(7, 1, 'What\'s On', 'Other Events', 'other-events', '1,2,12,9,15', 'Title, Description, Images, Location, Checkout', '1,1,1,1,1', '6', 0, 'assets/icons-30/whats-on-category-icon-red-30.webp', '#E74C3C', 10.00, 5.00, 15.00, 10.00, NULL, 'Events', '2025-10-29 12:32:47', '2025-11-13 22:08:51'),
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
-- AUTO_INCREMENT for table `admin_messages`
--
ALTER TABLE `admin_messages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=68;

--
-- AUTO_INCREMENT for table `admin_settings`
--
ALTER TABLE `admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=185;

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
