export const handler = async (sql) => {
    console.log('Running Announcements migration...');
    
    await sql`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        audience TEXT[] NOT NULL DEFAULT ARRAY['ALL'],
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;`;
    await sql`ALTER TABLE announcements ADD COLUMN IF NOT EXISTS audience TEXT[] DEFAULT ARRAY['ALL'];`;
    await sql`ALTER TABLE announcements ALTER COLUMN audience DROP DEFAULT;`;

    await sql.unsafe(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1
              FROM information_schema.columns
              WHERE table_name = 'announcements'
                AND column_name = 'audience'
                AND data_type = 'text'
          ) THEN
              ALTER TABLE announcements
                  ALTER COLUMN audience TYPE TEXT[]
                  USING ARRAY[UPPER(COALESCE(audience, 'ALL'))];
          END IF;
      END $$;
    `);

    await sql`
      UPDATE announcements
      SET audience = ARRAY['ALL']
      WHERE audience IS NULL OR array_length(audience, 1) IS NULL
    `;

    await sql`ALTER TABLE announcements ALTER COLUMN audience SET DEFAULT ARRAY['ALL'];`;
    await sql`ALTER TABLE announcements ALTER COLUMN audience SET NOT NULL;`;

    console.log('Announcements migration complete.');
};
