-- Fix: member_name so posts don't show as "Anonymous"
SET NAMES utf8mb4;

UPDATE `posts` SET `member_name` = 'UrbanExplorer' WHERE `id` = 16;
UPDATE `posts` SET `member_name` = 'VibeHunter_Melb' WHERE `id` = 17;
UPDATE `posts` SET `member_name` = 'SydneyFoodie' WHERE `id` = 18;
UPDATE `posts` SET `member_name` = 'LondonGigGuide' WHERE `id` = 19;
UPDATE `posts` SET `member_name` = 'NYCVenueSpotter' WHERE `id` = 20;
