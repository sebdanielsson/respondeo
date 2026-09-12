-- better-auth 1.7.3 reverted 1.7.0's account identity: an external identity is
-- keyed on (provider_id, account_id) again, `issuer` is no longer read, and a
-- NOT NULL column better-auth never writes now fails its startup schema check
-- and blocks sign-ups and account linking. Undo 0004.

-- 0004 backfilled issuer from provider_id ('credential' -> 'local:credential',
-- anything else -> 'local:oauth:<provider_id>'), which is injective, so its
-- unique index implies this one for every row it wrote. Rows written by
-- better-auth 1.7.0-1.7.2 afterwards carry the issuer from the provider's
-- discovery document instead, and a row like that can share (provider_id,
-- account_id) with a backfilled one while still being unique on
-- (issuer, account_id). Report all such pairs at once rather than letting the
-- index build surface them one at a time.
DO $$
DECLARE
  collisions text;
BEGIN
  -- %L quotes each value, so an account_id containing a comma or a paren (a
  -- `sub` is an arbitrary string) cannot be misread as a pair boundary.
  SELECT string_agg(format('(%L, %L) x%s', "provider_id", "account_id", n), ', ' ORDER BY n DESC)
  INTO collisions
  FROM (
    SELECT "provider_id", "account_id", count(*) AS n
    FROM "account"
    GROUP BY "provider_id", "account_id"
    HAVING count(*) > 1
  ) duplicates;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'account rows collide on (provider_id, account_id): %', collisions
      USING HINT = 'better-auth 1.7.3 requires this pair to be unambiguous; keep one account row per pair (the most recently updated is usually the live one) and re-run the migration';
  END IF;
END $$;--> statement-breakpoint

DROP INDEX "account_issuer_account_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_id_account_id_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
ALTER TABLE "account" DROP COLUMN "issuer";
