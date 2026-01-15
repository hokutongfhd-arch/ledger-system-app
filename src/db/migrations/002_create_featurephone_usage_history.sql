CREATE TABLE IF NOT EXISTS featurephone_usage_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  featurephone_id uuid REFERENCES featurephones(id) ON DELETE CASCADE NOT NULL,
  employee_code text,
  office_code text,
  start_date text,
  end_date text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_featurephone_usage_history_featurephone_id ON featurephone_usage_history(featurephone_id);
