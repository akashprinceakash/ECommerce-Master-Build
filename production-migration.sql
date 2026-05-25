-- ═══════════════════════════════════════════════════════════════════════════
-- KA.SHA — Production DB Migration
-- Run this in your Render PostgreSQL dashboard → "PSQL Console" (or via psql)
-- Safe to re-run: every statement uses IF NOT EXISTS / DO blocks
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. customizations — add missing columns ──────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='parts_enabled'
  ) THEN
    ALTER TABLE customizations
    ADD COLUMN parts_enabled jsonb NOT NULL
    DEFAULT '{"collar":true,"leftSleeve":true,"rightSleeve":true}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='canvas_data'
  ) THEN
    ALTER TABLE customizations ADD COLUMN canvas_data text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='preview_image_url'
  ) THEN
    ALTER TABLE customizations ADD COLUMN preview_image_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='front_image_url'
  ) THEN
    ALTER TABLE customizations ADD COLUMN front_image_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='back_image_url'
  ) THEN
    ALTER TABLE customizations ADD COLUMN back_image_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customizations' AND column_name='side_image_url'
  ) THEN
    ALTER TABLE customizations ADD COLUMN side_image_url text;
  END IF;
END $$;

-- ── 2. site_settings — create if missing ────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  key        text        PRIMARY KEY,
  value      text        NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 3. sku_assets — create if missing ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS sku_assets (
  id         serial      PRIMARY KEY,
  sku        text        NOT NULL,
  type       text        NOT NULL,
  asset_url  text        NOT NULL,
  label      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── 4. orders — add columns added after initial deploy ──────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='shipping_charge_in_paise'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_charge_in_paise integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='shiprocket_order_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN shiprocket_order_id text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='shiprocket_awb'
  ) THEN
    ALTER TABLE orders ADD COLUMN shiprocket_awb text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='orders' AND column_name='tracking_url'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_url text;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Done. All tables and columns are now in sync with the application schema.
-- ═══════════════════════════════════════════════════════════════════════════
