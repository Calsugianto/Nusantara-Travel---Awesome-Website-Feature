/* ----------------------------------------------------------------------
   db-helper.js
   Task 10.2P — Database Integration

   Shared helper used by create.js, seed.js, display.js and server.js.

   Uses the `sqlite3` npm package. Unlike better-sqlite3, `sqlite3`
   ships prebuilt native binaries for the common platforms (Windows,
   macOS, Linux) via prebuild-install, so `npm install` downloads a
   ready-made binary instead of compiling one — no Python, no Visual
   Studio Build Tools, no node-gyp needed on a normal machine.

   `sqlite3`'s API is callback-based, so this file wraps the three
   calls this project needs (run / get / all) in small Promise
   wrappers, which lets the rest of the project use plain async/await.
   The database writes straight to nusantara.db on disk as soon as
   each statement runs — there's no separate "save" step to remember.
------------------------------------------------------------------------- */

const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const DB_PATH = path.join(__dirname, "nusantara.db");

function openDb() {
  return new sqlite3.Database(DB_PATH);
}

/** Runs an INSERT/UPDATE/DELETE/CREATE statement. Resolves with { lastID, changes }. */
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/** Runs a SELECT and resolves with all matching rows. */
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

/** Runs a SELECT and resolves with the first matching row (or undefined). */
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => (err ? reject(err) : resolve()));
  });
}

module.exports = { DB_PATH, openDb, run, all, get, close };
