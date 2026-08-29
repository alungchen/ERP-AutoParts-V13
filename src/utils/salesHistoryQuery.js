import {
    filterProductsByQuery,
    hasAnyProductQuery,
    normalizePartNumber,
} from './filterProductsByQuery';

const escapeRegExp = (string) => string.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

/** 從已載入銷貨單據推算可查詢的日期範圍 */
export function computeSalesDateExtent(salesOrders = [], salesReturns = []) {
    const dates = [];
    for (const doc of [...salesOrders, ...salesReturns]) {
        if (doc?.date) dates.push(String(doc.date));
    }
    if (dates.length === 0) return { min: '', max: '', count: 0 };
    dates.sort();
    return { min: dates[0], max: dates[dates.length - 1], count: dates.length };
}

/** 單據明細欄位直接比對（品名常在明細 description，不一定等於產品主檔品名） */
function itemMatchesQueryDirect(item, query) {
    if (!item || !hasAnyProductQuery(query)) return !hasAnyProductQuery(query);

    const itemName = String(item.name || '').toLowerCase();
    const itemNote = String(item.note || '').toLowerCase();
    const itemPn = String(item.part_number || item.p_id || '').toLowerCase();
    const haystack = `${itemName} ${itemNote} ${itemPn}`;

    if (query.model) {
        const q = query.model.toLowerCase();
        if (!haystack.includes(q)) return false;
    }

    if (query.part) {
        const q = query.part.toLowerCase();
        if (!itemName.includes(q) && !itemNote.includes(q)) return false;
    }

    if (query.partNumber) {
        const cleanQuery = query.partNumber.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\u00ad\u200b-\u200f\uFEFF\s\-_]/g, '');
        const pattern = cleanQuery.split('*').map(escapeRegExp).join('.*');
        const regex = new RegExp(pattern, 'i');
        const pnNorm = normalizePartNumber(item.part_number || item.p_id || '');
        if (!regex.test(pnNorm) && !regex.test(normalizePartNumber(item.p_id || ''))) return false;
    }

    if (query.year) {
        if (!haystack.includes(query.year)) return false;
    }

    if (query.spec) {
        const q = query.spec.toLowerCase();
        if (!itemNote.includes(q) && !itemName.includes(q)) return false;
    }

    if (query.brand) {
        const q = query.brand.toLowerCase();
        if (!haystack.includes(q)) return false;
    }

    return true;
}

function inDateRange(date, dateFrom, dateTo) {
    const d = String(date || '');
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
}

function matchesCustomer(doc, customerQuery) {
    const q = String(customerQuery || '').trim().toLowerCase();
    if (!q) return true;
    const name = String(doc.customer_name || '').toLowerCase();
    const id = String(doc.customer_id || '').toLowerCase();
    return name.includes(q) || id.includes(q);
}

function buildProductIndexes(products) {
    const byPid = new Map();
    const byPartNorm = new Map();
    for (const p of products) {
        if (p.p_id) byPid.set(p.p_id, p);
        const mainPn = normalizePartNumber(p.part_number);
        if (mainPn && !byPartNorm.has(mainPn)) byPartNorm.set(mainPn, p);
        for (const pn of p.part_numbers || []) {
            const n = normalizePartNumber(pn.part_number);
            if (n && !byPartNorm.has(n)) byPartNorm.set(n, p);
        }
    }
    return { byPid, byPartNorm };
}

function buildMatchedProductKeys(matchedProducts) {
    const pids = new Set();
    const partNorms = new Set();
    for (const p of matchedProducts) {
        if (p.p_id) pids.add(p.p_id);
        const main = normalizePartNumber(p.part_number);
        if (main) partNorms.add(main);
        for (const pn of p.part_numbers || []) {
            const n = normalizePartNumber(pn.part_number);
            if (n) partNorms.add(n);
        }
    }
    return { pids, partNorms };
}

function createFilterContext(products, appliedQuery) {
    const hasFilter = hasAnyProductQuery(appliedQuery);
    const matchedProducts = hasFilter ? filterProductsByQuery(products, appliedQuery) : [];
    return {
        hasFilter,
        matchedKeys: hasFilter ? buildMatchedProductKeys(matchedProducts) : null,
        indexes: buildProductIndexes(products),
    };
}

function itemMatchesCatalogFast(item, keys) {
    if (!keys) return false;
    const pid = String(item.p_id || '').trim();
    if (pid && keys.pids.has(pid)) return true;
    const pn = normalizePartNumber(item.part_number || item.p_id || '');
    return Boolean(pn && keys.partNorms.has(pn));
}

function itemMatchesProductFilters(item, appliedQuery, ctx) {
    if (!ctx.hasFilter) return true;
    if (itemMatchesQueryDirect(item, appliedQuery)) return true;
    return itemMatchesCatalogFast(item, ctx.matchedKeys);
}

