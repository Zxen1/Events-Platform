-- Fix image filenames to use {postId}-{original_filename} convention
-- Run this AFTER uploading the correctly-named images to Bunny CDN

-- Post 1: The British Museum
UPDATE post_media 
SET file_name = '1-British_Museum_2018.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/1-British_Museum_2018.jpg'
WHERE id = 1;

-- Post 2: Natural History Museum
UPDATE post_media 
SET file_name = '2-Natural_History_Museum_London_UK.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/2-Natural_History_Museum_London_UK.jpg'
WHERE id = 2;

-- Post 3: Tower of London
UPDATE post_media 
SET file_name = '3-Tower_of_London_48.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/3-Tower_of_London_48.jpg'
WHERE id = 3;

-- Post 4: Westminster Abbey
UPDATE post_media 
SET file_name = '4-Westminster-Abbey.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/4-Westminster-Abbey.jpg'
WHERE id = 4;

-- Post 5: Tate Modern
UPDATE post_media 
SET file_name = '5-Tate_Modern_exterior.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/5-Tate_Modern_exterior.jpg'
WHERE id = 5;

-- Post 6: Buckingham Palace
UPDATE post_media 
SET file_name = '6-Buckingham_Palace_from_gardens.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/6-Buckingham_Palace_from_gardens.jpg'
WHERE id = 6;

-- Post 7: St Paul's Cathedral
UPDATE post_media 
SET file_name = '7-St_Pauls_Cathedral_in_London.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/7-St_Pauls_Cathedral_in_London.jpg'
WHERE id = 7;

-- Post 8: Victoria and Albert Museum
UPDATE post_media 
SET file_name = '8-Victoria_and_Albert_Museum_London.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/8-Victoria_and_Albert_Museum_London.jpg'
WHERE id = 8;

-- Post 9: London Eye
UPDATE post_media 
SET file_name = '9-London_Eye_River_Thames.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/9-London_Eye_River_Thames.jpg'
WHERE id = 9;

-- Post 10: Science Museum
UPDATE post_media 
SET file_name = '10-Science_Museum_London.jpg',
    file_url = 'https://cdn.funmap.com/post-images/2026-01/10-Science_Museum_London.jpg'
WHERE id = 10;

-- Also update settings_json with correct original filenames
UPDATE post_media SET settings_json = '{"file_name":"British_Museum_from_NE_2_(cropped).jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 1;
UPDATE post_media SET settings_json = '{"file_name":"Natural_History_Museum_London_Jan_2006.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 2;
UPDATE post_media SET settings_json = '{"file_name":"Tower_of_London_viewed_from_the_River_Thames.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 3;
UPDATE post_media SET settings_json = '{"file_name":"Westminster_Abbey_-_West_Door.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 4;
UPDATE post_media SET settings_json = '{"file_name":"Tate_Modern_-_Bankside_Power_Station.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 5;
UPDATE post_media SET settings_json = '{"file_name":"Buckingham_Palace_from_gardens,_London,_UK_-_Diliff.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 6;
UPDATE post_media SET settings_json = '{"file_name":"St_Paul'"'"'s_Cathedral,_London,_England_-_Jan_2010.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 7;
UPDATE post_media SET settings_json = '{"file_name":"Victoria_and_Albert_Museum_Entrance,_London,_UK_-_Diliff.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 8;
UPDATE post_media SET settings_json = '{"file_name":"London_Eye_Twilight_April_2006.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 9;
UPDATE post_media SET settings_json = '{"file_name":"Science_Museum,_Exhibition_Road,_London_SW7_-_geograph.org.uk_-_1125595.jpg","file_type":"image/jpeg","file_size":null,"crop":null}' WHERE id = 10;
