'use strict';
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function runD1Local(sql) {
    const cmd = `npx wrangler d1 execute erp-db --local --command=${JSON.stringify(sql)} --json`;
    const out = execSync(cmd, { encoding: 'utf8', cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] });
    return JSON.parse(out)[0]?.results || [];
}

// Step 1: 插入 branches
console.log('Step 1: 插入 branches...');
const branchSql = [
    "INSERT OR REPLACE INTO branches (branch_id, name, created_at) VALUES ('songshan', '松山店', '2026-06-08 07:34:11');",
    "INSERT OR REPLACE INTO branches (branch_id, name, created_at) VALUES ('xizhi', '汐止店', '2026-06-08 07:34:11');",
    "INSERT OR REPLACE INTO branches (branch_id, name, created_at) VALUES ('linkou', '林口店', '2026-06-08 07:34:11');"
].join(' ');
runD1Local(branchSql);
console.log('   ✅ branches 完成');

// Step 2: 修正 stock SQL 並匯入
console.log('Step 2: 修正 product_stock SQL...');
const src = fs.readFileSync(path.join(ROOT, 'output', 'remote_stock.sql'), 'utf8');
const fixed = src
    .replace(/CREATE TABLE product_stock/g, 'CREATE TABLE IF NOT EXISTS product_stock')
    .replace(/INSERT INTO "product_stock"/g, 'INSERT OR REPLACE INTO "product_stock"');
const outPath = path.join(ROOT, 'output', 'remote_stock_local.sql');
fs.writeFileSync(outPath, fixed, 'utf8');
console.log('   ✅ SQL 已修正:', outPath);

// Step 3: 匯入 stock
console.log('Step 3: 匯入 product_stock 到本地...');
execSync(`npx wrangler d1 execute erp-db --local --file="${outPath}" --yes`, {
    stdio: 'inherit',
    cwd: ROOT
});

// Step 4: 驗證
const cnt = runD1Local('SELECT COUNT(*) as cnt FROM product_stock;');
console.log('\n✅ product_stock 筆數:', cnt[0]?.cnt);
console.log('🎉 完成！請重新整理瀏覽器，車型/年份/品牌和庫存數量都會正確顯示。');