function findProductForItemFast(item, indexes) {
    const pid = String(item.p_id || '').trim();
    if (pid && indexes.byPid.has(pid)) return indexes.byPid.get(pid);
    const pn = normalizePartNumber(item.part_number || item.p_id || '');
    if (pn && indexes.byPartNorm.has(pn)) return indexes.byPartNorm.get(pn);
    return null;
}

function getItemSign(doc) {
    return doc.type === 'salesReturn' ? -1 : 1;
}

function getItemKey(item) {
    const pid = String(item.p_id || '').trim();
    if (pid) return `pid:${pid}`;
    const pn = String(item.part_number || '').trim();
    if (pn) return `pn:${pn.toLowerCase()}`;
    const name = String(item.name || '').trim();
    return `name:${name.toLowerCase() || 'unknown'}`;
}

function enrichRowFromProduct(row, product) {
    if (!product) return row;
    return {
        ...row,
        car_model: row.car_model || product.car_model || (product.part_numbers || [])[0]?.car_model || '',
        brand: row.brand || product.brand || (product.part_numbers || [])[0]?.brand || '',
        year: row.year || product.year || (product.part_numbers || [])[0]?.year || '',
        specifications: row.specifications || product.specifications || '',
    };
}

/** 期間內銷貨／銷退明細（可選客戶、產品篩選） */
export function collectSalesLineRows({
    salesOrders = [],
    salesReturns = [],
    dateFrom = '',
    dateTo = '',
    customer = '',
    appliedQuery = {},
    products = [],
}) {
    const docs = [...salesOrders, ...salesReturns];
    const rows = [];
    const ctx = createFilterContext(products, appliedQuery);

    for (const doc of docs) {
        if (!inDateRange(doc.date, dateFrom, dateTo)) continue;
        if (!matchesCustomer(doc, customer)) continue;

        const sign = getItemSign(doc);
        for (const item of doc.items || []) {
            if (!itemMatchesProductFilters(item, appliedQuery, ctx)) continue;

            const qty = (Number(item.qty) || 0) * sign;
            const unitPrice = Number(item.unit_price) || 0;
            const amount = qty * unitPrice;
            const product = findProductForItemFast(item, ctx.indexes);

            rows.push(enrichRowFromProduct({
                doc_id: doc.doc_id || '',
                date: doc.date || '',
                customer_id: doc.customer_id || '',
                customer_name: doc.customer_name || doc.customer_id || '—',
                doc_type: doc.type === 'salesReturn' ? '銷退' : '銷貨',
                p_id: item.p_id || product?.p_id || '',
                part_number: item.part_number || product?.part_number || '',
                name: item.name || product?.name || '',
                car_model: product?.car_model || '',
                brand: product?.brand || '',
                year: product?.year || '',
                specifications: product?.specifications || '',
                qty,
                unit_price: unitPrice,
                amount,
                currency: doc.currency || 'TWD',
            }, product));
        }
    }

    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.doc_id).localeCompare(String(a.doc_id)));
    return rows;
}

/** 期間內產品銷售排行（數量與金額） */
export function buildSalesRanking({
    salesOrders = [],
    salesReturns = [],
    dateFrom = '',
    dateTo = '',
    appliedQuery = {},
    products = [],
    sortBy = 'amount',
}) {
    const lineRows = collectSalesLineRows({
        salesOrders,
        salesReturns,
        dateFrom,
        dateTo,
        customer: '',
        appliedQuery,
        products,
    });

    const grouped = new Map();

    for (const row of lineRows) {
        const key = getItemKey(row);
        if (!grouped.has(key)) {
            grouped.set(key, {
                key,
                p_id: row.p_id,
                part_number: row.part_number,
                name: row.name,
                car_model: row.car_model,
                brand: row.brand,
                year: row.year,
                specifications: row.specifications,
                totalQty: 0,
                totalAmount: 0,
                docCount: 0,
                _docIds: new Set(),
            });
        }
        const agg = grouped.get(key);
        agg.totalQty += row.qty;
        agg.totalAmount += row.amount;
        if (row.doc_id) {
            agg._docIds.add(row.doc_id);
        }
        if (!agg.name && row.name) agg.name = row.name;
        if (!agg.part_number && row.part_number) agg.part_number = row.part_number;
        if (!agg.car_model && row.car_model) agg.car_model = row.car_model;
        if (!agg.brand && row.brand) agg.brand = row.brand;
    }

    const result = Array.from(grouped.values()).map((row) => ({
        ...row,
        docCount: row._docIds.size,
        _docIds: undefined,
    }));

    const sortKey = sortBy === 'qty' ? 'totalQty' : 'totalAmount';
    result.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0) || (b.totalQty || 0) - (a.totalQty || 0));

    return result.map((row, index) => ({ ...row, rank: index + 1 }));
}
