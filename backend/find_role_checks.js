const fs = require('fs');

const content = fs.readFileSync('e:/Texttail/frontend/src/pages/Inventory.jsx', 'utf8');
const lines = content.split('\n');

console.log('--- Role Checks in Inventory.jsx ---');
lines.forEach((line, idx) => {
  if (line.includes('role') && (line.includes('Admin') || line.includes('Manager') || line.includes('Owner'))) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
