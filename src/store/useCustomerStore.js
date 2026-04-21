import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

const initialCustomers = [
    {
        cust_id: 'CUST-001',
        name: '台灣機車材料行',
        contact_name: '林老闆',
        email: 'lin@moto-parts.com.tw',
        phone: '+886-4-2234-5678',
        country: 'Taiwan',
        currency: 'TWD',
        tier: 'A',   // A=Best price, B=Standard, C=Retail
        credit_limit: 500000,
        payment_terms: 'Net 30',
        address: '台中市西屯區工業區一路25號',
        notes: '忠實老客戶，每季大量採購煞車系統零件。'
    },
    {
        cust_id: 'CUST-002',
        name: 'Seoul Auto Wholesale',
        contact_name: 'Park Jungho',
        email: 'park@seoulauto.kr',
        phone: '+82-2-5555-1234',
        country: 'South Korea',
        currency: 'USD',
        tier: 'B',
        credit_limit: 200000,
        payment_terms: 'T/T 30 days',
        address: '120 Yeongdeungpo-gu, Seoul, Korea',
        notes: 'Korean distributor, mainly Toyota and Nissan compatibility.'
    },
    {
        cust_id: 'CUST-003',
        name: 'Pacific Rim Imports LLC',
        contact_name: 'Jake Morrison',
        email: 'jake.m@pacificrim.us',
        phone: '+1-310-888-7777',
        country: 'USA',
        currency: 'USD',
        tier: 'A',
        credit_limit: 1000000,
        payment_terms: 'Net 60',
        address: '3900 Wilshire Blvd, Los Angeles, CA 90010',
        notes: 'Major US importer. High MOQ orders - typically 500 pcs minimum.'
    },
    {
        cust_id: 'CUST-004',
        name: 'オートパーツ東京株式会社',
        contact_name: '山田一郎',
        email: 'yamada@autoparts-tokyo.jp',
        phone: '+81-3-6789-0123',
        country: 'Japan',
        currency: 'JPY',
        tier: 'B',
        credit_limit: 300000,
        payment_terms: 'T/T 45 days',
        address: '東京都品川区北品川3-7-18',
        notes: 'Japanese retailer, focuses on Honda and Toyota.'
    },
    {
        cust_id: 'CUST-005',
        name: '大成汽車材料股份有限公司',
        contact_name: '黃副理',
        email: 'huang@dacheng-auto.com.tw',
        phone: '+886-7-3456-7890',
        country: 'Taiwan',
        currency: 'TWD',
        tier: 'C',
        credit_limit: 50000,
        payment_terms: 'Net 15',
        address: '高雄市前鎮區中山三路99號',
        notes: '南部新客戶，信用額度觀察期中。'
    }
];

export const useCustomerStore = create(persist((set) => ({
    customers: initialCustomers,
    selectedCustomer: null,
    setSelectedCustomer: (c) => set({ selectedCustomer: c }),
    searchQuery: '',
    setSearchQuery: (q) => set({ searchQuery: q }),
    addCustomer: (customer) => set((state) => ({
        customers: [{ ...customer, cust_id: `CUST-${Math.floor(100 + Math.random() * 900)}` }, ...state.customers]
    })),
    updateCustomer: (updated) => set((state) => ({
        customers: state.customers.map(c => c.cust_id === updated.cust_id ? updated : c),
        selectedCustomer: state.selectedCustomer?.cust_id === updated.cust_id ? updated : state.selectedCustomer
    })),
    deleteCustomer: (id) => set((state) => ({
        customers: state.customers.filter(c => c.cust_id !== id),
        selectedCustomer: state.selectedCustomer?.cust_id === id ? null : state.selectedCustomer
    })),
    bulkUpdateCustomers: (list) => set((state) => {
        let updatedList = [...state.customers];
        list.forEach(item => {
            const idx = updatedList.findIndex(c => c.cust_id === item.cust_id);
            if (idx !== -1) updatedList[idx] = { ...updatedList[idx], ...item };
            else updatedList = [item, ...updatedList];
        });
        return { customers: updatedList };
    })
}), { name: 'erp-customer-store', storage: erpPersistStorage }));
