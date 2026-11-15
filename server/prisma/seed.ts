import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import "dotenv/config";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? "" }),
});

/**
 * Starting content only. Posters are left empty on purpose: add `posterUrl`
 * through the admin API (or edit this list) with images you have the files for.
 * Years and directors are public film facts.
 */
const movies = [
  { title: "OK Kanmani", year: 2015, director: "Mani Ratnam" },
  { title: "Alaipayuthey", year: 2000, director: "Mani Ratnam" },
  { title: "Thuppakki", year: 2012, director: "A. R. Murugadoss" },
  { title: "Oh My Kadavule", year: 2020, director: "Ashwath Marimuthu" },
  { title: "Eeram", year: 2009, director: "Arivazhagan" },
];

async function main() {
  await prisma.playlist.upsert({
    where: { slug: "favourites" },
    update: {},
    create: { slug: "favourites", name: "Favourites", description: "Add tracks from the admin API." },
  });

  for (const [index, movie] of movies.entries()) {
    const exists = await prisma.movie.findFirst({ where: { title: movie.title } });
    if (!exists) await prisma.movie.create({ data: { ...movie, sortOrder: index } });
  }

  // Editable site text.
  const settings = [
    { key: "valorant_tag", value: "aintNoMito#Love" },
    { key: "github_url", value: "https://github.com/mito-1315" },
  ];
  for (const s of settings) {
    await prisma.siteSetting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
}

main().finally(() => prisma.$disconnect());
