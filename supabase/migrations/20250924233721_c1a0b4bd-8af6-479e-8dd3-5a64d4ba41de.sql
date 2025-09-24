-- Set proper file size limits and MIME type restrictions for storage buckets

-- Update tv-episodes bucket with file size limit (500MB)
UPDATE storage.buckets 
SET file_size_limit = 524288000, -- 500MB
    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/avi']
WHERE id = 'tv-episodes';

-- Update episode-thumbnails bucket with file size limit (5MB)  
UPDATE storage.buckets
SET file_size_limit = 5242880, -- 5MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
WHERE id = 'episode-thumbnails';

-- Update videos bucket with file size limit (1GB)
UPDATE storage.buckets
SET file_size_limit = 1073741824, -- 1GB
    allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/avi']
WHERE id = 'videos';

-- Update thumbnails bucket with file size limit (10MB)
UPDATE storage.buckets
SET file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
WHERE id = 'thumbnails';