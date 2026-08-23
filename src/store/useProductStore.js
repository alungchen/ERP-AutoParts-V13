import { create } from 'zustand';

export const useProductStore = create((set, get) => ({
  products: [],
  isLoading: false,
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  partNumberQuery: '',
  setPartNumberQuery: (query) => set({ partNumberQuery: query }),
  selectedProduct: null,
  setSelectedProduct: (product) => set({ selectedProduct: product }),

  // 從 API 以游標分頁載入「全部」產品，邊載邊顯示；庫存另行平行載入後合併
  // 產品目錄全分店共用，僅庫存依分店呈現差異
  lastFetchedAt: 0,
  fetchProducts: async () => {
    if (get().isLoading) return;
    // 60 秒內已載入過就跳過（避免視窗聚焦等事件頻繁觸發全量重載）
    if (Date.now() - get().lastFetchedAt < 60000 && get().products.length > 0) return;
    set({ isLoading: true });
    try {
      const stockPromise = fetch('/api/products?stockOnly=1')
        .then((res) => (res.ok ? res.json() : { stock: {} }))
        .catch(() => ({ stock: {} }));

      const all = [];
      let cursor = 0;
      const PAGE_SIZE = 2000;
      // 逐頁抓取直到沒有更多資料
      for (;;) {
        const url = new URL('/api/products', window.location.origin);
        url.searchParams.set('cursor', String(cursor));
        url.searchParams.set('limit', String(PAGE_SIZE));

        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`);
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.items || []);
        all.push(...items);
        set({ products: [...all] });

        if (Array.isArray(data) || !data.hasMore || data.nextCursor == null || items.length === 0) break;
        cursor = data.nextCursor;
      }

      const stockMap = (await stockPromise)?.stock || {};
      const withStock = all.map((p) => {
        const details = stockMap[p.p_id] || p.stock_details || [];
        const totalStock = details.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
        return { ...p, stock_details: details, stock: totalStock };
      });
      withStock.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
      set({ products: withStock, isLoading: false, lastFetchedAt: Date.now() });
    } catch (err) {
      console.error("Failed to fetch products:", err);
      set({ isLoading: false });
    }
  },

  updateProduct: async (updatedProduct) => {
    const { isNew, ...cleanProduct } = updatedProduct;
    // 確保 ID 存在
    if (!cleanProduct.p_id) {
       cleanProduct.p_id = `P-${Math.floor(1000 + Math.random() * 9000)}`;
    }

    try {
      const isExisting = get().products.some(p => p.p_id === cleanProduct.p_id) && !isNew;
      // 發送 API 請求到資料庫
      const method = isExisting ? 'PUT' : 'POST';
      const res = await fetch('/api/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanProduct)
      });
      
      if (!res.ok) throw new Error("Failed to save product to DB");

      // 更新前端狀態
      set((state) => {
        const exists = state.products.some((p) => p.p_id === cleanProduct.p_id);
        if (exists) {
          return {
            products: state.products.map((p) => (p.p_id === cleanProduct.p_id ? cleanProduct : p)),
            selectedProduct: state.selectedProduct?.p_id === cleanProduct.p_id ? cleanProduct : state.selectedProduct
          };
        } else {
          return {
            products: [cleanProduct, ...state.products],
            selectedProduct: cleanProduct
          };
        }
      });
    } catch (err) {
      console.error(err);
      alert('儲存產品失敗！請檢查連線');
    }
  },

  deleteProduct: async (productId) => {
    try {
      const res = await fetch(`/api/products?id=${productId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Failed to delete product from DB (${res.status})`);

      set((state) => ({
        products: state.products.filter((p) => p.p_id !== productId),
        selectedProduct: state.selectedProduct?.p_id === productId ? null : state.selectedProduct
      }));
    } catch (err) {
      console.error('deleteProduct error:', err);
      throw err; // Let callers handle the error
    }
  },

  bulkUpdateProducts: async (newProducts) => {
    // 若要支援全部更新至 DB，需實作批量更新的 API，為求簡單，這裡示範單筆更新的迴圈（實務上建議實作批次 API）
    try {
      for (const newP of newProducts) {
        await get().updateProduct(newP); 
      }
    } catch (err) {
      console.error("Bulk update failed", err);
    }
  },

  duplicateProduct: async (productToDuplicate) => {
    const newId = `P-${Math.floor(1000 + Math.random() * 9000)}`;
    const sourceName = productToDuplicate?.name || '';
    const newProduct = {
      ...productToDuplicate,
      p_id: newId,
      name: `${sourceName} (Copy)`,
      isNew: true,
      part_numbers: (productToDuplicate?.part_numbers || []).map((pn, idx) => ({
        ...pn,
        pn_id: `PN-${Date.now()}-${idx}`
      })),
      car_models: Array.isArray(productToDuplicate?.car_models) ? [...productToDuplicate.car_models] : [],
      images: Array.isArray(productToDuplicate?.images) ? [...productToDuplicate.images] : [],
    };
    
    await get().updateProduct(newProduct);
  }
}));
