-- Final remediation constraints for launch readiness.
--
-- These constraints close concurrency/idempotency gaps. Partial unique indexes
-- are used where the set of conflicting rows is a subset (active queue entries,
-- open conversations). Prisma's schema language does not yet express partial
-- uniques, so they are declared here and left as deliberate migration drift.

-- 1. Provider message idempotency: a single provider message id must only ever
--    create one internal Message row. NULL providerMessageIds are excluded by
--    PostgreSQL unique-index semantics, so outbound messages are unaffected.
DROP INDEX IF EXISTS "Message_providerMessageId_conversationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Message_providerMessageId_key"
  ON "Message"("providerMessageId")
  WHERE "providerMessageId" IS NOT NULL;

-- 2. Active queue-entry uniqueness: one logical active entry per contact/queue.
--    Completed/cancelled/no-show entries are allowed to repeat.
CREATE UNIQUE INDEX IF NOT EXISTS "QueueEntry_active_contact_key"
  ON "QueueEntry"("queueId", "contactId")
  WHERE status IN ('WAITING', 'CALLED', 'IN_PROGRESS');

-- 3. Campaign recipient uniqueness: the same contact must not appear twice in
--    the same campaign (concurrent creation / import / retries).
CREATE UNIQUE INDEX IF NOT EXISTS "CampaignRecipient_campaignId_contactId_key"
  ON "CampaignRecipient"("campaignId", "contactId");
