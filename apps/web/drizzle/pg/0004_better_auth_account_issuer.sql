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
CREATE UNIQUE INDEX "account_issuer_account_id_idx" ON "account" USING btree ("issuer","account_id");
