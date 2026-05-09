// Check line count and find actual INSERT lines
const fs = require('fs');
const sql = fs.readFileSync('d1-mirror-erp.sql', 'utf8');
const allLines = sql.split('\n');
console.log('Total lines:', allLines.length);

const insertLines = allLines.filter(l => l.trimStart().startsWith('INSERT'));
console.log('INSERT lines:', insertLines.length);
console.log('First INSERT preview:', insertLines[0] ? insertLines[0].substring(0, 200) : 'NONE');
