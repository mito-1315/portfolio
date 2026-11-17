import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { putToR2, r2PublicUrl } from "../src/uploads.js";

/** One-off: copies the starting files in seed/uploads to the R2 bucket, skipping any already there. */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "seed", "uploads");

async function main() {
  if (!r2PublicUrl) throw new Error("Set the R2_* variables first.");
  let added = 0;
  let total = 0;
  for (const folder of ["audio", "images"]) {
    const names = await readdir(path.join(root, folder)).catch(() => []);
    for (const name of names) {
      total++;
      if (await putToR2(`${folder}/${name}`, await readFile(path.join(root, folder, name)), true)) added++;
    }
  }
  console.log(`${added} uploaded, ${total - added} already there (${total} files).`);
}

main();
