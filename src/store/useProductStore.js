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

  // 從 API 載入所有產品 (取代 localStorage 初始載入)
  fetchProducts: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        set({ products: data, isLoading: false });
      }
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
      if (!res.ok) throw new Error("Failed to delete product from DB");

      set((state) => ({
        products: state.products.filter((p) => p.p_id !== productId),
        selectedProduct: state.selectedProduct?.p_id === productId ? null : state.selectedProduct
      }));
    } catch (err) {
      console.error(err);
      alert('刪除產品失敗！');
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
