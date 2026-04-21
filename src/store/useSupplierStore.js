import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

const initialSuppliers = [
    {
        sup_id: 'SUP-001',
        name: 'Akebono Global Ltd.',
        country: 'Japan',
        currency: 'USD',
        contact_name: 'Tanaka Hiroshi',
        email: 'hiroshi@akebono.com',
        phone: '+81-3-1234-5678',
        payment_terms: 'T/T 30 days',
        lead_time_avg: 14,
        rating: 4.8,
        categories: ['Brake System'],
        notes: 'Premium OEM brake parts. Reliable and consistent quality.'
    },
    {
        sup_id: 'SUP-002',
        name: 'Denso Corporation Japan',
        country: 'Japan',
        currency: 'JPY',
        contact_name: 'Suzuki Kenji',
        email: 'kenji.suzuki@denso.com',
        phone: '+81-566-25-5511',
        payment_terms: 'L/C 60 days',
        lead_time_avg: 21,
        rating: 4.9,
        categories: ['Filters', 'Ignition', 'Electrical'],
        notes: 'Tier-1 global OEM. Excellent for Honda and Toyota filters.'
    },
    {
        sup_id: 'SUP-003',
        name: 'Brembo Europe AG',
        country: 'Germany',
        currency: 'EUR',
        contact_name: 'Klaus Weber',
        email: 'k.weber@brembo.eu',
        phone: '+49-30-8888-9999',
        payment_terms: 'T/T 45 days',
        lead_time_avg: 30,
        rating: 4.5,
        categories: ['Brake System'],
        notes: 'High-performance European brake systems.'
    },
    {
        sup_id: 'SUP-004',
        name: 'Taiwan Auto Parts Inc.',
        country: 'Taiwan',
        currency: 'TWD',
        contact_name: '王大明',
        email: 'daming@twap.com.tw',
        phone: '+886-2-2345-6789',
        payment_terms: 'Net 15',
        lead_time_avg: 3,
        rating: 4.2,
        categories: ['Brake System', 'Suspension', 'Filters'],
        notes: '台灣本地供應商，交期短，可配合急單。'
    },
    {
        sup_id: 'SUP-005',
        name: 'Guangzhou Filter Mfg Co.',
        country: 'China',
        currency: 'CNY',
        contact_name: 'Chen Wei',
        email: 'chenwei@gzfilter.cn',
        phone: '+86-20-8765-4321',
        payment_terms: 'T/T 30 days',
        lead_time_avg: 10,
        rating: 3.9,
        categories: ['Filters'],
        notes: 'Cost-effective large-volume filter supplier. MOQ 500+.'
    }
];

export const useSupplierStore = create(persist((set) => ({
    suppliers: initialSuppliers,
    selectedSupplier: null,
    setSelectedSupplier: (supplier) => set({ selectedSupplier: supplier }),
    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    addSupplier: (supplier) => set((state) => ({
        suppliers: [{ ...supplier, sup_id: `SUP-${Math.floor(100 + Math.random() * 900)}` }, ...state.suppliers]
    })),
    updateSupplier: (updated) => set((state) => ({
        suppliers: state.suppliers.map(s => s.sup_id === updated.sup_id ? updated : s),
        selectedSupplier: state.selectedSupplier?.sup_id === updated.sup_id ? updated : state.selectedSupplier
    })),
    deleteSupplier: (id) => set((state) => ({
        suppliers: state.suppliers.filter(s => s.sup_id !== id),
        selectedSupplier: state.selectedSupplier?.sup_id === id ? null : state.selectedSupplier
    })),
    bulkUpdateSuppliers: (list) => set((state) => {
        let updatedList = [...state.suppliers];
        list.forEach(item => {
            const idx = updatedList.findIndex(s => s.sup_id === item.sup_id);
            if (idx !== -1) updatedList[idx] = { ...updatedList[idx], ...item };
            else updatedList = [item, ...updatedList];
        });
        return { suppliers: updatedList };
    })
}), { name: 'erp-supplier-store', storage: erpPersistStorage }));
