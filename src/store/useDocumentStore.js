import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';

const today = new Date().toISOString().split('T')[0];

// =========================================
// INQUIRY ORDER (詢價單) - sent to suppliers
// =========================================
const initialInquiries = [
    {
        doc_id: 'INQ-2024-001',
        type: 'inquiry',
        date: '2024-03-01',
        supplier_id: 'SUP-001',
        supplier_name: 'Akebono Global Ltd.',
        opener_emp_id: 'EMP-001',
        opener_emp_name: '陳志明',
        status: 'pending',
        due_date: '2024-03-15',
        items: [
            { p_id: 'P-1001', name: 'Brake Pad Set - Front', part_number: '04465-02220', qty: 100, unit: 'PCS', note: '' }
        ],
        notes: 'Please quote for Q2 batch. Need lead time confirmation.'
    },
    {
        doc_id: 'INQ-2024-002',
        type: 'inquiry',
        date: '2024-03-05',
        supplier_id: 'SUP-002',
        supplier_name: 'Denso Corporation Japan',
        opener_emp_id: 'EMP-002',
        opener_emp_name: '王雅婷',
        status: 'replied',
        due_date: '2024-03-20',
        items: [
            { p_id: 'P-1002', name: 'Air Filter Element', part_number: '17220-5AA-A00', qty: 500, unit: 'PCS', note: 'Honda Civic spec' },
            { p_id: 'P-1003', name: 'Spark Plug Iridium', part_number: '22401-ED815', qty: 200, unit: 'PCS', note: '' }
        ],
        notes: 'Urgent - low stock on spark plugs.'
    }
];

// =========================================
// PURCHASE ORDER (進貨單) - from suppliers
// =========================================
const initialPurchaseOrders = [
    {
        doc_id: 'PO-2024-001',
        type: 'purchase',
        date: '2024-02-15',
        supplier_id: 'SUP-002',
        supplier_name: 'Denso Corporation Japan',
        opener_emp_id: 'EMP-002',
        opener_emp_name: '王雅婷',
        status: 'received',
        expected_date: '2024-03-10',
        currency: 'JPY',
        exchange_rate: 0.21,
        items: [
            { p_id: 'P-1002', name: 'Air Filter Element', part_number: '17220-5AA-A00', qty: 500, unit_price: 550, unit: 'PCS' }
        ],
        freight_cost: 800,
        tariff_rate: 0.08,
        notes: 'Received in full. QC passed.'
    },
    {
        doc_id: 'PO-2024-002',
        type: 'purchase',
        date: '2024-03-01',
        supplier_id: 'SUP-001',
        supplier_name: 'Akebono Global Ltd.',
        opener_emp_id: 'EMP-001',
        opener_emp_name: '陳志明',
        status: 'in_transit',
        expected_date: '2024-03-20',
        currency: 'USD',
        exchange_rate: 31.85,
        items: [
            { p_id: 'P-1001', name: 'Brake Pad Set - Front', part_number: '04465-02220', qty: 100, unit_price: 11.50, unit: 'PCS' }
        ],
        freight_cost: 1500,
        tariff_rate: 0.05,
        notes: 'In transit via DHL. ETA Mar 20.'
    }
];

// =========================================
// QUOTATION (報價單) - to customers
// =========================================
const initialQuotations = [
    {
        doc_id: 'QT-2024-001',
        type: 'quotation',
        date: '2024-03-01',
        customer_id: 'CUST-001',
        customer_name: '台灣機車材料行',
        opener_emp_id: 'EMP-001',
        opener_emp_name: '陳志明',
        status: 'accepted',
        valid_until: '2024-04-01',
        currency: 'TWD',
        items: [
            { p_id: 'P-1001', name: 'Brake Pad Set - Front', part_number: 'BRK-FC-01', qty: 50, unit_price: 450, unit: 'PCS' }
        ],
        discount: 0.05,
        notes: 'A-tier pricing applied. 5% loyalty discount.'
    },
    {
        doc_id: 'QT-2024-002',
        type: 'quotation',
        date: '2024-03-05',
        customer_id: 'CUST-003',
        customer_name: 'Pacific Rim Imports LLC',
        opener_emp_id: 'EMP-001',
        opener_emp_name: '陳志明',
        status: 'sent',
        valid_until: '2024-04-05',
        currency: 'USD',
        items: [
            { p_id: 'P-1001', name: 'Brake Pad Set - Front', part_number: '04465-02220', qty: 500, unit_price: 14.50, unit: 'PCS' },
            { p_id: 'P-1002', name: 'Air Filter Element', part_number: '17220-5AA-A00', qty: 1000, unit_price: 5.20, unit: 'PCS' }
        ],
        discount: 0.08,
        notes: 'Volume discount applied for 500+ pcs per item.'
    }
];

