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
import { existsSync, rmSync } from 'fs';
import { join } from 'path';

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
    execSync(`npx wrangler d1 execute erp-db --local --file=${OUTPUT_SQL} --yes`, {
        stdio: 'inherit',
        cwd: process.cwd(),
    });

    console.log('[db:sync:local] 完成。請重新啟動 worker（例如 npm run dev:all），並於瀏覽器重新整理。');
}

main();
