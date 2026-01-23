-- Fix for Unicode filenames that were corrupted to question marks
-- The correct filenames are stored in settings_json, we extract and update

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Update file_name from settings_json where file_name contains '?'
UPDATE post_media 
SET file_name = CONCAT(
    LPAD(post_id, 8, '0'), 
    '-', 
    JSON_UNQUOTE(JSON_EXTRACT(settings_json, '$.file_name'))
)
WHERE file_name LIKE '%?%';

-- Update file_url to match the corrected file_name
UPDATE post_media 
SET file_url = CONCAT(
    'https://cdn.funmap.com/post-images/2026-01/',
    file_name
)
WHERE file_url LIKE '%?%';

-- Verify the fix
SELECT id, post_id, file_name, file_url 
FROM post_media 
WHERE file_name LIKE '%上%' OR file_name LIKE '%明%' OR file_name LIKE '%Σ%'
LIMIT 10;
