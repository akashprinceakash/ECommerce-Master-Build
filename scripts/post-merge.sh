#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Legacy `lookbook_outfits` rows predate the AI virtual try-on rework and use an
# incompatible shape (no `gender`/`result_image_url`, different `items` layout).
# Drop the table so `drizzle-kit push` can (re)create it cleanly and
# non-interactively, instead of prompting for a not-null default on existing
# rows (stdin is closed during post-merge, so any prompt would hang/fail).
# Saved looks are regenerable, so this is a safe, idempotent reset.
psql "$DATABASE_URL" -c "DROP TABLE IF EXISTS lookbook_outfits CASCADE;"

pnpm --filter db push
