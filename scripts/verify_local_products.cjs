'use strict';
const { execSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function runD1Local(sql) {
    const cmd = `npx wrangler d1 execute erp-db --local --command=${JSON.stringify(sql)} --json`;
    const out = execSync(cmd, { encoding: 'utf8', cwd: ROOT, stdio: ['pipe', 'pipe', 'ignore'] });
    return JSON.parse(out)[0]?.results || [];
}

// 查 product_stock schema
const schema = runD1Local("SELECT sql FROM sqlite_master WHERE type='table' AND name='product_stock';");
console.log('product_stock schema:');
console.log(schema[0]?.sql);

// 查 branches 表
const branches = runD1Local('SELECT * FROM branches LIMIT 10;');
console.log('\nbranches:', JSON.stringify(branches));

// 查 product_stock 的 branch_id 清單 (遠端 export 的前幾筆)
const fs = require('fs');
const stockLines = fs.readFileSync(path.join(ROOT, 'output', 'remote_stock.sql'), 'utf8').split('\n');
const insertLines = stockLines.filter(l => l.startsWith('INSERT INTO'));
console.log('\n遠端 stock INSERT 前3筆:');
insertLines.slice(0, 3).forEach(l => console.log(l.slice(0, 150)));
