const fs = require('fs');
const path = require('path');

const files = [
    'output/shorthand_models.csv',
    'output/shorthand_parts.csv',
    'output/shorthand_brands.csv'
];

files.forEach(f => {
    const fullPath = path.join(__dirname, '..', f);
    const content = fs.readFileSync(fullPath, 'utf8').replace(/^\uFEFF/, '');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
    const header = lines[0];

    const data = lines.slice(1).filter(l => {
        // 簡單 CSV 解析（不處理引號內的逗號）
        const cols = l.split(',');
        const code = (cols[0] || '').replace(/^"|"$/g, '').trim();
        const name = (cols[1] || '').replace(/^"|"$/g, '').trim();
        // 保留有代碼且有名稱的資料
        return code && name;
    });

    console.log(`${f}: ${data.length} 筆有效（原 ${lines.length - 1} 筆，移除 ${lines.length - 1 - data.length} 筆空白）`);
    fs.writeFileSync(fullPath, '\uFEFF' + header + '\n' + data.join('\n'), 'utf8');
});

console.log('\n✅ 清理完成！');
