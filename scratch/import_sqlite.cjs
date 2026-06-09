const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const sqlFilePath = path.join(__dirname, '../d1-mirror-erp.sql');
const sqliteDbPath = path.join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0e60851c1998f7cdba4eb76d90199a126f73717e31028bf264f293c89f60e07e.sqlite');

console.log('Loading SQL file...');
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

console.log('Opening SQLite database...');
const db = new Database(sqliteDbPath);

console.log('Executing SQL statements...');
db.exec(sqlContent);

console.log('Import completed successfully!');
db.close();
