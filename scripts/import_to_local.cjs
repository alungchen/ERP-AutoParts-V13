// Import d1-mirror-erp.sql via API call instead (reads from /api/products)
// We fetch all products from the REMOTE API and insert into local SQLite
const Database = require('better-sqlite3');
const https = require('https');
const path = require('path');

const SQLITE_PATH = path.join(__dirname, '../.wrangler/state/v3/d1/miniflare-D1DatabaseObject/0e60851c1998f7cdba4eb76d90199a126f73717e31028bf264f293c89f60e07e.sqlite');
const API_URL = 'https://erp-autoparts-v13.pages.dev/api/products';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + data.substring(0, 100))); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Fetching products from remote API...');
  const products = await fetchJson(API_URL);
  console.log(`Fetched ${products.length} products from remote`);

  console.log('Opening local SQLite:', SQLITE_PATH);
  const db = new Database(SQLITE_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      p_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      car_models TEXT,
      category TEXT,
      images TEXT,
      part_numbers TEXT,
      brand TEXT,
      stock INTEGER,
      specifications TEXT,
      safety_stock INTEGER,
      base_cost REAL,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS shorthands (
      s_id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      shorthand TEXT NOT NULL,
      fullname TEXT NOT NULL,
      meta_category TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec('DELETE FROM products');
  console.log('Cleared existing data');

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO products 
      (p_id, name, car_models, category, images, part_numbers, brand, stock, specifications, safety_stock, base_cost, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const p of rows) {
      stmt.run(
        p.p_id,
        p.name,
        JSON.stringify(p.car_models || []),
        p.category || '',
        JSON.stringify(p.images || []),
        JSON.stringify(p.part_numbers || []),
        p.brand || '',
        Number(p.stock) || 0,
        p.specifications || '',
        Number(p.safety_stock) || 0,
        Number(p.base_cost) || 0,
        p.updated_at || ''
      );
    }
  });

  insertMany(products);

  const finalCount = db.prepare('SELECT count(*) as cnt FROM products').get();
  console.log(`\n✅ Done! Final count: ${finalCount.cnt} products in local DB`);
  db.close();
}

main().catch(console.error);
