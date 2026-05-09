import { create } from 'zustand';

const API = '/api/customers';

export const useCustomerStore = create((set, get) => ({
    customers: [],
    selectedCustomer: null,
    searchQuery: '',
    isLoading: false,

    // ── 從 D1 API 載入 ──
    fetchCustomers: async () => {
        set({ isLoading: true });
        try {
            const res = await fetch(API);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            set({ customers: data, isLoading: false });
        } catch (err) {
            console.error('fetchCustomers error:', err);
            set({ isLoading: false });
        }
    },

    setSelectedCustomer: (customer) => set({ selectedCustomer: customer }),
    setSearchQuery: (q) => set({ searchQuery: q }),

    addCustomer: async (customer) => {
        const cust_id = customer.cust_id || `CUST-${Date.now()}`;
        const newCust = { ...customer, cust_id };
        const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newCust) });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({ customers: [newCust, ...state.customers] }));
    },

    updateCustomer: async (updated) => {
        const res = await fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({
            customers: state.customers.map(c => c.cust_id === updated.cust_id ? updated : c),
            selectedCustomer: state.selectedCustomer?.cust_id === updated.cust_id ? updated : state.selectedCustomer
        }));
    },

    deleteCustomer: async (id) => {
        const res = await fetch(`${API}?id=${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        set(state => ({
            customers: state.customers.filter(c => c.cust_id !== id),
            selectedCustomer: state.selectedCustomer?.cust_id === id ? null : state.selectedCustomer
        }));
    },

    // ── 批次匯入（匯入 CSV 時使用）──
    bulkUpdateCustomers: async (list) => {
        await fetch(`${API}?clearAll=1`, { method: 'DELETE' });
        const BATCH = 50;
        for (let i = 0; i < list.length; i += BATCH) {
            const batch = list.slice(i, i + BATCH);
            await Promise.all(batch.map(item =>
                fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) })
            ));
        }
        await get().fetchCustomers();
    },

    clearAllCustomers: async () => {
        await fetch(`${API}?clearAll=1`, { method: 'DELETE' });
        set({ customers: [], selectedCustomer: null });
    },
}));
