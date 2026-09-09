/* ----------------------------------------------------------------------
   display.js
   Task 10.2P — Database Integration

   A small read-only reporting script: prints every row currently in
   destinations and enquiries to the console. Used to take "before" and
   "after" screenshots of the database contents (e.g. run once before
   submitting the Contact Us form on the site, and once after, to show
   the new enquiry row landing in the table).

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

  const destinations = await all(db, "SELECT * FROM destinations ORDER BY id");
  printTable("destinations", destinations);

  const enquiries = await all(db, `
    SELECT enquiries.id, enquiries.name, enquiries.email, enquiries.phone,
           enquiries.message, destinations.name AS destination, enquiries.created_at
    FROM enquiries
    LEFT JOIN destinations ON destinations.id = enquiries.destination_id
    ORDER BY enquiries.id
  `);
  printTable("enquiries", enquiries);

  await close(db);
})();
