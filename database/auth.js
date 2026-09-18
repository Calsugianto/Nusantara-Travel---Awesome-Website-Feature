/* ----------------------------------------------------------------------
   auth.js
   Task 10.2D — Database Integration (v2: authentication)

   Small password-hashing helper, deliberately using Node's built-in
   crypto.scrypt rather than bcrypt — bcrypt is a native module and can
   hit the same install problems better-sqlite3 did earlier in this
   project, whereas crypto is always available with zero extra
   dependencies.

   Stored format: "<salt-hex>:<hash-hex>", so each user's row only
   needs a single password_hash column.
------------------------------------------------------------------------- */

const crypto = require("crypto");

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(plainPassword, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(plainPassword, stored) {
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  const candidateHash = crypto.scryptSync(plainPassword, salt, 64);
  const storedBuffer = Buffer.from(storedHash, "hex");
  // Lengths must match before timingSafeEqual will accept the buffers.
  if (candidateHash.length !== storedBuffer.length) return false;
  return crypto.timingSafeEqual(candidateHash, storedBuffer);
}

module.exports = { hashPassword, verifyPassword };
