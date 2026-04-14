/** 進口估價單：可選欄位匯出／匯入（CSV；仍可讀取舊版 JSON 匯入） */

import { createDefaultEstimateLine } from '../store/useImportEstimateStore';

export const IMPORT_ESTIMATE_EXPORT_KIND = 'erp-import-estimate-export';
export const IMPORT_ESTIMATE_SCHEMA_VERSION = 1;
export const CSV_META_KIND = 'erp_import_estimate_csv';
export const CSV_META_VERSION = 1;

/** 單頭可匯出欄位（與 store／編輯頁一致） */
export const IMPORT_ESTIMATE_HEADER_KEYS = [
    'estimate_id',
    'date',
    'supplier_id',
    'supplier_name',
    'notes',
    'sharedCostSplit',
    'currency',
    'exchangeBuffer',
    'inlandDocTwd',
    'intlFreightTwd',
    'insuranceCifFactor',
    'insuranceRate',
    'customsFeeTwd',
    'doFeeTwd',
    'ediFeeTwd',
    'lclFeeTwd',
    'terminalFeeTwd',
    'domesticFreightTwd',
    'vatRatePct',
    'miscBudgetPct',
    'retailMarginPct',
    'breakdown',
    'createdAt',
    'updatedAt',
];

/** 品項列可匯出欄位 */
export const IMPORT_ESTIMATE_LINE_KEYS = [
    'id',
    'p_id',
    'productName',
    'note',
    'exwForeign',
    'quantity',
    'volPerUnit',
    'weightPerUnit',
    'dutyRate',
    'exciseRate',
    'hsCode',
    'nameZh',
    'inputRegulation',
    'dutyRateText',
    'goodsTaxRateHint',
    'tariffMiss',
];

export const DEFAULT_EXPORT_HEADER_KEYS = IMPORT_ESTIMATE_HEADER_KEYS.filter(
    (k) => k !== 'createdAt' && k !== 'updatedAt' && k !== 'breakdown',
);

export const DEFAULT_EXPORT_LINE_KEYS = [...IMPORT_ESTIMATE_LINE_KEYS];

const HEADER_KEY_SET = new Set(IMPORT_ESTIMATE_HEADER_KEYS);
const LINE_KEY_SET = new Set(IMPORT_ESTIMATE_LINE_KEYS);
const ALLOWED_HEADER_PATCH = new Set(IMPORT_ESTIMATE_HEADER_KEYS.filter((k) => k !== 'estimate_id'));

function pickObject(obj, keys) {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) {
            out[k] = obj[k];
        }
    }
    return out;
}

