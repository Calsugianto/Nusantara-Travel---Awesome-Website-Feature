/* ----------------------------------------------------------------------
   server.js
   Task 10.2D — Database Integration (v2: auth + admin CRUD)

   Adds session-based authentication on top of the v1 database
   integration, so that adding, editing or deleting destinations and
   packages — and viewing the enquiries list — all require an
   authenticated admin. Public visitors can still browse destinations
   and packages, and can still submit a Contact Us enquiry.

     Auth
       POST   /api/login              -> log in, starts a session
       POST   /api/logout             -> ends the session
       GET    /api/session            -> current logged-in user, or null

     Destinations (public GET, admin-only write)
       GET    /api/destinations       -> list (supports ?region, ?search, ?sort)
       POST   /api/destinations       -> create                [admin only]
       PUT    /api/destinations/:id   -> update                [admin only]
       DELETE /api/destinations/:id   -> delete                [admin only]

     Packages (public GET, admin-only write)
       GET    /api/packages           -> list (supports ?type, ?search, ?sort, ?page, ?pageSize)
       POST   /api/packages           -> create                [admin only]
       PUT    /api/packages/:id       -> update                [admin only]
       DELETE /api/packages/:id       -> delete                [admin only]

     Enquiries (public POST, admin-only GET/manage)
       POST   /api/enquiries          -> save a Contact Us submission
       GET    /api/enquiries          -> list                  [admin only]
       PUT    /api/enquiries/:id      -> update status         [admin only]
       DELETE /api/enquiries/:id      -> delete                [admin only]

     Admin page
       GET    /admin                  -> serves views/admin.html [admin only]
                                          (kept OUT of /public so it can
                                          never be reached by requesting
                                          the raw file — see Design
                                          Rationale, "why /admin is a
                                          route and not a static file")

   Start with:  node server.js   (or  npm start)
   Then visit:  http://localhost:3000
   Admin login: username "admin", password "admin123" (seeded — change
   it before any real deployment).
------------------------------------------------------------------------- */

const path = require("path");
const express = require("express");
const session = require("express-session");
const { openDb, run, all, get } = require("./database/db-helper");
const { hashPassword, verifyPassword } = require("./database/auth");

const app = express();
const PORT = 3000;
const db = openDb(); // one shared connection for the life of the server
run(db, "PRAGMA foreign_keys = ON").catch((err) => console.error("Could not enable foreign keys:", err));

app.use(express.json());
app.use(session({
  secret: "nusantara-travel-dev-secret", // fine for a unit demo; use an env var in real deployments
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}));
app.use(express.static(path.join(__dirname, "public")));

/* ============================================================
   Small shared helpers
   ============================================================ */

const MAX_PHONE_DIGITS = 10;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PACKAGE_TYPES = ["beach", "adventure", "culture", "nature"];

/** Trims a string and collapses it to null if empty — used so optional
 *  fields never get stored as an empty string. */
function cleanText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Turns a name into a URL/DB-safe slug, e.g. "Bali & Lombok" -> "bali-lombok". */
function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Middleware: blocks the request unless an admin is logged in. */
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(401).json({ ok: false, error: "You must be logged in as an admin to do that." });
  }
  next();
}

/** Recognises SQLite's foreign-key/uniqueness failures and turns them
 *  into a message a visitor can actually understand, instead of a raw
 *  driver error. Falls back to a generic message for anything else. */
function friendlyDbError(err) {
  if (!err || !err.message) return "Something went wrong talking to the database.";
  if (err.message.includes("FOREIGN KEY constraint failed")) {
    return "This record can't be deleted because other records (e.g. enquiries) still refer to it.";
  }
  if (err.message.includes("UNIQUE constraint failed")) {
    return "That name is already in use — please choose a different one.";
  }
  return "Something went wrong talking to the database. Please try again.";
}

/* ============================================================
   Auth
   ============================================================ */

app.post("/api/login", async (req, res) => {
  const username = cleanText(req.body?.username);
  const password = req.body?.password;

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Username and password are both required." });
  }

  try {
    const user = await get(db, "SELECT * FROM users WHERE username = ?", [username]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: "Incorrect username or password." });
    }

    req.session.user = { id: user.id, username: user.username, role: user.role };
    res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/session", (req, res) => {
  res.json({ ok: true, user: req.session.user || null });
});

/* ============================================================
   Destinations
   ============================================================ */

