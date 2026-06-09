const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../src/pages/Documents/DocumentEditorPage.jsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 統一換行符為 \n
content = content.replace(/\r\n/g, '\n');

// 0. 在檔案頂部，元件外宣告 getDefaultLocation 輔助函數
const helperFunction = `const getDefaultLocation = (product, activeBranch) => {
    if (product && Array.isArray(product.stock_details)) {
        const branchStocks = product.stock_details.filter(s => s.branch_id === activeBranch);
        if (branchStocks.length > 0 && branchStocks[0].location_code) {
            return branchStocks[0].location_code;
        }
    }
    return 'A1';
};

const DOC_TYPE_TITLE_ZH = {`;

if (content.includes('const DOC_TYPE_TITLE_ZH = {')) {
    content = content.replace('const DOC_TYPE_TITLE_ZH = {', helperFunction);
    console.log('Successfully added getDefaultLocation helper!');
} else {
    console.error('Could not find DOC_TYPE_TITLE_ZH target!');
}

// 1. 在 useAppStore 解構中加入 activeBranchId
const targetStore = `const { defaultCurrency, isMultiCountryMode, enableLoginSystem, enablePermissionRole, currentUserEmpId } = useAppStore();`;
const replacementStore = `const { defaultCurrency, isMultiCountryMode, enableLoginSystem, enablePermissionRole, currentUserEmpId, activeBranchId } = useAppStore();`;

if (content.includes(targetStore)) {
    content = content.replace(targetStore, replacementStore);
    console.log('Successfully added activeBranchId to useAppStore!');
} else {
    console.error('Could not find targetStore in DocumentEditorPage!');
}

// 2. 在 addEmptyItem 中加入 location_code: 'A1'
const targetEmptyItem = `            qty: 1,
            unit_price: 0,
            unit: 'PCS',
            stock: 0`;
const replacementEmptyItem = `            qty: 1,
            unit_price: 0,
            unit: 'PCS',
            stock: 0,
            location_code: 'A1'`;

if (content.includes(targetEmptyItem)) {
    content = content.replace(targetEmptyItem, replacementEmptyItem);
    console.log('Successfully added location_code to addEmptyItem!');
} else {
    console.error('Could not find targetEmptyItem!');
}

// 3. 在 handlePickProduct 與 handlePickSelectedProducts 中設定 location_code
const targetPick = `            qty: 1,
            unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
            unit: 'PCS',
            stock: p.stock,`;
const replacementPick = `            qty: 1,
            unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
            unit: 'PCS',
            stock: p.stock,
            location_code: getDefaultLocation(p, activeBranchId),`;

if (content.includes(targetPick)) {
    content = content.split(targetPick).join(replacementPick);
    console.log('Successfully added location_code defaults in pick actions!');
} else {
    console.error('Could not find targetPick!');
}

// 4. 在 Table Header 中新增「庫位」th
const targetTh = `<th style={{ width: '100px' }}>{'\\u6578\\u91cf'}</th>`;
const replacementTh = `<th style={{ width: '100px' }}>庫位</th>\n                                <th style={{ width: '100px' }}>{'\\u6578\\u91cf'}</th>`;

if (content.includes(targetTh)) {
    content = content.replace(targetTh, replacementTh);
    console.log('Successfully added <th>庫位</th>!');
} else {
    console.error('Could not find targetTh!');
}

// 5. 修改 colSpan={11} 為 colSpan={12}
const targetColSpan = `<td colSpan={11} style={{ padding: '1rem' }}>`;
const replacementColSpan = `<td colSpan={12} style={{ padding: '1rem' }}>`;

if (content.includes(targetColSpan)) {
    content = content.replace(targetColSpan, replacementColSpan);
    console.log('Successfully updated colSpan to 12!');
} else {
    console.error('Could not find targetColSpan!');
}

// 6. 在品項 Row 中新增庫位輸入框 td
const targetTd = `<td style={{ padding: '0.5rem 1rem' }}>
                                            <input
                                                data-doc-item-qty`;
const replacementTd = `<td style={{ padding: '0.5rem 1rem' }}>
                                            <input
                                                type="text"
                                                disabled={isReadOnly}
                                                value={item.location_code || 'A1'}
                                                onChange={e => updateItem(idx, 'location_code', e.target.value.trim().toUpperCase())}
                                                placeholder="e.g. A1"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.4rem',
                                                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-tertiary)',
                                                    border: isReadOnly ? 'none' : '1px solid var(--border-color)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-primary)',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 1rem' }}>
                                            <input
                                                data-doc-item-qty`;

if (content.includes(targetTd)) {
    content = content.replace(targetTd, replacementTd);
    console.log('Successfully added location input <td> row!');
} else {
    console.error('Could not find targetTd row insertion point!');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Editor page patch complete.');
