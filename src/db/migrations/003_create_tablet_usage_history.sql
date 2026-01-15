CREATE TABLE IF NOT EXISTS tablet_usage_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tablet_id uuid REFERENCES tablets(id) ON DELETE CASCADE NOT NULL,
  employee_code text,
  office_code text,
  start_date text,
  end_date text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_tablet_usage_history_tablet_id ON tablet_usage_history(tablet_id);
