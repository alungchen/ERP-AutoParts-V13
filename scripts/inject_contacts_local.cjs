// inject_contacts_local.cjs
// 用 Puppeteer 自動把聯絡人資料注入到本機瀏覽器的 localStorage
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SEED_FILE = path.join(__dirname, '..', 'output', 'contacts_seed.json');
const LOCAL_URL = 'http://localhost:5173';

(async () => {
    if (!fs.existsSync(SEED_FILE)) {
        console.error('❌ 找不到 output/contacts_seed.json，請先執行: node scripts/sync_contacts_to_local.cjs');
        process.exit(1);
    }

    const seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    console.log(`📦 準備注入: 供應商 ${seed.suppliers.length} 筆，客戶 ${seed.customers.length} 筆`);

    console.log('🚀 啟動 Puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    console.log(`🌐 前往 ${LOCAL_URL} ...`);
    await page.goto(LOCAL_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 注入 localStorage
    await page.evaluate((suppliers, customers) => {
        // 供應商
        const ss = JSON.parse(localStorage.getItem('erp-supplier-store') || '{}');
        ss.state = ss.state || {};
        ss.state.suppliers = suppliers;
        ss.state.selectedSupplier = null;
        localStorage.setItem('erp-supplier-store', JSON.stringify(ss));

        // 客戶
        const cs = JSON.parse(localStorage.getItem('erp-customer-store') || '{}');
        cs.state = cs.state || {};
        cs.state.customers = customers;
        cs.state.selectedCustomer = null;
        localStorage.setItem('erp-customer-store', JSON.stringify(cs));

        return { sup: suppliers.length, cust: customers.length };
    }, seed.suppliers, seed.customers);

    console.log('✅ localStorage 注入完成！');

    await browser.close();
    console.log('\n🎉 完成！請重新整理您的本機瀏覽器 (http://localhost:5173) 就可以看到資料了！');
})();
