import { create } from 'zustand';

const API = '/api/suppliers';

export const useSupplierStore = create((set, get) => ({
    suppliers: [],
    selectedSupplier: null,
    searchQuery: '',
    isLoading: false,

    // ── 從 D1 API 載入 ──
    fetchSuppliers: async () => {
        set({ isLoading: true });
        try {
            const res = await fetch(API);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            set({ suppliers: data, isLoading: false });
        } catch (err) {
            console.error('fetchSuppliers error:', err);
            set({ isLoading: false });
        }
    },

    setSelectedSupplier: (supplier) => set({ selectedSupplier: supplier }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    addSupplier: async (supplier) => {
        const sup_id = supplier.sup_id || `SUP-${Date.now()}`;
        const newSup = { ...supplier, sup_id };
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newSup) });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({ suppliers: [newSup, ...state.suppliers] }));
    },

    updateSupplier: async (updated) => {
        const res = await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({
            suppliers: state.suppliers.map(s => s.sup_id === updated.sup_id ? updated : s),
            selectedSupplier: state.selectedSupplier?.sup_id === updated.sup_id ? updated : state.selectedSupplier
        }));
    },

    deleteSupplier: async (id) => {
        const res = await fetch(`${API}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({
            suppliers: state.suppliers.filter(s => s.sup_id !== id),
            selectedSupplier: state.selectedSupplier?.sup_id === id ? null : state.selectedSupplier
        }));
    },

    // ── 批次匯入（匯入 CSV 時使用）──
    bulkUpdateSuppliers: async (list) => {
        // 清空後批次寫入
        await fetch(`${API}?clearAll=1`, { method: 'DELETE' });
        const BATCH = 50;
        for (let i = 0; i < list.length; i += BATCH) {
            const batch = list.slice(i, i + BATCH);
            await Promise.all(batch.map(item =>
                fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
            ));
        }
        await get().fetchSuppliers();
    },

    clearAllSuppliers: async () => {
        await fetch(`${API}?clearAll=1`, { method: 'DELETE' });
        set({ suppliers: [], selectedSupplier: null });
    },
}));
