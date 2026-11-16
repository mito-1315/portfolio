/*
  Warnings:

  - You are about to drop the `Melody` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "Melody";

-- CreateTable
CREATE TABLE "QuizCollection" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "instrument" TEXT NOT NULL DEFAULT 'acoustic_piano',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuizSong" (
    "id" SERIAL NOT NULL,
    "collectionId" INTEGER NOT NULL,
    "songId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "movie" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuizSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuizCollection_key_key" ON "QuizCollection"("key");

-- CreateIndex
CREATE UNIQUE INDEX "QuizSong_collectionId_songId_key" ON "QuizSong"("collectionId", "songId");

-- AddForeignKey
ALTER TABLE "QuizSong" ADD CONSTRAINT "QuizSong_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "QuizCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
