/**
 * 進口估價單「品項明細」專用 CSV 匯出／匯入（含 PIM、稅則 enrichment 與衝突欄位標記）
 */

import { createDefaultEstimateLine } from '../store/useImportEstimateStore';
import { csvEscape, parseCsvDocument, IMPORT_ESTIMATE_LINE_KEYS } from './importEstimateBackup';
import { normalizeHsCode, findByHsCode } from './tariffService';

export const LINES_CSV_META_KIND = 'erp_import_estimate_lines_csv';
export const LINES_CSV_META_VERSION = 2;

/** 由 PIM 對照 p_id 衍生的只讀匯出欄（匯入時忽略） */
export const LINE_CSV_PIM_EXTRA_KEYS = [
    'pim_part_number',
    'pim_car_model_year',
    'pim_name_spec',
    'pim_brand',
    'pim_stock_status',
];

export const LINE_CSV_ALL_EXPORT_KEYS = [...IMPORT_ESTIMATE_LINE_KEYS, ...LINE_CSV_PIM_EXTRA_KEYS];

const IMPORT_MERGE_KEYS = new Set(IMPORT_ESTIMATE_LINE_KEYS);

export const DEFAULT_LINES_CSV_KEYS = [
    ...IMPORT_ESTIMATE_LINE_KEYS.filter((k) => k !== 'id'),
    ...LINE_CSV_PIM_EXTRA_KEYS,
];

export function findProductByPartRef(products, ref) {
    const s = String(ref || '').trim();
    if (!s) return null;
    let p = products.find((x) => x.p_id === s);
    if (p) return p;
    p = products.find((x) => String(x.part_number || '').trim() === s);
    if (p) return p;
    for (const pr of products) {
        if ((pr.part_numbers || []).some((pn) => String(pn.part_number || '').trim() === s)) {
            return pr;
        }
    }
    return null;
}

function buildPimOnlyPatch(product) {
    const rawHs = String(product.hs_code || '').trim();
    const digits = rawHs.replace(/\D/g, '');
    return {
        p_id: product.p_id || '',
        productName: product.name || '',
        note: product.name || '',
        exwForeign:
            product.base_cost != null && product.base_cost !== '' ? String(product.base_cost) : '',
        hsCode: digits.length >= 11 ? digits.slice(0, 11) : rawHs.replace(/\s/g, ''),
    };
}

function coerceMergedLine(base, picked) {
    const merged = { ...base, ...picked };
    merged.dutyRate = Number(merged.dutyRate);
    if (Number.isNaN(merged.dutyRate)) merged.dutyRate = 0;
    merged.exciseRate = Number(merged.exciseRate);
    if (Number.isNaN(merged.exciseRate)) merged.exciseRate = 0;
    merged.goodsTaxRateHint = Number(merged.goodsTaxRateHint);
    if (Number.isNaN(merged.goodsTaxRateHint)) merged.goodsTaxRateHint = 0;
    const tm = merged.tariffMiss;
    merged.tariffMiss = tm === true || tm === 'true' || tm === '1' || tm === 1;
    if (!merged.id || String(merged.id).trim() === '') merged.id = base.id;
    return merged;
}

function displayCarModel(p) {
    if (!p) return '-';
    const activeCar = (p.part_numbers || []).find((pn) => pn.car_model);
    if (activeCar) return activeCar.car_model;
    const c0 = (p.car_models || [])[0];
    return p.car_model || (typeof c0 === 'string' ? c0 : c0?.model) || '-';
}

function displayCarYear(p) {
    if (!p) return '不限年份';
    const activeCar = (p.part_numbers || []).find((pn) => pn.year);
    if (activeCar) return activeCar.year;
    const c0 = (p.car_models || [])[0];
    const cStr = typeof c0 === 'string' ? c0 : c0?.year;
    return p.year || (cStr?.match(/\d{4}-\d{4}/) ? cStr.match(/\d{4}-\d{4}/)[0] : cStr) || '不限年份';
}

