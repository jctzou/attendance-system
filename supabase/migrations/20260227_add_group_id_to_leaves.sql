-- ==========================================
-- Migration: Add group_id to leaves table
-- Purpose: Support split daily leave records managed as a single group
-- Date: 2026-02-27
-- ==========================================

-- Add the column (nullable so it doesn't break existing single-day or old multi-day records)
ALTER TABLE public.leaves 
ADD COLUMN IF NOT EXISTS group_id UUID;

-- Add an index to speed up grouping and cancellation by group
CREATE INDEX IF NOT EXISTS idx_leaves_group_id ON public.leaves(group_id);

COMMENT ON COLUMN public.leaves.group_id IS 'Used to group split daily leave records that were submitted together in a single multi-day application.';
