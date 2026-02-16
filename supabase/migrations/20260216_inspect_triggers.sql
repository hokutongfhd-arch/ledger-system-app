
-- Helper function to inspect triggers
CREATE OR REPLACE FUNCTION get_table_triggers()
RETURNS TABLE (
    table_schema text,
    table_name text,
    trigger_name text,
    event_manipulation text,
    action_statement text,
    action_timing text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        event_object_schema::text,
        event_object_table::text,
        information_schema.triggers.trigger_name::text,
        information_schema.triggers.event_manipulation::text,
        information_schema.triggers.action_statement::text,
        information_schema.triggers.action_timing::text
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
    ORDER BY event_object_table, trigger_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
