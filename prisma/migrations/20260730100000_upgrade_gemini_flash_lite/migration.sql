-- Preserve existing users' Swift permission after the registry ID upgrade.
DELETE FROM "ModelAccess"
WHERE "modelId" = 'gemini-2.5-flash-lite'
  AND EXISTS (
    SELECT 1
    FROM "ModelAccess" AS "currentAccess"
    WHERE "currentAccess"."userId" = "ModelAccess"."userId"
      AND "currentAccess"."modelId" = 'gemini-3.1-flash-lite'
  );

UPDATE "ModelAccess"
SET "modelId" = 'gemini-3.1-flash-lite'
WHERE "modelId" = 'gemini-2.5-flash-lite';
