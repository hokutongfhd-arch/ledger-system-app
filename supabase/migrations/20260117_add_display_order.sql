
-- Add display_order column to device_manuals table
ALTER TABLE device_manuals ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Optional: Initialize display_order based on updated_at for existing records
WITH ranked_manuals AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at DESC) - 1 as new_rank
  FROM device_manuals
)
UPDATE device_manuals
SET display_order = ranked_manuals.new_rank
FROM ranked_manuals
WHERE device_manuals.id = ranked_manuals.id;
