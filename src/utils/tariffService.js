import { parseCsvLine } from './csvUtils';

/** @typedef {{ hsCode: string, nameZh: string, nameEn: string, dutyRate: number, dutyRateText: string, goodsTaxRateText: string, goodsTaxRateHint: number, inputRegulation: string, col2Text: string, col3Text: string }} TariffRow */

let cached = null;
let loadPromise = null;

/** 自儲存格字串擷取開頭百分比為小數（例如 "2.5%"、"10%"、"0% (PA..."） */
export function parseLeadingPercent(cell) {
    if (cell == null || String(cell).trim() === '') return 0;
    const m = String(cell).trim().match(/^([\d.]+)\s*%/);
    if (!m) return 0;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n / 100 : 0;
}

/** HS Code 正規化為 11 碼數字；不足或不合法回傳 null */
export function normalizeHsCode(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (digits.length !== 11) return null;
    return digits;
}

function rowFromCells(cells) {
    const [
        hsRaw,
        nameZh = '',
        nameEn = '',
        col1 = '',
        col2 = '',
        col3 = '',
        ,
        ,
        auditRule = '',
        inputReg = '',
    ] = cells;

    const hsCode = String(hsRaw || '').replace(/\D/g, '');
    if (hsCode.length !== 11) return null;

    return {
        hsCode,
        nameZh: String(nameZh || '').trim(),
        nameEn: String(nameEn || '').trim(),
        dutyRate: parseLeadingPercent(col1),
        dutyRateText: String(col1 || '').trim(),
        goodsTaxRateText: String(col2 || '').trim(),
        /** 第二欄首段百分比 — 實務上多為優惠關稅參考，作為貨物稅提示時須人工複核 */
        goodsTaxRateHint: parseLeadingPercent(col2),
        col2Text: String(col2 || '').trim(),
        col3Text: String(col3 || '').trim(),
        auditRule: String(auditRule || '').trim(),
        inputRegulation: String(inputReg || '').trim(),
    };
}

/**
 * 載入 public/data/tariff.csv，建 HS 索引
 * @returns {Promise<{ byHs: Map<string, TariffRow>, rows: TariffRow[] }>}
 */
export async function loadTariffTable() {
    if (cached) return cached;
    if (!loadPromise) {
        loadPromise = (async () => {
            const res = await fetch(`${import.meta.env.BASE_URL}data/tariff.csv`);
            if (!res.ok) throw new Error(`無法載入稅則檔：HTTP ${res.status}`);
            let text = await res.text();
            if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
            const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
            if (lines.length < 2) throw new Error('稅則檔為空');

            const byHs = new Map();
            const rows = [];
            for (let i = 1; i < lines.length; i += 1) {
                const cells = parseCsvLine(lines[i]);
                const row = rowFromCells(cells);
                if (row) {
                    byHs.set(row.hsCode, row);
                    rows.push(row);
                }
            }
            cached = { byHs, rows };
            return cached;
        })();
    }
    return loadPromise;
}

/** @param {string} hs11 */
export function findByHsCode(index, hs11) {
    const key = normalizeHsCode(hs11);
    if (!key) return null;
    return index.byHs.get(key) || null;
}

/**
 * 貨名關鍵字模糊查（中英文；多關鍵字為 AND）
 * @param {ReturnType<typeof loadTariffTable> extends Promise<infer R> ? R : never} index
 * @param {string} keyword
 * @param {{ max?: number }} [opts]
 * @returns {TariffRow[]}
 */
export function searchTariffByKeyword(index, keyword, opts = {}) {
    const max = opts.max ?? 80;
    const parts = String(keyword || '')
        .toLowerCase()
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (parts.length === 0) return [];

    const out = [];
    for (const row of index.rows) {
        const blobZh = row.nameZh.toLowerCase();
        const blobEn = row.nameEn.toLowerCase();
        const ok = parts.every((p) => blobZh.includes(p) || blobEn.includes(p));
        if (ok) {
            out.push(row);
            if (out.length >= max) break;
        }
    }
    return out;
}

/** 「輸入規定」是否含須提醒代碼 */
export function hasSpecialImportRestriction(inputRegulation) {
    const s = String(inputRegulation || '');
    return /\bMW0\b/i.test(s) || /\bF01\b/i.test(s);
}
