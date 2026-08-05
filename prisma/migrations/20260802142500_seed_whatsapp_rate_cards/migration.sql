-- Seed placeholder India rate card so chargeWhatsAppMessage has something to
-- look up from the moment this deploys (baked into a migration, not a
-- separate `prisma db seed` step, so production doesn't go live with an
-- empty rate table). THESE ARE PLACEHOLDER ESTIMATES based on historical
-- published Meta India conversation-based pricing, NOT verified against any
-- actual Gupshup account billing — a platform admin must review/correct
-- these via the rate-card admin page before relying on this for real client
-- invoicing.
INSERT INTO "WhatsAppRateCard" ("id", "category", "countryCode", "costPaise", "effectiveFrom", "updatedAt")
VALUES
  ('ratecard_in_marketing', 'MARKETING', 'IN', 78, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ratecard_in_utility', 'UTILITY', 'IN', 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ratecard_in_authentication', 'AUTHENTICATION', 'IN', 35, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ratecard_in_service', 'SERVICE', 'IN', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("category", "countryCode") DO NOTHING;
