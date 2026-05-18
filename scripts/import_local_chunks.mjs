/**
 * import_local_chunks.mjs
 * 將雲端備份 SQL 的 INSERT 語句分批匯入本機 D1 資料庫
 * 用法: node scripts/import_local_chunks.mjs
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SQL_FILE = path.join(ROOT, 'd1-mirror-erp.sql');
const CHUNK_DIR = path.join(ROOT, '.sql-chunks');
const CHUNK_SIZE = 50; // INSERT statements per chunk (小一點更安全)

if (!existsSync(SQL_FILE)) {
    console.error('❌ 找不到 d1-mirror-erp.sql，請先執行 npm run db:export:remote');
    process.exit(1);
}

if (!existsSync(CHUNK_DIR)) mkdirSync(CHUNK_DIR, { recursive: true });

console.log('📖 讀取 SQL 檔案...');
const raw = readFileSync(SQL_FILE, 'utf-8');

// 擷取所有 INSERT 語句（每行一個 INSERT）
const insertLines = raw.split('\n').filter(line => {
    const t = line.trim();
    return t.toUpperCase().startsWith('INSERT INTO');
});

console.log(`📊 找到 INSERT 語句: ${insertLines.length} 筆`);

const totalChunks = Math.ceil(insertLines.length / CHUNK_SIZE);
console.log(`📦 分為 ${totalChunks} 批（每批 ${CHUNK_SIZE} 筆）開始匯入...\n`);

let success = 0;
let failed = 0;

for (let i = 0; i < totalChunks; i++) {
    const chunk = insertLines.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    const chunkFile = path.join(CHUNK_DIR, `chunk_${String(i).padStart(4, '0')}.sql`);
    writeFileSync(chunkFile, chunk.join('\n') + '\n', 'utf-8');
    
    const pct = Math.round(((i + 1) / totalChunks) * 100);
    process.stdout.write(`  [${pct}%] 批次 ${i + 1}/${totalChunks}...`);
    
    try {
        execSync(`wrangler d1 execute erp-db --local --file="${chunkFile}" --yes`, {
            cwd: ROOT, stdio: 'pipe'
        });
        process.stdout.write(' ✅\n');
        success++;
    } catch (e) {
        const errMsg = (e.stderr?.toString() || e.message || '').slice(0, 100);
        process.stdout.write(` ❌ ${errMsg}\n`);
        failed++;
    }
    
    unlinkSync(chunkFile);
}

// 清理暫存目錄
try { import('fs').then(fs => fs.rmdirSync(CHUNK_DIR)); } catch {}

console.log('\n' + '='.repeat(50));
console.log(`✅ 成功批次: ${success}`);
console.log(`❌ 失敗批次: ${failed}`);
console.log(`📊 總計處理: ${insertLines.length} 筆`);

if (failed === 0) {
    console.log('\n🎉 雲端資料已完整同步到本機！請重新整理瀏覽器。');
} else {
    console.warn('\n⚠️  部分批次失敗（可能是重複主鍵），其他資料已匯入。請重新整理瀏覽器確認。');
}
