/* ----------------------------------------------------------------------
   create.js
   Task 10.2P — Database Integration

   Creates database/nusantara.db (a single embedded SQLite file) and
   defines two simple, related tables:

   1. destinations  — the five regions shown on destinations.html.
                       Read by the website (GET /api/destinations) so the
                       page is no longer built from hard-coded HTML.

   2. enquiries      — one row per submission of the "Send us a query"
                       form on contact.html. Written by the website
                       (POST /api/enquiries) whenever a visitor sends a
                       query, and links back to a destination with a
                       simple foreign key (destination_id), so the two
                       tables have a basic one-to-many relationship.

   Run with:  node database/create.js   (or  npm run db:create)
   Safe to re-run — uses CREATE TABLE IF NOT EXISTS, so it never wipes
   existing data.
------------------------------------------------------------------------- */

const { DB_PATH, openDb, run, close } = require("./db-helper");

(async () => {
  const db = openDb();

  await run(db, `
    CREATE TABLE IF NOT EXISTS destinations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url   TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS enquiries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL,
      phone          TEXT,
      message        TEXT NOT NULL,
      destination_id INTEGER,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (destination_id) REFERENCES destinations(id)
    );
  `);

  console.log(`Database ready at ${DB_PATH}`);
  console.log("Tables created (or already existed): destinations, enquiries");
  await close(db);
})();