app.get("/api/destinations", async (req, res) => {
  try {
    const { region, search, sort } = req.query;
    const clauses = [];
    const params = [];

    if (region && region !== "all") { clauses.push("slug = ?"); params.push(region); }
    if (search) { clauses.push("(name LIKE ? OR description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = sort === "name" ? "ORDER BY name ASC" : "ORDER BY id ASC";

    const rows = await all(db, `SELECT * FROM destinations ${where} ${orderBy}`, params);
    res.json({ ok: true, count: rows.length, destinations: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

function validateDestination(body) {
  const errors = {};
  const name = cleanText(body.name);
  const category = cleanText(body.category);
  const description = cleanText(body.description);
  const image_url = cleanText(body.image_url);

  if (!name) errors.name = "Name is required.";
  if (!category) errors.category = "Category is required.";
  if (!description) errors.description = "Description is required.";
  if (!image_url) errors.image_url = "Image URL is required.";
  else if (!/^https?:\/\//.test(image_url)) errors.image_url = "Image URL must start with http:// or https://";

  return { errors, cleaned: { name, category, description, image_url } };
}

app.post("/api/destinations", requireAdmin, async (req, res) => {
  const { errors, cleaned } = validateDestination(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  try {
    const slug = slugify(cleaned.name);
    const existing = await get(db, "SELECT id FROM destinations WHERE slug = ?", [slug]);
    if (existing) return res.status(409).json({ ok: false, errors: { name: "A destination with this name already exists." } });

    const { lastID } = await run(
      db,
      `INSERT INTO destinations (slug, name, category, description, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [slug, cleaned.name, cleaned.category, cleaned.description, cleaned.image_url, req.session.user.id]
    );
    res.status(201).json({ ok: true, id: lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.put("/api/destinations/:id", requireAdmin, async (req, res) => {
  const { errors, cleaned } = validateDestination(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  try {
    const result = await run(
      db,
      `UPDATE destinations SET name = ?, category = ?, description = ?, image_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [cleaned.name, cleaned.category, cleaned.description, cleaned.image_url, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Destination not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.delete("/api/destinations/:id", requireAdmin, async (req, res) => {
  try {
    const result = await run(db, "DELETE FROM destinations WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Destination not found." });
    res.json({ ok: true });
  } catch (err) {
    // This is exactly the case the schema's plain (no ON DELETE) foreign
    // key on enquiries.destination_id is designed to catch.
    console.error(err);
    res.status(409).json({ ok: false, error: friendlyDbError(err) });
  }
});

/* ============================================================
   Packages
   ============================================================ */

app.get("/api/packages", async (req, res) => {
  try {
    const { type, search, sort, page, pageSize } = req.query;
    const clauses = [];
    const params = [];

    if (type && type !== "all") { clauses.push("type = ?"); params.push(type); }
    if (search) { clauses.push("(name LIKE ? OR description LIKE ?)"); params.push(`%${search}%`, `%${search}%`); }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = {
      price_asc: "ORDER BY price_from ASC",
      price_desc: "ORDER BY price_from DESC",
      newest: "ORDER BY created_at DESC"
    }[sort] || "ORDER BY id ASC";

    const total = (await get(db, `SELECT COUNT(*) AS count FROM packages ${where}`, params)).count;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const size = Math.min(Math.max(parseInt(pageSize, 10) || total || 1, 1), 50);
    const offset = (pageNum - 1) * size;

    const rows = await all(db, `SELECT * FROM packages ${where} ${orderBy} LIMIT ? OFFSET ?`, [...params, size, offset]);
    res.json({ ok: true, total, page: pageNum, pageSize: size, totalPages: Math.max(Math.ceil(total / size), 1), packages: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

function validatePackage(body) {
  const errors = {};
  const name = cleanText(body.name);
  const type = cleanText(body.type);
  const description = cleanText(body.description);
  const image_url = cleanText(body.image_url);
  const price_from = Number(body.price_from);
  const duration_days = Number(body.duration_days);

  if (!name) errors.name = "Name is required.";
  if (!type || !PACKAGE_TYPES.includes(type)) errors.type = `Type must be one of: ${PACKAGE_TYPES.join(", ")}.`;
  if (!description) errors.description = "Description is required.";
  if (!image_url) errors.image_url = "Image URL is required.";
  else if (!/^https?:\/\//.test(image_url)) errors.image_url = "Image URL must start with http:// or https://";
  if (!Number.isFinite(price_from) || price_from < 0) errors.price_from = "Price must be a number of 0 or more.";
  if (!Number.isInteger(duration_days) || duration_days < 1) errors.duration_days = "Duration must be a whole number of at least 1 day.";

  return { errors, cleaned: { name, type, description, image_url, price_from, duration_days } };
}

app.post("/api/packages", requireAdmin, async (req, res) => {
  const { errors, cleaned } = validatePackage(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  try {
    const slug = `${slugify(cleaned.name)}-${cleaned.duration_days}-days`;
    const existing = await get(db, "SELECT id FROM packages WHERE slug = ?", [slug]);
    if (existing) return res.status(409).json({ ok: false, errors: { name: "A package with this name and duration already exists." } });

    const { lastID } = await run(
      db,
      `INSERT INTO packages (slug, name, type, price_from, duration_days, description, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, cleaned.name, cleaned.type, cleaned.price_from, cleaned.duration_days, cleaned.description, cleaned.image_url, req.session.user.id]
    );
    res.status(201).json({ ok: true, id: lastID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.put("/api/packages/:id", requireAdmin, async (req, res) => {
  const { errors, cleaned } = validatePackage(req.body || {});
  if (Object.keys(errors).length) return res.status(400).json({ ok: false, errors });

  try {
    const result = await run(
      db,
      `UPDATE packages SET name = ?, type = ?, price_from = ?, duration_days = ?, description = ?, image_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [cleaned.name, cleaned.type, cleaned.price_from, cleaned.duration_days, cleaned.description, cleaned.image_url, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Package not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.delete("/api/packages/:id", requireAdmin, async (req, res) => {
  try {
    const result = await run(db, "DELETE FROM packages WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Package not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(409).json({ ok: false, error: friendlyDbError(err) });
  }
});

/* ============================================================
   Enquiries
   ============================================================ */

app.get("/api/enquiries", requireAdmin, async (req, res) => {
  try {
    const { status, search, sort, page, pageSize } = req.query;
    const clauses = [];
    const params = [];

    if (status && status !== "all") { clauses.push("enquiries.status = ?"); params.push(status); }
    if (search) {
      clauses.push("(enquiries.name LIKE ? OR enquiries.email LIKE ? OR enquiries.message LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const orderBy = sort === "oldest" ? "ORDER BY enquiries.id ASC" : "ORDER BY enquiries.id DESC";

    const total = (await get(db, `SELECT COUNT(*) AS count FROM enquiries ${where}`, params)).count;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const size = Math.min(Math.max(parseInt(pageSize, 10) || 5, 1), 50);
    const offset = (pageNum - 1) * size;

    const rows = await all(db, `
      SELECT enquiries.*, destinations.name AS destination_name
      FROM enquiries
      LEFT JOIN destinations ON destinations.id = enquiries.destination_id
      ${where}
      ${orderBy}
      LIMIT ? OFFSET ?
    `, [...params, size, offset]);

    res.json({ ok: true, total, page: pageNum, pageSize: size, totalPages: Math.max(Math.ceil(total / size), 1), enquiries: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.post("/api/enquiries", async (req, res) => {
  const { name, email, phone, message, destinationSlug } = req.body || {};

  const errors = {};
  if (!name || !name.trim()) errors.name = "Please enter your name.";
  if (!email || !EMAIL_PATTERN.test(email.trim())) errors.email = "Please enter a valid email address.";
  if (phone && phone.trim() !== "") {
    if (!/^[0-9]+$/.test(phone.trim())) errors.phone = "Phone number must contain digits only.";
    else if (phone.trim().length > MAX_PHONE_DIGITS) errors.phone = `Phone number must be at most ${MAX_PHONE_DIGITS} digits.`;
  }
  if (!message || !message.trim()) errors.message = "Please enter your query.";
  else if (message.trim().length > 500) errors.message = "Please keep your query under 500 characters.";

  if (Object.keys(errors).length > 0) return res.status(400).json({ ok: false, errors });

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
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.put("/api/enquiries/:id", requireAdmin, async (req, res) => {
  const status = cleanText(req.body?.status);
  if (!["pending", "responded"].includes(status)) {
    return res.status(400).json({ ok: false, errors: { status: "Status must be 'pending' or 'responded'." } });
  }

  try {
    const result = await run(
      db,
      "UPDATE enquiries SET status = ?, updated_at = datetime('now') WHERE id = ?",
      [status, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Enquiry not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

app.delete("/api/enquiries/:id", requireAdmin, async (req, res) => {
  try {
    const result = await run(db, "DELETE FROM enquiries WHERE id = ?", [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ ok: false, error: "Enquiry not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: friendlyDbError(err) });
  }
});

/* ============================================================
   Admin page — served from a protected route, NOT /public
   ============================================================ */

app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.redirect("/login.html");
  }
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

app.listen(PORT, () => {
  console.log(`Nusantara Travel server running at http://localhost:${PORT}`);
});
