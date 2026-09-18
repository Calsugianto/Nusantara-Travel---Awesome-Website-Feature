/* ----------------------------------------------------------------------
   seed.js
   Task 10.2D — Database Integration (v2)

   Seeds:
   - one admin account (username: admin, password: admin123) — change
     this password before deploying anywhere real; it exists purely so
     the demonstration has a working login out of the box
   - the five destinations (unchanged from v1)
   - the ten tour packages that were previously hard-coded directly
     into packages.html, now real rows an admin can edit or delete

   Every insert checks for an existing row first (by slug/username), so
   running this script more than once never creates duplicates.

   Run with:  node database/seed.js   (or  npm run db:seed)
   Requires database/create.js to have been run first.
------------------------------------------------------------------------- */

const { openDb, run, get, close } = require("./db-helper");
const { hashPassword } = require("./auth");

const ADMIN_USERNAME = "admin";
const ADMIN_EMAIL = "admin@nusantaratravel.com";
const ADMIN_PASSWORD = "admin123";

const destinations = [
  { slug: "bali-lombok", name: "Bali & Lombok", category: "Beach & nature",
    description: "Beaches, rice terraces, and the Gili Islands just off the coast.",
    image_url: "https://loremflickr.com/400/260/bali,ricefield?lock=11" },
  { slug: "java-yogyakarta", name: "Java & Yogyakarta", category: "Culture",
    description: "Ancient temples, royal courts, and the sunrise trek up Mount Bromo.",
    image_url: "https://loremflickr.com/400/260/borobudur,temple?lock=12" },
  { slug: "raja-ampat-papua", name: "Raja Ampat & Papua", category: "Nature",
    description: "Remote islands and some of the richest coral reefs on Earth.",
    image_url: "https://loremflickr.com/400/260/rajaampat,islands?lock=13" },
  { slug: "sumatera", name: "Sumatera", category: "Adventure",
    description: "Volcanic Lake Toba, orangutan jungle treks, and Batak highland villages.",
    image_url: "https://loremflickr.com/400/260/laketoba,sumatra?lock=14" },
  { slug: "kalimantan", name: "Kalimantan", category: "Nature",
    description: "Borneo rainforest river cruises, wild orangutans, and Dayak longhouse culture.",
    image_url: "https://loremflickr.com/400/260/borneo,rainforest?lock=15" }
];

const packages = [
  { slug: "bali-gili-islands-6-days", name: "Bali & Gili Islands", type: "beach", price_from: 520, duration_days: 6,
    description: "Flights, hotel, and one boat day trip included.", image_url: "https://loremflickr.com/400/240/bali,beach?lock=21" },
  { slug: "bromo-ijen-trekking-4-days", name: "Bromo & Ijen trekking", type: "adventure", price_from: 380, duration_days: 4,
    description: "Guide, permits, and transport included.", image_url: "https://loremflickr.com/400/240/bromo,volcano?lock=22" },
  { slug: "java-yogyakarta-culture-7-days", name: "Java & Yogyakarta culture", type: "culture", price_from: 650, duration_days: 7,
    description: "Borobudur, Prambanan, and a batik workshop included.", image_url: "https://loremflickr.com/400/240/borobudur,yogyakarta?lock=23" },
  { slug: "nusa-penida-day-trip-1-day", name: "Nusa Penida day trip", type: "beach", price_from: 95, duration_days: 1,
    description: "Fast-boat transfer, cliff viewpoints, and snorkelling included.", image_url: "https://loremflickr.com/400/240/nusapenida,cliff?lock=24" },
  { slug: "mount-rinjani-trek-3-days", name: "Mount Rinjani trek, Lombok", type: "adventure", price_from: 410, duration_days: 3,
    description: "Crater-rim camping and guided summit push included.", image_url: "https://loremflickr.com/400/240/rinjani,lombok?lock=25" },
  { slug: "komodo-labuan-bajo-4-days", name: "Komodo & Labuan Bajo", type: "adventure", price_from: 560, duration_days: 4,
    description: "Komodo dragon trek and Pink Beach snorkelling included.", image_url: "https://loremflickr.com/400/240/komodo,dragon?lock=26" },
  { slug: "lake-toba-samosir-5-days", name: "Lake Toba & Samosir Island", type: "culture", price_from: 470, duration_days: 5,
    description: "Batak villages, traditional houses, and lake-view stays included.", image_url: "https://loremflickr.com/400/240/laketoba,samosir?lock=27" },
  { slug: "bukit-lawang-orangutan-3-days", name: "Bukit Lawang orangutan trek, Sumatera", type: "nature", price_from: 340, duration_days: 3,
    description: "Guided rainforest trek to see wild orangutans included.", image_url: "https://loremflickr.com/400/240/orangutan,sumatra?lock=28" },
  { slug: "tanjung-puting-river-cruise-4-days", name: "Tanjung Puting river cruise, Kalimantan", type: "nature", price_from: 590, duration_days: 4,
    description: "Klotok houseboat cruise through the orangutan reserve included.", image_url: "https://loremflickr.com/400/240/borneo,river?lock=29" },
  { slug: "kalimantan-river-longhouse-5-days", name: "Kalimantan river & longhouse culture", type: "culture", price_from: 530, duration_days: 5,
    description: "Dayak longhouse stay and traditional river travel included.", image_url: "https://loremflickr.com/400/240/dayak,longhouse?lock=30" }
];

(async () => {
  const db = openDb();
  await run(db, "PRAGMA foreign_keys = ON");

  // ---- Admin user ----
  let admin = await get(db, "SELECT id FROM users WHERE username = ?", [ADMIN_USERNAME]);
  if (!admin) {
    const { lastID } = await run(
      db,
      "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, 'admin')",
      [ADMIN_USERNAME, ADMIN_EMAIL, hashPassword(ADMIN_PASSWORD)]
    );
    admin = { id: lastID };
    console.log(`Created admin user '${ADMIN_USERNAME}' (password: ${ADMIN_PASSWORD}) — change this before any real deployment.`);
  } else {
    console.log(`Admin user '${ADMIN_USERNAME}' already exists — left untouched.`);
  }

  // ---- Destinations ----
  let destinationsInserted = 0;
  for (const d of destinations) {
    const existing = await get(db, "SELECT id FROM destinations WHERE slug = ?", [d.slug]);
    if (existing) continue;
    await run(
      db,
      `INSERT INTO destinations (slug, name, category, description, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [d.slug, d.name, d.category, d.description, d.image_url, admin.id]
    );
    destinationsInserted += 1;
  }

  // ---- Packages ----
  let packagesInserted = 0;
  for (const p of packages) {
    const existing = await get(db, "SELECT id FROM packages WHERE slug = ?", [p.slug]);
    if (existing) continue;
    await run(
      db,
      `INSERT INTO packages (slug, name, type, price_from, duration_days, description, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [p.slug, p.name, p.type, p.price_from, p.duration_days, p.description, p.image_url, admin.id]
    );
    packagesInserted += 1;
  }

  console.log(`Seed complete: ${destinationsInserted} new destination(s), ${packagesInserted} new package(s) inserted.`);
  await close(db);
})();
