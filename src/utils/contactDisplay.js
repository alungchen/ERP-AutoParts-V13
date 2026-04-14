/** 單據／下拉選單：優先顯示自訂供應編號，不顯示內部 sup_id */
export function formatSupplierSelectLabel(s) {
    if (!s) return '';
    const code = (s.supplier_code || '').trim();
    return code ? `${code} — ${s.name || ''}` : (s.name || '');
}

/** 單據／下拉選單：優先顯示自訂客戶編號，不顯示內部 cust_id */
export function formatCustomerSelectLabel(c) {
    if (!c) return '';
    const code = (c.customer_code || '').trim();
    return code ? `${code} — ${c.name || ''}` : (c.name || '');
}

/** 依單據已帶入的 supplier_id 從主檔取得供應商名稱（供失焦後顯示交易對象） */
export function getResolvedSupplierName(doc, suppliers) {
    if (!doc?.supplier_id || !Array.isArray(suppliers)) return '';
    const s = suppliers.find((x) => x.sup_id === doc.supplier_id);
    return (s?.name || doc.supplier_name || '').trim();
}

/** 依單據已帶入的 customer_id 從主檔取得客戶名稱 */
export function getResolvedCustomerName(doc, customers) {
    if (!doc?.customer_id || !Array.isArray(customers)) return '';
    const c = customers.find((x) => x.cust_id === doc.customer_id);
    return (c?.name || doc.customer_name || '').trim();
}

/** 「編號 — 名稱」或「編號 - 名稱」只取編號／ID 片段供主檔比對 */
export function normalizePartyInputForLookup(raw) {
    const q0 = (raw || '').trim();
    if (!q0) return q0;
    const emParts = q0.split(/\s*[—–−]\s*/);
    if (emParts.length >= 2) return emParts[0].trim();
    const hyphenTail = q0.match(/^(.+?)\s+-\s+.+/);
    if (hyphenTail) return hyphenTail[1].trim();
    return q0;
}

/** 輸入供應編號／內部 ID 解析供應商；空字串 => error: 'empty' */
export function resolveSupplierFromInput(suppliers, raw) {
    const q = normalizePartyInputForLookup(raw);
    if (!q) return { party: null, error: 'empty' };
    const lower = q.toLowerCase();
    const byExactCode = suppliers.filter((s) => (s.supplier_code || '').trim().toLowerCase() === lower);
    if (byExactCode.length === 1) return { party: byExactCode[0], error: null };
    if (byExactCode.length > 1) return { party: null, error: 'ambiguous' };
    const byExactId = suppliers.filter((s) => (s.sup_id || '').toLowerCase() === lower);
    if (byExactId.length === 1) return { party: byExactId[0], error: null };
    const byNameExact = suppliers.filter((s) => (s.name || '').trim().toLowerCase() === lower);
    if (byNameExact.length === 1) return { party: byNameExact[0], error: null };
    if (byNameExact.length > 1) return { party: null, error: 'ambiguous' };
    const partial = suppliers.filter(
        (s) =>
            (s.supplier_code || '').toLowerCase().includes(lower) ||
            (s.sup_id || '').toLowerCase().includes(lower)
    );
    if (partial.length === 1) return { party: partial[0], error: null };
    if (partial.length === 0) return { party: null, error: 'notfound' };
    return { party: null, error: 'ambiguous' };
}

/** 輸入客戶編號／內部 ID 解析客戶；空字串 => error: 'empty' */
export function resolveCustomerFromInput(customers, raw) {
    const q = normalizePartyInputForLookup(raw);
    if (!q) return { party: null, error: 'empty' };
    const lower = q.toLowerCase();
    const byExactCode = customers.filter((c) => (c.customer_code || '').trim().toLowerCase() === lower);
    if (byExactCode.length === 1) return { party: byExactCode[0], error: null };
    if (byExactCode.length > 1) return { party: null, error: 'ambiguous' };
    const byExactId = customers.filter((c) => (c.cust_id || '').toLowerCase() === lower);
    if (byExactId.length === 1) return { party: byExactId[0], error: null };
    const byNameExact = customers.filter((c) => (c.name || '').trim().toLowerCase() === lower);
    if (byNameExact.length === 1) return { party: byNameExact[0], error: null };
    if (byNameExact.length > 1) return { party: null, error: 'ambiguous' };
    const partial = customers.filter(
        (c) =>
            (c.customer_code || '').toLowerCase().includes(lower) ||
            (c.cust_id || '').toLowerCase().includes(lower)
    );
    if (partial.length === 1) return { party: partial[0], error: null };
    if (partial.length === 0) return { party: null, error: 'notfound' };
    return { party: null, error: 'ambiguous' };
}

/** 製單查詢：交易對象欄比對名稱、供應／客戶編號、內部 ID 等 */
export function docMatchesPartySearch(doc, qRaw, suppliers, customers) {
    const q = (qRaw || '').trim().toLowerCase();
    if (!q) return true;
    if ((doc.supplier_name || '').toLowerCase().includes(q)) return true;
    if ((doc.customer_name || '').toLowerCase().includes(q)) return true;
    if (doc.supplier_id) {
        const s = suppliers.find((sup) => sup.sup_id === doc.supplier_id);
        if (s) {
            const code = (s.supplier_code || '').trim();
            const display = code ? `${code} — ${s.name}` : (s.name || '');
            if (display.toLowerCase().includes(q)) return true;
            if ((s.supplier_code || '').toLowerCase().includes(q)) return true;
            if ((s.sup_id || '').toLowerCase().includes(q)) return true;
        }
    }
    if (doc.customer_id) {
        const c = customers.find((cust) => cust.cust_id === doc.customer_id);
        if (c) {
            const code = (c.customer_code || '').trim();
            const display = code ? `${code} — ${c.name}` : (c.name || '');
            if (display.toLowerCase().includes(q)) return true;
            if ((c.customer_code || '').toLowerCase().includes(q)) return true;
            if ((c.cust_id || '').toLowerCase().includes(q)) return true;
        }
    }
    return false;
}
