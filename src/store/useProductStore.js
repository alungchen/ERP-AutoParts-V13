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

  // 從 API 分頁載入全部產品（避免一次 2 萬筆造成 Worker 逾時）
  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const pageSize = 1500;
      let offset = 0;
      let total = Infinity;
      const all = [];

      while (offset < total) {
        const res = await fetch(`/api/products?limit=${pageSize}&offset=${offset}`);
        if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`);
        const data = await res.json();

        // 相容舊版直接回傳陣列的 API
        const items = Array.isArray(data) ? data : (data.items || []);
        total = Array.isArray(data) ? items.length : (Number(data.total) || items.length);
        all.push(...items);

        if (Array.isArray(data)) break;
        if (!data.hasMore || items.length === 0) break;
        offset += items.length;
      }

      set({ products: all, isLoading: false });
    } catch (err) {
      console.error("Failed to fetch products:", err);
      set({ isLoading: false });
    }
  },

  // 單筆補齊照片等完整欄位（列表預設不帶 images）
  fetchProductById: async (pId) => {
    if (!pId) return null;
    try {
      const res = await fetch(`/api/products?id=${encodeURIComponent(pId)}`);
      if (!res.ok) return null;
      const product = await res.json();
      set((state) => ({
        products: state.products.map((p) => (p.p_id === product.p_id ? { ...p, ...product } : p)),
        selectedProduct:
          state.selectedProduct?.p_id === product.p_id
            ? { ...state.selectedProduct, ...product }
            : state.selectedProduct,
      }));
      return product;
    } catch (err) {
      console.error('Failed to fetch product by id:', err);
      return null;
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
