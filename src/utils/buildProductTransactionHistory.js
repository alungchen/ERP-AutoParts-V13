/** 供比對用之零件號碼正規化（略空白、連字號等） */
function normPartRef(s) {
    return String(s || '').trim().toLowerCase().replace(/[\s/_-]+/g, '');
}

/** 比對單據明細是否屬於某產品（p_id、主檔零件號、任一明細零件號、品名末段） */
export function lineMatchesProduct(product, item) {
    if (!product || !item) return false;

    const pidItem = String(item.p_id ?? '').trim();
    const pidProd = String(product.p_id ?? '').trim();
    if (pidItem && pidProd && pidItem === pidProd) return true;

    const ipRaw = String(item.part_number || '').trim();
    const ip = normPartRef(ipRaw);
    if (ip) {
        const mainPn = normPartRef(product.part_number || '');
        if (mainPn && mainPn === ip) return true;
        const hitAlternate = (product.part_numbers || []).some(
            (pn) => normPartRef(pn.part_number || '') === ip
        );
        if (hitAlternate) return true;
    }

    const lineName = String(item.name || '').trim();
    const prodName = String(product.name || '').trim();
    if (lineName && prodName && lineName === prodName) {
        if (!ipRaw && !pidItem) return true;
    }

    return false;
}

function buildNoteLine(item, doc) {
    const line = String(item.note || '').trim();
    if (line) return line;
    const docNote = String(doc.notes || '').trim();
    if (docNote.length > 100) return `${docNote.slice(0, 97)}…`;
    return docNote || '—';
}

function pushCustomerRow(rows, doc, item, kindTag) {
    const unitRaw = item.unit_price;
    const hasUnitPrice = unitRaw !== undefined && unitRaw !== null && unitRaw !== '' && Number.isFinite(Number(unitRaw));
    rows.push({
        doc_id: doc.doc_id || '',
        party: doc.customer_name || doc.customer_id || '—',
        date: doc.date || '',
        unit_price: hasUnitPrice ? Number(unitRaw) : null,
        hasUnitPrice,
        qty: Number(item.qty) || 0,
        note: buildNoteLine(item, doc),
        currency: doc.currency || 'TWD',
        doc_kind: kindTag,
    });
}

/** 客戶端：銷貨單 + 報價單（多數環境下報價資料較完整） */
export function collectCustomerSalesHistory(product, salesOrders = [], quotations = []) {
    const rows = [];
    for (const doc of salesOrders) {
        if (!doc?.items?.length) continue;
        for (const item of doc.items) {
            if (!lineMatchesProduct(product, item)) continue;
            pushCustomerRow(rows, doc, item, '銷貨');
        }
    }
    for (const doc of quotations) {
        if (!doc?.items?.length) continue;
        for (const item of doc.items) {
            if (!lineMatchesProduct(product, item)) continue;
            pushCustomerRow(rows, doc, item, '報價');
        }
    }
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return rows;
}

function pushSupplierRow(rows, doc, item, kindTag) {
    const unitRaw = item.unit_price;
    const hasUnitPrice = unitRaw !== undefined && unitRaw !== null && unitRaw !== '' && Number.isFinite(Number(unitRaw));
    rows.push({
        doc_id: doc.doc_id || '',
        party: doc.supplier_name || doc.supplier_id || '—',
        date: doc.date || '',
        unit_price: hasUnitPrice ? Number(unitRaw) : null,
        hasUnitPrice,
        qty: Number(item.qty) || 0,
        note: buildNoteLine(item, doc),
        currency: doc.currency || 'TWD',
        doc_kind: kindTag,
    });
}

/** 廠商端：進貨單 + 詢價單（詢價常無單價，畫面顯示為 —） */
export function collectSupplierPurchaseHistory(product, purchaseOrders = [], inquiries = []) {
    const rows = [];
    for (const doc of purchaseOrders) {
        if (!doc?.items?.length) continue;
        for (const item of doc.items) {
            if (!lineMatchesProduct(product, item)) continue;
            pushSupplierRow(rows, doc, item, '進貨');
        }
    }
    for (const doc of inquiries) {
        if (!doc?.items?.length) continue;
        for (const item of doc.items) {
            if (!lineMatchesProduct(product, item)) continue;
            pushSupplierRow(rows, doc, item, '詢價');
        }
    }
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return rows;
}
