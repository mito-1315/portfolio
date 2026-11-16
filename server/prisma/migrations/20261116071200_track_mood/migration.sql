-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('Calm', 'Focused', 'Energetic', 'Nostalgic', 'Curious');

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "description" TEXT,
ADD COLUMN     "mood" "Mood" NOT NULL DEFAULT 'Calm';
