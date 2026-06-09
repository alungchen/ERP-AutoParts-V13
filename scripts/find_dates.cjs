const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, 'ts_page.html'), 'utf8');
const dates = new Set();
const matches = html.matchAll(/<td title="(\d{4}-\d{2}-\d{2})">/g);
for (const match of matches) {
  dates.add(match[1]);
}
console.log(Array.from(dates));
