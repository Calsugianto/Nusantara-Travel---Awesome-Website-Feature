/* ----------------------------------------------------------------------
   seed.js
   Task 10.2P — Database Integration

   Populates the destinations table with the five regions that were
   previously hard-coded into destinations.html in Task 7.2D. Checks
   for an existing row by "slug" before inserting, so running this
   script more than once will not create duplicate rows.

   Run with:  node database/seed.js   (or  npm run db:seed)
   Requires database/create.js to have been run first.
------------------------------------------------------------------------- */

const { openDb, run, get, close } = require("./db-helper");

const destinations = [
  {
    slug: "bali-lombok",
    name: "Bali & Lombok",
    category: "Beach & nature",
    description: "Beaches, rice terraces, and the Gili Islands just off the coast.",
    image_url: "https://loremflickr.com/400/260/bali,ricefield?lock=11"
  },
  {
    slug: "java-yogyakarta",
    name: "Java & Yogyakarta",
    category: "Culture",
    description: "Ancient temples, royal courts, and the sunrise trek up Mount Bromo.",
    image_url: "https://loremflickr.com/400/260/borobudur,temple?lock=12"
  },
  {
    slug: "raja-ampat-papua",
    name: "Raja Ampat & Papua",
    category: "Nature",
    description: "Remote islands and some of the richest coral reefs on Earth.",
    image_url: "https://loremflickr.com/400/260/rajaampat,islands?lock=13"
  },
  {
    slug: "sumatera",
    name: "Sumatera",
    category: "Adventure",
    description: "Volcanic Lake Toba, orangutan jungle treks, and Batak highland villages.",
    image_url: "https://loremflickr.com/400/260/laketoba,sumatra?lock=14"
  },
  {
    slug: "kalimantan",
    name: "Kalimantan",
    category: "Nature",
    description: "Borneo rainforest river cruises, wild orangutans, and Dayak longhouse culture.",
    image_url: "https://loremflickr.com/400/260/borneo,rainforest?lock=15"
  }
];

(async () => {
  const db = openDb();

  let inserted = 0;
  for (const d of destinations) {
    const existing = await get(db, "SELECT id FROM destinations WHERE slug = ?", [d.slug]);
    if (existing) continue;

    await run(
      db,
      `INSERT INTO destinations (slug, name, category, description, image_url)
       VALUES (?, ?, ?, ?, ?)`,
      [d.slug, d.name, d.category, d.description, d.image_url]
    );
    inserted += 1;
  }

  console.log(`Seed complete: ${inserted} new destination row(s) inserted (existing rows left untouched).`);
  await close(db);
})();
