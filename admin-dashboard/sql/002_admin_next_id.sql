-- Sequence helper for BIGINT tables without defaults
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS admin_id_sequences (
  table_name text PRIMARY KEY,
  next_id bigint NOT NULL
);

CREATE OR REPLACE FUNCTION admin_next_id(p_table text)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_next bigint;
BEGIN
  LOOP
    UPDATE admin_id_sequences
      SET next_id = next_id + 1
      WHERE table_name = p_table
      RETURNING next_id - 1 INTO v_next;

    IF FOUND THEN
      RETURN v_next;
    END IF;

    EXECUTE format('SELECT COALESCE(MAX(id),0)+1 FROM %I', p_table) INTO v_next;

    BEGIN
      INSERT INTO admin_id_sequences(table_name, next_id)
      VALUES (p_table, v_next + 1);
      RETURN v_next;
    EXCEPTION WHEN unique_violation THEN
      -- retry
    END;
  END LOOP;
END;
$$;
