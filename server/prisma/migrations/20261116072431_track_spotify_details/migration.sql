-- AlterTable
ALTER TABLE "Playlist" ADD COLUMN     "album" TEXT,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "releaseDate" TEXT,
ADD COLUMN     "spotifyId" TEXT,
ADD COLUMN     "spotifyUrl" TEXT;
