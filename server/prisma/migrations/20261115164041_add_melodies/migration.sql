-- CreateTable
CREATE TABLE "Melody" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "composer" TEXT NOT NULL,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "notes" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Melody_pkey" PRIMARY KEY ("id")
);
