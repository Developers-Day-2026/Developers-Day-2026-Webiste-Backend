-- Sync migration history with a manual DB change:
-- Ensure UserType enum contains BRAND_AMBASSADOR.

ALTER TYPE "UserType" ADD VALUE IF NOT EXISTS 'BRAND_AMBASSADOR';