// =========================================
// SALES ORDER (銷貨單) - confirmed sales
// =========================================
const initialSalesOrders = [
    {
        doc_id: 'SO-2024-001',
        type: 'sales',
        date: '2024-03-08',
        customer_id: 'CUST-001',
        customer_name: '台灣機車材料行',
        opener_emp_id: 'EMP-001',
        opener_emp_name: '陳志明',
        status: 'shipped',
        quotation_ref: 'QT-2024-001',
        currency: 'TWD',
        items: [
            { p_id: 'P-1001', name: 'Brake Pad Set - Front', part_number: 'BRK-FC-01', qty: 50, unit_price: 427.50, unit: 'PCS' }
        ],
        discount: 0.05,
        notes: 'Shipped via 黑貓宅急便. 追蹤號: 2280123456'
    },
    {
        doc_id: 'SO-2024-002',
        type: 'sales',
        date: '2024-03-10',
        customer_id: 'CUST-002',
        customer_name: 'Seoul Auto Wholesale',
        opener_emp_id: 'EMP-002',
        opener_emp_name: '王雅婷',
        status: 'pending_payment',
        quotation_ref: null,
        currency: 'USD',
        items: [
            { p_id: 'P-1003', name: 'Spark Plug Iridium', part_number: 'LZKAR6AP-11', qty: 100, unit_price: 8.50, unit: 'PCS' }
        ],
        discount: 0,
        notes: 'Awaiting T/T payment confirmation.'
    }
];

// =========================================
// SALES RETURN (銷貨退回)
// =========================================
const initialSalesReturns = [];

// =========================================
// PURCHASE RETURN (進貨退回)
// =========================================
const initialPurchaseReturns = [];

const STATUS_COLORS = {
    pending: 'warning',
    replied: 'accent',
    accepted: 'success',
    sent: 'accent',
    received: 'success',
    in_transit: 'warning',
    shipped: 'success',
    pending_payment: 'warning',
    cancelled: 'danger'
};

const DOC_PREFIXES = {
    inquiry: 'INQ',
    purchase: 'PO',
    quotation: 'QT',
    sales: 'SO',
    salesReturn: 'SR',
    purchaseReturn: 'PR',
};

const DOC_COLLECTION_KEYS = {
    inquiry: 'inquiries',
    purchase: 'purchaseOrders',
    quotation: 'quotations',
    sales: 'salesOrders',
    salesReturn: 'salesReturns',
    purchaseReturn: 'purchaseReturns',
};

const getDocCollectionKey = (type) => DOC_COLLECTION_KEYS[type] || 'inquiries';

const getLatestPurchaseSupplierByProduct = (purchaseOrders = []) => {
    const latestSupplierMap = {};
    const sortedPurchaseOrders = [...purchaseOrders].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    sortedPurchaseOrders.forEach((po) => {
        const supplierId = po.supplier_id || '';
        const supplierName = po.supplier_name || '';
        if (!supplierId && !supplierName) return;

        (po.items || []).forEach((item) => {
            if (!item?.p_id) return;
            if (!latestSupplierMap[item.p_id]) {
                latestSupplierMap[item.p_id] = {
                    supplier_id: supplierId,
                    supplier_name: supplierName
                };
            }
        });
    });

    return latestSupplierMap;
};

