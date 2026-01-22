-- Repair test posts 16-20
-- Run this to delete and re-insert with correct formatting
SET NAMES utf8mb4;

-- Step 1: Delete existing test records
DELETE FROM `post_map_cards` WHERE `post_id` IN (16, 17, 18, 19, 20);
DELETE FROM `post_media` WHERE `post_id` IN (16, 17, 18, 19, 20);
DELETE FROM `posts` WHERE `id` IN (16, 17, 18, 19, 20);

-- Step 2: Insert posts
INSERT INTO `posts` (`id`, `post_key`, `member_id`, `subcategory_key`, `loc_qty`, `visibility`, `moderation_status`, `checkout_key`, `payment_status`, `expires_at`, `created_at`, `updated_at`) VALUES
(16, '16-sydney-opera-house', 2, 'theatres-concert-halls', 1, 'active', 'clean', 'premium-listing', 'paid', '2046-01-01', NOW(), NOW()),
(17, '17-sydney-harbour-bridge', 3, 'landmarks', 1, 'active', 'clean', 'premium-listing', 'paid', '2046-01-01', NOW(), NOW()),
(18, '18-bondi-beach', 4, 'parks-nature', 1, 'active', 'clean', 'premium-listing', 'paid', '2046-01-01', NOW(), NOW()),
(19, '19-taronga-zoo', 5, 'zoos-aquariums-wildlife', 1, 'active', 'clean', 'premium-listing', 'paid', '2046-01-01', NOW(), NOW()),
(20, '20-royal-botanic-garden-sydney', 6, 'parks-nature', 1, 'active', 'clean', 'premium-listing', 'paid', '2046-01-01', NOW(), NOW());

