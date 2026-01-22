-- Fix post_map_cards media_ids to link to the images
-- media_ids should contain comma-separated post_media IDs

UPDATE `post_map_cards` SET `media_ids` = '41,42,43' WHERE `post_id` = 16;
UPDATE `post_map_cards` SET `media_ids` = '44,45,46' WHERE `post_id` = 17;
UPDATE `post_map_cards` SET `media_ids` = '47,48,49' WHERE `post_id` = 18;
UPDATE `post_map_cards` SET `media_ids` = '50,51,52' WHERE `post_id` = 19;
UPDATE `post_map_cards` SET `media_ids` = '53,54,55' WHERE `post_id` = 20;
