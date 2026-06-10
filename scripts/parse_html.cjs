const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, 'ts_page.html'), 'utf8');

// Find script tags or locations containing do_QueryMaster
const regex = /function\s+do_QueryMaster[\s\S]{0,1000}/i;
const match = html.match(regex);
console.log("do_QueryMaster definition matches:", match ? match[0] : "Not found function keyword");

// Let's do a simple substring search as well
const idx = html.indexOf('do_QueryMaster');
if (idx !== -1) {
  console.log("Substring index:", idx);
  console.log("Context:", html.substring(idx - 100, idx + 500));
}


