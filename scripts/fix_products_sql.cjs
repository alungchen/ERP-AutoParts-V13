'use strict';
const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const src = fs.readFileSync(path.join(ROOT, 'output', 'remote_stock.sql'), 'utf8');

const fixed = 'PRAGMA foreign_keys = OFF;\n' +
    src
        .replace(/CREATE TABLE product_stock/g, 'CREATE TABLE IF NOT EXISTS product_stock')
        .replace(/INSERT INTO "product_stock"/g, 'INSERT OR REPLACE INTO "product_stock"') +
    '\nPRAGMA foreign_keys = ON;\n';

fs.writeFileSync(path.join(ROOT, 'output', 'remote_stock_local.sql'), fixed, 'utf8');
console.log('✅ stock SQL ready, bytes:', fixed.length);
