import { create } from 'zustand';
import { useProductStore } from './useProductStore';

/**
 * 盤點明細僅儲存 p_id 與盤點量；帳載與品名由產品庫即時帶入。
 */
const mockSheets = () => [
    {
        id: 'IC-2025-001',
        title: '2025 Q1 主倉盤點',
        warehouse: '主倉 A 區',
        status: 'in_progress',
        createdAt: '2025-03-10',
        lines: [
            { lineId: 'L1', p_id: 'P-1001', countedQty: 118 },
            { lineId: 'L2', p_id: 'P-1002', countedQty: 320 },
            { lineId: 'L3', p_id: 'P-1003', countedQty: 48 },
        ],
    },
    {
        id: 'IC-2025-002',
        title: '零件暫存區抽盤',
        warehouse: '暫存區',
        status: 'draft',
        createdAt: '2025-03-18',
        lines: [
            { lineId: 'L1', p_id: 'P-1004', countedQty: 15 },
            { lineId: 'L2', p_id: 'P-1003', countedQty: 8 },
        ],
    },
    {
        id: 'IC-2024-099',
        title: '2024 年終盤點（已結案）',
        warehouse: '主倉 B 區',
        status: 'submitted',
        createdAt: '2024-12-20',
        submittedAt: '2024-12-22',
        lines: [{ lineId: 'L1', p_id: 'P-1002', countedQty: 320 }],
    },
];

const findLineIndex = (sheet, lineId) =>
    sheet.lines.findIndex((l) => l.lineId === lineId);

function nextLineId(lines) {
    const seq = lines.map((l) => {
        const m = /^L(\d+)$/i.exec(String(l.lineId));
        return m ? parseInt(m[1], 10) : 0;
    });
    const max = seq.length ? Math.max(...seq) : 0;
    return `L${max + 1}`;
}

/** 料號比對用：全形轉半形、各種連字號統一成 -、去空白、小寫 */
function normalizePartKey(s) {
    if (s == null || s === '') return '';
    return String(s)
        .trim()
        .normalize('NFKC')
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
        .replace(/\s+/g, '')
        .toLowerCase();
}

function partKeyEquals(candidate, rawNorm, rawNormNoHyphen) {
    const c = normalizePartKey(candidate);
    if (!c) return false;
    if (c === rawNorm) return true;
    return c.replace(/-/g, '') === rawNormNoHyphen;
}

/**
 * 比對掃碼／手動輸入是否為產品 p_id、頂層 part_number（PIM 主零件號）或任一 part_numbers 料號
 */
function productMatchesScan(product, raw) {
    if (!product || !raw) return false;
    const norm = normalizePartKey(raw);
    if (!norm) return false;
    const normNoHyphen = norm.replace(/-/g, '');

    if (partKeyEquals(product.p_id, norm, normNoHyphen)) return true;
    if (partKeyEquals(product.part_number, norm, normNoHyphen)) return true;
    return (product.part_numbers || []).some((pn) =>
        partKeyEquals(pn.part_number, norm, normNoHyphen)
    );
}

/** 在全部產品中找出與輸入相符的一筆（p_id 或任一料號） */
function findProductByScanText(text) {
    const raw = String(text || '').trim();
    if (!raw) return null;
    const products = useProductStore.getState().products;
    return products.find((p) => productMatchesScan(p, raw)) || null;
}

function newSheetId() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const r = Math.floor(100 + Math.random() * 900);
    return `IC-${y}${m}${day}-${r}`;
}

export const useInventoryCountStore = create((set, get) => ({
    sheets: mockSheets(),

    /**
     * 新增空白盤點單（草稿），明細請在單內以手動／掃碼加入。
     * @returns {string} 新單 id
     */
    addSheet: ({ title, warehouse }) => {
        const id = newSheetId();
        const sheet = {
            id,
            title: (title && String(title).trim()) || '未命名盤點單',
            warehouse: (warehouse && String(warehouse).trim()) || '未指定倉別',
            status: 'draft',
            createdAt: new Date().toISOString().slice(0, 10),
            lines: [],
        };
        set((state) => ({ sheets: [sheet, ...state.sheets] }));
        return id;
    },

    setLineQty: (sheetId, lineId, qty) => {
        const n = Number(qty);
        if (!Number.isFinite(n) || n < 0) return;
        set((state) => ({
            sheets: state.sheets.map((s) => {
                if (s.id !== sheetId) return s;
                const idx = findLineIndex(s, lineId);
                if (idx < 0) return s;
                const lines = [...s.lines];
                lines[idx] = { ...lines[idx], countedQty: Math.floor(n) };
                return { ...s, lines };
            }),
        }));
    },

    bumpLineQty: (sheetId, lineId, delta = 1) => {
        set((state) => ({
            sheets: state.sheets.map((s) => {
                if (s.id !== sheetId) return s;
                const idx = findLineIndex(s, lineId);
                if (idx < 0) return s;
                const lines = [...s.lines];
                const cur = lines[idx].countedQty ?? 0;
                lines[idx] = {
                    ...lines[idx],
                    countedQty: Math.max(0, Math.floor(cur + delta)),
                };
                return { ...s, lines };
            }),
        }));
    },

    /**
     * 將條碼／料號／P-ID 對應到明細：已在單上則回傳該列；否則依模式新增一列。
     * @param {'manual'|'scan'} mode 手動：新列預設盤點量＝目前庫存；掃碼：新列預設＝1（首掃計件）
     * @returns {{ lineId: string, isNew: boolean, p_id: string } | null}
     */
    resolveProductToLine: (sheetId, text, mode) => {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const sheet = get().sheets.find((s) => s.id === sheetId);
        if (!sheet || sheet.status === 'submitted') return null;

        const product = findProductByScanText(raw);
        if (!product) return null;

        const existing = sheet.lines.find((l) => l.p_id === product.p_id);
        if (existing) {
            return { lineId: existing.lineId, isNew: false, p_id: product.p_id };
        }

        const lineId = nextLineId(sheet.lines);
        const countedQty =
            mode === 'manual'
                ? Math.max(0, Math.floor(product.stock ?? 0))
                : 1;

        set((state) => ({
            sheets: state.sheets.map((s) =>
                s.id !== sheetId
                    ? s
                    : {
                          ...s,
                          lines: [
                              ...s.lines,
                              { lineId, p_id: product.p_id, countedQty },
                          ],
                      }
            ),
        }));

        return { lineId, isNew: true, p_id: product.p_id };
    },

    submitSheet: (sheetId) => {
        const sheet = get().sheets.find((s) => s.id === sheetId);
        if (!sheet) return;

        const { updateProduct } = useProductStore.getState();

        sheet.lines.forEach((line) => {
            const products = useProductStore.getState().products;
            const p = products.find((x) => x.p_id === line.p_id);
            if (!p) return;
            const nextStock = Math.max(0, Math.floor(line.countedQty ?? p.stock));
            updateProduct({
                ...p,
                stock: nextStock,
            });
        });

        set((state) => ({
            sheets: state.sheets.map((s) =>
                s.id === sheetId
                    ? {
                          ...s,
                          status: 'submitted',
                          submittedAt: new Date().toISOString().slice(0, 10),
                      }
                    : s
            ),
        }));
    },

    startSheet: (sheetId) => {
        set((state) => ({
            sheets: state.sheets.map((s) =>
                s.id === sheetId && s.status === 'draft'
                    ? { ...s, status: 'in_progress' }
                    : s
            ),
        }));
    },
}));