export const useDocumentStore = create(persist((set, get) => ({
    inquiries: initialInquiries,
    purchaseOrders: initialPurchaseOrders,
    quotations: initialQuotations,
    salesOrders: initialSalesOrders,
    salesReturns: initialSalesReturns,
    purchaseReturns: initialPurchaseReturns,
    shortageBook: [],
    shortageDismissedIds: [],
    statusColors: STATUS_COLORS,

    addDocument: (type, doc) => {
        const prefix = DOC_PREFIXES[type] || 'DOC';
        const newId = `${prefix}-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
        const now = new Date().toISOString().split('T')[0];
        const newDoc = { ...doc, doc_id: newId, type, date: now };
        const key = getDocCollectionKey(type);
        set((state) => ({ [key]: [newDoc, ...state[key]] }));
        return newDoc;
    },

    updateStatus: (type, docId, newStatus) => set((state) => {
        const key = getDocCollectionKey(type);
        return { [key]: state[key].map(d => d.doc_id === docId ? { ...d, status: newStatus } : d) };
    }),

    updateDocument: (type, updatedDoc) => {
        const key = getDocCollectionKey(type);
        set((state) => ({ [key]: state[key].map(d => d.doc_id === updatedDoc.doc_id ? updatedDoc : d) }));
        return updatedDoc;
    },

    deleteDocument: (type, docId) => set((state) => {
        const key = getDocCollectionKey(type);
        return { [key]: state[key].filter(d => d.doc_id !== docId) };
    }),

    // Auto-generate an inquiry for low-stock products
    autoCreateInquiry: (product) => set((state) => {
        const newInq = {
            doc_id: `INQ-AUTO-${Date.now()}`,
            type: 'inquiry',
            date: today,
            supplier_id: '',
            supplier_name: '(未指定供應商)',
            opener_emp_id: '',
            opener_emp_name: '',
            status: 'pending',
            due_date: '',
            items: [{
                p_id: product.p_id,
                name: product.name,
                part_number: product.part_numbers[0]?.part_number || '',
                qty: (product.safety_stock - product.stock) * 2,
                unit: 'PCS',
                note: `AUTO: 庫存 ${product.stock} 低於安全庫存 ${product.safety_stock}`
            }],
            notes: `[系統自動產生] 庫存警示補貨詢價 - ${product.name}`
        };
        return { inquiries: [newInq, ...state.inquiries] };
    }),

    bulkUpdateInquiries: (list) => set((state) => {
        let updatedList = [...state.inquiries];
        list.forEach(item => {
            const idx = updatedList.findIndex(d => d.doc_id === item.doc_id);
            if (idx !== -1) updatedList[idx] = { ...updatedList[idx], ...item };
            else updatedList = [item, ...updatedList];
        });
        return { inquiries: updatedList };
    }),

    syncShortageBook: (products = [], purchaseOrders = []) => set((state) => {
        const productMap = new Map(products.map((p) => [p.p_id, p]));
        // 缺貨簿列：庫存 ≤ 安全庫存 即保留；僅當庫存 > 安全庫存（例如進貨入庫後）才自動從清單移除
        const lowStockProducts = products.filter((p) => Number(p.safety_stock || 0) > 0 && Number(p.stock || 0) <= Number(p.safety_stock || 0));
        const lowStockIds = new Set(lowStockProducts.map((p) => p.p_id));
        const activeDismissedIds = (state.shortageDismissedIds || []).filter((id) => lowStockIds.has(id));
        const dismissedIdSet = new Set(activeDismissedIds);
        const existingMap = new Map((state.shortageBook || []).map((item) => [item.p_id, item]));
        const latestSupplierByProduct = getLatestPurchaseSupplierByProduct(purchaseOrders);

        const nextShortageBookAuto = lowStockProducts
            .filter((product) => !dismissedIdSet.has(product.p_id))
            .map((product) => {
                const existing = existingMap.get(product.p_id);
                const latestSupplier = latestSupplierByProduct[product.p_id] || {};
                const shortageQty = Math.max(Number(product.safety_stock || 0) - Number(product.stock || 0), 0);

                return {
                    p_id: product.p_id,
                    name: product.name,
                    spec: product.specifications || '',
                    part_number: product.part_numbers?.[0]?.part_number || product.part_number || '',
                    stock: Number(product.stock || 0),
                    safety_stock: Number(product.safety_stock || 0),
                    shortage_qty: shortageQty,
                    suggested_qty: existing?.suggested_qty || shortageQty || 1,
                    supplier_id: existing?.supplier_id || latestSupplier.supplier_id || '',
                    supplier_name: existing?.supplier_name || latestSupplier.supplier_name || '',
                    note: existing?.note || '',
                    source: 'auto'
                };
            });

        const manualItems = (state.shortageBook || [])
            .filter((item) => item.source === 'manual' && !dismissedIdSet.has(item.p_id))
            .map((item) => {
                const product = productMap.get(item.p_id);
                const latestSupplier = latestSupplierByProduct[item.p_id] || {};
                if (!product) return item;
                const shortageQty = Math.max(Number(product.safety_stock || 0) - Number(product.stock || 0), 0);
                return {
                    ...item,
                    name: product.name,
                    spec: product.specifications || item.spec || '',
                    part_number: product.part_numbers?.[0]?.part_number || product.part_number || item.part_number || '',
                    stock: Number(product.stock || 0),
                    safety_stock: Number(product.safety_stock || 0),
                    shortage_qty: shortageQty,
                    supplier_id: item.supplier_id || latestSupplier.supplier_id || '',
                    supplier_name: item.supplier_name || latestSupplier.supplier_name || '',
                    source: 'manual'
                };
            });

        const manualOnly = manualItems.filter((item) => !lowStockIds.has(item.p_id));
        const nextShortageBook = [...nextShortageBookAuto, ...manualOnly];

        return {
            shortageBook: nextShortageBook,
            shortageDismissedIds: activeDismissedIds
        };
    }),

    addProductsToShortageBook: (products = [], purchaseOrders = []) => set((state) => {
        const existingMap = new Map((state.shortageBook || []).map((item) => [item.p_id, item]));
        const latestSupplierByProduct = getLatestPurchaseSupplierByProduct(purchaseOrders);
        const nextShortageBook = [...(state.shortageBook || [])];
        const dismissedSet = new Set(state.shortageDismissedIds || []);

        products.forEach((product) => {
            if (!product?.p_id) return;
            const existing = existingMap.get(product.p_id);
            const latestSupplier = latestSupplierByProduct[product.p_id] || {};
            const shortageQty = Math.max(Number(product.safety_stock || 0) - Number(product.stock || 0), 0);
            const newItem = {
                p_id: product.p_id,
                name: product.name,
                spec: product.specifications || '',
                part_number: product.part_numbers?.[0]?.part_number || product.part_number || '',
                stock: Number(product.stock || 0),
                safety_stock: Number(product.safety_stock || 0),
                shortage_qty: shortageQty,
                suggested_qty: existing?.suggested_qty || shortageQty || 1,
                supplier_id: existing?.supplier_id || latestSupplier.supplier_id || '',
                supplier_name: existing?.supplier_name || latestSupplier.supplier_name || '',
                note: existing?.note || '',
                source: 'manual'
            };

            if (existing) {
                const index = nextShortageBook.findIndex((item) => item.p_id === product.p_id);
                if (index !== -1) nextShortageBook[index] = { ...nextShortageBook[index], ...newItem };
            } else {
                nextShortageBook.push(newItem);
            }

            dismissedSet.delete(product.p_id);
        });

        return {
            shortageBook: nextShortageBook,
            shortageDismissedIds: [...dismissedSet]
        };
    }),

    updateShortageSupplier: (pId, supplier = null) => set((state) => ({
        shortageBook: (state.shortageBook || []).map((item) =>
            item.p_id === pId
                ? {
                    ...item,
                    supplier_id: supplier?.sup_id || '',
                    supplier_name: supplier?.name || ''
                }
                : item
        )
    })),

    updateShortageSuggestedQty: (pId, qty) => set((state) => ({
        shortageBook: (state.shortageBook || []).map((item) =>
            item.p_id === pId
                ? { ...item, suggested_qty: Math.max(1, Number(qty || 1)) }
                : item
        )
    })),

    deleteShortageItems: (pIds = []) => set((state) => {
        const removeSet = new Set(pIds);
        const nextDismissed = new Set([...(state.shortageDismissedIds || []), ...pIds]);
        return {
            shortageBook: (state.shortageBook || []).filter((item) => !removeSet.has(item.p_id)),
            shortageDismissedIds: [...nextDismissed]
        };
    }),

    transferShortageToInquiry: ({ pIds = [], openerEmpId = '', openerEmpName = '' }) => {
        const state = get();
        const selectedSet = new Set(pIds);
        const selectedItems = (state.shortageBook || []).filter((item) => selectedSet.has(item.p_id));
        if (selectedItems.length === 0) return [];

        const groupedBySupplier = selectedItems.reduce((acc, item) => {
            const key = item.supplier_id || '__UNASSIGNED__';
            if (!acc[key]) acc[key] = [];
            acc[key].push(item);
            return acc;
        }, {});

        const createdDocs = [];
        Object.keys(groupedBySupplier).forEach((supplierKey) => {
            const items = groupedBySupplier[supplierKey];
            if (!items || items.length === 0) return;

            const supplierId = supplierKey === '__UNASSIGNED__' ? '' : (items[0].supplier_id || '');
            const supplierName = items[0].supplier_name || '(未指定供應商)';
            const inquiryDoc = {
                type: 'inquiry',
                date: today,
                supplier_id: supplierId,
                supplier_name: supplierName,
                opener_emp_id: openerEmpId || '',
                opener_emp_name: openerEmpName || '',
                status: 'pending',
                due_date: '',
                items: items.map((item) => ({
                    p_id: item.p_id,
                    name: item.name,
                    part_number: item.part_number || '',
                    qty: Number(item.suggested_qty || item.shortage_qty || 1),
                    unit: 'PCS',
                    note: item.note || `AUTO: 庫存 ${item.stock} 低於安全庫存 ${item.safety_stock}`
                })),
                notes: `[缺貨簿轉單] 系統自動產生詢價單，共 ${items.length} 項`
            };
            const created = get().addDocument('inquiry', inquiryDoc);
            createdDocs.push(created);
        });

        // 轉詢價後仍保留於缺貨簿，直至庫存 > 安全庫存（由 syncShortageBook 依產品庫存更新）
        return createdDocs;
    }
}), { name: 'erp-document-store', storage: erpPersistStorage }));
