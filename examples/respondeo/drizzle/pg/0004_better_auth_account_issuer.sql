-- better-auth 1.7 keys an external identity on (issuer, account_id) instead of
-- (provider_id, account_id). The column is required, so it cannot be added to a
-- populated table in one statement: add it nullable, backfill every row, then
-- constrain it.
--
-- The backfill reproduces the synthetic issuer better-auth generates for
-- providers that have none of their own, so an account written before the
-- upgrade resolves to the same identity afterwards:
--
--   credential  -> local:credential
--   OAuth/OIDC  -> local:oauth:<encodeURIComponent(providerId)>
--
-- That includes the generic OAuth provider, which pins `accountIssuer` to the
-- same value in lib/auth/server.ts rather than adopting the issuer from its
-- discovery document — a value this migration has no way to know.

ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint

-- encodeURIComponent leaves only these characters unescaped, and Postgres has
-- no equivalent function. A provider ID outside that set would be backfilled
-- with an issuer the application never produces, silently orphaning the
-- account, so refuse to guess.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "account"
    WHERE "provider_id" <> 'credential'
      AND "provider_id" !~ '^[A-Za-z0-9\-_.!~*''()]+$'
  ) THEN
    RAISE EXCEPTION 'account.provider_id contains characters that encodeURIComponent would percent-encode; backfill account.issuer by hand before running this migration';
  END IF;
END $$;--> statement-breakpoint

UPDATE "account"
SET "issuer" = CASE
  WHEN "provider_id" = 'credential' THEN 'local:credential'
  ELSE 'local:oauth:' || "provider_id"
END
WHERE "issuer" IS NULL;--> statement-breakpoint

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;--> statement-breakpoint

-- 1.6 never enforced (provider_id, account_id) at the database level, so rows
-- that collide under the new key can already exist. Postgres would report them
-- one pair at a time as the index build hits each; report all of them at once
-- so a single pass is enough to clean the table up.
DO $$
DECLARE
  collisions text;
BEGIN
  -- %L quotes each value, so an account_id containing a comma or a paren (a
  -- `sub` is an arbitrary string) cannot be misread as a pair boundary.
  SELECT string_agg(format('(%L, %L) x%s', "issuer", "account_id", n), ', ' ORDER BY n DESC)
  INTO collisions
  FROM (
    SELECT "issuer", "account_id", count(*) AS n
    FROM "account"
    GROUP BY "issuer", "account_id"
    HAVING count(*) > 1
  ) duplicates;

  IF collisions IS NOT NULL THEN
    RAISE EXCEPTION 'account rows collide on (issuer, account_id): %', collisions
      USING HINT = 'better-auth 1.7 requires this pair to be unique; keep one account row per pair (the most recently updated is usually the live one) and re-run the migration';
  END IF;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX "account_issuer_account_id_idx" ON "account" USING btree ("issuer","account_id");
