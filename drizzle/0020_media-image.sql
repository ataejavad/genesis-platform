-- IF NOT EXISTS: an earlier preview build of this branch may already have added the column
ALTER TABLE "media_posts" ADD COLUMN IF NOT EXISTS "image_url" text;