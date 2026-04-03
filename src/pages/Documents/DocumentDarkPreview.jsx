import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useProductStore } from '../../store/useProductStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useShorthandStore } from '../../store/useShorthandStore';
import { FileText, Printer, Edit2, X, Trash2, Save, Package, RotateCcw, Plus, Search } from 'lucide-react';
import PartMappingModal from '../PIM/PartMappingModal';
import DocProductHistoryDrawer from '../../components/DocProductHistoryDrawer';
import { isElementInDocPartEditingZone } from '../../utils/docHistoryFocusZones';
import { sortedCustomersForSelect, sortedSuppliersForSelect } from '../../utils/sortContactsForSelect';
import {
    productCarModelsSearchText,
    productPurchaseUnitPrice,
    productSalesUnitPrice,
    productLineCarModel,
    productLineYear
} from '../../utils/productPickerSync';

// --- Viewing Mode Component ---
const DocumentDarkPreviewView = ({ doc, type, onEdit, onClose, inline = false, canEdit = true }) => {
    const { t } = useTranslation();
    const { defaultCurrency, isMultiCountryMode, vatEnabled, vatRate } = useAppStore();
    const { suppliers } = useSupplierStore();
    const { customers } = useCustomerStore();
    const customerOptions = useMemo(() => sortedCustomersForSelect(customers), [customers]);
    const supplierOptions = useMemo(() => sortedSuppliersForSelect(suppliers), [suppliers]);
    const { employees } = useEmployeeStore();
    const { products } = useProductStore();
    const [mappingProduct, setMappingProduct] = useState(null);
    const editBtnRef = useRef(null);

    // 進入此畫面時自動聚焦「編輯」按鈕，方便鍵盤操作（使用較長延遲確保勝過其他 focus）
    useEffect(() => {
        if (!canEdit) return;
        const focusEdit = () => editBtnRef.current?.focus();
        // 多次延遲以確保 DOM 已就緒且勝過其他會搶焦點的邏輯
        const t1 = setTimeout(focusEdit, 50);
        const t2 = setTimeout(focusEdit, 150);
        const t3 = setTimeout(focusEdit, 350);
        const t4 = setTimeout(focusEdit, 550);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }, [canEdit, doc?.doc_id]);

    if (!doc) return null;

    const isSupplier = type === 'inquiry' || type === 'purchase' || type === 'purchaseReturn';
    const isCustomer = type === 'quotation' || type === 'sales' || type === 'salesReturn';
    const docTypeLabelKeyMap = {
        inquiry: 'docs.tabInquiry',
        purchase: 'docs.tabPurchase',
        quotation: 'docs.tabQuotation',
        sales: 'docs.tabSales',
        salesReturn: 'docs.tabSalesReturn',
        purchaseReturn: 'docs.tabPurchaseReturn',
    };

    const displayCurrency = (isSupplier || (!isMultiCountryMode && isCustomer))
        ? defaultCurrency
        : (doc.currency || defaultCurrency);
    const formatAmount = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subtotal = (doc.items || []).reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0);
    const vatAmount = vatEnabled ? subtotal * ((Number(vatRate) || 0) / 100) : 0;
    const grandTotal = subtotal + vatAmount;

    const getPartyName = () => {
        if (isSupplier) {
            const s = supplierOptions.find((sup) => sup.sup_id === doc.supplier_id);
            return s ? `${s.sup_id} | ${s.name}` : doc.supplier_name || '-';
        } else {
            const c = customerOptions.find((cust) => cust.cust_id === doc.customer_id);
            return c ? `${c.cust_id} | ${c.name}` : doc.customer_name || '-';
        }
    };

    const getOpenerDisplay = () => {
        if (doc.opener_emp_name) return `${doc.opener_emp_name} (${doc.opener_emp_id || '-'})`;
        if (doc.opener_emp_id) {
            const e = employees.find((item) => item.emp_id === doc.opener_emp_id);
            return e ? `${e.name} (${e.emp_id})` : doc.opener_emp_id;
        }
        return '-';
    };

    const STATUS_MAP = {
        pending: '待處理',
        accepted: '已核准',
        received: '已入庫',
        replied: '已回覆',
        sent: '已送出',
        in_transit: '運輸中',
        shipped: '已出貨',
        pending_payment: '待付款',
        cancelled: '已取消'
    };

    return (
        <div style={{
            backgroundColor: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: inline ? '0 0 8px 8px' : '12px',
            overflow: 'hidden',
            width: '100%',
            flex: inline ? 1 : undefined,
            minHeight: inline ? 0 : undefined,
            height: inline ? '100%' : '90vh',
            maxHeight: inline ? '100%' : 'none',
            border: inline ? 'none' : '1px solid var(--border-color)',
            boxShadow: inline ? 'none' : '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
            {/* Header section */}
            <div style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ background: isCustomer ? '#3b82f6' : '#8b5cf6', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 800 }}>
                            {t(docTypeLabelKeyMap[type] || 'docs.title')}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                單號: {doc.doc_id}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                檢視模式
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={() => window.print()}
                            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                            title="列印單據"
                        >
                            <Printer size={18} />
                        </button>
                        {canEdit && (
                            <button
                                id="doc-preview-edit-btn"
                                ref={editBtnRef}
                                autoFocus
                                onClick={onEdit}
                                style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                            >
                                <Edit2 size={18} /> 編輯
                            </button>
                        )}
                        {!inline && (
                            <button onClick={onClose} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.1fr 1fr 1.7fr', gap: '0.85rem', alignItems: 'end', padding: '0.7rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>日期</label>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                            {doc.date}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>{isSupplier ? '供應商 (廠商)' : '客戶 (買家)'}</label>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getPartyName()}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>
                            {type === 'sales' ? '狀態（暫不開放）' : '狀態'}
                        </label>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                            {type === 'sales' ? '—' : (STATUS_MAP[doc.status] || doc.status)}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>幣別</label>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                            {doc.currency || displayCurrency}
                        </div>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>開單人員</label>
                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>
                            {getOpenerDisplay()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Body */}
            <div className="custom-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: '1.5rem' }}>
                <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            <tr>
                                <th style={{ padding: '1rem' }}>零件號碼 (ID)</th>
                                <th style={{ padding: '1rem' }}>車型 / 年份</th>
                                <th style={{ padding: '1rem' }}>品名 / 規格</th>
                                <th style={{ padding: '1rem' }}>品牌</th>
                                <th style={{ padding: '1rem', width: '80px', textAlign: 'center' }}>庫存狀況</th>
                                <th style={{ padding: '1rem', width: '80px', textAlign: 'center' }}>數量</th>
                                <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>單價</th>
                                <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>小計</th>
                            </tr>
                        </thead>
                        <tbody>
                            {doc.items.map((item, idx) => {
                                const associatedProduct = products.find(p => p.p_id === item.p_id);
                                const mappingCount = associatedProduct?.part_numbers?.length || 0;

                                return (
                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>{item.part_number || item.p_id}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.p_id}</div>
                                            {mappingCount > 0 && (
                                                <div
                                                    onClick={(e) => { e.stopPropagation(); setMappingProduct(associatedProduct); }}
                                                    style={{
                                                        marginTop: '4px',
                                                        fontSize: '10px',
                                                        backgroundColor: 'var(--bg-tertiary)',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        color: '#60a5fa',
                                                        border: '1px solid var(--border-color)',
                                                        display: 'inline-block',
                                                        cursor: 'pointer'
                                                    }}
                                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                                                >
                                                    +{mappingCount} 適用
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.car_model || '-'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.year || '-'}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.spec || '-'}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.brand || '-'}</div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: (associatedProduct?.stock ?? item.stock ?? 0) > 0 ? '#10b981' : '#ef4444' }}>
                                                {associatedProduct?.stock ?? item.stock ?? '-'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 700 }}>{item.qty}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-primary)', fontWeight: 700 }}>{item.unit_price?.toLocaleString()}</td>
                                        <td style={{ padding: '1rem', textAlign: 'center', color: '#f59e0b', fontWeight: 800 }}>{(item.qty * (item.unit_price || 0)).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Summary */}
            <div style={{ padding: '1rem 2rem', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: '3rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <span>總項數: <b>{doc.items.length}</b></span>
                        <span>總件數: <b>{doc.items.reduce((sum, item) => sum + (item.qty || 0), 0)}</b></span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                            未稅小計 ({doc.currency || displayCurrency}): {formatAmount(subtotal)}
                        </div>
                        {vatEnabled && (
                            <div style={{ color: 'var(--accent-hover)', fontSize: '0.95rem', marginBottom: '0.3rem', fontWeight: 700 }}>
                                VAT ({Number(vatRate || 0).toFixed(2)}%): {formatAmount(vatAmount)} (含稅)
                            </div>
                        )}
                        <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f59e0b' }}>
                            {vatEnabled ? '含稅總計' : '未稅總計'} ({doc.currency || displayCurrency}): {formatAmount(grandTotal)}
                        </div>
                    </div>
                </div>
            </div>

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    onClose={() => setMappingProduct(null)}
                />
            )}
        </div>
    );
};

