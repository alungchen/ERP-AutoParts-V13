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

/**
 * 寫入雲端下載的 store 快照到 localStorage。
 * erp-app-store：自動 bootstrap 時保留「本機已存的 operationMode」，避免雲端快照落後而覆寫剛儲存的傳統/新分頁設定。
 */
function applyIncomingStoreKeyToLocalStorage(key, incomingValue, { preserveLocalOperationMode = false } = {}) {
    if (incomingValue === undefined || incomingValue === null) return;
    if (key !== 'erp-app-store' || !preserveLocalOperationMode) {
        const raw = typeof incomingValue === 'string' ? incomingValue : JSON.stringify(incomingValue);
        localStorage.setItem(key, raw);
        return;
    }
    const prevRaw = localStorage.getItem(key);
    let inc = incomingValue;
    if (typeof inc === 'string') {
        try {
            inc = JSON.parse(inc);
        } catch {
            localStorage.setItem(key, incomingValue);
            return;
        }
    }
    if (!inc || typeof inc !== 'object') {
        localStorage.setItem(key, JSON.stringify(incomingValue));
        return;
    }
    let prev = null;
    if (prevRaw) {
        try {
            prev = JSON.parse(prevRaw);
        } catch {
            prev = null;
        }
    }
    const localMode = prev?.state?.operationMode;
    if (localMode !== undefined && localMode !== null && inc.state && typeof inc.state === 'object') {
        localStorage.setItem(
            key,
            JSON.stringify({
                ...inc,
                state: { ...inc.state, operationMode: localMode },
            })
        );
        return;
    }
    localStorage.setItem(key, JSON.stringify(inc));
}

function rehydrateAllStores() {
    useDocumentStore.persist.rehydrate();
    // useSupplierStore / useCustomerStore 已改為 API 模式，不使用 persist
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
            applyIncomingStoreKeyToLocalStorage(k, incoming[k], { preserveLocalOperationMode: false });
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
                applyIncomingStoreKeyToLocalStorage(k, incoming[k], { preserveLocalOperationMode: k === 'erp-app-store' });
            }
        }
        rehydrateAllStores();
        void useProductStore.getState().fetchProducts();
        // 供應商/客戶從 D1 API 載入
        void useSupplierStore.getState().fetchSuppliers();
        void useCustomerStore.getState().fetchCustomers();
    } catch (e) {
        console.warn('[ERP] D1 載入失敗，使用本機快取', e);
    }
}
