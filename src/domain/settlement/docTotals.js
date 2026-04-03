/**
 * 與單據編輯器一致：小計 + VAT（未套用 discount 欄於總額，與 DocumentEditorPage 相同）
 * 外幣：grandTotal(doc 幣) × exchange_rate → 換算為 TWD；無匯率且非 TWD 時使用 1（建議於單據填寫匯率）
 */
export function monthKeyFromISODate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const y = dateStr.slice(0, 4);
    const m = dateStr.slice(5, 7);
    if (y.length !== 4 || m.length !== 2) return '';
    return `${y}-${m}`;
}

export function docGrandTotalInDocCurrency(doc, vatEnabled, vatRate) {
    const items = doc?.items || [];
    const subtotal = items.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.unit_price) || 0), 0);
    const vat = vatEnabled ? subtotal * ((Number(vatRate) || 0) / 100) : 0;
    return subtotal + vat;
}

/** @returns {number} TWD 金額「分」 */
export function docAmountMinorTwd(doc, vatEnabled, vatRate, defaultCurrency = 'TWD') {
    const grand = docGrandTotalInDocCurrency(doc, vatEnabled, vatRate);
    const cur = (doc?.currency || defaultCurrency || 'TWD').toUpperCase();
    const rate = Number(doc?.exchange_rate);
    const mult = cur === 'TWD' || cur === '' ? 1 : (Number.isFinite(rate) && rate > 0 ? rate : 1);
    const twd = grand * mult;
    return Math.round(twd * 100);
}

/**
 * 應收認列：不依銷貨單「狀態」判斷；只要有建檔之銷貨單（有 doc_id）即納入應收同步。
 * 狀態欄位於製單暫屏蔽，故不在此篩選。
 */
export function salesOrderQualifiesForAR(doc) {
    if (!doc?.doc_id || doc.type !== 'sales') return false;
    return true;
}

export function purchaseOrderQualifiesForAP(doc) {
    if (!doc?.doc_id || doc.type !== 'purchase') return false;
    if (doc.status === 'cancelled') return false;
    return doc.status === 'received' || doc.status === 'in_transit';
}
