# Nusantara Travel — Task 10.2P (Database Integration)

Uses the `sqlite3` npm package (not better-sqlite3 or sql.js). `sqlite3`
ships prebuilt native binaries for Windows/macOS/Linux, so `npm install`
just downloads a ready-made binary — no Python, no Visual Studio Build
Tools, no compiler needed.

## Setup
1. `npm install`
2. `node database/create.js`   (creates database/nusantara.db + tables)
3. `node database/seed.js`     (loads the 5 starter destinations)
4. `node server.js`            (starts the site at http://localhost:3000)

## Verifying the database
`node database/display.js` prints every row in `destinations` and
`enquiries` to the console — run it before and after submitting the
Contact Us form for a before/after screenshot.

## What changed from Task 7.2D
- destinations.html no longer has hard-coded cards — it fetches them
  from GET /api/destinations.
- contact.html's query form now POSTs to /api/enquiries and the
  submission is saved in the enquiries table (linked to a destination
  via a simple foreign key).
- about.html, packages.html, search.html, css/style.css are otherwise
  unchanged from Task 7.2D.

## If `npm install` still complains
This can happen if npm can't find a prebuilt binary for your exact
Node.js version. Two options:
1. Switch to an LTS Node version (e.g. Node 20 or 22) — these have the
   widest prebuilt binary coverage — then delete node_modules and
   package-lock.json and run `npm install` again.
2. Ask me to swap in `sql.js` instead — it's pure WebAssembly with zero
   native binaries at all, so it always installs cleanly regardless of
   Node version, at the cost of slightly different code internally
   (the site's behaviour is identical either way).

## Task 10.3HD — Live Travel Package Preference Visualiser
New page: `public/plan.html` + `public/js/plan.js` (linked from the nav
on every page as "Plan Your Trip"). Implements the feature proposed in
Task 7.3HD:
- Range sliders (trip duration, budget) and selects (travel style,
  destination type) recalculate an estimated cost breakdown in real time.
- Two `<canvas>` charts (cost breakdown stacked bar, itinerary timeline)
  redraw on every change, debounced (~80ms) so dragging a slider doesn't
  flood the canvas with redraws.
- Budget-fit feedback (Constraint-Validation-style): tells the customer
  whether their estimated total comfortably fits their stated budget.
- An `aria-live="polite"` region announces the updated total after each
  debounced recalculation, for screen-reader users.
- The chosen preference can be saved to `localStorage` and is
  automatically restored on a return visit (client-side only — this
  feature does not touch the Task 10.2P database, by design).
