const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, 'ts_page.html'), 'utf8');
const inputs = html.match(/<input[^>]*>/gi) || [];
console.log("ele_單號 found:", inputs.filter(i => i.includes('ele_單號')).length > 0);
console.log("ele_QueryMaster found:", inputs.filter(i => i.includes('ele_QueryMaster')).length > 0);
console.log("btn_QueryMaster found:", inputs.filter(i => i.includes('btn_QueryMaster')).length > 0);
console.log("btn_UpRecord found:", html.includes('btn_UpRecord'));

// Also find the exact id for docNo
const allIds = Array.from(html.matchAll(/id="([^"]+)"/g)).map(m => m[1]);
console.log("IDs with 單號:", allIds.filter(id => id.includes('單號')));
console.log("IDs with 交易日期:", allIds.filter(id => id.includes('交易日期')));
