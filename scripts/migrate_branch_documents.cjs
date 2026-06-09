const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const branchArg = args.find(a => a.startsWith('--branch='))?.split('=')[1];
const startArg = args.find(a => a.startsWith('--start='))?.split('=')[1];
const endArg = args.find(a => a.startsWith('--end='))?.split('=')[1];
const isLocal = args.includes('--local');
const isSkipScrape = args.includes('--skip-scrape');

if (!branchArg || (!isSkipScrape && (!startArg || !endArg))) {
  console.log(`
使用方式: node scripts/migrate_branch_documents.cjs --branch=<分店代號> --start=<開始日期> --end=<結束日期> [--local] [--skip-scrape]
範例一 (完整流程): node scripts/migrate_branch_documents.cjs --branch=xizhi --start=2026-06-08 --end=2026-06-08
範例二 (只重新匯入已抓好的資料): node scripts/migrate_branch_documents.cjs --branch=xizhi --skip-scrape
`);
  process.exit(1);
}

const targetEnv = isLocal ? 'local' : 'remote';
console.log(`🚀 [一鍵整合單據搬家] 開始執行...`);
console.log(`📍 分店: ${branchArg}`);
if (!isSkipScrape) {
  console.log(`📅 日期範圍: ${startArg} 至 ${endArg}`);
}
console.log(`🌐 目標資料庫: ${targetEnv === 'local' ? '本地 (Local Dev DB)' : '雲端 (Remote D1 DB)'}`);
console.log(`═`.repeat(50));

// 1. 執行爬蟲
if (isSkipScrape) {
  console.log(`\n[第一階段] 跳過自動化爬蟲 (直接使用已下載之 CSV 檔案)...`);
} else {
  console.log(`\n[第一階段] 啟動自動化爬蟲...`);
  const scrapeResult = spawnSync('node', [
    path.join(__dirname, 'scrape_documents.cjs'),
    `--branch=${branchArg}`,
    '--type=all',
    `--start=${startArg}`,
    `--end=${endArg}`
  ], { stdio: 'inherit' });

  if (scrapeResult.status !== 0) {
    console.error(`❌ 爬蟲階段執行失敗，已終止整合流程。`);
    process.exit(scrapeResult.status || 1);
  }
}

// 2. 轉換為 SQL 與匯入
console.log(`\n[第二階段] 轉換 CSV 檔案並匯入資料庫 (${targetEnv})...`);
const sqlFile = branchArg === 'songshan' 
  ? './output/import_documents.sql'
  : `./output/${branchArg}/import_documents.sql`;

// 執行產生 SQL
const sqlResult = spawnSync('node', [
  path.join(__dirname, 'generate_document_sql.cjs'),
  `--branch=${branchArg}`
], { stdio: 'inherit' });

if (sqlResult.status !== 0) {
  console.error(`❌ SQL 轉換階段執行失敗，已終止整合流程。`);
  process.exit(sqlResult.status || 1);
}

// 執行 D1 匯入
const fs = require('fs');
const wranglerArgs = [
  'd1', 'execute', 'erp-db',
  `--${targetEnv}`,
  `--file=${sqlFile}`,
  '--yes'
];

const wranglerJs = path.join(__dirname, '..', 'node_modules', 'wrangler', 'bin', 'wrangler.js');
let cmd = 'node';
let cmdArgs = [];
let useShell = false;

if (fs.existsSync(wranglerJs)) {
  cmdArgs = [wranglerJs, ...wranglerArgs];
  console.log(`執行匯入指令: node ${cmdArgs.join(' ')}`);
} else {
  cmd = 'npx';
  cmdArgs = ['wrangler', ...wranglerArgs];
  useShell = process.platform === 'win32';
  console.log(`執行匯入指令: npx wrangler ${wranglerArgs.join(' ')}`);
}

const importResult = spawnSync(cmd, cmdArgs, { stdio: 'inherit', shell: useShell });

if (importResult.status !== 0) {
  console.error(`❌ 資料庫匯入階段執行失敗。`);
  process.exit(importResult.status || 1);
}

console.log(`\n🎉 [一鍵整合單據搬家] ${branchArg} 分店單據已成功搬移完成！`);
