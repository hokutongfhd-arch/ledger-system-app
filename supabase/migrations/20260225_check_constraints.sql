CREATE OR REPLACE FUNCTION check_db_constraints()
RETURNS TABLE (
    table_name TEXT,
    constraint_or_index_name TEXT,
    column_name TEXT,
    constraint_type TEXT,
    is_composite BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        -- UNIQUE and PRIMARY KEY constraints
        SELECT
            rel.relname::TEXT as table_name,
            con.conname::TEXT as constraint_or_index_name,
            att.attname::TEXT as column_name,
            CASE 
                WHEN con.contype = 'p' THEN 'PRIMARY KEY'
                WHEN con.contype = 'u' THEN 'UNIQUE'
                ELSE 'OTHER'
            END as constraint_type,
            (array_length(con.conkey, 1) > 1) as is_composite
        FROM pg_constraint con
        JOIN pg_class rel ON con.conrelid = rel.oid
        JOIN pg_namespace nsp ON rel.relnamespace = nsp.oid
        JOIN pg_attribute att ON att.attrelid = nsp.oid AND att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public'
        AND con.contype IN ('p', 'u')
        AND rel.relname IN ('employees', 'addresses', 'areas', 'tablets', 'iphones', 'featurephones', 'routers')

        UNION ALL

        -- UNIQUE indexes that are not constraints
        SELECT
            rel.relname::TEXT as table_name,
            idx_rel.relname::TEXT as constraint_or_index_name,
            att.attname::TEXT as column_name,
            'UNIQUE INDEX'::TEXT as constraint_type,
            (idx.indnatts > 1) as is_composite
        FROM pg_index idx
        JOIN pg_class rel ON idx.indrelid = rel.oid
        JOIN pg_class idx_rel ON idx.indexrelid = idx_rel.oid
        JOIN pg_namespace nsp ON rel.relnamespace = nsp.oid
        JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(idx.indkey)
        WHERE nsp.nspname = 'public'
        AND idx.indisunique = true
        AND idx.indisprimary = false
        AND rel.relname IN ('employees', 'addresses', 'areas', 'tablets', 'iphones', 'featurephones', 'routers')
        -- Exclude indexes that are already listed as constraints
        AND NOT EXISTS (
            SELECT 1 FROM pg_constraint con 
            WHERE con.conname = idx_rel.relname
        )
    ) sub
    ORDER BY sub.table_name, sub.constraint_type, sub.constraint_or_index_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