function stockStatusText(p) {
    if (!p) return '';
    const stockNum = Number(p.stock) || 0;
    const safetyNum = Number(p.safety_stock) || 0;
    const belowSafety = safetyNum > 0 && stockNum < safetyNum;
    return `現貨 ${stockNum}；安全庫存 ${safetyNum}${belowSafety ? '（低於安全庫存）' : ''}`;
}

const PIM_EXTRA_KEY_SET = new Set(LINE_CSV_PIM_EXTRA_KEYS);

/**
 * @param {object} line
 * @param {object|null} product
 * @param {string} key — one of LINE_CSV_PIM_EXTRA_KEYS
 */
export function getLineCsvPimDerivedCell(line, product, key) {
    if (!PIM_EXTRA_KEY_SET.has(key)) return line[key];
    if (!product) return '';
    const mainPN = product.part_numbers?.[0] || {};
    switch (key) {
        case 'pim_part_number':
            return String(product.part_number || mainPN.part_number || '').trim() || product.p_id || '';
        case 'pim_car_model_year':
            return `${displayCarModel(product)} / ${displayCarYear(product)}`;
        case 'pim_name_spec':
            return [product.name || '', product.specifications || ''].filter(Boolean).join(' / ');
        case 'pim_brand':
            return String(product.brand || mainPN.brand || '').trim();
        case 'pim_stock_status':
            return stockStatusText(product);
        default:
            return '';
    }
}

function mergeCsvRowIntoLine(base, rowObj, columnKeys) {
    const picked = {};
    for (const k of columnKeys) {
        if (Object.prototype.hasOwnProperty.call(rowObj, k)) {
            picked[k] = rowObj[k];
        }
    }
    return coerceMergedLine(base, picked);
}

/** 欄位在 CSV 是否為「有填寫」（空白儲存格不算） */
export function rawCsvMeaningful(val) {
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return val.trim() !== '';
    if (typeof val === 'number') return Number.isFinite(val);
    if (typeof val === 'boolean') return true;
    return false;
}

function normCompare(a, b, key) {
    if (key === 'dutyRate' || key === 'exciseRate' || key === 'goodsTaxRateHint') {
        return Math.abs(Number(a) - Number(b)) <= 1e-9;
    }
    if (key === 'tariffMiss') {
        const ba = Boolean(a === true || a === 'true' || a === '1' || a === 1);
        const bb = Boolean(b === true || b === 'true' || b === '1' || b === 1);
        return ba === bb;
    }
    return String(a ?? '').trim() === String(b ?? '').trim();
}

function tariffHitPatch(row) {
    return {
        dutyRate: row.dutyRate,
        exciseRate: 0,
        hsCode: row.hsCode,
        nameZh: row.nameZh,
        inputRegulation: row.inputRegulation,
        dutyRateText: row.dutyRateText,
        goodsTaxRateHint: row.goodsTaxRateHint ?? 0,
        tariffMiss: false,
    };
}

function tariffMissPatch() {
    return {
        tariffMiss: true,
        nameZh: '',
        dutyRateText: '',
        inputRegulation: '',
        goodsTaxRateHint: 0,
        dutyRate: 0,
        exciseRate: 0,
    };
}

/**
 * @param {object} rowObj — 由 CSV 列建出之物件
 * @param {string[]} presentKeys — 本檔案有的欄位名（表頭，僅含已知 line keys）
 * @param {object|null} tariffIndex — loadTariffTable() 結果，未完成可為 null
 * @param {object[]} products
 * @returns {{ line: object, conflicts: Record<string, true> }}
 */
