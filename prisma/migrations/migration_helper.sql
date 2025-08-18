-- Migration helper script to transition from ApprovalStatus enum to Status table
-- This script should be run manually as part of the migration process

-- Step 1: Create the statuses table if it doesn't exist
-- (This will be handled by Prisma migration)

-- Step 2: Insert default statuses matching the old enum values
INSERT INTO statuses (id, name, description, color, is_default, display_order, created_at, updated_at)
VALUES 
  ('pending-default', 'Pending', 'Awaiting review and approval', '#f59e0b', true, 1, NOW(), NOW()),
  ('approved-default', 'Approved', 'Reviewed and approved for use', '#10b981', false, 2, NOW(), NOW()),
  ('rejected-default', 'Rejected', 'Reviewed and rejected', '#ef4444', false, 3, NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- Step 3: Add status_id columns to entities (will be handled by Prisma)

-- Step 4: Migrate existing approval_status data to status_id
UPDATE partners 
SET status_id = CASE 
  WHEN approval_status = 'PENDING' THEN 'pending-default'
  WHEN approval_status = 'APPROVED' THEN 'approved-default'
  WHEN approval_status = 'REJECTED' THEN 'rejected-default'
  ELSE 'pending-default'
END
WHERE approval_status IS NOT NULL;

UPDATE goods_and_services 
SET status_id = CASE 
  WHEN approval_status = 'PENDING' THEN 'pending-default'
  WHEN approval_status = 'APPROVED' THEN 'approved-default'
  WHEN approval_status = 'REJECTED' THEN 'rejected-default'
  ELSE 'pending-default'
END
WHERE approval_status IS NOT NULL;

UPDATE documents 
SET status_id = CASE 
  WHEN approval_status = 'PENDING' THEN 'pending-default'
  WHEN approval_status = 'APPROVED' THEN 'approved-default'
  WHEN approval_status = 'REJECTED' THEN 'rejected-default'
  ELSE 'pending-default'
END
WHERE approval_status IS NOT NULL;

-- Step 5: Drop approval_status columns (will be handled by Prisma migration)
-- Step 6: Drop ApprovalStatus enum (will be handled by Prisma migration)