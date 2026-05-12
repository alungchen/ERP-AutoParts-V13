import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';

const DB_NAME = 'erp-db';

const tablesToSync = [
  'erp_stores',
  'products'
];

function escapeSqlString(str) {
  if (str === null || str === undefined) return 'NULL';
  if (typeof str === 'number') return str;
  // Replace single quotes with two single quotes for SQLite
  return `'${String(str).replace(/'/g, "''")}'`;
}

function runWranglerCmd(cmd) {
  return execSync(`npx wrangler d1 execute ${DB_NAME} ${cmd}`, {
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 50 // 50MB buffer for large JSON outputs
  });
}

async function syncTable(tableName) {
  console.log(`\n--- Syncing table: ${tableName} ---`);
  
  console.log(`Fetching data from remote...`);
  try {
    const output = runWranglerCmd(`--remote --command="SELECT * FROM ${tableName}" --json`);
    const parsed = JSON.parse(output);
    const rows = parsed[0]?.results || [];
    
    console.log(`Fetched ${rows.length} rows.`);
    
    if (rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    const columnsSql = columns.map(c => `"${c}"`).join(', ');

    let totalImported = 0;

    let currentBatchSize = tableName === 'erp_stores' ? 1 : 250;

    for (let i = 0; i < rows.length; i += currentBatchSize) {
      const batch = rows.slice(i, i + currentBatchSize);
      
      const sql = batch.map(row => {
        const rowValues = columns.map(col => escapeSqlString(row[col]));
        return `INSERT OR REPLACE INTO "${tableName}" (${columnsSql}) VALUES (${rowValues.join(', ')});`;
      }).join('\n');
      
      const tempFileName = `temp_chunk_${tableName}_${i}.sql`;
      writeFileSync(tempFileName, sql, 'utf-8');

      try {
        runWranglerCmd(`--local --file="${tempFileName}"`);
        totalImported += batch.length;
        process.stdout.write(`\rImported ${totalImported} / ${rows.length} rows`);
      } catch (err) {
        console.error(`\nError executing batch for ${tableName}:`, err.message);
      } finally {
        unlinkSync(tempFileName);
      }
    }
    console.log(`\nFinished syncing ${tableName}.`);

  } catch (err) {
    console.error(`Failed to sync table ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('Starting synchronization from remote to local...');
  for (const table of tablesToSync) {
    await syncTable(table);
  }
  console.log('\nAll tables synchronized successfully!');
}

main();
