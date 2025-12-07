-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Dec 08, 2025 at 03:11 AM
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
(1, 'site_name', 'Funmap.com', 'string', 'Site name', '2025-11-13 16:17:10', '2025-12-02 10:03:20'),
(2, 'site_tagline', 'Find stuff to do', 'string', 'Site tagline/slogan', '2025-11-13 16:17:10', '2025-12-02 10:03:20'),
(3, 'site_currency', 'USD', 'string', 'Universal currency for all listings', '2025-11-13 16:17:10', '2025-12-02 09:35:39'),
(4, 'contact_email', '', 'string', 'Admin contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(5, 'support_email', '', 'string', 'Support contact email', '2025-11-13 16:17:10', '2025-11-14 09:10:02'),
(6, 'maintenance_mode', 'false', 'boolean', 'Enable maintenance mode', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(7, 'welcome_enabled', 'false', 'boolean', 'Show welcome modal to new users', '2025-11-13 16:17:10', '2025-12-06 10:22:56'),
(8, 'welcome_title', 'Welcome to FunMap', 'string', 'Welcome modal title', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(9, 'welcome_message', NULL, 'json', 'Welcome modal content (JSON)', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(10, 'map_shadow', '0', 'integer', 'Map Shadow', '2025-11-13 16:17:10', '2025-12-06 05:28:17'),
(11, 'console_filter', 'true', 'boolean', 'Enable/disable console filter on page load', '2025-11-13 16:17:10', '2025-12-02 03:25:58'),
(12, 'icon_folder', 'assets/icons-30', 'string', 'Folder path for category/subcategory icons', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(13, 'admin_icon_folder', 'assets/admin-icons', 'string', 'Folder path for admin message category icons', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(14, 'spin_on_load', 'false', 'boolean', 'Enable map spin on page load', '2025-11-13 16:17:10', '2025-12-06 10:22:48'),
(15, 'spin_load_type', 'everyone', 'string', 'Spin for: everyone or new_users', '2025-11-13 16:17:10', '2025-11-27 21:47:01'),
(16, 'spin_on_logo', 'true', 'boolean', 'Enable map spin when logo clicked', '2025-11-13 16:17:10', '2025-11-24 15:20:41'),
(17, 'spin_zoom_max', '4', 'integer', 'Maximum zoom spin threshold', '2025-11-13 16:17:10', '2025-11-27 21:47:29'),
(18, 'spin_speed', '0.3', 'decimal', 'Speed of globe spin rotation', '2025-11-13 16:17:10', '2025-11-30 15:01:26'),
(19, 'paypal_enabled', 'false', 'boolean', 'Enable PayPal payments', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(20, 'paypal_mode', 'sandbox', 'string', 'PayPal mode: sandbox or live', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(21, 'paypal_client_id', NULL, 'string', 'PayPal Client ID', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(22, 'paypal_secret', NULL, 'string', 'PayPal Secret Key', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(23, 'admin_tab_order', '[\"settings\",\"forms\",\"map\",\"messages\"]', 'json', 'Order of admin panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(24, 'member_tab_order', '[\"create\",\"myposts\",\"profile\"]', 'json', 'Order of member panel tabs', '2025-11-13 16:17:10', '2025-11-13 16:17:10'),
(25, 'map_card_display', 'always', 'string', 'Map card display mode: hover_only or always', '2025-11-23 11:24:22', '2025-12-06 09:25:34'),
(26, 'map_shadow_mode', 'always', 'string', 'Map Shadow Mode: post_mode_only or always', '2025-11-24 14:41:59', '2025-12-05 17:34:13'),
(27, 'small_map_card_pill', 'assets/system-images/150x40-pill-70.webp', 'string', 'Path to small map card base pill image (150×40px)', '2025-11-25 16:59:26', '2025-11-29 08:35:15'),
(28, 'big_map_card_pill', 'assets/system-images/225x60-pill-2f3b73.webp', 'string', 'Path to big map card pill image (225×60px)', '2025-11-25 16:59:26', '2025-11-29 09:22:12'),
(29, 'multi_post_icon', 'assets/system-images/multi-post-icon-50.webp', 'string', 'Path to multi-post icon image (30×30px small / 50×50px big)', '2025-11-25 16:59:26', '2025-11-29 08:35:50'),
(30, 'hover_map_card_pill', 'assets/system-images/150x40-pill-2f3b73.webp', 'string', 'Path to hover map card pill image (150×40px)', '2025-11-27 16:24:58', '2025-11-29 08:35:38'),
(31, 'msg_category_user_icon', 'assets/system-images/user-messages.svg', 'string', 'Path to user messages category icon', '2025-11-27 21:40:22', '2025-11-28 00:05:28'),
(32, 'msg_category_member_icon', 'assets/system-images/member-messages.svg', 'string', 'Path to member messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(33, 'msg_category_admin_icon', 'assets/system-images/admin-messages.svg', 'string', 'Path to admin messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(34, 'msg_category_email_icon', 'assets/system-images/email-messages.svg', 'string', 'Path to email messages category icon', '2025-11-27 21:40:22', '2025-11-27 21:40:22'),
(35, 'marker_cluster_icon', 'assets/system-images/red-balloon-40.png', 'string', 'Path to marker cluster/balloon icon', '2025-11-27 21:40:22', '2025-11-29 06:55:06'),
(1657, 'system_images_folder', 'assets/system-images', 'string', NULL, '2025-11-27 21:47:00', '2025-11-27 21:47:00'),
(4592, 'msg_category_fieldset-tooltips_icon', '/assets/system-images/fieldset-tooltips.svg', 'string', NULL, '2025-12-06 17:40:32', '2025-12-06 17:40:32');

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
(1, 'What\'s On', 'whats-on', 1, 0, 'assets/icons-30/whats-on-category-icon-30.webp', '#E74C3C', '2025-10-29 23:32:47', '2025-12-02 21:48:27'),
(2, 'Opportunities', 'opportunities', 4, 0, 'assets/icons-30/opportunities-category-icon-30.webp', '#F1C40F', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(3, 'Learning', 'learning', 3, 0, 'assets/icons-30/learning-category-icon-30.webp', '#3498DB', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(4, 'Buy and Sell', 'buy-and-sell', 5, 0, 'assets/icons-30/Buy-and-sell-category-icon-30.webp', '#2ECC71', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(5, 'For Hire', 'for-hire', 2, 0, 'assets/icons-30/For-hire-category-icon-30.webp', '#9B59B6', '2025-10-29 23:32:47', '2025-11-11 23:59:15'),
(47, 'Test', 'test', 6, 0, 'assets/icons-30/opportunities-category-icon-red-30.webp', NULL, '2025-11-17 04:45:27', '2025-11-17 04:45:27');

-- --------------------------------------------------------

--
-- Table structure for table `checkout_options`
--

CREATE TABLE `checkout_options` (
  `id` int(11) NOT NULL,
  `checkout_key` varchar(100) NOT NULL,
  `checkout_title` varchar(255) NOT NULL,
  `checkout_description` text DEFAULT NULL,
  `checkout_currency` varchar(10) NOT NULL,
  `checkout_flagfall_price` decimal(10,2) NOT NULL,
  `checkout_basic_day_rate` decimal(10,2) DEFAULT NULL,
  `checkout_discount_day_rate` decimal(10,2) DEFAULT NULL,
  `checkout_featured` tinyint(1) DEFAULT 0,
  `checkout_sidebar_ad` tinyint(1) DEFAULT 0,
  `sort_order` tinyint(3) UNSIGNED DEFAULT 1,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `checkout_options`
--

INSERT INTO `checkout_options` (`id`, `checkout_key`, `checkout_title`, `checkout_description`, `checkout_currency`, `checkout_flagfall_price`, `checkout_basic_day_rate`, `checkout_discount_day_rate`, `checkout_featured`, `checkout_sidebar_ad`, `sort_order`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'free-post', 'Free Post', 'Free post with standard visibility.', 'USD', 0.00, NULL, NULL, 0, 0, 1, 0, '2025-11-30 05:45:21', '2025-12-07 23:33:32'),
(2, 'standard-post', 'Standard Post', 'Standard visibility with basic map markers and standard post cards.', 'USD', 10.00, 0.15, 0.08, 0, 0, 2, 1, '2025-11-30 05:45:21', '2025-12-07 23:33:32'),
(3, 'featured-post', 'Featured Post', 'Featured visibility with featured map cards and featured post cards.', 'USD', 10.00, 0.30, 0.15, 1, 0, 3, 1, '2025-11-30 05:45:21', '2025-12-07 23:33:32'),
(4, 'featured-post-sidebar-ad', 'Featured Post + Sidebar Ad', 'Featured visibility with featured map cards and featured post cards. Includes a dominating 20 second sidebar ad that displays on regular width monitors and cycles randomly with other sidebar ads.', 'USD', 10.00, 0.40, 0.20, 1, 1, 4, 1, '2025-11-30 05:45:21', '2025-12-07 23:33:32');

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
(4, 'venue-name', 'text', 2, 200, 1, '2025-10-29 23:32:47', '2025-12-07 03:13:38'),
(5, 'address-line', 'text', 5, 500, 1, '2025-10-29 23:32:47', '2025-12-07 03:13:38'),
(6, 'latitude', 'decimal', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(7, 'longitude', 'decimal', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(8, 'session-date', 'date', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(9, 'session-time', 'time', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(10, 'seating-area', 'text', 1, 100, 1, '2025-10-29 23:32:47', '2025-12-07 03:34:36'),
(11, 'pricing-tier', 'text', 1, 100, 1, '2025-10-29 23:32:47', '2025-12-07 03:34:36'),
(12, 'ticket-price', 'decimal(10,2)', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(13, 'currency', 'dropdown', 1, 50, 0, '2025-10-29 23:32:47', '2025-12-08 01:15:56'),
(14, 'text-box', 'text', 1, 500, 1, '2025-10-30 17:11:57', '2025-12-07 03:13:38'),
(15, 'text-area', 'textarea', 1, 2000, 1, '2025-10-30 17:11:57', '2025-12-07 03:13:38'),
(16, 'dropdown', 'dropdown', 1, 500, 0, '2025-10-30 17:14:25', '2025-12-08 01:15:56'),
(17, 'radio', 'radio', 1, 500, 0, '2025-10-30 17:14:25', '2025-12-08 01:15:56'),
(18, 'email', 'email', 5, 254, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(19, 'phone', 'tel', 6, 30, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(20, 'website', 'url', 5, 500, 1, '2025-10-30 17:25:10', '2025-12-07 03:34:36'),
(21, 'item-name', 'text', 2, 200, 1, '2025-10-30 18:33:09', '2025-12-07 03:13:38'),
(23, 'item-price', 'decimal(10,2)', 1, 50, 0, '2025-10-30 18:39:14', '2025-12-08 01:15:56');

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
(8, 'phone', '[\"phone\"]', 'Phone', NULL, '+61 455 555 555', 'Enter a phone number where visitors can reach you. Include country code if applicable.', 0, 8, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(9, 'location', '[\"address-line\", \"latitude\", \"longitude\"]', 'Location', NULL, '1 Smith Street, Timbuctu, Kollasis, Tomeggia', 'Search for and select the location of your event or listing. The map will help you find the exact spot.', 0, 9, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(10, 'website-url', '[\"website\"]', 'Website (URL)', NULL, 'www.website.com', 'Enter the full website URL (including https://) where visitors can find more information.', 0, 10, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(11, 'tickets-url', '[\"website\"]', 'Tickets (URL)', NULL, 'www.tickets.com', 'Enter the full URL (including https://) where visitors can purchase tickets or make reservations.', 0, 11, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(12, 'images', '[\"images\"]', 'Images', NULL, 'images', 'Upload images that showcase your event or listing. Good quality photos help attract more visitors.', 0, 12, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(13, 'coupon', '[\"text-box\"]', 'Coupon', NULL, 'eg. FreeStuff', 'Enter a coupon or discount code if applicable. Visitors can use this code when making purchases.', 0, 13, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(14, 'item-pricing', '[\"item-name\", \"item-price\", \"currency\"]', 'Item Pricing', NULL, 'eg. Ruby Slippers - Small', 'Add pricing information for individual items. Include item name, price, and currency for each item you\'re selling.', 0, 14, '2025-10-29 19:03:05', '2025-12-06 17:08:19'),
(15, 'venue-ticketing', '[\"venue-name\", \"address-line\", \"latitude\", \"longitude\", \"session-date\", \"session-time\", \"seating-area\", \"pricing-tier\", \"ticket-price\", \"currency\"]', 'Venue Ticketing', NULL, 'eg.VenueSessionPricing', 'Set up venue sessions with dates, times, seating areas, and pricing tiers. This is for events with multiple sessions or ticket types.', 0, 16, '2025-10-29 19:03:05', '2025-12-06 17:08:19');

-- --------------------------------------------------------

--
-- Table structure for table `general_options`
--

CREATE TABLE `general_options` (
  `id` int(11) NOT NULL,
  `option_group` varchar(50) NOT NULL,
  `option_value` varchar(50) NOT NULL,
  `option_label` varchar(100) NOT NULL,
  `sort_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `general_options`
--

INSERT INTO `general_options` (`id`, `option_group`, `option_value`, `option_label`, `sort_order`, `is_active`) VALUES
(1, 'currency', 'USD', '🇺🇸 US Dollar', 1, 1),
(2, 'currency', 'EUR', '🇪🇺 Euro', 2, 1),
(3, 'currency', 'GBP', '🇬🇧 British Pound', 3, 1),
(4, 'currency', 'AUD', '🇦🇺 Australian Dollar', 4, 1),
(5, 'currency', 'CAD', '🇨🇦 Canadian Dollar', 5, 1),
(6, 'currency', 'NZD', '🇳🇿 New Zealand Dollar', 6, 1),
(7, 'currency', 'JPY', '🇯🇵 Japanese Yen', 7, 1),
(8, 'currency', 'CHF', '🇨🇭 Swiss Franc', 8, 1),
(9, 'currency', 'SGD', '🇸🇬 Singapore Dollar', 9, 1),
(10, 'currency', 'HKD', '🇭🇰 Hong Kong Dollar', 10, 1),
(11, 'currency', 'SEK', '🇸🇪 Swedish Krona', 11, 1),
(12, 'currency', 'NOK', '🇳🇴 Norwegian Krone', 12, 1),
(13, 'currency', 'DKK', '🇩🇰 Danish Krone', 13, 1),
(14, 'currency', 'PLN', '🇵🇱 Polish Zloty', 14, 1),
(15, 'currency', 'MXN', '🇲🇽 Mexican Peso', 15, 1),
(16, 'currency', 'BRL', '🇧🇷 Brazilian Real', 16, 1),
(17, 'currency', 'INR', '🇮🇳 Indian Rupee', 17, 1),
(18, 'currency', 'ZAR', '🇿🇦 South African Rand', 18, 1),
(19, 'currency', 'CNY', '🇨🇳 Chinese Yuan', 19, 1),
(20, 'currency', 'KRW', '🇰🇷 South Korean Won', 20, 1),
(21, 'currency', 'TWD', '🇹🇼 Taiwan Dollar', 21, 1),
(22, 'currency', 'THB', '🇹🇭 Thai Baht', 22, 1),
(23, 'currency', 'PHP', '🇵🇭 Philippine Peso', 23, 1),
(24, 'currency', 'IDR', '🇮🇩 Indonesian Rupiah', 24, 1),
(25, 'currency', 'MYR', '🇲🇾 Malaysian Ringgit', 25, 1),
(26, 'currency', 'VND', '🇻🇳 Vietnamese Dong', 26, 1),
(27, 'currency', 'AED', '🇦🇪 UAE Dirham', 27, 1),
(28, 'currency', 'SAR', '🇸🇦 Saudi Riyal', 28, 1),
(29, 'currency', 'QAR', '🇶🇦 Qatari Riyal', 29, 1),
(30, 'currency', 'KWD', '🇰🇼 Kuwaiti Dinar', 30, 1),
(31, 'currency', 'BHD', '🇧🇭 Bahraini Dinar', 31, 1),
(32, 'currency', 'OMR', '🇴🇲 Omani Rial', 32, 1),
(33, 'currency', 'ILS', '🇮🇱 Israeli Shekel', 33, 1),
(34, 'currency', 'CZK', '🇨🇿 Czech Koruna', 34, 1),
(35, 'currency', 'HUF', '🇭🇺 Hungarian Forint', 35, 1),
(36, 'currency', 'RON', '🇷🇴 Romanian Leu', 36, 1),
(37, 'currency', 'BGN', '🇧🇬 Bulgarian Lev', 37, 1),
(38, 'currency', 'HRK', '🇭🇷 Croatian Kuna', 38, 1),
(39, 'currency', 'ISK', '🇮🇸 Icelandic Krona', 39, 1),
(40, 'currency', 'RUB', '🇷🇺 Russian Ruble', 40, 1),
(41, 'currency', 'UAH', '🇺🇦 Ukrainian Hryvnia', 41, 1),
(42, 'currency', 'TRY', '🇹🇷 Turkish Lira', 42, 1),
(43, 'currency', 'CLP', '🇨🇱 Chilean Peso', 43, 1),
(44, 'currency', 'COP', '🇨🇴 Colombian Peso', 44, 1),
(45, 'currency', 'ARS', '🇦🇷 Argentine Peso', 45, 1),
(46, 'currency', 'PEN', '🇵🇪 Peruvian Sol', 46, 1),
(47, 'currency', 'UYU', '🇺🇾 Uruguayan Peso', 47, 1),
(48, 'currency', 'BOB', '🇧🇴 Bolivian Boliviano', 48, 1),
(49, 'currency', 'PYG', '🇵🇾 Paraguayan Guarani', 49, 1),
(50, 'currency', 'VES', '🇻🇪 Venezuelan Bolivar', 50, 1),
(51, 'currency', 'DOP', '🇩🇴 Dominican Peso', 51, 1),
(52, 'currency', 'JMD', '🇯🇲 Jamaican Dollar', 52, 1),
(53, 'currency', 'TTD', '🇹🇹 Trinidad Dollar', 53, 1),
(54, 'currency', 'GTQ', '🇬🇹 Guatemalan Quetzal', 54, 1),
(55, 'currency', 'CRC', '🇨🇷 Costa Rican Colon', 55, 1),
(56, 'currency', 'PAB', '🇵🇦 Panamanian Balboa', 56, 1),
(57, 'currency', 'NGN', '🇳🇬 Nigerian Naira', 57, 1),
(58, 'currency', 'EGP', '🇪🇬 Egyptian Pound', 58, 1),
(59, 'currency', 'KES', '🇰🇪 Kenyan Shilling', 59, 1),
(60, 'currency', 'GHS', '🇬🇭 Ghanaian Cedi', 60, 1),
(61, 'currency', 'TZS', '🇹🇿 Tanzanian Shilling', 61, 1),
(62, 'currency', 'UGX', '🇺🇬 Ugandan Shilling', 62, 1),
(63, 'currency', 'MAD', '🇲🇦 Moroccan Dirham', 63, 1),
(64, 'currency', 'TND', '🇹🇳 Tunisian Dinar', 64, 1),
(65, 'currency', 'XOF', '🌍 West African CFA Franc', 65, 1),
(66, 'currency', 'XAF', '🌍 Central African CFA Franc', 66, 1),
(67, 'currency', 'PKR', '🇵🇰 Pakistani Rupee', 67, 1),
(68, 'currency', 'BDT', '🇧🇩 Bangladeshi Taka', 68, 1),
(69, 'currency', 'LKR', '🇱🇰 Sri Lankan Rupee', 69, 1),
(70, 'currency', 'NPR', '🇳🇵 Nepalese Rupee', 70, 1),
(71, 'currency', 'MMK', '🇲🇲 Myanmar Kyat', 71, 1),
(72, 'currency', 'FJD', '🇫🇯 Fijian Dollar', 72, 1),
(73, 'currency', 'PGK', '🇵🇬 Papua New Guinean Kina', 73, 1),
(74, 'currency', 'XPF', '🌍 CFP Franc', 74, 1),
(75, 'phone_prefix', '+1', '🇺🇸 +1 United States', 1, 1),
(76, 'phone_prefix', '+1', '🇨🇦 +1 Canada', 2, 1),
(77, 'phone_prefix', '+44', '🇬🇧 +44 United Kingdom', 3, 1),
(78, 'phone_prefix', '+61', '🇦🇺 +61 Australia', 4, 1),
(79, 'phone_prefix', '+64', '🇳🇿 +64 New Zealand', 5, 1),
(80, 'phone_prefix', '+81', '🇯🇵 +81 Japan', 6, 1),
(81, 'phone_prefix', '+65', '🇸🇬 +65 Singapore', 7, 1),
(82, 'phone_prefix', '+852', '🇭🇰 +852 Hong Kong', 8, 1),
(83, 'phone_prefix', '+46', '🇸🇪 +46 Sweden', 9, 1),
(84, 'phone_prefix', '+47', '🇳🇴 +47 Norway', 10, 1),
(85, 'phone_prefix', '+45', '🇩🇰 +45 Denmark', 11, 1),
(86, 'phone_prefix', '+48', '🇵🇱 +48 Poland', 12, 1),
(87, 'phone_prefix', '+52', '🇲🇽 +52 Mexico', 13, 1),
(88, 'phone_prefix', '+55', '🇧🇷 +55 Brazil', 14, 1),
(89, 'phone_prefix', '+91', '🇮🇳 +91 India', 15, 1),
(90, 'phone_prefix', '+27', '🇿🇦 +27 South Africa', 16, 1),
(91, 'phone_prefix', '+86', '🇨🇳 +86 China', 17, 1),
(92, 'phone_prefix', '+82', '🇰🇷 +82 South Korea', 18, 1),
(93, 'phone_prefix', '+886', '🇹🇼 +886 Taiwan', 19, 1),
(94, 'phone_prefix', '+66', '🇹🇭 +66 Thailand', 20, 1),
(95, 'phone_prefix', '+63', '🇵🇭 +63 Philippines', 21, 1),
(96, 'phone_prefix', '+62', '🇮🇩 +62 Indonesia', 22, 1),
(97, 'phone_prefix', '+60', '🇲🇾 +60 Malaysia', 23, 1),
(98, 'phone_prefix', '+84', '🇻🇳 +84 Vietnam', 24, 1),
(99, 'phone_prefix', '+971', '🇦🇪 +971 UAE', 25, 1),
(100, 'phone_prefix', '+966', '🇸🇦 +966 Saudi Arabia', 26, 1),
(101, 'phone_prefix', '+974', '🇶🇦 +974 Qatar', 27, 1),
(102, 'phone_prefix', '+965', '🇰🇼 +965 Kuwait', 28, 1),
(103, 'phone_prefix', '+973', '🇧🇭 +973 Bahrain', 29, 1),
(104, 'phone_prefix', '+968', '🇴🇲 +968 Oman', 30, 1),
(105, 'phone_prefix', '+972', '🇮🇱 +972 Israel', 31, 1),
(106, 'phone_prefix', '+420', '🇨🇿 +420 Czech Republic', 32, 1),
(107, 'phone_prefix', '+36', '🇭🇺 +36 Hungary', 33, 1),
(108, 'phone_prefix', '+40', '🇷🇴 +40 Romania', 34, 1),
(109, 'phone_prefix', '+359', '🇧🇬 +359 Bulgaria', 35, 1),
(110, 'phone_prefix', '+385', '🇭🇷 +385 Croatia', 36, 1),
(111, 'phone_prefix', '+354', '🇮🇸 +354 Iceland', 37, 1),
(112, 'phone_prefix', '+7', '🇷🇺 +7 Russia', 38, 1),
(113, 'phone_prefix', '+380', '🇺🇦 +380 Ukraine', 39, 1),
(114, 'phone_prefix', '+90', '🇹🇷 +90 Turkey', 40, 1),
(115, 'phone_prefix', '+56', '🇨🇱 +56 Chile', 41, 1),
(116, 'phone_prefix', '+57', '🇨🇴 +57 Colombia', 42, 1),
(117, 'phone_prefix', '+54', '🇦🇷 +54 Argentina', 43, 1),
(118, 'phone_prefix', '+51', '🇵🇪 +51 Peru', 44, 1),
(119, 'phone_prefix', '+598', '🇺🇾 +598 Uruguay', 45, 1),
(120, 'phone_prefix', '+591', '🇧🇴 +591 Bolivia', 46, 1),
(121, 'phone_prefix', '+595', '🇵🇾 +595 Paraguay', 47, 1),
(122, 'phone_prefix', '+58', '🇻🇪 +58 Venezuela', 48, 1),
(123, 'phone_prefix', '+1', '🇩🇴 +1 Dominican Republic', 49, 1),
(124, 'phone_prefix', '+1', '🇯🇲 +1 Jamaica', 50, 1),
(125, 'phone_prefix', '+1', '🇹🇹 +1 Trinidad and Tobago', 51, 1),
(126, 'phone_prefix', '+502', '🇬🇹 +502 Guatemala', 52, 1),
(127, 'phone_prefix', '+506', '🇨🇷 +506 Costa Rica', 53, 1),
(128, 'phone_prefix', '+507', '🇵🇦 +507 Panama', 54, 1),
(129, 'phone_prefix', '+234', '🇳🇬 +234 Nigeria', 55, 1),
(130, 'phone_prefix', '+20', '🇪🇬 +20 Egypt', 56, 1),
(131, 'phone_prefix', '+254', '🇰🇪 +254 Kenya', 57, 1),
(132, 'phone_prefix', '+233', '🇬🇭 +233 Ghana', 58, 1),
(133, 'phone_prefix', '+255', '🇹🇿 +255 Tanzania', 59, 1),
(134, 'phone_prefix', '+256', '🇺🇬 +256 Uganda', 60, 1),
(135, 'phone_prefix', '+212', '🇲🇦 +212 Morocco', 61, 1),
(136, 'phone_prefix', '+216', '🇹🇳 +216 Tunisia', 62, 1),
(137, 'phone_prefix', '+92', '🇵🇰 +92 Pakistan', 63, 1),
(138, 'phone_prefix', '+880', '🇧🇩 +880 Bangladesh', 64, 1),
(139, 'phone_prefix', '+94', '🇱🇰 +94 Sri Lanka', 65, 1),
(140, 'phone_prefix', '+977', '🇳🇵 +977 Nepal', 66, 1),
(141, 'phone_prefix', '+95', '🇲🇲 +95 Myanmar', 67, 1),
(142, 'phone_prefix', '+679', '🇫🇯 +679 Fiji', 68, 1),
(143, 'phone_prefix', '+675', '🇵🇬 +675 Papua New Guinea', 69, 1),
(144, 'phone_prefix', '+33', '🇫🇷 +33 France', 70, 1),
(145, 'phone_prefix', '+49', '🇩🇪 +49 Germany', 71, 1),
(146, 'phone_prefix', '+39', '🇮🇹 +39 Italy', 72, 1),
(147, 'phone_prefix', '+34', '🇪🇸 +34 Spain', 73, 1),
(148, 'phone_prefix', '+31', '🇳🇱 +31 Netherlands', 74, 1),
(149, 'phone_prefix', '+32', '🇧🇪 +32 Belgium', 75, 1),
(150, 'phone_prefix', '+41', '🇨🇭 +41 Switzerland', 76, 1),
(151, 'phone_prefix', '+43', '🇦🇹 +43 Austria', 77, 1),
(152, 'phone_prefix', '+351', '🇵🇹 +351 Portugal', 78, 1),
(153, 'phone_prefix', '+353', '🇮🇪 +353 Ireland', 79, 1),
(154, 'phone_prefix', '+358', '🇫🇮 +358 Finland', 80, 1),
(155, 'phone_prefix', '+30', '🇬🇷 +30 Greece', 81, 1);

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
  `checkout_surcharge` decimal(10,2) DEFAULT NULL,
  `sort_order` text DEFAULT NULL,
  `hidden` tinyint(1) NOT NULL DEFAULT 0,
  `icon_path` varchar(255) DEFAULT NULL,
  `color_hex` varchar(7) DEFAULT NULL,
  `subcategory_type` enum('Events','Standard') DEFAULT 'Events',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `subcategories`
--

INSERT INTO `subcategories` (`id`, `category_id`, `category_name`, `subcategory_name`, `subcategory_key`, `fieldset_ids`, `fieldset_name`, `required`, `checkout_surcharge`, `sort_order`, `hidden`, `icon_path`, `color_hex`, `subcategory_type`, `created_at`, `updated_at`) VALUES
(1, 1, 'What\'s On', 'Live Gigs', 'live-gigs', '1,2,12,15,3', 'Title, Description, Images, Venue Ticketing, Text Box (editable)', '1,1,1,1,1', NULL, '1', 0, 'assets/icons-30/whats-on-category-icon-blue-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-07 07:21:28'),
(2, 1, 'What\'s On', 'Live Theatre', 'live-theatre', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '3', 0, 'assets/icons-30/whats-on-category-icon-dark-yellow-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-05 05:07:18'),
(3, 1, 'What\'s On', 'Screenings', 'screenings', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '2', 0, 'assets/icons-30/whats-on-category-icon-green-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-05 12:44:10'),
(4, 1, 'What\'s On', 'Artwork', 'artwork', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '4', 0, 'assets/icons-30/whats-on-category-icon-indigo-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-05 05:07:18'),
(5, 1, 'What\'s On', 'Live Sport', 'live-sport', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '5', 0, 'assets/icons-30/whats-on-category-icon-orange-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-05 05:07:18'),
(6, 1, 'What\'s On', 'Venues', 'venues', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '7', 0, 'assets/icons-30/whats-on-category-icon-violet-30.webp', '#E74C3C', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(7, 1, 'What\'s On', 'Other Events', 'other-events', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '6', 0, 'assets/icons-30/whats-on-category-icon-red-30.webp', '#E74C3C', 'Events', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(8, 2, 'Opportunities', 'Stage Auditions', 'stage-auditions', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '6', 0, 'assets/icons-30/opportunities-category-icon-blue-30.webp', '#F1C40F', 'Events', '2025-10-29 12:32:47', '2025-12-05 05:07:18'),
(9, 2, 'Opportunities', 'Screen Auditions', 'screen-auditions', '1,2,12,15', 'Title, Description, Images, Venue Ticketing', '1,1,1,1', NULL, '5', 0, 'assets/icons-30/opportunities-category-icon-dark-yellow-30.webp', '#F1C40F', 'Events', '2025-10-29 12:32:47', '2025-12-05 05:07:18'),
(10, 2, 'Opportunities', 'Clubs', 'clubs', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '1', 0, 'assets/icons-30/opportunities-category-icon-green-30.webp', '#F1C40F', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(11, 2, 'Opportunities', 'Jobs', 'jobs', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '3', 0, 'assets/icons-30/opportunities-category-icon-indigo-30.webp', '#F1C40F', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(12, 2, 'Opportunities', 'Volunteers', 'volunteers', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '7', 0, 'assets/icons-30/opportunities-category-icon-orange-30.webp', '#F1C40F', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(13, 2, 'Opportunities', 'Competitions', 'competitions', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '2', 0, 'assets/icons-30/opportunities-category-icon-red-30.webp', '#F1C40F', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(14, 2, 'Opportunities', 'Other Opportunities', 'other-opportunities', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '4', 0, 'assets/icons-30/opportunities-category-icon-violet-30.webp', '#F1C40F', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(15, 3, 'Learning', 'Tutors', 'tutors', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '4', 0, 'assets/icons-30/learning-category-icon-blue-30.webp', '#3498DB', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(16, 3, 'Learning', 'Education Centres', 'education-centres', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '2', 0, 'assets/icons-30/learning-category-icon-dark-yellow-30.webp', '#3498DB', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(17, 3, 'Learning', 'Courses', 'courses', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '1', 0, 'assets/icons-30/learning-category-icon-green-30.webp', '#3498DB', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(18, 3, 'Learning', 'Other Learning', 'other-learning', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '3', 0, 'assets/icons-30/learning-category-icon-red-30.webp', '#3498DB', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(19, 4, 'Buy and Sell', 'Wanted', 'wanted', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '2', 0, 'assets/icons-30/Buy-and-sell-category-icon-orange-30.webp', '#2ECC71', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(20, 4, 'Buy and Sell', 'For Sale', 'for-sale', '1,2,14,12,9', 'Title, Description, Item Pricing, Images, Location', '1,1,1,1,1', NULL, '3', 0, 'assets/icons-30/Buy-and-sell-category-icon-red-30.webp', '#2ECC71', 'Standard', '2025-10-29 12:32:47', '2025-12-07 12:08:29'),
(21, 4, 'Buy and Sell', 'Freebies', 'freebies', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '1', 0, 'assets/icons-30/Buy-and-sell-category-icon-violet-30.webp', '#2ECC71', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(22, 5, 'For Hire', 'Performers', 'performers', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '2', 0, 'assets/icons-30/For-hire-category-icon-blue-30.webp', '#9B59B6', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(23, 5, 'For Hire', 'Staff', 'staff', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '3', 0, 'assets/icons-30/For-hire-category-icon-dark-yellow-30.webp', '#9B59B6', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(24, 5, 'For Hire', 'Goods and Services', 'goods-and-services', '1,2,12,9', 'Title, Description, Images, Location', '1,1,1,1', NULL, '1', 0, 'assets/icons-30/For-hire-category-icon-green-30.webp', '#9B59B6', 'Standard', '2025-10-29 12:32:47', '2025-12-03 06:27:25'),
(27, 47, 'Test', 'Test Subcategory', 'test-subcategory', '1,2,3,4,5,6,7,8,9,10,11,13,14,15,12', 'Title, Description, Text Box (editable), Text Area (editable), Dropdown (editable), Radio Toggle (editable), Email, Phone, Location, Website (URL), Tickets (URL), Coupon, Item Pricing, Venue Ticketing, Images', '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1', NULL, '1', 0, 'assets/icons-30/Buy-and-sell-category-icon-blue-30.webp', NULL, 'Standard', '2025-11-16 17:46:29', '2025-12-06 20:47:47'),
(28, 47, 'Test', 'Test 2 Subcategory', 'test-2-subcategory', '1,2,7,8,9,10,11,12,13,14,15,4,5,3,6', 'Title, Description, Email, Phone, Location, Website (URL), Tickets (URL), Images, Coupon, Item Pricing, Venue Ticketing, Text Area (editable), Dropdown (editable), Text Box (editable), Radio Toggle (editable)', '1,1,1,1,1,1,1,1,1,1,1,1,1,1,1', NULL, '2', 0, 'assets/icons-30/Buy-and-sell-category-icon-red-30.webp', NULL, 'Standard', '2025-12-07 08:14:46', '2025-12-07 11:27:01');

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
(781, 'live-gigs', 'text-box', 'Text Box (editable)', NULL, 'eg. Diamonds and Pearls', 'Write stuff here.', '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(782, 'test-subcategory', 'text-box', 'Textify!', NULL, NULL, NULL, '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(783, 'test-subcategory', 'text-area', 'Write an Essay', NULL, NULL, NULL, '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(784, 'test-subcategory', 'dropdown', 'Droppable', '[\"I Cant\",\"Do That\",\"Dave\"]', NULL, NULL, '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(785, 'test-subcategory', 'radio', 'Radiothon', '[\"Wake Me Up\",\"Before You\",\"Go Go\"]', NULL, NULL, '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(786, 'test-2-subcategory', 'text-area', 'hlhlhText Area Name 2', NULL, 'Field Placeholder 2', 'Field Placeholder 2', '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(787, 'test-2-subcategory', 'dropdown', 'Dropdown Name 2', '[\"Option 1\",\"Option 2\",\"Option 3\"]', 'Field Placeholder 2', 'Field Placeholder 2', '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(788, 'test-2-subcategory', 'text-box', 'Text Box (editable)', NULL, 'eg. Diamonds and Pearls', 'Write stuff here.', '2025-12-07 12:33:33', '2025-12-07 12:33:33'),
(789, 'test-2-subcategory', 'radio', 'Radicvcvvo Toggle (editable)', '[\"Four\",\"Five\",\"Six\"]', 'Four,Five,Six', 'Choose one option from the radio buttons. Only one selection is allowed.', '2025-12-07 12:33:33', '2025-12-07 12:33:33');

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
-- Indexes for table `general_options`
--
ALTER TABLE `general_options`
  ADD PRIMARY KEY (`id`),
  ADD KEY `option_group` (`option_group`);

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=82;

--
-- AUTO_INCREMENT for table `admin_settings`
--
ALTER TABLE `admin_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5881;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `fieldsets`
--
ALTER TABLE `fieldsets`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `general_options`
--
ALTER TABLE `general_options`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=156;

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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `subcategory_edits`
--
ALTER TABLE `subcategory_edits`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=790;

--
-- AUTO_INCREMENT for table `transactions`
--
ALTER TABLE `transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
