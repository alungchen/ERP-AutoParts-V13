import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Dummy data for PIM module
const initialProducts = [
  {
    p_id: 'P-1001',
    name: 'Brake Pad Set - Front (Premium Ceramic)',
    car_models: ['Toyota Corolla 2018-2022', 'Toyota Prius 2016-2022'],
    category: 'Brake System',
    images: ['img1.jpg', 'img2.jpg'],
    part_numbers: [
      { pn_id: 'PN-001', part_number: '04465-02220', brand: 'Toyota OE', type: 'OE' },
      { pn_id: 'PN-002', part_number: 'BP-1029', brand: 'Akebono', type: 'OEM' },
      { pn_id: 'PN-003', part_number: 'BRK-FC-01', brand: 'Internal', type: 'Internal' }
    ],
    brand: 'Toyota OE',
    stock: 145,
    specifications: 'W-156mm, Premium Copper Free',
    safety_stock: 100,
    base_cost: 380
  },
  {
    p_id: 'P-1002',
    name: 'Air Filter Element',
    car_models: ['Honda Civic 2016-2021', 'Honda CR-V 2017-2022'],
    category: 'Filters',
    images: ['img3.jpg'],
    part_numbers: [
      { pn_id: 'PN-004', part_number: '17220-5AA-A00', brand: 'Honda OE', type: 'OE' },
      { pn_id: 'PN-005', part_number: 'CA12059', brand: 'FRAM', type: 'AM' }
    ],
    brand: 'Honda OE',
    stock: 320,
    specifications: 'Dry Type, L:235mm, W:144mm, H:82mm',
    safety_stock: 50,
    base_cost: 150
  },
  {
    p_id: 'P-1003',
    name: 'Spark Plug Iridium',
    car_models: ['Nissan Altima 2013-2018', 'Nissan Rogue 2014-2020'],
    category: 'Ignition',
    images: ['img4.jpg', 'img5.jpg', 'img6.jpg'],
    part_numbers: [
      { pn_id: 'PN-006', part_number: '22401-ED815', brand: 'Nissan OE', type: 'OE' },
      { pn_id: 'PN-007', part_number: 'LZKAR6AP-11', brand: 'NGK', type: 'OEM' }
    ],
    brand: 'Nissan OE',
    stock: 50,
    specifications: 'Iridium, Thread:14mm, Reach:26.5mm, Hex:14mm',
    safety_stock: 80,   // Below safety - auto-triggers sourcing alert
    base_cost: 250
  },
  {
    p_id: 'P-1004',
    name: 'Suspension Control Arm (Left/Right Universal)',
    car_models: ['Ford Focus 2012-2018', 'Mazda 3 2010-2013'],
    category: 'Suspension',
    images: [],
    part_numbers: Array.from({ length: 26 }).map((_, i) => ({
      pn_id: `PN-10${i}`,
      part_number: `FDF-${9000 + i}`,
      brand: i % 2 === 0 ? 'Ford OE' : (i % 3 === 0 ? 'Moog AM' : 'Internal'),
      type: i % 2 === 0 ? 'OE' : (i % 3 === 0 ? 'AM' : 'Internal')
    })),
    brand: 'Universal',
    stock: 42,
    specifications: 'Aluminium Cast, L/R Compatible',
    safety_stock: 20,
    base_cost: 1450
  }
];

export const useProductStore = create(persist((set) => ({
  products: initialProducts,
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  partNumberQuery: '',
  setPartNumberQuery: (query) => set({ partNumberQuery: query }),
  selectedProduct: null,
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  updateProduct: (updatedProduct) => set((state) => {
    const exists = state.products.some((p) => p.p_id === updatedProduct.p_id);
    const { isNew, ...cleanProduct } = updatedProduct;
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
  }),
  deleteProduct: (productId) => set((state) => ({
    products: state.products.filter((p) => p.p_id !== productId),
    selectedProduct: state.selectedProduct?.p_id === productId ? null : state.selectedProduct
  })),
  bulkUpdateProducts: (newProducts) => set((state) => {
    let updatedList = [...state.products];
    newProducts.forEach(newP => {
      const index = updatedList.findIndex(p => p.p_id === newP.p_id);
      if (index !== -1) {
        updatedList[index] = { ...updatedList[index], ...newP };
      } else {
        updatedList = [newP, ...updatedList];
      }
    });
    return { products: updatedList };
  }),
  duplicateProduct: (productToDuplicate) => set((state) => {
    const newId = `P-${Math.floor(1000 + Math.random() * 9000)}`;
    const sourceName = productToDuplicate?.name || '';
    const newProduct = {
      ...productToDuplicate,
      p_id: newId,
      name: `${sourceName} (Copy)`,
      isNew: true,
      // Deep-clone common nested arrays to avoid accidental shared references.
      part_numbers: (productToDuplicate?.part_numbers || []).map((pn, idx) => ({
        ...pn,
        pn_id: `PN-${Date.now()}-${idx}`
      })),
      car_models: Array.isArray(productToDuplicate?.car_models) ? [...productToDuplicate.car_models] : [],
      images: Array.isArray(productToDuplicate?.images) ? [...productToDuplicate.images] : [],
    };
    return {
      products: [newProduct, ...state.products],
      selectedProduct: newProduct
    };
  })
}), { name: 'erp-product-store' }));
