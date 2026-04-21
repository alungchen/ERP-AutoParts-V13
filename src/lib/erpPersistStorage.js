import { createJSONStorage } from 'zustand/middleware';
import { apiUrl } from './apiUrl';

/** 與 zustand persist `name` 一致（不含產品：產品改走 /api/products，非 persist） */
export const STORE_KEYS = [
    'erp-app-store',
    'erp-document-store',
    'erp-customer-store',
    'erp-supplier-store',
    'erp-employee-store',
    'erp-sourcing-store',
    'erp-shorthand-store',
    'erp-import-estimates',
    'erp-settlement-store',
];

let debounceTimer = null;

export async function pushAllStoresToD1() {
    const body = {};
    for (const k of STORE_KEYS) {
        const v = localStorage.getItem(k);
        if (v) {
            try {
                body[k] = JSON.parse(v);
            } catch {
                /* skip */
            }
        }
    }
    if (Object.keys(body).length === 0) return;
    await fetch(apiUrl('/api/stores'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function scheduleSyncPush() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        pushAllStoresToD1().catch(() => {});
    }, 900);
}

export const erpPersistStorage = createJSONStorage(() => ({
    getItem: (name) => localStorage.getItem(name),
    setItem: (name, value) => {
        localStorage.setItem(name, value);
        scheduleSyncPush();
    },
    removeItem: (name) => localStorage.removeItem(name),
}));
