const fs = require('fs');

const files = [
  '../frontend/src/pages/POS.jsx',
  '../frontend/src/pages/Pos.css',
  '../frontend/src/index.css'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    console.log(`=== Matches in ${file} ===`);
    lines.forEach((line, index) => {
      if (line.includes('checkout-item-card') || line.includes('pos-cart-sticky') || line.includes('pos-container')) {
        console.log(`${index + 1}: ${line.trim()}`);
      }
    });
  } else {
    console.log(`File not found: ${file}`);
  }
});
