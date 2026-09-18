/* ----------------------------------------------------------------------
   display.js
   Task 10.2D — Database Integration (v2)

   Prints every row currently in users (username/role only — never the
   password hash), destinations, packages and enquiries. Used for
   before/after screenshots of database contents.

   Run with:  node database/display.js   (or  npm run db:display)
------------------------------------------------------------------------- */

const fs = require("fs");
const { DB_PATH, openDb, all, close } = require("./db-helper");

function printTable(title, rows) {
  console.log(`\n=== ${title} (${rows.length} row${rows.length === 1 ? "" : "s"}) ===`);
  if (rows.length === 0) {
    console.log("  (no rows yet)");
    return;
  }
  console.table(rows);
}

(async () => {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No database found at ${DB_PATH}`);
    console.error("Have you run `node database/create.js` yet?");
    return;
  }

  const db = openDb();

  printTable("users", await all(db, "SELECT id, username, email, role, created_at FROM users ORDER BY id"));
  printTable("destinations", await all(db, "SELECT * FROM destinations ORDER BY id"));
  printTable("packages", await all(db, "SELECT * FROM packages ORDER BY id"));
  printTable("enquiries", await all(db, `
    SELECT enquiries.id, enquiries.name, enquiries.email, enquiries.phone, enquiries.status,
           destinations.name AS destination, enquiries.created_at
    FROM enquiries
    LEFT JOIN destinations ON destinations.id = enquiries.destination_id
    ORDER BY enquiries.id
  `));

  await close(db);
})();
