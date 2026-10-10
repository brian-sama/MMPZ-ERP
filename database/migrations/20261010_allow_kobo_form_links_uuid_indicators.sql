-- Allow kobo_form_links to link to both integer indicators and UUID/CUID indicator summaries (Compass M&E)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'kobo_form_links_indicator_id_fkey'
          AND table_name = 'kobo_form_links'
    ) THEN
        ALTER TABLE kobo_form_links DROP CONSTRAINT kobo_form_links_indicator_id_fkey;
    END IF;
END $$;

ALTER TABLE kobo_form_links ALTER COLUMN indicator_id TYPE VARCHAR(100);
