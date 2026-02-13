-- Add cost_bearer column to device tables

-- iphones table
ALTER TABLE iphones ADD COLUMN IF NOT EXISTS cost_bearer TEXT;

-- feature_phones table (note: confirm table name is feature_phones or featurephones based on previous file views, device.api.ts uses 'featurephones')
-- Checking device.api.ts from previous turns, it uses 'featurephones'.
ALTER TABLE featurephones ADD COLUMN IF NOT EXISTS cost_bearer TEXT;

-- routers table
ALTER TABLE routers ADD COLUMN IF NOT EXISTS cost_bearer TEXT;

-- tablets table
ALTER TABLE tablets ADD COLUMN IF NOT EXISTS cost_bearer TEXT;
