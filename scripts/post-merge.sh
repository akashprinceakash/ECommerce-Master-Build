#!/bin/bash
set -e
pnpm install --frozen-lockfile

# One-time migration: legacy `lookbook_outfits` rows predate the AI virtual
# try-on rework and use an incompatible shape (no `gender`/`result_image_url`,
# different `items` layout). Adding those not-null columns via `drizzle-kit
# push` against a table with existing rows would prompt for a default
# interactively, but stdin is closed during post-merge, so it would hang/fail.
# This only drops the table the *first* time it detects the old shape (missing
# `result_image_url`), so `push` can recreate it cleanly. Once migrated, this
# is a no-op on every subsequent merge — newly saved AI-generated looks are
# never touched or wiped.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lookbook_outfits')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'lookbook_outfits' AND column_name = 'result_image_url') THEN
    DROP TABLE lookbook_outfits CASCADE;
  END IF;
END \$\$;
"

pnpm --filter db push
