-- Refresh sessions are stored in Redis only; this table was never used by application code.

DROP TABLE IF EXISTS "AuthRefreshSession";
