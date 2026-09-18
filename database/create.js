/* ----------------------------------------------------------------------
   create.js
   Task 10.2D — Database Integration (v2)

   Creates database/nusantara.db and defines four related tables:

   1. users         — admin/staff accounts. Only an authenticated admin
                       can create, edit or delete destinations and
                       packages, or view the enquiries list.
   2. destinations   — as before, now with created_by (which admin
                       added it) and enforced uniqueness/required
                       fields beyond the original slug constraint.
   3. packages       — NEW: the tour packages shown on packages.html
                       used to be hard-coded HTML; they are now real
                       rows an admin can add, edit or delete, with the
                       same created_by relationship as destinations.
   4. enquiries      — as before, now with a constrained "status"
                       column (pending/responded) so admins can triage
                       them from the dashboard, and an updated_at
                       column to track that change.

   Relationships (the "multiple related tables" requirement):
     destinations.created_by -> users.id
     packages.created_by     -> users.id
     enquiries.destination_id -> destinations.id   (unchanged from v1)

   Run with:  node database/create.js   (or  npm run db:create)
   Safe to re-run — every statement uses IF NOT EXISTS.
------------------------------------------------------------------------- */

const { DB_PATH, openDb, run, close } = require("./db-helper");

(async () => {
  const db = openDb();

  // Off by default in sqlite3 — must be enabled per connection so the
  // FOREIGN KEY constraints below are actually enforced (this is what
  // lets us give a friendly error instead of silently orphaning rows
  // when someone tries to delete a destination that still has
  // enquiries or packages pointing at it).
  await run(db, "PRAGMA foreign_keys = ON");

  await run(db, `
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS destinations (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      slug        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      category    TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url   TEXT NOT NULL,
      created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS packages (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      slug          TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL CHECK (type IN ('beach', 'adventure', 'culture', 'nature')),
      price_from    INTEGER NOT NULL CHECK (price_from >= 0),
      duration_days INTEGER NOT NULL CHECK (duration_days >= 1),
      description   TEXT NOT NULL,
      image_url     TEXT NOT NULL,
      created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await run(db, `
    CREATE TABLE IF NOT EXISTS enquiries (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      name           TEXT NOT NULL,
      email          TEXT NOT NULL,
      phone          TEXT,
      message        TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'responded')),
      destination_id INTEGER REFERENCES destinations(id),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`Database ready at ${DB_PATH}`);
  console.log("Tables created (or already existed): users, destinations, packages, enquiries");
  await close(db);
})();
