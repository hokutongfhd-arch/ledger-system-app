CREATE TABLE IF NOT EXISTS iphone_usage_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  iphone_id uuid REFERENCES iphones(id) ON DELETE CASCADE NOT NULL,
  employee_code text,
  office_code text,
  start_date text,
  end_date text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_iphone_usage_history_iphone_id ON iphone_usage_history(iphone_id);
