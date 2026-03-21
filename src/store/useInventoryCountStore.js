import { create } from 'zustand';

const mockSheets = () => [
    {
        id: 'IC-2025-001',
        title: '2025 Q1 主倉盤點',
        warehouse: '主倉 A 區',
        status: 'in_progress',
        createdAt: '2025-03-10',
        lines: [
            {
                lineId: 'L1',
                sku: 'BRK-F-001',
                barcode: '4710012345678',
                productName: '前煞車來令片組',
                systemQty: 120,
                countedQty: 118,
            },
            {
                lineId: 'L2',
                sku: 'OIL-5W30-4L',
                barcode: '4710098765432',
                productName: '全合成機油 5W-30 4L',
                systemQty: 64,
                countedQty: 64,
            },
            {
                lineId: 'L3',
                sku: 'FLT-OIL-01',
                barcode: '4710001112223',
                productName: '機油濾清器 通用型',
                systemQty: 200,
                countedQty: 198,
            },
        ],
    },
    {
        id: 'IC-2025-002',
        title: '零件暫存區抽盤',
        warehouse: '暫存區',
        status: 'draft',
        createdAt: '2025-03-18',
        lines: [
            {
                lineId: 'L1',
                sku: 'WIP-TEST-01',
                barcode: '4710033334445',
                productName: '測試用零件 A',
                systemQty: 15,
                countedQty: 15,
            },
            {
                lineId: 'L2',
                sku: 'WIP-TEST-02',
                barcode: '4710066667778',
                productName: '測試用零件 B',
                systemQty: 8,
                countedQty: 8,
            },
        ],
    },
    {
        id: 'IC-2024-099',
        title: '2024 年終盤點（已結案）',
        warehouse: '主倉 B 區',
        status: 'submitted',
        createdAt: '2024-12-20',
        submittedAt: '2024-12-22',
        lines: [
            {
                lineId: 'L1',
                sku: 'LEGACY-01',
                barcode: '4710888888888',
                productName: '範例料號（歷史）',
                systemQty: 50,
                countedQty: 50,
            },
        ],
    },
];

const findLineIndex = (sheet, lineId) =>
    sheet.lines.findIndex((l) => l.lineId === lineId);

export const useInventoryCountStore = create((set, get) => ({
    sheets: mockSheets(),

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

    /** 掃碼命中時：預設每掃一次 +1（同條碼短時間內由元件層防抖） */
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
     * 以條碼或內部料號比對（不分大小寫、去空白）
     * @returns {{ sheetId: string, lineId: string } | null}
     */
    matchScan: (sheetId, text) => {
        const raw = String(text || '').trim();
        if (!raw) return null;
        const sheet = get().sheets.find((s) => s.id === sheetId);
        if (!sheet || sheet.status === 'submitted') return null;
        const norm = raw.toLowerCase();
        const line = sheet.lines.find(
            (l) =>
                (l.barcode && l.barcode.trim().toLowerCase() === norm) ||
                (l.sku && l.sku.trim().toLowerCase() === norm)
        );
        if (!line) return null;
        return { sheetId, lineId: line.lineId };
    },

    submitSheet: (sheetId) => {
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