export function processImportedEstimateLine(rowObj, presentKeys, tariffIndex, products) {
    const pk = new Set((presentKeys || []).filter((k) => k && IMPORT_MERGE_KEYS.has(k)));
    const base = createDefaultEstimateLine();
    const afterCsv = mergeCsvRowIntoLine(base, rowObj, [...pk]);

    const snapshotRaw = {};
    for (const k of pk) {
        if (Object.prototype.hasOwnProperty.call(rowObj, k)) snapshotRaw[k] = rowObj[k];
    }

    const conflicts = {};
    const mark = (k) => {
        conflicts[k] = true;
    };

    let line = { ...afterCsv };

    const pidRef = String(line.p_id || '').trim();
    const product = pidRef ? findProductByPartRef(products, pidRef) : null;

    if (product) {
        const pimPatch = buildPimOnlyPatch(product);
        for (const key of Object.keys(pimPatch)) {
            if (!pk.has(key)) continue;
            if (rawCsvMeaningful(snapshotRaw[key]) && !normCompare(afterCsv[key], pimPatch[key], key)) {
                mark(key);
            }
        }
        line = { ...line, ...pimPatch };
    }

    if (tariffIndex) {
        const kHs = normalizeHsCode(line.hsCode);
        if (kHs) {
            const row = findByHsCode(tariffIndex, kHs);
            if (row) {
                const tPatch = tariffHitPatch(row);
                for (const key of Object.keys(tPatch)) {
                    if (!pk.has(key)) continue;
                    if (rawCsvMeaningful(snapshotRaw[key]) && !normCompare(afterCsv[key], tPatch[key], key)) {
                        mark(key);
                    }
                }
                line = { ...line, ...tPatch };
            } else {
                const tPatch = tariffMissPatch();
                for (const key of Object.keys(tPatch)) {
                    if (!pk.has(key)) continue;
                    if (rawCsvMeaningful(snapshotRaw[key]) && !normCompare(afterCsv[key], tPatch[key], key)) {
                        mark(key);
                    }
                }
                line = { ...line, ...tPatch, hsCode: line.hsCode };
            }
        }
    }

    return { line, conflicts };
}

/**
 * @param {object[]} lineItems
 * @param {string[]} keys
 * @param {object[]} [products] — PIM 列表，供 pim_* 欄對照 line.p_id
 */
export function buildEstimateLinesCsv(lineItems, keys, products = []) {
    const cols = keys.length ? keys : [...DEFAULT_LINES_CSV_KEYS];
    const items = Array.isArray(lineItems) ? lineItems : [];
    const plist = Array.isArray(products) ? products : [];
    const out = [];
    out.push([`# ${LINES_CSV_META_KIND}`, String(LINES_CSV_META_VERSION)].join(','));
    out.push(cols.map((k) => csvEscape(k)).join(','));
    for (const line of items) {
        const product = line.p_id ? plist.find((x) => x.p_id === line.p_id) : null;
        out.push(
            cols
                .map((k) => csvEscape(getLineCsvPimDerivedCell(line, product, k)))
                .join(','),
        );
    }
    return out.join('\r\n');
}

export function downloadLinesCsv(filename, csvText) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * @param {string} text
 * @returns {{ headerKeys: string[], rows: object[] } | { error: string }}
 */
export function parseEstimateLinesCsv(text) {
    if (typeof text !== 'string' || !String(text).trim()) {
        return { error: 'empty' };
    }
    const allRows = parseCsvDocument(text).filter((r) => r.some((c) => String(c).trim() !== ''));
    if (allRows.length < 2) {
        return { error: 'too_few_rows' };
    }

    let hi = 0;
    if (String(allRows[0][0] || '').trim().startsWith('#')) {
        hi = 1;
    }
    if (allRows.length <= hi + 1) {
        return { error: 'no_data' };
    }

    const headers = allRows[hi].map((h) => String(h).trim());
    if (!headers.some((h) => IMPORT_MERGE_KEYS.has(h))) {
        return { error: 'bad_headers' };
    }

    const dataRows = allRows.slice(hi + 1);
    const rows = [];
    for (const cells of dataRows) {
        const rowObj = {};
        headers.forEach((h, i) => {
            if (h) rowObj[h] = cells[i] !== undefined ? cells[i] : '';
        });
        const hasContent = headers.some(
            (h) => h && IMPORT_MERGE_KEYS.has(h) && String(rowObj[h] ?? '').trim() !== '',
        );
        if (hasContent) rows.push(rowObj);
    }

    if (rows.length === 0) {
        return { error: 'no_rows' };
    }

    return { headerKeys: headers.filter((h) => IMPORT_MERGE_KEYS.has(h)), rows };
}