function serializeCell(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/** RFC 4180 風格：含逗號、換行、雙引號者以雙引號包裹，內部 " 改為 "" */
export function csvEscape(value) {
    const s = serializeCell(value);
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

/** 將文字解析為二維陣列（支援 UTF-8 BOM） */
export function parseCsvDocument(text) {
    const s = String(text).replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rows = [];
    let row = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < s.length; i += 1) {
        const c = s[i];
        if (inQuotes) {
            if (c === '"') {
                if (s[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cur += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(cur);
            cur = '';
        } else if (c === '\n') {
            row.push(cur);
            rows.push(row);
            row = [];
            cur = '';
        } else {
            cur += c;
        }
    }
    row.push(cur);
    rows.push(row);
    return rows;
}

/**
 * 每列品項一資料列，單頭欄位在各列重複。
 * 第一列為註解：# erp_import_estimate_csv,1（供辨識，匯入時略過）。
 * @param {object} doc
 * @param {string[]} headerKeys
 * @param {string[]} lineKeys
 */
export function buildImportEstimateCsv(doc, headerKeys, lineKeys) {
    const lineItems = Array.isArray(doc.lineItems) ? doc.lineItems : [];
    const lineKeysEff =
        lineKeys.length > 0 ? lineKeys : lineItems.length > 0 ? [...DEFAULT_EXPORT_LINE_KEYS] : [];
    const cols = [...headerKeys, ...lineKeysEff];
    const out = [];

    out.push([`# ${CSV_META_KIND}`, String(CSV_META_VERSION)].join(','));
    out.push(cols.map((k) => csvEscape(k)).join(','));

    const headerCells = (d) => headerKeys.map((k) => csvEscape(d[k]));
    const lineCells = (line) => lineKeysEff.map((k) => csvEscape(line[k]));

    if (lineItems.length === 0) {
        out.push([...headerCells(doc), ...lineKeysEff.map(() => '')].join(','));
    } else {
        for (const line of lineItems) {
            out.push([...headerCells(doc), ...lineCells(line)].join(','));
        }
    }

    return out.join('\r\n');
}

function coerceLineFromCsv(picked) {
    const base = createDefaultEstimateLine();
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

function coerceHeaderPatchValue(key, val) {
    if (val === '' || val === undefined || val === null) return val;
    if (key === 'breakdown' && typeof val === 'string') {
        const t = val.trim();
        if (t.startsWith('{') || t.startsWith('[')) {
            try {
                return JSON.parse(val);
            } catch {
                return val;
            }
        }
    }
    if (key === 'exchangeBuffer') {
        const n = Number(val);
        return Number.isNaN(n) ? val : n;
    }
    return val;
}

function mergeImportedLineRow(row, lineKeys) {
    const keys = lineKeys?.length ? lineKeys : IMPORT_ESTIMATE_LINE_KEYS;
    const picked = pickObject(row, keys);
    return coerceLineFromCsv(picked);
}

function inferLineKeysFromRows(lineItemsRaw) {
    const keys = new Set();
    for (const r of lineItemsRaw) {
        if (r && typeof r === 'object') {
            for (const k of Object.keys(r)) keys.add(k);
        }
    }
    const ordered = IMPORT_ESTIMATE_LINE_KEYS.filter((k) => keys.has(k));
    for (const k of keys) {
        if (!ordered.includes(k)) ordered.push(k);
    }
    return ordered.length ? ordered : [...IMPORT_ESTIMATE_LINE_KEYS];
}

/**
 * @param {{ rawHeader: object, lineItemsRaw: array, lineKeysUsed: string[] }}
 */
export function buildPatchFromNormalized(norm) {
    const { rawHeader, lineItemsRaw, lineKeysUsed } = norm;
    const patch = {};
    for (const k of Object.keys(rawHeader)) {
        if (ALLOWED_HEADER_PATCH.has(k)) {
            patch[k] = coerceHeaderPatchValue(k, rawHeader[k]);
        }
    }
    if (lineItemsRaw.length > 0) {
        patch.lineItems = lineItemsRaw.map((row) => mergeImportedLineRow(row, lineKeysUsed));
    }
    return { patch };
}

/**
 * @param {unknown} parsed
 * @returns {{ rawHeader: object, lineItemsRaw: array, lineKeysUsed: string[] } | { error: string }}
 */
export function parseImportEstimateJson(parsed) {
    if (!parsed || typeof parsed !== 'object') {
        return { error: 'invalid_json_object' };
    }

    let rawHeader = {};
    let lineItemsRaw = [];

    if (parsed.kind === IMPORT_ESTIMATE_EXPORT_KIND && parsed.header && typeof parsed.header === 'object') {
        rawHeader = { ...parsed.header };
        lineItemsRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    } else {
        const skip = new Set(['lineItems']);
        for (const k of Object.keys(parsed)) {
            if (!skip.has(k)) rawHeader[k] = parsed[k];
        }
        lineItemsRaw = Array.isArray(parsed.lineItems) ? parsed.lineItems : [];
    }

    const lineKeysUsed = inferLineKeysFromRows(lineItemsRaw);

    return { rawHeader, lineItemsRaw, lineKeysUsed };
}

/**
 * @param {string} text
 * @returns {{ rawHeader: object, lineItemsRaw: array, lineKeysUsed: string[] } | { error: string }}
 */
export function parseImportEstimateCsv(text) {
    if (typeof text !== 'string' || !String(text).trim()) {
        return { error: 'empty_csv' };
    }

    const rows = parseCsvDocument(text).filter((r) => r.some((cell) => String(cell).trim() !== ''));
    if (rows.length < 2) {
        return { error: 'csv_too_few_rows' };
    }

    let headerRowIndex = 0;
    const firstCell = String(rows[0][0] ?? '').trim();
    if (firstCell.startsWith('#')) {
        headerRowIndex = 1;
    }

    if (rows.length <= headerRowIndex + 1) {
        return { error: 'csv_no_data' };
    }

    const headers = rows[headerRowIndex].map((h) => String(h).trim());
    const known = new Set([...IMPORT_ESTIMATE_HEADER_KEYS, ...IMPORT_ESTIMATE_LINE_KEYS]);
    if (!headers.some((h) => known.has(h))) {
        return { error: 'csv_unknown_headers' };
    }

    const lineKeyCols = headers.filter((h) => LINE_KEY_SET.has(h));
    const dataRows = rows.slice(headerRowIndex + 1);

    const toObj = (cells) => {
        const o = {};
        headers.forEach((h, i) => {
            if (h) o[h] = cells[i] !== undefined ? cells[i] : '';
        });
        return o;
    };

    const firstObj = toObj(dataRows[0]);
    const rawHeader = pickObject(firstObj, headers.filter((h) => HEADER_KEY_SET.has(h)));

    const lineItemsRaw = [];
    for (const cells of dataRows) {
        const o = toObj(cells);
        const pickKeys = lineKeyCols.length > 0 ? lineKeyCols : IMPORT_ESTIMATE_LINE_KEYS;
        const line = pickObject(o, pickKeys);
        const keysForEmpty = lineKeyCols.length > 0 ? lineKeyCols : IMPORT_ESTIMATE_LINE_KEYS;
        const hasLine = keysForEmpty.some((k) => String(line[k] ?? '').trim() !== '');
        if (hasLine) lineItemsRaw.push(line);
    }

    const lineKeysUsed = lineKeyCols.length > 0 ? lineKeyCols : [...IMPORT_ESTIMATE_LINE_KEYS];

    return { rawHeader, lineItemsRaw, lineKeysUsed };
}

/**
 * @param {unknown} parsed
 * @returns {{ patch: object } | { error: string }}
 */
export function importEstimateToStorePatch(parsed) {
    const norm = parseImportEstimateJson(parsed);
    if ('error' in norm) return norm;
    return buildPatchFromNormalized(norm);
}

/**
 * @param {string} text — CSV 或舊版 JSON
 * @returns {{ patch: object } | { error: string }}
 */
export function importEstimateFromBackupText(text) {
    const t = text.trim();
    if (t.startsWith('{')) {
        try {
            return importEstimateToStorePatch(JSON.parse(t));
        } catch {
            return { error: 'invalid_json' };
        }
    }
    const norm = parseImportEstimateCsv(text);
    if ('error' in norm) return norm;
    return buildPatchFromNormalized(norm);
}

export function downloadCsv(filename, csvText) {
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** 舊版／除錯用 JSON 匯出結構 */
export function buildImportEstimateExportPayload(doc, headerKeys, lineKeys) {
    const header = pickObject(doc, headerKeys);
    const rawLines = Array.isArray(doc.lineItems) ? doc.lineItems : [];
    const lineItems = rawLines.map((row) => pickObject(row, lineKeys));
    return {
        schemaVersion: IMPORT_ESTIMATE_SCHEMA_VERSION,
        kind: IMPORT_ESTIMATE_EXPORT_KIND,
        exportedAt: new Date().toISOString(),
        header,
        lineItems,
    };
}
