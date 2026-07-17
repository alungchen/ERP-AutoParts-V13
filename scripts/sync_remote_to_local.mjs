/**
 * 將 Cloudflare D1「遠端」資料庫完整鏡像到「本機」Miniflare D1。
 * 使用 wrangler export／execute，可避免 JSON 過長時 INSERT 字面量觸發 SQLITE_TOOBIG。
 *
 * 匯出的快照含 CREATE TABLE（非 IF NOT EXISTS），故匯入前會刪除本機 `.wrangler/state/v3/d1`。
 * 請先停止 `npm run worker`／`npm run dev:all`，以免 SQLite 檔案被鎖定。
 *
 * 前置：已登入 Cloudflare（wrangler login）、wrangler.toml 綁定正確的 database_id。
 */
import { execSync } from 'child_process';
import { existsSync, rmSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import Database from 'better-sqlite3';

const OUTPUT_SQL = './d1-mirror-erp.sql';

function wipeLocalD1Persistence() {
    const d1Dir = join(process.cwd(), '.wrangler', 'state', 'v3', 'd1');
    if (!existsSync(d1Dir)) return;
    console.log('[db:sync:local] 清除本機 D1 快取（舊表結構會與遠端 CREATE TABLE 衝突）…');
    try {
        rmSync(d1Dir, { recursive: true, force: true });
    } catch (e) {
        const code = e?.code;
        if (code === 'EBUSY' || code === 'EPERM') {
            console.error('\n[x] 無法刪除本機 D1 目錄（檔案被鎖定，通常是 worker 仍在執行）。');
            console.error('    請先停止 npm run worker / npm run dev:all，然後在本機根目錄執行：');
            console.error('    npx wrangler d1 execute erp-db --local --file=./d1-mirror-erp.sql --yes');
            console.error('    （遠端快照已成功下載至 ./d1-mirror-erp.sql）\n');
        }
        throw e;
    }
}

function main() {
    console.log('[db:sync:local] 遠端 D1 匯出 →', OUTPUT_SQL);
    execSync(`npx wrangler d1 export erp-db --remote --output=${OUTPUT_SQL}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    wipeLocalD1Persistence();

    console.log('[db:sync:local] 匯入本機 D1 …');
    try {
        execSync(`npx wrangler d1 execute erp-db --local --file=${OUTPUT_SQL} --yes`, {
            stdio: 'inherit',
            cwd: process.cwd(),
        });
    } catch (err) {
        console.log('\n[db:sync:local] ⚠️ 偵測到 wrangler d1 execute 匯入報錯 (通常是因為快照包含超過 100KB 的大資料欄位觸發 SQLITE_TOOBIG)。');
        console.log('[db:sync:local] 🚀 正在自動改用 better-sqlite3 原生驅動直接寫入本地 D1...');
        try {
            const dbDir = join(process.cwd(), '.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject');
            const files = existsSync(dbDir) ? readdirSync(dbDir) : [];
            const sqliteFile = files.find(f => f.endsWith('.sqlite') && !f.startsWith('metadata'));
            if (!sqliteFile) {
                throw new Error('找不到本地 SQLite 資料庫檔案。');
            }
            const dbPath = join(dbDir, sqliteFile);
            const db = new Database(dbPath);
            const sql = readFileSync(OUTPUT_SQL, 'utf8');
            db.exec(sql);
            db.close();
            console.log('[db:sync:local] ✅ 使用 better-sqlite3 原生驅動匯入成功！\n');
        } catch (fallbackErr) {
            console.error('[db:sync:local] 原生匯入失敗:', fallbackErr.message);
            throw err;
        }
    }

    console.log('[db:sync:local] 完成。請重新啟動 worker（例如 npm run dev:all），並於瀏覽器重新整理。');
}

main();
