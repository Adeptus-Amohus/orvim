-- Existing records and covers remain intact; only the document format advances.
UPDATE workspace_document SET settings=json_set(settings, '$.version', 30);
