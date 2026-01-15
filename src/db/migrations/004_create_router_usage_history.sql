CREATE TABLE IF NOT EXISTS router_usage_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  router_id uuid REFERENCES routers(id) ON DELETE CASCADE NOT NULL,
  employee_code text,
  office_code text,
  start_date text,
  end_date text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_router_usage_history_router_id ON router_usage_history(router_id);