-- Step 3: Insert media (URLs match exactly what's on Bunny)
INSERT INTO `post_media` (`member_id`, `post_id`, `file_name`, `file_url`, `file_size`, `created_at`, `updated_at`) VALUES
(2, 16, '00000016-Sydney_Australia.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000016-Sydney_Australia._(21339175489).jpg', 4588171, NOW(), NOW()),
(2, 16, '00000016-Interior_Opera_House.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000016-Interior_of_Sydney_Opera_House_Concert_Hall_during_performance.jpg', 2926435, NOW(), NOW()),
(2, 16, '00000016-Joan_Sutherland_Theatre.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000016-Joan_Sutherland_Theatre_Interior.JPG', 1051991, NOW(), NOW()),
(3, 17, '00000017-Sydney_Harbour_Bridge.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge-2022.jpg', 1521976, NOW(), NOW()),
(3, 17, '00000017-Bridge_from_air.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge_from_the_air.JPG', 734525, NOW(), NOW()),
(3, 17, '00000017-Bridge_from_Circular_Quay.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000017-Sydney_Harbour_Bridge_from_Circular_Quay.jpg', 8177508, NOW(), NOW()),
(4, 18, '00000018-Bondi_from_above.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-Bondi_from_above.jpg', 7345306, NOW(), NOW()),
(4, 18, '00000018-Bondi_rip_current.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-A_rip_current_pouring_over_the_people_standing_on_rock_shore_at_the_northern_end_of_Bondi_beach.jpg', 391684, NOW(), NOW()),
(4, 18, '00000018-Bondi_Beach.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000018-Bondi_Beach,_Sydney_(15175458494).jpg', 780475, NOW(), NOW()),
(5, 19, '00000019-Taronga_Zoo.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-Taronga_Park_Zoo_-7Sept2008.jpg', 835461, NOW(), NOW()),
(5, 19, '00000019-Rusticbridge.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-Rusticbridge.jpg', 1033829, NOW(), NOW()),
(5, 19, '00000019-Giraffes.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000019-2022-06-25_Giraffes_in_Taronga_Zoo.jpg', 4677850, NOW(), NOW()),
(6, 20, '00000020-Botanic_Gardens_Gates.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000020-Gates_at_Royal_Botanic_Gardens_viewed_from_Art_Gallery_Road.jpg', 5603754, NOW(), NOW()),
(6, 20, '00000020-Garden_Palace.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000020-After_the_fire_-_The_Garden_Palace_(8005393749).jpg', 375021, NOW(), NOW()),
(6, 20, '00000020-Botanic_Garden_view.jpg', 'https://cdn.funmap.com/post-images/2026-01/00000020-A_view_of_Royal_Botanic_Garden_taken_from_Sydney_Tower.jpeg', 6504334, NOW(), NOW());

-- Step 4: Insert map cards with proper paragraphs
INSERT INTO `post_map_cards` (`id`, `post_id`, `subcategory_key`, `title`, `description`, `city`, `latitude`, `longitude`, `country_code`, `website_url`, `created_at`, `updated_at`) VALUES
(19, 16, 'theatres-concert-halls', 'Sydney Opera House', 'The Sydney Opera House is a multi-venue performing arts centre in Sydney, New South Wales, Australia. Located on the foreshore of Sydney Harbour, it is widely regarded as one of the world''s most famous and distinctive buildings, and a masterpiece of 20th-century architecture.

Designed by Danish architect Jørn Utzon and completed by an Australian architectural team headed by Peter Hall, the building was formally opened by Queen Elizabeth II on 20 October 1973.

Photo: Bernard Spragg (CC0); BennyG3255 (CC BY-SA 4.0); MorePix (CC BY-SA 4.0)', 'Sydney', -33.85681, 151.21514, 'AU', 'https://www.sydneyoperahouse.com', NOW(), NOW()),

(20, 17, 'landmarks', 'Sydney Harbour Bridge', 'The Sydney Harbour Bridge is a steel through arch bridge in Sydney, New South Wales, Australia, spanning Sydney Harbour from the central business district to the North Shore. Nicknamed "the Coathanger" because of its arch-based design, the bridge carries rail, vehicular, bicycle and pedestrian traffic.

Designed and built by British firm Dorman Long of Middlesbrough, the bridge opened in 1932.

Photo: Bookish Worm (CC BY-SA 4.0); Rodney Haywood (Attribution); JJ Harrison (CC BY-SA 3.0)', 'Sydney', -33.85222, 151.21056, 'AU', NULL, NOW(), NOW()),

(21, 18, 'parks-nature', 'Bondi Beach', 'Bondi Beach is a popular beach and the name of the surrounding suburb in Sydney, New South Wales, Australia. Located 7 kilometres east of the Sydney central business district, it is one of the most visited tourist sites in Australia.

Photo: Nick Ang (CC BY-SA 4.0); Chen Hualin (CC BY-SA 4.0); Nicolas Lannuzel (CC BY-SA 2.0)', 'Sydney', -33.891, 151.278, 'AU', NULL, NOW(), NOW()),

(22, 19, 'zoos-aquariums-wildlife', 'Taronga Zoo', 'Taronga Zoo Sydney is a government-run public zoo located in Sydney, New South Wales, Australia, on the shores of Sydney Harbour. It offers great views of the harbour and the city. Taronga is an Aboriginal word meaning "beautiful view".

Officially opened on 7 October 1916, it is managed by the Zoological Parks Board of New South Wales.

Photo: Alex Dawson (CC BY-SA 2.0); Todd (Public domain); Maksym Kozlenko (CC BY-SA 4.0)', 'Sydney', -33.84333, 151.24111, 'AU', 'https://taronga.org.au/taronga-zoo', NOW(), NOW()),

(23, 20, 'parks-nature', 'Royal Botanic Garden, Sydney', 'The Royal Botanic Garden, Sydney is a heritage-listed 30-hectare botanical garden and public recreation area located at Farm Cove on the eastern fringe of the Sydney central business district.

Opened in 1816, it is the oldest scientific institution in Australia and one of the most important historic botanical institutions in the world.

Photo: Bidgee (CC BY-SA 3.0); Photographic Collection from Australia (CC BY 2.0); Harveychl (CC BY-SA 4.0)', 'Sydney', -33.86389, 151.21694, 'AU', 'https://www.botanicgardens.org.au/royal-botanic-garden-sydney', NOW(), NOW());
