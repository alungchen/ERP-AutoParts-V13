/**
 * 客戶／供應商下拉與聯絡人列表：同序、去重，與主檔 store 內容一致。
 * - 依名稱（繁中 locale）再依代號排序
 * - 相同 cust_id/sup_id 只保留一筆（以較後出現者覆寫，便於匯入修正）
 */
function localeNameCompare(aName, bName) {
    return String(aName || '').localeCompare(String(bName || ''), 'zh-TW', { sensitivity: 'base' });
}

export function sortedCustomersForSelect(customers) {
    if (!Array.isArray(customers)) return [];
    const byId = new Map();
    for (const c of customers) {
        if (!c || typeof c !== 'object') continue;
        const id = String(c.cust_id ?? '').trim();
        if (!id) continue;
        byId.set(id, { ...c, cust_id: id });
    }
    return [...byId.values()].sort((a, b) => {
        const n = localeNameCompare(a.name || a.cust_id, b.name || b.cust_id);
        if (n !== 0) return n;
        return a.cust_id.localeCompare(b.cust_id);
    });
}

export function sortedSuppliersForSelect(suppliers) {
    if (!Array.isArray(suppliers)) return [];
    const byId = new Map();
    for (const s of suppliers) {
        if (!s || typeof s !== 'object') continue;
        const id = String(s.sup_id ?? '').trim();
        if (!id) continue;
        byId.set(id, { ...s, sup_id: id });
    }
    return [...byId.values()].sort((a, b) => {
        const n = localeNameCompare(a.name || a.sup_id, b.name || b.sup_id);
        if (n !== 0) return n;
        return a.sup_id.localeCompare(b.sup_id);
    });
}
