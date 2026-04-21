import { STORE_KEYS, pushAllStoresToD1 } from './erpPersistStorage';
import { apiUrl } from './apiUrl';
import { useDocumentStore } from '../store/useDocumentStore';
import { useProductStore } from '../store/useProductStore';
import { useSupplierStore } from '../store/useSupplierStore';
import { useCustomerStore } from '../store/useCustomerStore';
import { useEmployeeStore } from '../store/useEmployeeStore';
import { useAppStore } from '../store/useAppStore';
import { useSourcingStore } from '../store/useSourcingStore';
import { useShorthandStore } from '../store/useShorthandStore';
import { useImportEstimateStore } from '../store/useImportEstimateStore';
import { useSettlementStore } from '../store/useSettlementStore';

function rehydrateAllStores() {
    useDocumentStore.persist.rehydrate();
    useSupplierStore.persist.rehydrate();
    useCustomerStore.persist.rehydrate();
    useEmployeeStore.persist.rehydrate();
    useAppStore.persist.rehydrate();
    useSourcingStore.persist.rehydrate();
    useShorthandStore.persist.rehydrate();
    useImportEstimateStore.persist.rehydrate();
    useSettlementStore.persist.rehydrate();
}

let bootstrapRan = false;

/**
 * 手動「從雲端下載」：以 D1 快照覆寫本機 localStorage 中對應的 store，並 rehydrate。
 * 僅更新遠端有提供的 key；雲端完全無資料時回傳 empty。
 */
export async function pullStoresFromD1() {
    const res = await fetch(apiUrl('/api/stores'));
    if (!res.ok) {
        throw new Error(`無法讀取雲端：HTTP ${res.status}`);
    }
    const data = await res.json();
    const incoming = data?.stores && typeof data.stores === 'object' ? data.stores : data;
    const keys = Object.keys(incoming || {}).filter((k) => STORE_KEYS.includes(k));

    if (keys.length === 0) {
        return { empty: true, updatedKeys: 0 };
    }

    let updatedKeys = 0;
    for (const k of STORE_KEYS) {
        if (incoming[k] !== undefined) {
            localStorage.setItem(k, JSON.stringify(incoming[k]));
            updatedKeys += 1;
        }
    }
    rehydrateAllStores();
    return { empty: false, updatedKeys };
}

/**
 * 啟動時：若 D1 有快照則覆寫 localStorage 並 rehydrate；
 * 若 D1 為空但本機有資料，則上傳到 D1。
 * 產品列表仍由 fetchProducts() 從 /api/products 載入。
 */
export async function bootstrapFromD1() {
    if (bootstrapRan) return;
    bootstrapRan = true;
    try {
        const res = await fetch(apiUrl('/api/stores'));
        if (!res.ok) return;
        const data = await res.json();
        const incoming = data?.stores && typeof data.stores === 'object' ? data.stores : data;
        const keys = Object.keys(incoming || {}).filter((k) => STORE_KEYS.includes(k));

        if (keys.length === 0) {
            const hasLocal = STORE_KEYS.some((k) => localStorage.getItem(k));
            if (hasLocal) {
                await pushAllStoresToD1();
            }
            return;
        }

        for (const k of STORE_KEYS) {
            if (incoming[k] !== undefined) {
                localStorage.setItem(k, JSON.stringify(incoming[k]));
            }
        }
        rehydrateAllStores();
        void useProductStore.getState().fetchProducts();
    } catch (e) {
        console.warn('[ERP] D1 載入失敗，使用本機快取', e);
    }
}
