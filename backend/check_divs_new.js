const fs = require('fs');

const fileContent = fs.readFileSync('e:/Texttail/frontend/src/pages/POS.jsx', 'utf8');
const lines = fileContent.split('\n');

let balance = 0;
let inCatalogue = false;

for (let i = 920; i < 1235; i++) {
  const line = lines[i];
  if (!line) continue;
  
  const trimLine = line.trim();
  const openCount = (line.match(/<div/g) || []).length;
  const closeCount = (line.match(/<\/div>/g) || []).length;
  const diff = openCount - closeCount;
  
  if (trimLine.includes('className="pos-container"')) {
    console.log(`[START] pos-container at line ${i + 1}`);
    balance = 1;
    inCatalogue = false;
    continue;
  }
  
  if (trimLine.includes('className="pos-catalogue"')) {
    console.log(`[START] pos-catalogue at line ${i + 1}`);
    inCatalogue = true;
    balance = 2; // container + catalogue
    continue;
  }
  
  if (trimLine.includes('className="pos-cart-sticky')) {
    console.log(`[START] pos-cart-sticky at line ${i + 1}, Current Balance: ${balance}`);
    inCatalogue = false;
  }
  
  if (balance > 0) {
    balance += diff;
    if (diff !== 0) {
      console.log(`Line ${i + 1} (${openCount} open, ${closeCount} close): Balance now ${balance}. Line: ${trimLine.slice(0, 70)}`);
    }
    if (balance === 1 && inCatalogue) {
      console.log(`[ALERT] pos-catalogue closed early at line ${i + 1}!`);
      inCatalogue = false;
    }
    if (balance === 0) {
      console.log(`[ALERT] pos-container closed early at line ${i + 1}!`);
      balance = 0;
    }
  }
}