// --- Inline Editor Mode Component ---
const DocumentInnerEditor = ({ docId, type, onSave, onClose, inline = false, docHistoryDrawerHostEl = null }) => {
    const { t } = useTranslation();
    const { updateDocument, deleteDocument, inquiries, purchaseOrders, quotations, salesOrders, salesReturns, purchaseReturns } = useDocumentStore();
    const { products } = useProductStore();
    const { suppliers } = useSupplierStore();
    const { customers } = useCustomerStore();
    const { employees } = useEmployeeStore();
    const { models, parts, brands } = useShorthandStore();
    const { defaultCurrency, isMultiCountryMode } = useAppStore();
    const [mappingProduct, setMappingProduct] = useState(null);
    const saveBtnRef = useRef(null);
    const selectAllRef = useRef(null);
    const [selectedIndexes, setSelectedIndexes] = useState([]);
    const [activeItemIndex, setActiveItemIndex] = useState(0);
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
    const itemTbodyRef = useRef(null);
    const docListKeyboardRef = useRef(null);

    const [doc, setDoc] = useState(null);

    // Product Picker State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerQuery, setPickerQuery] = useState({ partNumber: '', model: '', part: '', spec: '', year: '', brand: '' });
    const [pickerResults, setPickerResults] = useState([]);
    const [selectedPickerProductIds, setSelectedPickerProductIds] = useState([]);
    const [activePickerRowIndex, setActivePickerRowIndex] = useState(0);
    const pickerSelectAllRef = useRef(null);
    const pickerListRef = useRef(null);
    const setProductHistoryFocusPId = useAppStore((s) => s.setProductHistoryFocusPId);

    useEffect(() => {
        if (!isPickerOpen) setSelectedPickerProductIds([]);
    }, [isPickerOpen]);

    const docHistoryFocusPId = useMemo(() => {
        if (!doc) return null;
        if (isPickerOpen && pickerResults.length > 0) {
            return pickerResults[activePickerRowIndex]?.p_id || null;
        }
        if (doc.items?.length) {
            const item = doc.items[activeItemIndex];
            return item?.p_id && String(item.p_id).trim() ? item.p_id : null;
        }
        return null;
    }, [
        doc?.doc_id,
        isPickerOpen,
        pickerResults.length,
        activePickerRowIndex,
        pickerResults[activePickerRowIndex]?.p_id,
        doc?.items?.length,
        activeItemIndex,
        doc?.items?.[activeItemIndex]?.p_id,
    ]);

    useEffect(() => {
        setProductHistoryFocusPId(docHistoryFocusPId);
    }, [docHistoryFocusPId, setProductHistoryFocusPId]);

    useEffect(() => () => setProductHistoryFocusPId(null), [setProductHistoryFocusPId]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.repeat || e.code !== 'F8') return;
            if (!isElementInDocPartEditingZone(document.activeElement)) return;
            e.preventDefault();
            setHistoryDrawerOpen((v) => !v);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    useEffect(() => {
        setHistoryDrawerOpen(false);
    }, [isPickerOpen]);

    // 僅在首次開啟或切換單據時從 store 載入，避免 store 變動時覆蓋使用者未儲存的編輯或新增品項
    useEffect(() => {
        const state = useDocumentStore.getState();
        let existingDoc = null;
        if (type === 'inquiry') existingDoc = (state.inquiries || []).find(d => d.doc_id === docId);
        else if (type === 'purchase') existingDoc = (state.purchaseOrders || []).find(d => d.doc_id === docId);
        else if (type === 'quotation') existingDoc = (state.quotations || []).find(d => d.doc_id === docId);
        else if (type === 'sales') existingDoc = (state.salesOrders || []).find(d => d.doc_id === docId);
        else if (type === 'salesReturn') existingDoc = (state.salesReturns || []).find(d => d.doc_id === docId);
        else if (type === 'purchaseReturn') existingDoc = (state.purchaseReturns || []).find(d => d.doc_id === docId);

        if (existingDoc) {
            setDoc({ ...existingDoc });
        }
    }, [docId, type]);

    const isSupplier = type === 'inquiry' || type === 'purchase' || type === 'purchaseReturn';
    const isCustomer = type === 'quotation' || type === 'sales' || type === 'salesReturn';
    const docTypeLabelKeyMap = {
        inquiry: 'docs.tabInquiry',
        purchase: 'docs.tabPurchase',
        quotation: 'docs.tabQuotation',
        sales: 'docs.tabSales',
        salesReturn: 'docs.tabSalesReturn',
        purchaseReturn: 'docs.tabPurchaseReturn',
    };
    const isCurrencyLocked = (isSupplier) || (isCustomer && !isMultiCountryMode);

    const handleSave = () => {
        updateDocument(type, doc);
        if (onSave) onSave();
    };

    // 進入編輯模式時自動聚焦「儲存」按鈕
    useEffect(() => {
        if (!doc || !saveBtnRef.current) return;
        const focusSave = () => saveBtnRef.current?.focus();
        focusSave();
        const t1 = setTimeout(focusSave, 100);
        const t2 = setTimeout(focusSave, 300);
        const t3 = setTimeout(focusSave, 500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [doc?.doc_id]);

    const handleCloseEditor = () => {
        if ((doc.items || []).length === 0) {
            const shouldDelete = window.confirm('此單據目前沒有任何零件，是否要刪除此單據？');
            if (shouldDelete) {
                deleteDocument(type, doc.doc_id);
            } else {
                return;
            }
        }
        if (onClose) onClose();
    };

    const addEmptyItem = () => {
        if (!doc) return;
        const emptyItem = {
            p_id: '',
            name: '',
            part_number: '',
            car_model: '',
            brand: '',
            year: '',
            spec: '',
            qty: 1,
            unit_price: 0,
            unit: 'PCS',
            stock: 0
        };
        setDoc((prev) => ({ ...prev, items: [...(prev.items || []), emptyItem] }));
        setActiveItemIndex((doc.items || []).length);
    };

    const removeItem = (index) => {
        const newItems = [...doc.items];
        newItems.splice(index, 1);
        setDoc({ ...doc, items: newItems });
        setSelectedIndexes([]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...doc.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setDoc({ ...doc, items: newItems });
    };

    const toggleItemSelection = (index, checked) => {
        setSelectedIndexes((prev) => {
            if (checked) {
                if (prev.includes(index)) return prev;
                return [...prev, index];
            }
            return prev.filter((itemIndex) => itemIndex !== index);
        });
    };

    const toggleSelectAllItems = (checked) => {
        if (!checked) {
            setSelectedIndexes([]);
            return;
        }
        setSelectedIndexes(doc.items.map((_, index) => index));
    };

    const handleDeleteSelected = () => {
        if (selectedIndexes.length === 0) return;
        const selectedSet = new Set(selectedIndexes);
        const newItems = doc.items.filter((_, index) => !selectedSet.has(index));
        setDoc({ ...doc, items: newItems });
        setSelectedIndexes([]);
    };

    const handlePickProduct = (p) => {
        const pnObj = p.part_numbers?.[0] || {};
        const isPurch = type === 'purchase' || type === 'purchaseReturn';
        const newItem = {
            p_id: p.p_id,
            name: p.name,
            part_number: pnObj.part_number || p.part_number || '',
            car_model: productLineCarModel(p),
            brand: pnObj.brand || p.brand || '',
            year: productLineYear(p),
            spec: p.specifications || '',
            qty: 1,
            unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
            unit: 'PCS'
        };
        setDoc({ ...doc, items: [...doc.items, newItem] });
        setIsPickerOpen(false);
    };

    const isPickerAllSelected = selectedPickerProductIds.length === pickerResults.length && pickerResults.length > 0;
    const isPickerPartiallySelected = selectedPickerProductIds.length > 0 && selectedPickerProductIds.length < pickerResults.length;
    const togglePickerSelection = (pId, checked) => {
        setSelectedPickerProductIds((prev) => {
            if (checked) return prev.includes(pId) ? prev : [...prev, pId];
            return prev.filter((id) => id !== pId);
        });
    };
    const togglePickerSelectAll = (checked) => {
        if (!checked) {
            setSelectedPickerProductIds([]);
            return;
        }
        setSelectedPickerProductIds(pickerResults.map((p) => p.p_id));
    };
    const handlePickSelectedProducts = () => {
        if (selectedPickerProductIds.length === 0) return;
        const selectedProducts = pickerResults.filter((p) => selectedPickerProductIds.includes(p.p_id));
        const isPurch = type === 'purchase' || type === 'purchaseReturn';
        const newItems = selectedProducts.map((p) => {
            const pnObj = p.part_numbers?.[0] || {};
            return {
                p_id: p.p_id,
                name: p.name,
                part_number: pnObj.part_number || p.part_number || '',
                car_model: productLineCarModel(p),
                brand: pnObj.brand || p.brand || '',
                year: productLineYear(p),
                spec: p.specifications || '',
                qty: 1,
                unit_price: isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p),
                unit: 'PCS'
            };
        });
        setDoc({ ...doc, items: [...doc.items, ...newItems] });
        setSelectedPickerProductIds([]);
        setIsPickerOpen(false);
    };

    useEffect(() => {
        if (!pickerSelectAllRef.current || !isPickerOpen) return;
        pickerSelectAllRef.current.indeterminate = isPickerPartiallySelected;
    }, [isPickerPartiallySelected, isPickerOpen]);

    useEffect(() => {
        const normalize = (v) => String(v ?? '').toLowerCase();
        const rawQuery = normalize(pickerQuery.partNumber).trim();
        if (!rawQuery) {
            setPickerResults(products.slice(0, 50));
            return;
        }

        const phraseDict = [...models, ...parts, ...brands];
        const tokens = rawQuery.split(/\s+/).filter(Boolean);

        const tokenGroups = tokens.map((token) => {
            const matchedPhrases = phraseDict.filter((item) => {
                const shorthand = normalize(item?.shorthand);
                const fullname = normalize(item?.fullname);
                return shorthand.includes(token) || fullname.includes(token);
            });
            const group = new Set([token]);
            matchedPhrases.forEach((item) => {
                group.add(normalize(item?.shorthand));
                group.add(normalize(item?.fullname));
            });
            return Array.from(group).filter(Boolean);
        });

        const filtered = products.filter((p) => {
            const pnText = (p.part_numbers || [])
                .map((pn) => `${pn?.part_number || ''} ${pn?.car_model || ''} ${pn?.brand || ''} ${pn?.year || ''}`)
                .join(' ');
            const carModelsText = productCarModelsSearchText(p);
            const searchable = normalize(
                `${p.p_id || ''} ${p.part_number || ''} ${p.name || ''} ${p.notes || ''} ${p.specifications || ''} ${p.brand || ''} ${carModelsText} ${p.year || ''} ${pnText}`
            );
            return tokenGroups.every((group) => group.some((candidate) => searchable.includes(candidate)));
        });

        setPickerResults(filtered.slice(0, 50));
    }, [pickerQuery.partNumber, products, models, parts, brands]);

    useEffect(() => {
        if (!isPickerOpen) return;
        if (pickerResults.length === 0) {
            setActivePickerRowIndex(0);
            return;
        }
        setActivePickerRowIndex((prev) => Math.min(prev, pickerResults.length - 1));
    }, [isPickerOpen, pickerResults.length]);

    useEffect(() => {
        if (!isPickerOpen || pickerResults.length === 0) return;
        const list = pickerListRef.current;
        if (!list?.contains(document.activeElement)) return;
        const row = list.querySelector(`[data-picker-row-idx="${activePickerRowIndex}"]`);
        row?.scrollIntoView({ block: 'nearest' });
    }, [activePickerRowIndex, isPickerOpen, pickerResults.length]);

    const handlePickerListKeyDown = (e) => {
        if (pickerResults.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivePickerRowIndex((prev) => Math.min(prev + 1, pickerResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActivePickerRowIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            const p = pickerResults[activePickerRowIndex];
            if (p) {
                const checked = selectedPickerProductIds.includes(p.p_id);
                togglePickerSelection(p.p_id, !checked);
            }
        } else if (e.key === 'Enter') {
            if (selectedPickerProductIds.length > 0) {
                e.preventDefault();
                handlePickSelectedProducts();
            }
        }
    };

    const isAllSelected = doc?.items?.length > 0 && selectedIndexes.length === doc.items.length;
    const isPartiallySelected = selectedIndexes.length > 0 && selectedIndexes.length < (doc?.items?.length || 0);

    useEffect(() => {
        if (!selectAllRef.current) return;
        selectAllRef.current.indeterminate = isPartiallySelected;
    }, [isPartiallySelected]);

    useEffect(() => {
        if (!doc) return;
        if ((doc.items || []).length === 0) {
            setActiveItemIndex(0);
            return;
        }
        if (activeItemIndex > doc.items.length - 1) {
            setActiveItemIndex(doc.items.length - 1);
        }
    }, [doc, activeItemIndex]);

    useEffect(() => {
        if (!doc || isPickerOpen || (doc.items || []).length === 0 || !docListKeyboardRef.current) return;
        setActiveItemIndex(0);
        docListKeyboardRef.current.focus();
    }, [doc?.doc_id, doc?.items?.length, isPickerOpen]);

    useEffect(() => {
        if (!itemTbodyRef.current) return;
        const rowEl = itemTbodyRef.current.querySelector(`[data-doc-dark-item-row-idx="${activeItemIndex}"]`);
        if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
    }, [activeItemIndex]);

    const handleDocListKeyDown = (e) => {
        if (!doc || (doc.items || []).length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveItemIndex((prev) => Math.min(prev + 1, doc.items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveItemIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            const checked = selectedIndexes.includes(activeItemIndex);
            toggleItemSelection(activeItemIndex, !checked);
        }
    };

    if (!doc) return null;

    return (
        <>
            <div style={{
                backgroundColor: '#0f172a',
                color: '#f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: '0 0 8px 8px',
                flex: inline ? 1 : undefined,
                minHeight: inline ? 0 : undefined,
                height: inline ? '100%' : '90vh',
                maxHeight: inline ? '100%' : '90vh'
            }}>
                <div style={{ padding: '1rem 1.5rem', backgroundColor: '#1e293b', borderBottom: '1px solid #334155', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                            <div style={{ background: isCustomer ? '#3b82f6' : '#8b5cf6', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '4px', fontWeight: 800 }}>
                                {t(docTypeLabelKeyMap[type] || 'docs.title')}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>單號: {doc.doc_id}</span>
                                <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>快速編輯中...</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={() => window.print()} style={{ backgroundColor: '#334155', color: 'white', border: '1px solid #475569', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><Printer size={18} /></button>
                            <button ref={saveBtnRef} autoFocus onClick={handleSave} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}><Save size={18} /> 儲存</button>
                            <button onClick={handleCloseEditor} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '0.6rem 0.8rem', borderRadius: '6px', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1.1fr 1fr 1.7fr', gap: '0.85rem', alignItems: 'end', padding: '0.7rem', border: '1px solid #334155', borderRadius: '8px', background: '#0f172a' }}>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: '#2563eb', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>日期</label>
                            <input type="date" value={doc.date} onChange={e => setDoc({ ...doc, date: e.target.value })} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '4px', color: '#dbeafe', fontSize: '1rem', fontWeight: 700 }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: '#2563eb', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>{isSupplier ? '供應商' : '客戶'}</label>
                            <div style={{ padding: '0.5rem', backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '4px', color: '#dbeafe', fontSize: '1rem', fontWeight: 700 }}>{isSupplier ? doc.supplier_name : doc.customer_name}</div>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: '#2563eb', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>
                                {type === 'sales' ? '狀態（暫不開放）' : '狀態'}
                            </label>
                            {type === 'sales' ? (
                                <div
                                    title="銷貨單開單即入應收；狀態日後處理"
                                    style={{
                                        width: '100%',
                                        padding: '0.5rem',
                                        backgroundColor: '#1e293b',
                                        border: '1px dashed #475569',
                                        borderRadius: '4px',
                                        color: '#94a3b8',
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                    }}
                                >
                                    開單即入帳；狀態日後開放
                                </div>
                            ) : (
                                <select value={doc.status} onChange={(e) => setDoc({ ...doc, status: e.target.value })} style={{ width: '100%', padding: '0.5rem', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '4px', color: '#dbeafe', fontSize: '1rem', fontWeight: 700 }}>
                                    <option value="pending">待處理</option>
                                    <option value="accepted">已核准</option>
                                    <option value="received">已入庫</option>
                                </select>
                            )}
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: '#2563eb', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>幣別</label>
                            <select value={doc.currency} disabled={isCurrencyLocked} onChange={e => setDoc({ ...doc, currency: e.target.value })} style={{ width: '100%', padding: '0.5rem', backgroundColor: isCurrencyLocked ? '#1e293b' : '#334155', border: '1px solid #475569', borderRadius: '4px', color: '#dbeafe', fontWeight: 700, fontSize: '1rem' }}>
                                <option value="TWD">TWD</option><option value="USD">USD</option><option value="JPY">JPY</option>
                            </select>
                        </div>
                        <div>
                            <label style={{ fontSize: '0.85rem', color: '#2563eb', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>開單人員</label>
                            <select
                                value={doc.opener_emp_id || ''}
                                onChange={e => {
                                    const emp = employees.find((item) => item.emp_id === e.target.value);
                                    setDoc({
                                        ...doc,
                                        opener_emp_id: emp?.emp_id || '',
                                        opener_emp_name: emp?.name || ''
                                    });
                                }}
                                style={{ width: '100%', padding: '0.5rem', backgroundColor: '#334155', border: '1px solid #475569', borderRadius: '4px', color: '#dbeafe', fontSize: '1rem', fontWeight: 700 }}
                            >
                                <option value="">-- 選擇員工 --</option>
                                {employees.map((emp) => (
                                    <option key={emp.emp_id} value={emp.emp_id}>{emp.emp_id} | {emp.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {!isPickerOpen && (
                    inline && docHistoryDrawerHostEl != null
                        ? createPortal(
                            <DocProductHistoryDrawer
                                open={historyDrawerOpen}
                                onClose={() => setHistoryDrawerOpen(false)}
                                focusPId={docHistoryFocusPId}
                            />,
                            docHistoryDrawerHostEl
                        )
                        : (
                            <DocProductHistoryDrawer
                                open={historyDrawerOpen}
                                onClose={() => setHistoryDrawerOpen(false)}
                                focusPId={docHistoryFocusPId}
                            />
                        )
                )}

                <div
                    className="custom-scrollbar"
                    data-doc-items-zone
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'auto', padding: '1.5rem' }}
                >
                    <div
                        style={{ background: '#1e293b', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' }}
                        ref={docListKeyboardRef}
                        tabIndex={0}
                        onKeyDown={handleDocListKeyDown}
                    >
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #334155', backgroundColor: '#1e293b' }}>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIndexes.length === 0}
                                style={{
                                    backgroundColor: selectedIndexes.length === 0 ? '#334155' : '#ef4444',
                                    color: selectedIndexes.length === 0 ? '#94a3b8' : 'white',
                                    border: 'none',
                                    padding: '0.45rem 0.8rem',
                                    borderRadius: '6px',
                                    cursor: selectedIndexes.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 700
                                }}
                            >
                                刪除
                            </button>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '0.75rem' }}>
                                <tr>
                                    <th style={{ padding: '0.75rem', width: '48px', textAlign: 'center' }}>
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                        />
                                    </th>
                                    <th style={{ padding: '0.75rem' }}>零件號碼</th>
                                    <th style={{ padding: '0.75rem' }}>車型</th>
                                    <th style={{ padding: '0.75rem' }}>品名</th>
                                    <th style={{ padding: '0.75rem' }}>數量</th>
                                    <th style={{ padding: '0.75rem' }}>單價</th>
                                    <th style={{ padding: '0.75rem' }}>小計</th>
                                    <th style={{ padding: '0.75rem' }}></th>
                                </tr>
                            </thead>
                            <tbody ref={itemTbodyRef}>
                                {doc.items.map((item, idx) => (
                                    <tr
                                        key={idx}
                                        data-doc-dark-item-row-idx={idx}
                                        style={{ borderBottom: '1px solid #334155', backgroundColor: activeItemIndex === idx ? '#334155' : undefined }}
                                        onClick={() => {
                                            setActiveItemIndex(idx);
                                            docListKeyboardRef.current?.focus();
                                        }}
                                    >
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIndexes.includes(idx)}
                                                onChange={(e) => toggleItemSelection(idx, e.target.checked)}
                                            />
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <div style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>{item.part_number || item.p_id}</div>
                                            {(() => {
                                                const p = products.find(prod => prod.p_id === item.p_id);
                                                if (p && p.part_numbers?.length > 0) {
                                                    return (
                                                        <div
                                                            onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }}
                                                            style={{
                                                                marginTop: '4px',
                                                                fontSize: '10px',
                                                                backgroundColor: '#334155',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                color: '#60a5fa',
                                                                border: '1px solid #475569',
                                                                display: 'inline-block',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            +{p.part_numbers.length} 適用
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{item.brand} {item.car_model}</td>
                                        <td style={{ padding: '0.75rem' }}>{item.name}</td>
                                        <td><input type="number" value={item.qty} onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))} style={{ width: '60px', background: '#0f172a', color: 'white', border: '1px solid #334155' }} /></td>
                                        <td><input type="number" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} style={{ width: '80px', background: '#0f172a', color: 'white', border: '1px solid #334155' }} /></td>
                                        <td>{(item.qty * item.unit_price).toLocaleString()}</td>
                                        <td><button onClick={() => removeItem(idx)} style={{ color: '#ef4444' }}><Trash2 size={16} /></button></td>
                                    </tr>
                                ))}
                                <tr><td colSpan={8} style={{ padding: '1rem' }}><button type="button" onClick={() => setIsPickerOpen(true)} style={{ color: '#3b82f6', border: '1px dashed #3b82f6', background: 'rgba(59, 130, 246, 0.1)', width: '100%', padding: '0.5rem', cursor: 'pointer' }}><Plus size={16} /> 新增零件</button></td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Product Picker - rendered OUTSIDE the overflow container so it's never clipped */}
            {isPickerOpen && (
                <div data-doc-picker-zone style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.98)', zIndex: 9999, padding: '2rem' }}>
                    <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#1e293b', borderRadius: '12px', padding: '2rem', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', alignItems: 'center' }}>
                            <h2 style={{ color: 'white', fontSize: '1.25rem', fontWeight: 800 }}>零件選取</h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {selectedPickerProductIds.length > 0 && (
                                    <button
                                        onClick={handlePickSelectedProducts}
                                        style={{ background: '#10b981', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        批次確認取回 ({selectedPickerProductIds.length})
                                    </button>
                                )}
                                <button onClick={() => setIsPickerOpen(false)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>關閉</button>
                            </div>
                        </div>
                        <input placeholder="搜尋零件號 / 品名 / 車型 / 品牌（支援片語）..." onChange={e => setPickerQuery({ ...pickerQuery, partNumber: e.target.value })} style={{ background: '#334155', color: 'white', padding: '0.6rem 1rem', width: '100%', marginBottom: '1rem', borderRadius: '6px', border: '1px solid #475569' }} />
                        <DocProductHistoryDrawer
                            open={historyDrawerOpen}
                            onClose={() => setHistoryDrawerOpen(false)}
                            focusPId={docHistoryFocusPId}
                        />
                        <div
                            ref={pickerListRef}
                            tabIndex={0}
                            onKeyDown={handlePickerListKeyDown}
                            className="custom-scrollbar"
                            style={{ overflowY: 'auto', maxHeight: '60vh', outline: 'none' }}
                        >
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead style={{ position: 'sticky', top: 0, backgroundColor: '#0f172a' }}>
                                    <tr style={{ textAlign: 'left', color: '#94a3b8', fontSize: '0.75rem' }}>
                                        <th style={{ padding: '0.75rem', width: '48px', textAlign: 'center' }}>
                                            <input
                                                ref={pickerSelectAllRef}
                                                type="checkbox"
                                                checked={isPickerAllSelected}
                                                onChange={(e) => togglePickerSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <th style={{ padding: '0.75rem' }}>零件號</th>
                                        <th style={{ padding: '0.75rem' }}>名稱</th>
                                        <th style={{ padding: '0.75rem' }}>庫存</th>
                                        <th style={{ padding: '0.75rem' }}></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pickerResults.map((p, idx) => {
                                        const isActive = idx === activePickerRowIndex;
                                        return (
                                        <tr key={p.p_id} data-picker-row-idx={idx} style={{ borderBottom: '1px solid #334155', backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : undefined }}>
                                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPickerProductIds.includes(p.p_id)}
                                                    onChange={(e) => {
                                                        togglePickerSelection(p.p_id, e.target.checked);
                                                        setActivePickerRowIndex(idx);
                                                        requestAnimationFrame(() => pickerListRef.current?.focus());
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#60a5fa' }}>{p.p_id}</td>
                                            <td style={{ padding: '0.75rem', color: 'white' }}>{p.name}</td>
                                            <td style={{ padding: '0.75rem', color: '#94a3b8' }}>{p.stock}</td>
                                            <td style={{ padding: '0.75rem' }}><button onClick={() => handlePickProduct(p)} style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '4px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>選取</button></td>
                                        </tr>
                                    );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    onClose={() => setMappingProduct(null)}
                />
            )}
        </>
    );
};

// --- Main Exported Wrapper ---
const DocumentDarkPreview = ({ doc, type, inline, onEdit, onSave, onClose, isEditing, canEdit = true, docHistoryDrawerHostEl = null }) => {
    if (isEditing && canEdit) {
        return (
            <DocumentInnerEditor
                docId={doc.doc_id}
                type={type}
                onSave={onSave}
                onClose={onClose}
                inline={inline}
                docHistoryDrawerHostEl={docHistoryDrawerHostEl}
            />
        );
    }
    return <DocumentDarkPreviewView doc={doc} type={type} inline={inline} onEdit={onEdit} onClose={onClose} canEdit={canEdit} />;
};

export default DocumentDarkPreview;
