-- Migration: perf_indexes_analytics
-- Adds partial DESC indexes on User.createdAt and Message.createdAt.
-- These are used by the analytics service's daily signup and message
-- groupBy queries (DATE_TRUNC ... WHERE createdAt >= X AND deletedAt IS NULL).
-- The partial index condition (WHERE "deletedAt" IS NULL) excludes soft-deleted
-- rows so the planner uses a far smaller index at 10M-MAU scale.
-- Safe to re-apply: IF NOT EXISTS guards are present.

CREATE INDEX IF NOT EXISTS "User_createdAt_idx"
  ON "User"("createdAt" DESC)
  WHERE "deletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Message_createdAt_idx"
  ON "Message"("createdAt" DESC)
  WHERE "deletedAt" IS NULL;
