// upload_contacts_to_remote.cjs
// 透過 API 把 contacts_seed.json 上傳到遠端 D1（批次 POST）
const https = require('https');
const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, '../output/contacts_seed.json');
const BASE_URL = 'https://erp-autoparts-v13.pages.dev';

const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

function postJson(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const u = new URL(url);
        const req = https.request({
            hostname: u.hostname, path: u.pathname, method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
        }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function deleteUrl(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'DELETE' }, res => {
            let d = '';
            res.on('data', c => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function batchUpload(items, apiPath, idKey, label) {
    console.log(`\n🗑️  清空遠端 ${label}...`);
    await deleteUrl(`${BASE_URL}${apiPath}?clearAll=1`);

    console.log(`📤 上傳 ${items.length} 筆 ${label}（每批 30 筆）...`);
    const BATCH = 30;
    let done = 0, failed = 0;
    for (let i = 0; i < items.length; i += BATCH) {
        const batch = items.slice(i, i + BATCH);
        const results = await Promise.all(batch.map(item => postJson(`${BASE_URL}${apiPath}`, item)));
        results.forEach(r => r.status === 200 ? done++ : failed++);
        process.stdout.write(`\r   進度: ${Math.min(i + BATCH, items.length)}/${items.length}`);
    }
    console.log(`\n   ✅ 成功: ${done} 筆  ❌ 失敗: ${failed} 筆`);
}

(async () => {
    await batchUpload(seed.suppliers, '/api/suppliers', 'sup_id', '供應商');
    await batchUpload(seed.customers, '/api/customers', 'cust_id', '客戶');
    console.log('\n🎉 遠端 D1 同步完成！');
})();
