const jwt = require('jsonwebtoken');
require('dotenv').config();

const controllerSecret = process.env.JWT_SECRET || 'super_secret_textile_pos_key_2026';
console.log('JWT_SECRET loaded:', controllerSecret);

const payload = { id: 1, username: 'admin', role: 'Admin' };
const token = jwt.sign(payload, controllerSecret, { expiresIn: '8h' });
console.log('Generated Token:', token);

// Verify using the same secret
try {
  const decoded = jwt.verify(token, controllerSecret);
  console.log('Verification Success:', decoded);
} catch (err) {
  console.error('Verification Failed:', err.message);
}
