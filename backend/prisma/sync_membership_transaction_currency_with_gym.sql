-- Normalize historical membership transaction currency with each gym configuration.
-- Run once per environment after enabling gym-level global currency.

UPDATE "membership_transactions" AS mt
SET "currency" = CASE WHEN g."currency" = 'CRC' THEN 'CRC' ELSE 'USD' END
FROM "gyms" AS g
WHERE mt."gym_id" = g."id"
  AND mt."currency" <> CASE WHEN g."currency" = 'CRC' THEN 'CRC' ELSE 'USD' END;
