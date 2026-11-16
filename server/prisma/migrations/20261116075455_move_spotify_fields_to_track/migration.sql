/*
  Warnings:

  - You are about to drop the column `album` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `durationMs` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `releaseDate` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyId` on the `Playlist` table. All the data in the column will be lost.
  - You are about to drop the column `spotifyUrl` on the `Playlist` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Playlist" DROP COLUMN "album",
DROP COLUMN "durationMs",
DROP COLUMN "releaseDate",
DROP COLUMN "spotifyId",
DROP COLUMN "spotifyUrl";

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "album" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "releaseDate" TEXT,
ADD COLUMN     "spotifyId" TEXT,
ADD COLUMN     "spotifyUrl" TEXT;
