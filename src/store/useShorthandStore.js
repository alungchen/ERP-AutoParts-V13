import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

const initialModels = [
    { id: 'm1', shorthand: 'toal', fullname: 'TOYOTA Altis', brand: 'TOYOTA' },
    { id: 'm2', shorthand: 'hoac', fullname: 'HONDA Accord', brand: 'HONDA' },
    { id: 'm3', shorthand: 'nisy', fullname: 'NISSAN Sylphy', brand: 'NISSAN' },
];

const initialParts = [
    { id: 'p1', shorthand: 'z2r', fullname: '發電機', category: '電裝系統' },
    { id: 'p2', shorthand: 'fdj', fullname: '發電機', category: '電裝系統' },
    { id: 'p3', shorthand: 'unr', fullname: '壓縮機', category: '空調系統' },
    { id: 'p4', shorthand: 'byp', fullname: '來令片', category: '煞車系統' },
];

const initialBrands = [
    { id: 'b1', shorthand: 'toy', fullname: 'TOYOTA OE', category: 'OE' },
    { id: 'b2', shorthand: 'hon', fullname: 'HONDA OE', category: 'OE' },
    { id: 'b3', shorthand: 'ake', fullname: 'Akebono', category: 'OEM' },
];

// Helper for unique ID
const genId = (prefix) => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

// Helper for API call
const apiSync = async (method, data) => {
    try {
        await fetch('/api/shorthands', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        console.error('Shorthand sync failed:', e);
    }
};

const mapToDb = (item, type) => ({
    s_id: String(item.id),
    type,
    shorthand: item.shorthand,
    fullname: item.fullname,
    meta_category: item.brand || item.category || ''
});

const mapFromDb = (item) => ({
    id: item.s_id,
    shorthand: item.shorthand,
    fullname: item.fullname,
    brand: item.type === 'model' ? item.meta_category : undefined,
    category: item.type !== 'model' ? item.meta_category : undefined,
});

export const useShorthandStore = create(persist((set, get) => ({
    models: initialModels,
    parts: initialParts,
    brands: initialBrands,
    isSynced: false,

    fetchShorthands: async () => {
        try {
            const res = await fetch('/api/shorthands');
            if (!res.ok) return;
            const data = await res.json();
            
            // If the database has data, we overwrite local state
            if (data && data.length > 0) {
                const models = data.filter(d => d.type === 'model').map(mapFromDb);
                const parts = data.filter(d => d.type === 'part').map(mapFromDb);
                const brands = data.filter(d => d.type === 'brand').map(mapFromDb);
                set({ models, parts, brands, isSynced: true });
            } else {
                // If database is empty but we have local data (migration case), push to DB!
                const state = get();
                const allData = [
                    ...state.models.map(m => mapToDb(m, 'model')),
                    ...state.parts.map(p => mapToDb(p, 'part')),
                    ...state.brands.map(b => mapToDb(b, 'brand'))
                ];
                // Only push if we have MORE than the default initial items (3 + 4 + 3 = 10)
                // This prevents an incognito window from locking in the default items as the master DB copy!
                if (allData.length > 10) {
                    await apiSync('POST', allData);
                }
                set({ isSynced: true });
            }
        } catch (err) {
            console.error('Failed to fetch shorthands from DB', err);
        }
    },

    // ── 單筆操作 ──
    addModel: (model) => {
        const newModel = { ...model, id: genId('m') };
        set((state) => ({ models: [...state.models, newModel] }));
        apiSync('POST', mapToDb(newModel, 'model'));
    },
    updateModel: (model) => {
        set((state) => ({ models: state.models.map(m => m.id === model.id ? model : m) }));
        apiSync('PUT', mapToDb(model, 'model'));
    },
    deleteModel: (id) => {
        set((state) => ({ models: state.models.filter(m => m.id !== id) }));
        apiSync('DELETE', { s_id: String(id) }); // Note: the DELETE API accepts ?id=... we will change apiSync or use query
        fetch('/api/shorthands?id=' + id, { method: 'DELETE' }).catch(console.error);
    },

    addPart: (part) => {
        const newPart = { ...part, id: genId('p') };
        set((state) => ({ parts: [...state.parts, newPart] }));
        apiSync('POST', mapToDb(newPart, 'part'));
    },
    updatePart: (part) => {
        set((state) => ({ parts: state.parts.map(p => p.id === part.id ? part : p) }));
        apiSync('PUT', mapToDb(part, 'part'));
    },
    deletePart: (id) => {
        set((state) => ({ parts: state.parts.filter(p => p.id !== id) }));
        fetch('/api/shorthands?id=' + id, { method: 'DELETE' }).catch(console.error);
    },

    addBrand: (brand) => {
        const newBrand = { ...brand, id: genId('b') };
        set((state) => ({ brands: [...state.brands, newBrand] }));
        apiSync('POST', mapToDb(newBrand, 'brand'));
    },
    updateBrand: (brand) => {
        set((state) => ({ brands: state.brands.map(b => b.id === brand.id ? brand : b) }));
        apiSync('PUT', mapToDb(brand, 'brand'));
    },
    deleteBrand: (id) => {
        set((state) => ({ brands: state.brands.filter(b => b.id !== id) }));
        fetch('/api/shorthands?id=' + id, { method: 'DELETE' }).catch(console.error);
    },

    // ── 批次刪除 ──
    deleteModels: (ids) => {
        set((state) => ({ models: state.models.filter(m => !ids.includes(m.id)) }));
        fetch('/api/shorthands?ids=' + ids.join(','), { method: 'DELETE' }).catch(console.error);
    },
    deleteParts: (ids) => {
        set((state) => ({ parts: state.parts.filter(p => !ids.includes(p.id)) }));
        fetch('/api/shorthands?ids=' + ids.join(','), { method: 'DELETE' }).catch(console.error);
    },
    deleteBrands: (ids) => {
        set((state) => ({ brands: state.brands.filter(b => !ids.includes(b.id)) }));
        fetch('/api/shorthands?ids=' + ids.join(','), { method: 'DELETE' }).catch(console.error);
    },

    // ── 批次設定（匯入用）──
    setModels: (list) => {
        const processed = list.map((item) => ({ ...item, id: genId('m') }));
        set({ models: processed });
        fetch('/api/shorthands?type=model', { method: 'DELETE' }).then(() => {
            apiSync('POST', processed.map(m => mapToDb(m, 'model')));
        });
    },
    setParts: (list) => {
        const processed = list.map((item) => ({ ...item, id: genId('p') }));
        set({ parts: processed });
        fetch('/api/shorthands?type=part', { method: 'DELETE' }).then(() => {
            apiSync('POST', processed.map(p => mapToDb(p, 'part')));
        });
    },
    setBrands: (list) => {
        const processed = list.map((item) => ({ ...item, id: genId('b') }));
        set({ brands: processed });
        fetch('/api/shorthands?type=brand', { method: 'DELETE' }).then(() => {
            apiSync('POST', processed.map(b => mapToDb(b, 'brand')));
        });
    },

    // ── 清空表格 ──
    clearModels: () => {
        set({ models: [] });
        fetch('/api/shorthands?type=model', { method: 'DELETE' }).catch(console.error);
    },
    clearParts: () => {
        set({ parts: [] });
        fetch('/api/shorthands?type=part', { method: 'DELETE' }).catch(console.error);
    },
    clearBrands: () => {
        set({ brands: [] });
        fetch('/api/shorthands?type=brand', { method: 'DELETE' }).catch(console.error);
    },

}), { name: 'erp-shorthand-store', storage: erpPersistStorage }));

