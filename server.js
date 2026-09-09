/* ----------------------------------------------------------------------
   server.js
   Task 10.2P — Database Integration

   Serves the existing Nusantara Travel site as static files, and adds
   two small JSON API routes backed by database/nusantara.db (via the
   sqlite3 package — see database/db-helper.js):

     GET  /api/destinations           -> list all destinations
     GET  /api/destinations?region=X  -> filter by region slug
     POST /api/enquiries              -> save a Contact Us form submission
     GET  /api/enquiries              -> list saved enquiries (used to
                                          demonstrate the before/after
                                          write, and by display.js's
                                          console output)

   Start with:  node server.js   (or  npm start)
   Then visit:  http://localhost:3000
------------------------------------------------------------------------- */

const path = require("path");
const express = require("express");
const { openDb, run, all, get } = require("./database/db-helper");

const app = express();
const PORT = 3000;
const db = openDb(); // one shared connection for the life of the server

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const MAX_PHONE_DIGITS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ---------------- GET /api/destinations ---------------- */
app.get("/api/destinations", async (req, res) => {
  try {
    const { region } = req.query;
    const rows = region
      ? await all(db, "SELECT * FROM destinations WHERE slug = ? ORDER BY id", [region])
      : await all(db, "SELECT * FROM destinations ORDER BY id");
    res.json({ ok: true, count: rows.length, destinations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Could not read destinations from the database." });
  }
});

/* ---------------- GET /api/enquiries (for verification / display) ---------------- */
app.get("/api/enquiries", async (req, res) => {
  try {
    const rows = await all(db, `
      SELECT enquiries.id, enquiries.name, enquiries.email, enquiries.phone,
             enquiries.message, destinations.name AS destination, enquiries.created_at
      FROM enquiries
      LEFT JOIN destinations ON destinations.id = enquiries.destination_id
      ORDER BY enquiries.id DESC
    `);
    res.json({ ok: true, count: rows.length, enquiries: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Could not read enquiries from the database." });
  }
});

/* ---------------- POST /api/enquiries ---------------- */
app.post("/api/enquiries", async (req, res) => {
  const { name, email, phone, message, destinationSlug } = req.body || {};

  // Server-side validation mirrors the client-side rules already used
  // by js/script.js, so a request can never bypass them.
  const errors = {};
  if (!name || !name.trim()) errors.name = "Please enter your name.";
  if (!email || !EMAIL_PATTERN.test(email.trim())) errors.email = "Please enter a valid email address.";
  if (phone && phone.trim() !== "") {
    if (!/^[0-9]+$/.test(phone.trim())) errors.phone = "Phone number must contain digits only.";
    else if (phone.trim().length > MAX_PHONE_DIGITS) errors.phone = `Phone number must be at most ${MAX_PHONE_DIGITS} digits.`;
  }
  if (!message || !message.trim()) errors.message = "Please enter your query.";
  else if (message.trim().length > 500) errors.message = "Please keep your query under 500 characters.";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ ok: false, errors });
  }

  try {
    let destinationId = null;
    if (destinationSlug) {
      const destination = await get(db, "SELECT id FROM destinations WHERE slug = ?", [destinationSlug]);
      if (destination) destinationId = destination.id;
    }

    const { lastID } = await run(
      db,
      `INSERT INTO enquiries (name, email, phone, message, destination_id) VALUES (?, ?, ?, ?, ?)`,
      [name.trim(), email.trim(), phone ? phone.trim() : null, message.trim(), destinationId]
    );

    res.status(201).json({ ok: true, id: lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: "Something went wrong saving your query. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Nusantara Travel server running at http://localhost:${PORT}`);
});
