/** 匯入前備份 D1 遠端 shorthands 表 → output/shorthands_backup_before_import.json */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const out = execSync(
  'npx wrangler d1 execute erp-db --remote --command="SELECT * FROM shorthands" --json',
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], cwd: path.join(__dirname, '..') }
);
const i = out.indexOf('[');
const d = JSON.parse(out.slice(i));
const rows = d[0].results;
const dest = path.join(__dirname, '..', 'output', 'shorthands_backup_before_import.json');
fs.writeFileSync(dest, JSON.stringify(rows, null, 1), 'utf8');
console.log('已備份現有片語筆數:', rows.length, '→', dest);
