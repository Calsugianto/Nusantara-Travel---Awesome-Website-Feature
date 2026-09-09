# Nusantara Travel - Awesome Website Feature

## Setup
1. `npm install`
2. `node database/create.js`   (creates database/nusantara.db + tables)
3. `node database/seed.js`     (loads the 5 starter destinations)
4. `node server.js`            (starts the site at http://localhost:3000)

## Verifying the database
`node database/display.js` prints every row in `destinations` and
`enquiries` to the console — run it before and after submitting the
Contact Us form for a before/after screenshot.

## Task 10.3HD — Live Travel Package Preference Visualiser
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
  automatically restored on a return visit.
