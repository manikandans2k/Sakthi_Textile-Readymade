const bcrypt = require('bcryptjs');

/**
 * Hashes a plaintext password with a salt round count of 10.
 * @param {string} password - Cleartext password.
 * @returns {Promise<string>} The hashed password string.
 */
async function hashPassword(password) {
  if (!password) {
    throw new Error('Password string is required for hashing.');
  }
  return await bcrypt.hash(password, 10);
}

/**
 * Compares a cleartext password with a hashed password string.
 * @param {string} password - Cleartext password entry.
 * @param {string} hashedPassword - Hashed password to match against.
 * @returns {Promise<boolean>} Match success state.
 */
async function comparePassword(password, hashedPassword) {
  if (!password || !hashedPassword) {
    return false;
  }
  return await bcrypt.compare(password, hashedPassword);
}

module.exports = {
  hashPassword,
  comparePassword
};
