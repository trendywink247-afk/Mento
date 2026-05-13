-- Catch-up migration: Phases A through G
-- Covers all schema drift between 20260510181133_init and current schema.prisma.
-- Generated manually on 2026-05-13. Do NOT edit after applying to prod.

-- ============================================================
-- 1. ENUM ADDITIONS & NEW ENUMS
-- ============================================================

-- Role: add COORDINATOR value
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COORDINATOR';

-- UserStatus: add BANNED value
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'BANNED';

-- New enums (did not exist in init)
DO $$ BEGIN
  CREATE TYPE "AvatarLetter" AS ENUM ('B', 'A', 'P', 'M', 'I', 'F');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AvatarColor" AS ENUM ('SLATE', 'AMBER', 'SKY', 'FOREST', 'PURPLE', 'GOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ChatRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'ARCHIVED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JourneyStage" AS ENUM (
    'ABOUT_TO_START',
    'ONE_YEAR_IN',
    'TWO_YEARS_IN_NO_PRELIMS',
    'ONE_PRELIMS_ATTEMPT',
    'MULTI_PRELIMS_NO_CLEAR',
    'PRELIMS_CLEARED',
    'MAINS_WRITTEN',
    'INTERVIEW_ATTEMPTED',
    'MULTI_INTERVIEW'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "MentorJourney" AS ENUM (
    'PRELIMS_CLEARED',
    'MAINS_ONCE',
    'MAINS_MULTI',
    'INTERVIEW_ONCE',
    'INTERVIEW_MULTI',
    'STILL_PREPARING',
    'DONE_CLEARED',
    'WORKING_AND_PREPARING',
    'DONE_NOT_PREPARING',
    'FOUNDING_MENTOR_PARTNER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalCategory" AS ENUM (
    'PERSONAL',
    'PRELIMS_POLITY',
    'PRELIMS_HISTORY',
    'PRELIMS_GEOGRAPHY',
    'PRELIMS_ECONOMY',
    'PRELIMS_ENVIRONMENT',
    'PRELIMS_SCI_TECH',
    'PRELIMS_CSAT',
    'PRELIMS_CURRENT_AFFAIRS',
    'MAINS_GS1',
    'MAINS_GS2',
    'MAINS_GS3',
    'MAINS_GS4',
    'MAINS_ESSAY',
    'MAINS_OPTIONAL',
    'INTERVIEW',
    'SHARED_WITH_MENTOR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalEntryType" AS ENUM ('MANUAL_TEXT', 'SAVED_CHAT', 'CALL_TRANSCRIPT_CHUNK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "JournalAuditAction" AS ENUM ('CREATE', 'EDIT', 'APPEND', 'DELETE', 'LOCK', 'UNLOCK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'BASIC', 'PRO', 'MAX');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SessionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('SIMULATED', 'HELD', 'CAPTURED', 'REFUNDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "WalletTxnType" AS ENUM ('HOLD', 'CAPTURE', 'REFUND', 'CREDIT', 'DEBIT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED_NO_ACTION', 'REVIEWED_BANNED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ModerationAction" AS ENUM (
    'WARN',
    'DISMISS',
    'SUSPEND_ASPIRANT',
    'SUSPEND_MENTOR',
    'BAN_ASPIRANT',
    'BAN_MENTOR',
    'BAN_BOTH'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. ALTER User TABLE
-- ============================================================

-- Add new columns (all nullable so existing rows don't break)
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "googleSub" TEXT,
  ADD COLUMN IF NOT EXISTS "bannedAt" TIMESTAMP(3);

-- Unique index for googleSub
CREATE UNIQUE INDEX IF NOT EXISTS "User_googleSub_key" ON "User"("googleSub");

-- ============================================================
-- 3. REPLACE Profile TABLE
-- ============================================================
-- The init Profile had displayName + avatarUrl.
-- The current schema has displayHandle, avatarLetter, avatarColor, hasPurpleTick.
-- We drop the old table and recreate to spec.

DROP TABLE IF EXISTS "Profile";

CREATE TABLE "Profile" (
    "userId" UUID NOT NULL,
    "displayHandle" TEXT NOT NULL,
    "avatarLetter" "AvatarLetter" NOT NULL DEFAULT 'B',
    "avatarColor" "AvatarColor" NOT NULL DEFAULT 'SLATE',
    "hasPurpleTick" BOOLEAN NOT NULL DEFAULT false,
    "bio" TEXT,
    "city" TEXT,
    "state" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Profile_displayHandle_key" ON "Profile"("displayHandle");
CREATE INDEX "Profile_displayHandle_idx" ON "Profile"("displayHandle");
CREATE INDEX "Profile_avatarLetter_idx" ON "Profile"("avatarLetter");

-- ============================================================
-- 4. REPLACE MentorProfile TABLE
-- ============================================================
-- The init MentorProfile had expertise, yearsExperience, attemptCount, rankAchieved, isVerified, approvedAt, approvedBy.
-- Current schema has a much richer shape.

DROP TABLE IF EXISTS "MentorProfile";

CREATE TABLE "MentorProfile" (
    "userId" UUID NOT NULL,
    "journeyType" "MentorJourney" NOT NULL DEFAULT 'PRELIMS_CLEARED',
    "prelimsCleared" BOOLEAN NOT NULL DEFAULT false,
    "mainsAttempts" INTEGER NOT NULL DEFAULT 0,
    "interviewAttempts" INTEGER NOT NULL DEFAULT 0,
    "attemptHistory" JSONB,
    "rankAchieved" INTEGER,
    "optionalSubject" TEXT,
    "guidanceCategories" TEXT[] NOT NULL DEFAULT '{}',
    "languages" TEXT[] NOT NULL DEFAULT '{}',
    "hourlyRateInr" INTEGER NOT NULL DEFAULT 400,
    "availability" JSONB,
    "metrics" JSONB,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isFoundingPartner" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "MentorProfile"
  ADD CONSTRAINT "MentorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "MentorProfile_isVerified_approvedAt_idx" ON "MentorProfile"("isVerified", "approvedAt");
CREATE INDEX "MentorProfile_prelimsCleared_mainsAttempts_idx" ON "MentorProfile"("prelimsCleared", "mainsAttempts");

-- ============================================================
-- 5. DROP AspirantProfile; CREATE MenteeProfile
-- ============================================================

DROP TABLE IF EXISTS "AspirantProfile";

CREATE TABLE "MenteeProfile" (
    "userId" UUID NOT NULL,
    "journeyStage" "JourneyStage" NOT NULL DEFAULT 'ABOUT_TO_START',
    "background" TEXT,
    "knowledge" JSONB,
    "challenges" TEXT[] NOT NULL DEFAULT '{}',
    "mirrorCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenteeProfile_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "MenteeProfile"
  ADD CONSTRAINT "MenteeProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. ALTER Conversation TABLE
-- ============================================================

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "archivedByMentee" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "archivedByMentor" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 7. ALTER Message TABLE
-- ============================================================

ALTER TABLE "Message"
  ADD COLUMN IF NOT EXISTS "isReported" BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- 8. NEW TABLES
-- ============================================================

-- ConversationPresence
CREATE TABLE IF NOT EXISTS "ConversationPresence" (
    "conversationId" UUID NOT NULL,
    "mentorActive" BOOLEAN NOT NULL DEFAULT false,
    "menteeActive" BOOLEAN NOT NULL DEFAULT false,
    "mentorLastSeen" TIMESTAMP(3),
    "menteeLastSeen" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationPresence_pkey" PRIMARY KEY ("conversationId")
);

ALTER TABLE "ConversationPresence"
  ADD CONSTRAINT "ConversationPresence_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- VerificationDocument
CREATE TABLE IF NOT EXISTS "VerificationDocument" (
    "userId" UUID NOT NULL,
    "aadhaarUrl" TEXT,
    "aadhaarHash" TEXT,
    "hallTicketUrl" TEXT,
    "marksSheetUrl" TEXT,
    "bankAccount" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "reviewNote" TEXT,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "VerificationDocument"
  ADD CONSTRAINT "VerificationDocument_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "VerificationDocument_aadhaarHash_key" ON "VerificationDocument"("aadhaarHash");
CREATE INDEX IF NOT EXISTS "VerificationDocument_reviewedAt_idx" ON "VerificationDocument"("reviewedAt");

-- MentorDenylist
CREATE TABLE IF NOT EXISTS "MentorDenylist" (
    "aadhaarHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bannedBy" UUID,

    CONSTRAINT "MentorDenylist_pkey" PRIMARY KEY ("aadhaarHash")
);

-- ChatRequest
CREATE TABLE IF NOT EXISTS "ChatRequest" (
    "id" UUID NOT NULL,
    "menteeId" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "intro" TEXT NOT NULL,
    "status" "ChatRequestStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ChatRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ChatRequest"
  ADD CONSTRAINT "ChatRequest_menteeId_fkey"
  FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChatRequest"
  ADD CONSTRAINT "ChatRequest_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ChatRequest_mentorId_status_idx" ON "ChatRequest"("mentorId", "status");
CREATE INDEX IF NOT EXISTS "ChatRequest_menteeId_status_idx" ON "ChatRequest"("menteeId", "status");

-- Journal
CREATE TABLE IF NOT EXISTS "Journal" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "category" "JournalCategory" NOT NULL,
    "conversationId" UUID,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lastActivePairSeenAt" TIMESTAMP(3),
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Journal_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Journal"
  ADD CONSTRAINT "Journal_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Journal"
  ADD CONSTRAINT "Journal_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Journal_conversationId_key" ON "Journal"("conversationId");
CREATE UNIQUE INDEX IF NOT EXISTS "Journal_ownerId_category_conversationId_key" ON "Journal"("ownerId", "category", "conversationId");
CREATE INDEX IF NOT EXISTS "Journal_ownerId_category_idx" ON "Journal"("ownerId", "category");

-- JournalEntry
CREATE TABLE IF NOT EXISTS "JournalEntry" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "type" "JournalEntryType" NOT NULL DEFAULT 'MANUAL_TEXT',
    "authorId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "sourceMessageId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "JournalEntry_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "JournalEntry_journalId_createdAt_idx" ON "JournalEntry"("journalId", "createdAt");

-- JournalAuditLog
CREATE TABLE IF NOT EXISTS "JournalAuditLog" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" "JournalAuditAction" NOT NULL,
    "diff" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAuditLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "JournalAuditLog"
  ADD CONSTRAINT "JournalAuditLog_journalId_fkey"
  FOREIGN KEY ("journalId") REFERENCES "Journal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JournalAuditLog"
  ADD CONSTRAINT "JournalAuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "JournalAuditLog_journalId_timestamp_idx" ON "JournalAuditLog"("journalId", "timestamp");
CREATE INDEX IF NOT EXISTS "JournalAuditLog_userId_timestamp_idx" ON "JournalAuditLog"("userId", "timestamp");

-- SessionRequest
CREATE TABLE IF NOT EXISTS "SessionRequest" (
    "id" UUID NOT NULL,
    "menteeId" UUID NOT NULL,
    "mentorId" UUID NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "hourlyRateInr" INTEGER NOT NULL DEFAULT 400,
    "status" "SessionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'SIMULATED',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "SessionRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SessionRequest"
  ADD CONSTRAINT "SessionRequest_menteeId_fkey"
  FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SessionRequest"
  ADD CONSTRAINT "SessionRequest_mentorId_fkey"
  FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "SessionRequest_mentorId_status_idx" ON "SessionRequest"("mentorId", "status");
CREATE INDEX IF NOT EXISTS "SessionRequest_menteeId_status_idx" ON "SessionRequest"("menteeId", "status");

-- Session
CREATE TABLE IF NOT EXISTS "Session" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "transcriptOptIn" BOOLEAN NOT NULL DEFAULT false,
    "transcriptUrl" TEXT,
    "durationActualSec" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Session"
  ADD CONSTRAINT "Session_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "SessionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Session_requestId_key" ON "Session"("requestId");

-- WalletTransaction
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "WalletTxnType" NOT NULL,
    "amountInr" INTEGER NOT NULL,
    "sessionId" UUID,
    "reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'SIMULATED',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WalletTransaction"
  ADD CONSTRAINT "WalletTransaction_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "WalletTransaction_userId_createdAt_idx" ON "WalletTransaction"("userId", "createdAt");

-- Subscription
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "razorpaySubscriptionId" TEXT,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Subscription"
  ADD CONSTRAINT "Subscription_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_razorpaySubscriptionId_key" ON "Subscription"("razorpaySubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_userId_status_idx" ON "Subscription"("userId", "status");

-- Review
CREATE TABLE IF NOT EXISTS "Review" (
    "id" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "subjectId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "Review_authorId_subjectId_key" ON "Review"("authorId", "subjectId");
CREATE INDEX IF NOT EXISTS "Review_subjectId_createdAt_idx" ON "Review"("subjectId", "createdAt");

-- MessageReport
CREATE TABLE IF NOT EXISTS "MessageReport" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "reporterId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" UUID,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReport_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MessageReport"
  ADD CONSTRAINT "MessageReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "MessageReport_status_createdAt_idx" ON "MessageReport"("status", "createdAt");

-- ModerationActionLog
CREATE TABLE IF NOT EXISTS "ModerationActionLog" (
    "id" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceMessageIds" UUID[] NOT NULL DEFAULT '{}',
    "action" "ModerationAction" NOT NULL,
    "bannedByAdmin" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationActionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ModerationActionLog_targetUserId_createdAt_idx" ON "ModerationActionLog"("targetUserId", "createdAt");

-- OnboardingEvent
CREATE TABLE IF NOT EXISTS "OnboardingEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "sessionId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OnboardingEvent_sessionId_createdAt_idx" ON "OnboardingEvent"("sessionId", "createdAt");
CREATE INDEX IF NOT EXISTS "OnboardingEvent_userId_createdAt_idx" ON "OnboardingEvent"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "OnboardingEvent_step_createdAt_idx" ON "OnboardingEvent"("step", "createdAt");
