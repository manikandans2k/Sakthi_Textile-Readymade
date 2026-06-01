const fs = require('fs');

const fileContent = fs.readFileSync('e:/Texttail/frontend/src/pages/POS.css', 'utf8');
const lines = fileContent.split('\n');

lines.forEach((line, index) => {
  if (line.includes('pos-container') || line.includes('pos-catalogue') || line.includes('pos-cart-sticky')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
