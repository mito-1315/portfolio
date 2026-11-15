-- CreateEnum
CREATE TYPE "JournalKind" AS ENUM ('BUG', 'DECISION', 'EXPERIMENT', 'LEARNED');

-- AlterEnum
ALTER TYPE "RecommendationKind" ADD VALUE 'OTHER';

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" SERIAL NOT NULL,
    "project" TEXT NOT NULL,
    "kind" "JournalKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "entryDate" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);
