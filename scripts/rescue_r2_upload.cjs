const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const R2_BUCKET = 'erp-images';
const BACKUP_DIR = path.join(__dirname, '..', 'output', 'legacy_photos_backup');

console.log('🚀 開始補上傳備份資料夾內的照片到真正的遠端 R2...');
const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.JPG') || f.endsWith('.jpg') || f.endsWith('.png'));

let count = 0;
for (const file of files) {
    count++;
    console.log(`[${count}/${files.length}] 上傳 ${file}...`);
    const localFilePath = path.join(BACKUP_DIR, file);
    try {
        execSync(`npx wrangler r2 object put ${R2_BUCKET}/${file} --file="${localFilePath}" --remote`, { stdio: 'pipe' });
    } catch (e) {
        console.error(`  ❌上傳失敗: ${e.message}`);
    }
}
console.log('✅ 全部補上傳完畢！');
