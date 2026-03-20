import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const initialModels = [
    { id: 1, shorthand: 'toal', fullname: 'TOYOTA Altis', brand: 'TOYOTA' },
    { id: 2, shorthand: 'hoac', fullname: 'HONDA Accord', brand: 'HONDA' },
    { id: 3, shorthand: 'nisy', fullname: 'NISSAN Sylphy', brand: 'NISSAN' },
];

const initialParts = [
    { id: 1, shorthand: 'z2r', fullname: '發電機', category: '電裝系統' },
    { id: 2, shorthand: 'fdj', fullname: '發電機', category: '電裝系統' },
    { id: 3, shorthand: 'unr', fullname: '壓縮機', category: '空調系統' },
    { id: 4, shorthand: 'byp', fullname: '來令片', category: '煞車系統' },
];

const initialBrands = [
    { id: 1, shorthand: 'toy', fullname: 'TOYOTA OE', category: 'OE' },
    { id: 2, shorthand: 'hon', fullname: 'HONDA OE', category: 'OE' },
    { id: 3, shorthand: 'ake', fullname: 'Akebono', category: 'OEM' },
];

export const useShorthandStore = create(persist((set) => ({
    models: initialModels,
    parts: initialParts,
    brands: initialBrands,

    addModel: (model) => set((state) => ({ models: [...state.models, { ...model, id: Date.now() }] })),
    updateModel: (model) => set((state) => ({ models: state.models.map(m => m.id === model.id ? model : m) })),
    deleteModel: (id) => set((state) => ({ models: state.models.filter(m => m.id !== id) })),

    addPart: (part) => set((state) => ({ parts: [...state.parts, { ...part, id: Date.now() }] })),
    updatePart: (part) => set((state) => ({ parts: state.parts.map(p => p.id === part.id ? part : p) })),
    deletePart: (id) => set((state) => ({ parts: state.parts.filter(p => p.id !== id) })),

    addBrand: (brand) => set((state) => ({ brands: [...state.brands, { ...brand, id: Date.now() }] })),
    updateBrand: (brand) => set((state) => ({ brands: state.brands.map(b => b.id === brand.id ? brand : b) })),
    deleteBrand: (id) => set((state) => ({ brands: state.brands.filter(b => b.id !== id) })),
}), { name: 'erp-shorthand-store' }));
