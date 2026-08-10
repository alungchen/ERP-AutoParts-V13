const fs = require('fs');
const t = fs.readFileSync('output/shorthand_model.csv', 'utf8');
const lines = t.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
const codes = new Set(lines.slice(1).map(l => (l.split(',')[2] || '').trim().toUpperCase()));
const targets = ['MB 1G1', 'MB1841', 'MB190', 'MBA', 'MBAC', 'MBC117', 'MBC205', 'MB2040', 'MBAT', 'MBB', 'MBC'];
for (const c of targets) {
  console.log(c.padEnd(10), codes.has(c.toUpperCase()) ? '有' : '❌ 缺');
}
console.log('CSV 資料筆數:', lines.length - 1);
const mb = [...codes].filter(c => c.startsWith('MB'));
console.log('CSV 內 MB 開頭的代碼數:', mb.length, '→', mb.slice(0, 30).join(', '));
