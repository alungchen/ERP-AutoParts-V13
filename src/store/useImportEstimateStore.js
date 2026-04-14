import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const createDefaultEstimateLine = () => ({
    id:
        globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
            ? globalThis.crypto.randomUUID()
            : `L-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    p_id: '',
    productName: '',
    note: '',
    exwForeign: '',
    quantity: '1',
    volPerUnit: '',
    weightPerUnit: '',
    dutyRate: 0,
    exciseRate: 0,
    hsCode: '',
    nameZh: '',
    inputRegulation: '',
    dutyRateText: '',
    goodsTaxRateHint: 0,
    /** 11 碼 HS 於稅則檔查無資料 */
    tariffMiss: false,
});

const defaultEstimatorFields = () => ({
    sharedCostSplit: 'equal',
    currency: 'USD',
    exchangeBuffer: 0.01,
    inlandDocTwd: '0',
    intlFreightTwd: '0',
    insuranceCifFactor: '1.1',
    insuranceRate: '0.001',
    customsFeeTwd: '3500',
    doFeeTwd: '3500',
    ediFeeTwd: '600',
    lclFeeTwd: '0',
    terminalFeeTwd: '0',
    domesticFreightTwd: '0',
    vatRatePct: '5',
    miscBudgetPct: '5',
    retailMarginPct: '20',
    breakdown: null,
});

function nextEstimateId(existingIds) {
    const y = new Date().getFullYear();
    const set = new Set(existingIds);
    let id;
    do {
        id = `ICE-${y}-${String(Math.floor(100 + Math.random() * 900))}`;
    } while (set.has(id));
    return id;
}

export const useImportEstimateStore = create(
    persist(
        (set, get) => ({
            importEstimates: [],

            getImportEstimate: (estimateId) =>
                get().importEstimates.find((e) => e.estimate_id === estimateId) ?? null,

            addImportEstimate: (partial = {}) => {
                const existingIds = get().importEstimates.map((e) => e.estimate_id);
                const estimate_id = nextEstimateId(existingIds);
                const now = new Date().toISOString();
                const defaults = {
                    estimate_id,
                    date: new Date().toISOString().split('T')[0],
                    supplier_id: '',
                    supplier_name: '',
                    notes: '',
                    lineItems: [],
                    ...defaultEstimatorFields(),
                    createdAt: now,
                    updatedAt: now,
                };
                const lineItems = Array.isArray(partial.lineItems)
                    ? partial.lineItems
                    : defaults.lineItems;
                const doc = { ...defaults, ...partial, estimate_id, lineItems, updatedAt: now };
                set((s) => ({ importEstimates: [doc, ...s.importEstimates] }));
                return doc;
            },

            updateImportEstimate: (estimateId, patch) => {
                set((s) => ({
                    importEstimates: s.importEstimates.map((e) =>
                        e.estimate_id === estimateId
                            ? { ...e, ...patch, updatedAt: new Date().toISOString() }
                            : e,
                    ),
                }));
            },

            deleteImportEstimate: (estimateId) =>
                set((s) => ({
                    importEstimates: s.importEstimates.filter((e) => e.estimate_id !== estimateId),
                })),
        }),
        { name: 'erp-import-estimates' },
    ),
);
