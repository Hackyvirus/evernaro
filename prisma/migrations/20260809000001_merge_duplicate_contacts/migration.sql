-- Merge duplicate contacts per identifier type, keeping the oldest contact in
-- each duplicate group and moving core relations to it. After the merge, add
-- unique constraints that prevent future duplicates.

CREATE OR REPLACE FUNCTION merge_duplicate_contacts(identifier_column TEXT)
RETURNS void AS $$
DECLARE
  rec RECORD;
  kept_id TEXT;
  dup_ids TEXT[];
BEGIN
  FOR rec IN EXECUTE format(
    'SELECT "orgId" AS org_id, %I AS identifier, array_agg(id ORDER BY "createdAt" ASC, id ASC) AS ids
     FROM "Contact"
     WHERE %I IS NOT NULL
     GROUP BY "orgId", %I
     HAVING count(*) > 1',
    identifier_column, identifier_column, identifier_column
  )
  LOOP
    kept_id := rec.ids[1];
    dup_ids := rec.ids[2:array_length(rec.ids, 1)];

    -- Move core relations to the kept contact.
    EXECUTE 'UPDATE "Conversation" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "Appointment" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "QueueEntry" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "Reminder" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "Review" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "JobCard" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "Membership" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "CustomerFlowSession" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "CampaignRecipient" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "CustomerEvent" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "NotificationPreference" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "CallLog" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;
    EXECUTE 'UPDATE "Invoice" SET "contactId" = $1 WHERE "contactId" = ANY($2)' USING kept_id, dup_ids;

    -- Delete the duplicate contacts. Remaining relations with onDelete: Cascade
    -- are removed; CustomerFlowSession uses SetNull and was updated above.
    EXECUTE 'DELETE FROM "Contact" WHERE id = ANY($1)' USING dup_ids;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

SELECT merge_duplicate_contacts('phone');
SELECT merge_duplicate_contacts('email');
SELECT merge_duplicate_contacts('telegramChatId');
SELECT merge_duplicate_contacts('instagramUserId');

DROP FUNCTION merge_duplicate_contacts(TEXT);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_orgId_phone_key" ON "Contact"("orgId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_orgId_email_key" ON "Contact"("orgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_orgId_telegramChatId_key" ON "Contact"("orgId", "telegramChatId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contact_orgId_instagramUserId_key" ON "Contact"("orgId", "instagramUserId");
