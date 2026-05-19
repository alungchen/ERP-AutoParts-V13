import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useProductStore } from '../../store/useProductStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useAppStore } from '../../store/useAppStore';
import { canEditDocType } from '../../utils/permissions';
import { X, Plus, Trash2, Save, FileText, Package, RotateCcw, Edit2, Printer } from 'lucide-react';
import AutocompleteInput from '../../components/AutocompleteInput';
import PartMappingModal from '../PIM/PartMappingModal';
import DocumentViewer from './DocumentViewer';
import { useSearchFormKeyboardNav } from '../../hooks/useSearchFormKeyboardNav';
import DocProductHistoryDrawer from '../../components/DocProductHistoryDrawer';
import DocumentHub from './DocumentHub';
import { isElementInDocPartEditingZone } from '../../utils/docHistoryFocusZones';
import { sortedCustomersForSelect, sortedSuppliersForSelect } from '../../utils/sortContactsForSelect';
import CodeLookupInput from '../../components/CodeLookupInput';
import {
    productCarModelsSearchText,
    productPurchaseUnitPrice,
    productSalesUnitPrice,
    productLineCarModel,
    productLineYear,
    productYearSearchBlob
} from '../../utils/productPickerSync';
import styles from './Documents.module.css';

const DOC_TYPE_TITLE_ZH = {
    inquiry: '詢價單',
    purchase: '進貨單',
    quotation: '報價單',
    sales: '銷貨單',
    salesReturn: '銷貨退回',
    purchaseReturn: '進貨退回',
};

const DocumentEditorPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const { addDocument, updateDocument, deleteDocument, inquiries, purchaseOrders, quotations, salesOrders, salesReturns, purchaseReturns, isDocumentsLoaded } = useDocumentStore();
    const { products } = useProductStore();
    const { suppliers } = useSupplierStore();
    const { customers } = useCustomerStore();
    const { employees } = useEmployeeStore();
    const { models, parts, brands } = useShorthandStore();
    const { defaultCurrency, isMultiCountryMode, enableLoginSystem, enablePermissionRole, currentUserEmpId } = useAppStore();

    const type = searchParams.get('type') || 'inquiry';
    const id = searchParams.get('id');
    const mode = searchParams.get('mode'); // 'intl' if international
    const isEdit = !!id;
    const isIntl = mode === 'intl';
    const customerOptions = useMemo(() => sortedCustomersForSelect(customers), [customers]);
    const supplierOptions = useMemo(() => sortedSuppliersForSelect(suppliers), [suppliers]);
    const docTypeTitleZh = DOC_TYPE_TITLE_ZH[type] || '單據';

    useEffect(() => {
        document.title = docTypeTitleZh;
        return () => {
            document.title = 'ARUFA';
        };
    }, [docTypeTitleZh]);

    const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);
    const canEditThisDocType = canEditDocType({
        enableLoginSystem,
        enablePermissionRole,
        currentUser,
        docType: type
    });
    const [isReadOnly, setIsReadOnly] = useState(isEdit || !canEditThisDocType);
    const [doc, setDoc] = useState({
        type: type,
        date: new Date().toISOString().split('T')[0],
        status: 'pending',
        items: [],
        currency: defaultCurrency,
        notes: '',
        supplier_id: '',
        supplier_name: '',
        customer_id: '',
        customer_name: '',
        opener_emp_id: '',
        opener_emp_name: '',
        discount: 0,
    });

    // Product Picker State
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [pickerQuery, setPickerQuery] = useState({
        partNumber: '',
        model: '',
        part: '',
        spec: '',
        year: '',
        brand: ''
    });
    const [pickerResults, setPickerResults] = useState([]);
    /** 符合篩選的總筆數（列表因效能最多顯示 50 筆） */
    const [pickerMatchTotal, setPickerMatchTotal] = useState(0);
    const [selectedPickerProductIds, setSelectedPickerProductIds] = useState([]);
    const [mappingProduct, setMappingProduct] = useState(null);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const [isDocListDrawerOpen, setIsDocListDrawerOpen] = useState(false);

    const [focusedHeaderAction, setFocusedHeaderAction] = useState('');
    const pickerFirstInputRef = useRef(null);
    const pickerFormRef = useRef(null);
    const pickerResetBtnRef = useRef(null);
    const pickerListRef = useRef(null);
    const [activePickerRowIndex, setActivePickerRowIndex] = useState(0);
    const pickerTbodyRef = useRef(null);
    const printBtnRef = useRef(null);
    const editBtnRef = useRef(null);
    const saveBtnRef = useRef(null);
    const selectAllRef = useRef(null);
    const pickerSelectAllRef = useRef(null);
    const addPartBtnRef = useRef(null);
    const [selectedIndexes, setSelectedIndexes] = useState([]);
    const [activeItemIndex, setActiveItemIndex] = useState(0);
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
    const [isAddPartFocused, setIsAddPartFocused] = useState(false);
    const itemTbodyRef = useRef(null);
    const docListKeyboardRef = useRef(null);
    const editorPaneRef = useRef(null);
    const setProductHistoryFocusPId = useAppStore((s) => s.setProductHistoryFocusPId);

    const docHistoryFocusPId = useMemo(() => {
        if (isPickerOpen && pickerResults.length > 0) {
            return pickerResults[activePickerRowIndex]?.p_id || null;
        }
        if (doc?.items?.length) {
            const item = doc.items[activeItemIndex];
            return item?.p_id && String(item.p_id).trim() ? item.p_id : null;
        }
        return null;
    }, [
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

    // Handle loading existing document
    useEffect(() => {
        if (!isEdit) return;
        const state = useDocumentStore.getState();
        let existingDoc = null;
        if (type === 'inquiry') existingDoc = (state.inquiries || []).find(d => d?.doc_id === id);
        else if (type === 'purchase') existingDoc = (state.purchaseOrders || []).find(d => d?.doc_id === id);
        else if (type === 'quotation') existingDoc = (state.quotations || []).find(d => d?.doc_id === id);
        else if (type === 'sales') existingDoc = (state.salesOrders || []).find(d => d?.doc_id === id);
        else if (type === 'salesReturn') existingDoc = (state.salesReturns || []).find(d => d?.doc_id === id);
        else if (type === 'purchaseReturn') existingDoc = (state.purchaseReturns || []).find(d => d?.doc_id === id);

        if (existingDoc) {
            let updatedDoc = { ...existingDoc };
            updatedDoc.items = updatedDoc.items || [];
            if (!updatedDoc.supplier_name && updatedDoc.supplier_id) {
                updatedDoc.supplier_name = supplierOptions.find(s => s.sup_id === updatedDoc.supplier_id)?.name || '';
            }
            if (!updatedDoc.customer_name && updatedDoc.customer_id) {
                updatedDoc.customer_name = customerOptions.find(c => c.cust_id === updatedDoc.customer_id)?.name || '';
            }
            setDoc(updatedDoc);
        }
    }, [isEdit, id, type, customerOptions, supplierOptions, defaultCurrency, currentUser]);

    const isNewExplicit = searchParams.get('new') === '1';

    // Auto-redirect to the latest document if id is missing and new=1 is not present
    useEffect(() => {
        if (!isDocumentsLoaded) return;
        if (!type || id || isNewExplicit || type === 'shortageBook') return;
        const state = useDocumentStore.getState();
        let docs = [];
        if (type === 'inquiry') docs = state.inquiries || [];
        else if (type === 'purchase') docs = state.purchaseOrders || [];
        else if (type === 'quotation') docs = state.quotations || [];
        else if (type === 'sales') docs = state.salesOrders || [];
        else if (type === 'salesReturn') docs = state.salesReturns || [];
        else if (type === 'purchaseReturn') docs = state.purchaseReturns || [];
        
        if (docs.length > 0) {
            // Find the latest document based on date (falling back to doc_id)
            const latest = [...docs].sort((a, b) => {
                const dateCompare = String(b?.date || '').localeCompare(String(a?.date || ''));
                if (dateCompare !== 0) return dateCompare;
                return String(b?.doc_id || '').localeCompare(String(a?.doc_id || ''));
            })[0];
            if (latest && latest.doc_id) {
                const newParams = new URLSearchParams(searchParams);
                newParams.set('id', String(latest.doc_id));
                setSearchParams(newParams, { replace: true });
            }
        }
    }, [id, type, isNewExplicit, setSearchParams, isDocumentsLoaded]);

    // Handle Up/Down keys to switch documents in ReadOnly mode
    useEffect(() => {
        if (!isReadOnly || !id || isPickerOpen || isDocListDrawerOpen) return;
        const handleDocSwitchKey = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const state = useDocumentStore.getState();
                let docs = [];
                if (type === 'inquiry') docs = state.inquiries || [];
                else if (type === 'purchase') docs = state.purchaseOrders || [];
                else if (type === 'quotation') docs = state.quotations || [];
                else if (type === 'sales') docs = state.salesOrders || [];
                else if (type === 'salesReturn') docs = state.salesReturns || [];
                else if (type === 'purchaseReturn') docs = state.purchaseReturns || [];
                
                if (docs.length === 0) return;
                const sortedDocs = [...docs].sort((a, b) => {
                    const dateCompare = String(b?.date || '').localeCompare(String(a?.date || ''));
                    if (dateCompare !== 0) return dateCompare;
                    return String(b?.doc_id || '').localeCompare(String(a?.doc_id || ''));
                });
                const currentIndex = sortedDocs.findIndex(d => String(d?.doc_id) === String(id));
                if (currentIndex === -1) return;
                
                let nextIndex = currentIndex;
                if (e.key === 'ArrowDown') {
                    // ArrowDown: go to older document (next in descending list)
                    nextIndex = Math.min(currentIndex + 1, sortedDocs.length - 1);
                } else if (e.key === 'ArrowUp') {
                    // ArrowUp: go to newer document (previous in descending list)
                    nextIndex = Math.max(currentIndex - 1, 0);
                }
                
                if (nextIndex !== currentIndex) {
                    const targetDoc = sortedDocs[nextIndex];
                    if (targetDoc && targetDoc.doc_id) {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('id', String(targetDoc.doc_id));
                        setSearchParams(newParams, { replace: true });
                    }
                }
            }
        };
        window.addEventListener('keydown', handleDocSwitchKey);
        return () => window.removeEventListener('keydown', handleDocSwitchKey);
    }, [isReadOnly, id, type, isPickerOpen, isDocListDrawerOpen, setSearchParams]);

    useEffect(() => {
        if (!isEdit && currentUser && (!doc.opener_emp_id || !doc.opener_emp_name)) {
            setDoc((prev) => ({
                ...prev,
                opener_emp_id: currentUser.emp_id,
                opener_emp_name: currentUser.name
            }));
        }
    }, [isEdit, currentUser, doc.opener_emp_id, doc.opener_emp_name]);

    useEffect(() => {
        // Only reset read-only mode when switching document/route,
        // so manual "edit mode" is not accidentally reverted.
        if (!canEditThisDocType) {
            setIsReadOnly(true);
            return;
        }
        setIsReadOnly(isEdit);
    }, [isEdit, id, type, canEditThisDocType]);

    //
    useEffect(() => {
        if (!isReadOnly || !canEditThisDocType || !editBtnRef.current) return;
        const focusEdit = () => editBtnRef.current?.focus();
        focusEdit();
        const t1 = setTimeout(focusEdit, 100);
        const t2 = setTimeout(focusEdit, 300);
        const t3 = setTimeout(focusEdit, 500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isReadOnly, canEditThisDocType]);

    //
    useEffect(() => {
        if (isReadOnly) return;
        if ((doc?.items || []).length > 0 && docListKeyboardRef.current) {
            setActiveItemIndex(0);
            const focusList = () => {
                const firstRow = itemTbodyRef.current?.querySelector('[data-doc-item-row-idx="0"]');
                if (firstRow) {
                    firstRow.focus();
                } else {
                    docListKeyboardRef.current?.focus();
                }
                setActiveItemIndex(0);
            };
            focusList();
            const t1 = setTimeout(focusList, 100);
            const t2 = setTimeout(focusList, 300);
            const t3 = setTimeout(focusList, 500);
            return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
        }
        if (!saveBtnRef.current) return;
        const focusSave = () => saveBtnRef.current?.focus();
        focusSave();
        const t1 = setTimeout(focusSave, 100);
        const t2 = setTimeout(focusSave, 300);
        const t3 = setTimeout(focusSave, 500);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isReadOnly, (doc?.items || []).length]);

    useEffect(() => {
        if (!enableLoginSystem && !isEdit && !doc.opener_emp_id && employees.length > 0) {
            setDoc((prev) => ({
                ...prev,
                opener_emp_id: employees[0].emp_id,
                opener_emp_name: employees[0].name,
            }));
        }
    }, [enableLoginSystem, isEdit, doc.opener_emp_id, employees]);

    useEffect(() => {
        if (isPickerOpen && pickerResetBtnRef.current) {
            const t = setTimeout(() => pickerResetBtnRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
    }, [isPickerOpen]);

    useEffect(() => {
        if (!isPickerOpen) setSelectedPickerProductIds([]);
    }, [isPickerOpen]);

    //
    useEffect(() => {
        if (!isPickerOpen) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (pickerFormRef.current?.contains(document.activeElement)) {
                    return;
                }
                e.preventDefault();
                setIsPickerOpen(false);
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isPickerOpen]);

    //
    useEffect(() => {
        if (isPickerOpen || isViewerOpen || isReadOnly || !saveBtnRef.current) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                saveBtnRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isPickerOpen, isViewerOpen, isReadOnly]);

    const isSupplier = type === 'inquiry' || type === 'purchase' || type === 'purchaseReturn';
    const isCustomer = type === 'quotation' || type === 'sales' || type === 'salesReturn';
    const formatAmount = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const docItems = doc?.items ?? [];
    const subtotal = docItems.reduce((sum, item) => sum + ((item.qty || 0) * (item.unit_price || 0)), 0);

    // Currency Lock Rules:
    // 1. Inquiry/Purchase (Buying) -> Lock to default currency ONLY IF NOT in international mode
    // 2. Quotation/Sales (Selling) -> Lock to default currency ONLY IF NOT in multi-country mode
    const isCurrencyLocked = (isSupplier && !isIntl) || (isCustomer && !isMultiCountryMode);

    // Sync currency if locked
    useEffect(() => {
        if (isCurrencyLocked && doc.currency !== defaultCurrency) {
            setDoc(prev => ({ ...prev, currency: defaultCurrency }));
        }
    }, [isCurrencyLocked, defaultCurrency, doc.currency]);

    const handleSave = async () => {
        if (!canEditThisDocType) {
            alert('\u60a8\u6c92\u6709\u6b0a\u9650\u7de8\u8f2f\u6b64\u55ae\u64da\u3002');
            return;
        }
        const payload = {
            ...doc,
            items: Array.isArray(doc.items) ? doc.items : [],
        };
        let savedDoc;
        try {
            if (isEdit) {
                savedDoc = await updateDocument(type, payload);
            } else {
                savedDoc = await addDocument(type, payload);
                const url = new URL(window.location);
                url.searchParams.set('id', savedDoc.doc_id);
                window.history.replaceState({}, '', url);
            }
        } catch (err) {
            console.error('Save document failed', err);
            alert('\u5132\u5b58\u5931\u6557\uff0c\u8acb\u7a0d\u5f8c\u518d\u8a66\u3002');
            return;
        }

        localStorage.setItem('erp-last-doc-type', type);
        setDoc({
            ...savedDoc,
            items: Array.isArray(savedDoc?.items) ? savedDoc.items : payload.items,
        });
        setIsReadOnly(true);
    };

    const handleClose = () => {
        const targetDocId = doc.doc_id || id;
        if (targetDocId && (doc.items || []).length === 0) {
            const shouldDelete = window.confirm('\u6b64\u55ae\u64da\u76ee\u524d\u6c92\u6709\u54c1\u9805\uff0c\u662f\u5426\u522a\u9664\u5f8c\u96e2\u958b\uff1f');
            if (shouldDelete) {
                deleteDocument(type, targetDocId);
                // Fallback retry in case the tab closes before persistence settles.
                const state = useDocumentStore.getState();
                const getListByType = (docType) => {
                    if (docType === 'inquiry') return state.inquiries || [];
                    if (docType === 'purchase') return state.purchaseOrders || [];
                    if (docType === 'quotation') return state.quotations || [];
                    if (docType === 'sales') return state.salesOrders || [];
                    if (docType === 'salesReturn') return state.salesReturns || [];
                    if (docType === 'purchaseReturn') return state.purchaseReturns || [];
                    return [];
                };
                const stillExists = getListByType(type).some((d) => d.doc_id === targetDocId);
                if (stillExists) {
                    state.deleteDocument(type, targetDocId);
                }
            } else {
                return;
            }
        }
        // 回到列表時保留 standalone 等查詢參數（與製單列表開啟來源一致）
        let fallbackUrl = `/documents?tab=${encodeURIComponent(type)}`;
        let returnFromHub = false;
        try {
            const ret = sessionStorage.getItem('erp-doc-hub-return');
            if (ret && ret.startsWith('/documents')) {
                const u = new URL(ret, window.location.origin);
                u.searchParams.set('tab', type);
                fallbackUrl = `${u.pathname}?${u.searchParams.toString()}`;
                returnFromHub = true;
                sessionStorage.removeItem('erp-doc-hub-return');
            }
        } catch {
            /* ignore */
        }

        // 修復 COOP (Cross-Origin-Opener-Policy) 導致 window.closed/opener.closed 被阻擋的問題
        // 改用安全性較高且不依賴跨視窗屬性的檢測方法
        try {
            // 只要 opener 存在 (即使不可存取其屬性)，通常代表它是被 window.open 開啟的分頁
            let isPopup = false;
            try {
                isPopup = !!(window.opener && window.opener !== window);
            } catch (e) {
                // 如果存取 opener 報錯，通常是因為 COOP 隔離，代表它必定是一個彈出視窗
                isPopup = true;
            }

            if (isPopup) {
                window.close();
                // 如果 close() 成功，頁面會關閉；如果失敗 (如非腳本開啟)，則超時後執行 fallback 重導向
                setTimeout(() => {
                    let isStillOpen = true;
                    try {
                        // 在某些極端 COOP 設定下，self.closed 也可能受限，故加 try-catch
                        isStillOpen = !window.closed;
                    } catch (e) {
                        isStillOpen = true; 
                    }
                    
                    if (isStillOpen) {
                        window.location.href = fallbackUrl;
                    }
                }, 150);
                return;
            }
        } catch (e) {
            // 發生任何權限錯誤時，嘗試關閉並 fallback
            window.close();
            setTimeout(() => { window.location.href = fallbackUrl; }, 150);
            return;
        }

        // 若判定為非彈出分頁或關閉無效，則嘗試回到上一頁或列表
        if (!returnFromHub && window.history.length > 1) {
            window.history.back();
        } else {
            window.location.href = fallbackUrl;
        }
    };

    const handlePrint = () => {
        setIsViewerOpen(true);
    };

    const handleCloseViewerAndFocusPrint = () => {
        setIsViewerOpen(false);
        //
        const focusPrint = () => printBtnRef.current?.focus();
        setTimeout(focusPrint, 0);
        setTimeout(focusPrint, 80);
    };

    const focusActionButtonByArrow = (currentRef, direction) => {
        const actionButtonRefs = [
            isEdit ? printBtnRef : null,
            isReadOnly ? editBtnRef : saveBtnRef,
        ]
            .filter(Boolean)
            .filter((refObj) => refObj.current);

        if (actionButtonRefs.length === 0) return;
        const currentIndex = actionButtonRefs.findIndex((refObj) => refObj === currentRef);
        if (currentIndex === -1) return;

        const nextIndex = direction === 'right'
            ? (currentIndex + 1) % actionButtonRefs.length
            : (currentIndex - 1 + actionButtonRefs.length) % actionButtonRefs.length;
        actionButtonRefs[nextIndex].current?.focus();
    };

    const handleHeaderActionKeyDown = (e, currentRef) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopPropagation();
            focusActionButtonByArrow(currentRef, 'right');
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            e.stopPropagation();
            focusActionButtonByArrow(currentRef, 'left');
        }
    };

    const getHeaderActionStyle = (baseStyle, actionKey) => {
        if (focusedHeaderAction !== actionKey) return baseStyle;
        return {
            ...baseStyle,
            outline: '2px solid #60a5fa',
            outlineOffset: '2px',
            boxShadow: '0 0 0 3px rgba(96, 165, 250, 0.28)',
            transform: 'translateY(-1px)',
        };
    };

    const addEmptyItem = () => {
        if (isReadOnly) return;
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
        const nextLen = (doc.items || []).length + 1;
        setDoc((prev) => ({ ...prev, items: [...(prev.items || []), emptyItem] }));
        setActiveItemIndex(nextLen - 1); //
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
        const newItems = (doc.items || []).filter((_, index) => !selectedSet.has(index));
        setDoc({ ...doc, items: newItems });
        setSelectedIndexes([]);
    };

    const isAllSelected = (doc?.items || []).length > 0 && selectedIndexes.length === (doc?.items || []).length;
    const isPartiallySelected = selectedIndexes.length > 0 && selectedIndexes.length < (doc?.items || []).length;

    useEffect(() => {
        if (!selectAllRef.current) return;
        selectAllRef.current.indeterminate = isPartiallySelected;
    }, [isPartiallySelected]);

    useEffect(() => {
        if ((doc?.items || []).length === 0) {
            setActiveItemIndex(0);
            return;
        }
        if (activeItemIndex > (doc?.items || []).length - 1) {
            setActiveItemIndex((doc?.items || []).length - 1);
        }
    }, [doc.items, activeItemIndex]);

    useEffect(() => {
        if (isReadOnly || isPickerOpen || isViewerOpen || (doc?.items || []).length === 0 || !docListKeyboardRef.current) return;
        setActiveItemIndex(0);
        docListKeyboardRef.current.focus();
    }, [isReadOnly, isPickerOpen, isViewerOpen, doc.doc_id, (doc?.items || []).length]);

    useEffect(() => {
        if (!itemTbodyRef.current) return;
        const rowEl = itemTbodyRef.current.querySelector(`[data-doc-item-row-idx="${activeItemIndex}"]`);
        if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
    }, [activeItemIndex]);

    useEffect(() => {
        if (isPickerOpen || isViewerOpen || (doc?.items || []).length === 0) return;
        const isTypingTarget = (el) => {
            if (!el || !el.tagName) return false;
            const tag = el.tagName.toLowerCase();
            const role = el.getAttribute?.('role');
            return tag === 'input' || tag === 'textarea' || tag === 'select' || role === 'combobox' || role === 'listbox';
        };
        const handleGlobal = (e) => {
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            const inEditor = document.activeElement?.closest?.('[data-editor-pane]');
            if (!inEditor) return;
            if (!isDocListDrawerOpen && isReadOnly) return;
            const listEl = docListKeyboardRef.current;
            if (listEl?.contains(document.activeElement) && !isTypingTarget(document.activeElement)) return;
            if (isTypingTarget(document.activeElement)) return;
            e.preventDefault();
            e.stopPropagation();
            applyItemArrowNavigation(e.key);
        };
        window.addEventListener('keydown', handleGlobal, true);
        return () => window.removeEventListener('keydown', handleGlobal, true);
    }, [isReadOnly, isDocListDrawerOpen, isPickerOpen, isViewerOpen, (doc?.items || []).length, activeItemIndex]);

    const isTypingInList = () => {
        const el = document.activeElement;
        if (!el || !docListKeyboardRef.current?.contains?.(el)) return false;
        const tag = el.tagName?.toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select';
    };

    const focusItemRow = (rowIdx) => {
        const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
        row?.focus();
    };

    const focusQtyInput = (rowIdx) => {
        const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
        row?.querySelector('[data-doc-item-qty]')?.focus();
    };
    const focusPriceInput = (rowIdx) => {
        const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
        row?.querySelector('[data-doc-item-price]')?.focus();
    };

    const applyItemArrowNavigation = (key) => {
        const items = doc?.items || [];
        if (items.length === 0) return;
        if (key === 'ArrowDown') {
            if (activeItemIndex === items.length - 1) {
                if (!isReadOnly) addPartBtnRef.current?.focus();
            } else {
                const nextIdx = Math.min(activeItemIndex + 1, items.length - 1);
                setActiveItemIndex(nextIdx);
                focusItemRow(nextIdx);
            }
        } else if (key === 'ArrowUp') {
            if (!isReadOnly && document.activeElement === addPartBtnRef.current) {
                const lastIdx = items.length - 1;
                setActiveItemIndex(lastIdx);
                focusItemRow(lastIdx);
            } else if (!isReadOnly && activeItemIndex === 0) {
                saveBtnRef.current?.focus();
            } else if (activeItemIndex > 0) {
                const prevIdx = activeItemIndex - 1;
                setActiveItemIndex(prevIdx);
                focusItemRow(prevIdx);
            }
        }
    };

    const handleDocListKeyDown = (e) => {
        if ((doc?.items || []).length === 0) return;

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            applyItemArrowNavigation(e.key);
            return;
        }

        if (isReadOnly) return;

        if (e.key === 'Enter' && document.activeElement === addPartBtnRef.current) {
            e.preventDefault();
            setIsPickerOpen(true);
            return;
        }

        const isInInput = document.activeElement?.closest?.('input, textarea, select');
        if (e.key === 'Enter') {
            if (isInInput) return; //
            e.preventDefault();
            //
            const rowEl = document.activeElement?.closest?.('[data-doc-item-row-idx]');
            const rowIdx = rowEl != null ? parseInt(rowEl.getAttribute('data-doc-item-row-idx'), 10) : activeItemIndex;
            if (!isNaN(rowIdx)) {
                const row = itemTbodyRef.current?.querySelector(`[data-doc-item-row-idx="${rowIdx}"]`);
                row?.querySelector('[data-doc-item-qty]')?.focus();
            }
            return;
        }

        if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            const checked = selectedIndexes.includes(activeItemIndex);
            toggleItemSelection(activeItemIndex, !checked);
        }
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
            unit: 'PCS',
            stock: p.stock,
            // Attach original product info for "Applicability" link in main list
            _full_product: p
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

    useEffect(() => {
        if (!pickerSelectAllRef.current || !isPickerOpen) return;
        pickerSelectAllRef.current.indeterminate = isPickerPartiallySelected;
    }, [isPickerPartiallySelected, isPickerOpen]);

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
                unit: 'PCS',
                stock: p.stock,
                _full_product: p
            };
        });
        setDoc({ ...doc, items: [...doc.items, ...newItems] });
        setSelectedPickerProductIds([]);
        setIsPickerOpen(false);
    };

    const handleClearPicker = () => {
        setPickerQuery({
            partNumber: '',
            model: '',
            part: '',
            spec: '',
            year: '',
            brand: ''
        });
        requestAnimationFrame(() => pickerFirstInputRef.current?.focus());
    };

    //
    const handlePickerListKeyDown = (e) => {
        if (pickerResults.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActivePickerRowIndex((prev) => Math.min(prev + 1, pickerResults.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (activePickerRowIndex === 0) {
                pickerResetBtnRef.current?.focus();
                return;
            }
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

    useSearchFormKeyboardNav(pickerFormRef, null, pickerResetBtnRef, { enabled: isPickerOpen, searchEscapeGoesToReset: true });

    // Picker form: ArrowDown from any search field → focus first result row
    const handlePickerFormKeyDown = (e) => {
        if (e.defaultPrevented) return;
        if (e.key !== 'ArrowDown') return;
        const active = document.activeElement;
        if (!pickerFormRef.current?.contains(active)) return;
        if (active?.closest?.('ul')) return;
        if (pickerResults.length === 0) return;
        e.preventDefault();
        setActivePickerRowIndex(0);
        pickerListRef.current?.focus();
    };

    // Filter Logic
    useEffect(() => {
        let filtered = products;

        if (pickerQuery.model) {
            const q = pickerQuery.model.toLowerCase();
            filtered = filtered.filter((p) => {
                const cm = productCarModelsSearchText(p).toLowerCase();
                return cm.includes(q) ||
                    (p.part_numbers || []).some((pn) => (pn.car_model || '').toLowerCase().includes(q));
            });
        }

        if (pickerQuery.part) {
            const q = pickerQuery.part.toLowerCase();
            filtered = filtered.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.notes || '').toLowerCase().includes(q) ||
                (p.specifications || '').toLowerCase().includes(q)
            );
        }

        if (pickerQuery.partNumber) {
            const q = pickerQuery.partNumber.toLowerCase();
            filtered = filtered.filter(p =>
                (p.p_id || '').toLowerCase().includes(q) ||
                (p.part_number || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some(pn => (pn.part_number || '').toLowerCase().includes(q))
            );
        }

        if (pickerQuery.year) {
            const y = pickerQuery.year.trim();
            filtered = filtered.filter((p) => productYearSearchBlob(p).includes(y));
        }

        if (pickerQuery.spec) {
            const q = pickerQuery.spec.toLowerCase();
            filtered = filtered.filter(p =>
                (p.specifications || '').toLowerCase().includes(q) ||
                (p.name || '').toLowerCase().includes(q)
            );
        }

        if (pickerQuery.brand) {
            const normalize = (v) => String(v ?? '').toLowerCase();
            const q = normalize(pickerQuery.brand).trim();
            const matchedBrandPhrases = brands.filter((item) => {
                const shorthand = normalize(item?.shorthand);
                const fullname = normalize(item?.fullname);
                return shorthand.includes(q) || fullname.includes(q);
            });
            const brandKeywords = new Set([q]);
            matchedBrandPhrases.forEach((item) => {
                brandKeywords.add(normalize(item?.shorthand));
                brandKeywords.add(normalize(item?.fullname));
            });

            filtered = filtered.filter((p) => {
                const brandText = normalize(
                    `${p.brand || ''} ${(p.part_numbers || []).map((pn) => pn?.brand || '').join(' ')}`
                );
                return Array.from(brandKeywords).some((keyword) => keyword && brandText.includes(keyword));
            });
        }

        setPickerMatchTotal(filtered.length);
        setPickerResults(filtered.slice(0, 50));
    }, [pickerQuery, products, brands]);

    // Keep active row index valid while user filters results.
    // Do not force focus to list, otherwise typing in search fields gets interrupted.
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

    return (
        <div
            style={{
                backgroundColor: 'var(--bg-primary)',
                height: '100vh',
                color: 'var(--text-primary)',
                display: 'flex',
                flexDirection: 'row',
                overflow: 'hidden',
            }}
        >
            <div
                ref={editorPaneRef}
                data-editor-pane
                style={{
                    flex: isDocListDrawerOpen ? '1 1 50%' : '1 1 100%',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                }}
            >
            {/* Header section (Basic Info) */}
            <div style={{ padding: '1rem 1.5rem', backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                                {isEdit ? (
                                    <>
                                        <span style={{ color: '#2563eb' }}>{docTypeTitleZh}</span>
                                        {` \u55ae\u865f: ${id}`}
                                    </>
                                ) : (
                                    <>
                                        <span style={{ color: '#2563eb' }}>{docTypeTitleZh}</span>
                                        {` \u65b0\u55ae\u64da\u9810\u89bd`}
                                    </>
                                )}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {isEdit ? (isReadOnly ? '\u6aa2\u8996\u6a21\u5f0f' : '\u7de8\u8f2f\u4e2d..') : '\u5efa\u7acb\u65b0\u55ae\u64da\u4e2d'}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        {/* New Document Button */}
                        <button
                            onClick={() => {
                                window.open(`/document-editor?type=${type}&new=1`, '_blank');
                            }}
                            style={{ backgroundColor: 'var(--accent-primary)', color: 'white', border: 'none', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                            title={'新增單據'}
                        >
                            <Plus size={18} strokeWidth={3} /> 新增單據
                        </button>

                        {/* Always show Printer if it's an existing document */}
                        {isEdit && (
                            <button
                                ref={printBtnRef}
                                onClick={handlePrint}
                                onKeyDown={(e) => handleHeaderActionKeyDown(e, printBtnRef)}
                                onFocus={() => setFocusedHeaderAction('print')}
                                onBlur={() => setFocusedHeaderAction('')}
                                style={getHeaderActionStyle(
                                    { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.6rem 1rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
                                    'print'
                                )}
                                title={'\u5217\u5370\u55ae\u64da'}
                            >
                                <Printer size={18} />
                            </button>
                        )}

                        {/* Toggle between Edit/Save buttons in the same position */}
                        {isReadOnly ? (
                            <button
                                ref={editBtnRef}
                                autoFocus
                                onClick={() => canEditThisDocType && setIsReadOnly(false)}
                                onKeyDown={(e) => handleHeaderActionKeyDown(e, editBtnRef)}
                                onFocus={() => setFocusedHeaderAction('edit')}
                                onBlur={() => setFocusedHeaderAction('')}
                                disabled={!canEditThisDocType}
                                style={getHeaderActionStyle(
                                    { backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
                                    'edit'
                                )}
                            >
                                <Edit2 size={18} /> {'\u7de8\u8f2f'}
                            </button>
                        ) : (
                            <button
                                ref={saveBtnRef}
                                autoFocus={(doc?.items || []).length === 0}
                                onClick={handleSave}
                                onKeyDown={(e) => handleHeaderActionKeyDown(e, saveBtnRef)}
                                onFocus={() => setFocusedHeaderAction('save')}
                                onBlur={() => setFocusedHeaderAction('')}
                                style={getHeaderActionStyle(
                                    { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '0.6rem 1.25rem', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' },
                                    'save'
                                )}
                            >
                                <Save size={18} /> {'\u5132\u5b58'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1fr) minmax(200px, 2.5fr) minmax(180px, 1.4fr)', gap: '0.85rem', alignItems: 'end', padding: '0.7rem', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-primary)' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>{'\u65e5\u671f'}</label>
                        <input
                            type="date"
                            disabled={isReadOnly}
                            value={doc.date}
                            onChange={e => setDoc({ ...doc, date: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: isReadOnly ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                fontWeight: 700
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>{isSupplier ? '\u4f9b\u61c9\u5546' : '\u5ba2\u6236'}</label>
                        {isSupplier ? (
                            <CodeLookupInput
                                value={doc.supplier_id || ''}
                                nameValue={doc.supplier_name || ''}
                                suggestions={supplierOptions}
                                idKey="sup_id"
                                disabled={isReadOnly}
                                inputStyle={{
                                    padding: '0.5rem',
                                    backgroundColor: isReadOnly ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: 700
                                }}
                                onSelect={sup => setDoc({
                                    ...doc,
                                    supplier_id: sup.sup_id,
                                    supplier_name: sup.name,
                                    currency: isCurrencyLocked ? defaultCurrency : (sup.currency || 'USD')
                                })}
                            />
                        ) : (
                            <CodeLookupInput
                                value={doc.customer_id || ''}
                                nameValue={doc.customer_name || ''}
                                suggestions={customerOptions}
                                idKey="cust_id"
                                disabled={isReadOnly}
                                inputStyle={{
                                    padding: '0.5rem',
                                    backgroundColor: isReadOnly ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: 700
                                }}
                                onSelect={cust => setDoc({
                                    ...doc,
                                    customer_id: cust.cust_id,
                                    customer_name: cust.name,
                                    currency: isCurrencyLocked ? defaultCurrency : (cust.currency || 'TWD')
                                })}
                            />
                        )}
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', display: 'block', marginBottom: '6px', fontWeight: 800, letterSpacing: '0.03em' }}>{'\u958b\u55ae\u4eba\u54e1'}</label>
                        <select
                            disabled={isReadOnly}
                            value={doc.opener_emp_id || ''}
                            onChange={e => {
                                const emp = employees.find((item) => item.emp_id === e.target.value);
                                setDoc({
                                    ...doc,
                                    opener_emp_id: emp?.emp_id || '',
                                    opener_emp_name: emp?.name || ''
                                });
                            }}
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                backgroundColor: isReadOnly ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                color: 'var(--text-primary)',
                                fontSize: '1rem',
                                fontWeight: 700
                            }}
                        >
                            <option value="">-- {'\u8acb\u9078\u64c7'} --</option>
                            {employees.map((emp) => (
                                <option key={emp.emp_id} value={emp.emp_id}>{emp.emp_id} | {emp.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {!canEditThisDocType && (
                    <div style={{ marginTop: '0.6rem', color: 'var(--warning)', fontSize: '0.8rem', fontWeight: 700 }}>
                        {'\u60a8\u6c92\u6709\u6b0a\u9650\u7de8\u8f2f\u6b64\u55ae\u64da\u3002'}
                    </div>
                )}
            </div>

            {!isPickerOpen && (
                <DocProductHistoryDrawer
                    open={historyDrawerOpen}
                    onClose={() => setHistoryDrawerOpen(false)}
                    focusPId={docHistoryFocusPId}
                />
            )}

            {/* Content Body (Table for parts) */}
            <div
                data-doc-items-zone
                style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
            >
                <div
                    style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                    ref={docListKeyboardRef}
                    tabIndex={(doc?.items || []).length > 0 ? 0 : -1}
                    onKeyDown={handleDocListKeyDown}
                >
                    {!isReadOnly && (
                        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)', flexShrink: 0 }}>
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedIndexes.length === 0}
                                style={{
                                    backgroundColor: selectedIndexes.length === 0 ? 'var(--bg-tertiary)' : '#ef4444',
                                    color: selectedIndexes.length === 0 ? 'var(--text-muted)' : 'white',
                                    border: 'none',
                                    padding: '0.45rem 0.8rem',
                                    borderRadius: '6px',
                                    cursor: selectedIndexes.length === 0 ? 'not-allowed' : 'pointer',
                                    fontWeight: 700
                                }}
                            >
                                {'\u522a\u9664'}
                            </button>
                        </div>
                    )}
                    <div className={`${styles.docEditorTableScroll} custom-scrollbar`}>
                    <table className={styles.docEditorTable} style={{ textAlign: 'left' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '44px', textAlign: 'center' }}>#</th>
                                <th style={{ width: '54px' }}>
                                    {!isReadOnly && (
                                        <input
                                            ref={selectAllRef}
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => toggleSelectAllItems(e.target.checked)}
                                        />
                                    )}
                                </th>
                                <th>{'\u96f6\u4ef6\u865f\u78bc'} (ID)</th>
                                <th>{'\u8eca\u578b'} / {'\u5e74\u4efd'}</th>
                                <th>{'\u54c1\u540d'} / {'\u898f\u683c'}</th>
                                <th>{'\u54c1\u724c'}</th>
                                <th style={{ width: '80px', textAlign: 'center' }}>{'\u5eab\u5b58'}</th>
                                <th style={{ width: '100px' }}>{'\u6578\u91cf'}</th>
                                <th style={{ width: '120px' }}>{'\u55ae\u50f9'}</th>
                                <th style={{ width: '120px' }}>{'\u5c0f\u8a08'}</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody ref={itemTbodyRef}>
                            {docItems.map((item, idx) => {
                                // Find associated product metadata if exists (to show applicability link)
                                const associatedProduct = item._full_product || products.find(p => p.p_id === item.p_id || (item.part_number && (p.part_number === item.part_number || p.part_numbers?.some(pn => pn.part_number === item.part_number))));
                                const mappingCount = associatedProduct?.part_numbers?.length || 0;

                                const displayCarModel = (item.car_model && typeof item.car_model === 'object') ? (item.car_model?.model || '') : (item.car_model || (associatedProduct ? productLineCarModel(associatedProduct) : '-'));
                                const displayYear = (item.year && typeof item.year === 'object') ? (item.year?.year || '') : (item.year || (associatedProduct ? productLineYear(associatedProduct) : '-'));
                                const displayName = item.name || associatedProduct?.name || '-';
                                const displaySpec = item.spec || associatedProduct?.specifications || '-';
                                const displayBrand = item.brand || associatedProduct?.brand || (associatedProduct?.part_numbers?.[0]?.brand) || '-';

                                return (
                                    <tr
                                        key={idx}
                                        data-doc-item-row-idx={idx}
                                        tabIndex={-1}
                                        style={{
                                            borderBottom: '1px solid var(--border-color)',
                                            fontSize: '0.85rem',
                                            backgroundColor: activeItemIndex === idx ? 'var(--bg-tertiary)' : undefined
                                        }}
                                        onClick={(ev) => {
                                            setActiveItemIndex(idx);
                                            ev.currentTarget.focus();
                                        }}
                                    >
                                        <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 700 }}>
                                            {idx + 1}
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            {!isReadOnly && (
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIndexes.includes(idx)}
                                                    onChange={(e) => toggleItemSelection(idx, e.target.checked)}
                                                />
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>{item.part_number || item.p_id}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.p_id !== item.part_number ? item.p_id : (associatedProduct?.p_id || '')}</div>
                                            {mappingCount > 0 && (
                                                <div
                                                    style={{ mt: '4px', fontSize: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa', cursor: 'pointer', display: 'inline-block', border: '1px solid var(--border-color)' }}
                                                    onClick={(e) => { e.stopPropagation(); setMappingProduct(associatedProduct); }}
                                                >
                                                    +{mappingCount} {'\u9069\u7528'}</div>
                                            )}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{displayCarModel}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{displayYear}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{displayName}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{displaySpec}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{displayBrand}</div>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: (associatedProduct?.stock ?? item.stock ?? 0) > 0 ? '#10b981' : '#ef4444' }}>
                                                {associatedProduct?.stock ?? item.stock ?? '-'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.5rem 1rem' }}>
                                            <input
                                                data-doc-item-qty
                                                type="number"
                                                disabled={isReadOnly}
                                                value={item.qty}
                                                onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        focusPriceInput(idx);
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.4rem',
                                                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-tertiary)',
                                                    border: isReadOnly ? 'none' : '1px solid var(--border-color)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-primary)',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '0.5rem 1rem' }}>
                                            <input
                                                data-doc-item-price
                                                type="number"
                                                disabled={isReadOnly}
                                                value={item.unit_price}
                                                onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        if (idx < (doc?.items || []).length - 1) {
                                                            focusQtyInput(idx + 1);
                                                            setActiveItemIndex(idx + 1);
                                                        } else {
                                                            addPartBtnRef.current?.focus();
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.4rem',
                                                    backgroundColor: isReadOnly ? 'transparent' : 'var(--bg-tertiary)',
                                                    border: isReadOnly ? 'none' : '1px solid var(--border-color)',
                                                    borderRadius: '4px',
                                                    color: 'var(--text-primary)',
                                                    textAlign: 'center'
                                                }}
                                            />
                                        </td>
                                        <td style={{ padding: '1rem', fontWeight: 800 }}>{(item.qty * item.unit_price).toLocaleString()}</td>
                                        <td style={{ padding: '1rem' }}>
                                            {!isReadOnly && <button onClick={() => removeItem(idx)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {!isReadOnly && (
                                <tr>
                                    <td colSpan={11} style={{ padding: '1rem' }}>
                                        <button
                                            type="button"
                                            ref={addPartBtnRef}
                                            onClick={() => setIsPickerOpen(true)}
                                            onFocus={() => setIsAddPartFocused(true)}
                                            onBlur={() => setIsAddPartFocused(false)}
                                            style={{
                                                color: '#3b82f6',
                                                border: isAddPartFocused ? '2px solid #3b82f6' : '1px dashed #3b82f6',
                                                background: isAddPartFocused ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                                boxShadow: isAddPartFocused ? '0 0 0 3px rgba(59, 130, 246, 0.25)' : 'none',
                                                width: '100%',
                                                padding: '0.5rem',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                fontWeight: 700,
                                                outline: 'none',
                                                transition: 'border 0.15s ease, background 0.15s ease, box-shadow 0.15s ease'
                                            }}
                                        >
                                            <Plus size={16} /> {'\u65b0\u589e\u96f6\u4ef6'}
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            {/* Footer Summary */}
            <div style={{ padding: '0.85rem 1.5rem', backgroundColor: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', flexShrink: 0, gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <span>{'\u7e3d\u9805\u6578'}: <b style={{ color: 'var(--text-primary)' }}>{docItems.length}</b></span>
                    <span>{'\u7e3d\u4ef6\u6578'}: <b style={{ color: 'var(--text-primary)' }}>{docItems.reduce((sum, item) => sum + (item.qty || 0), 0)}</b></span>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--warning)' }}>
                    {'\u672a\u7a05\u5c0f\u8a08'} ({doc.currency || defaultCurrency}): {formatAmount(subtotal)}
                </div>
            </div>

            </div>

            {isDocListDrawerOpen && (
                <aside
                    style={{
                        flex: '1 1 50%',
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderLeft: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-primary)',
                    }}
                >
                    <div
                        style={{
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 0.85rem',
                            background: 'var(--bg-secondary)',
                            borderBottom: '1px solid var(--border-color)',
                        }}
                    >
                        <FileText size={17} aria-hidden />
                        <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>單據列表</span>
                        <span style={{ flex: 1 }} />
                        <button
                            type="button"
                            onClick={() => setIsDocListDrawerOpen(false)}
                            style={{
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '50%',
                                width: '34px',
                                height: '34px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                            }}
                            aria-label="關閉單據列表"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <DocumentHub
                            isDrawerMode={true}
                            drawerAnchorDocType={type}
                            onSelectDoc={(nextType, docId) => {
                                const next = new URLSearchParams(searchParams);
                                next.set('type', nextType);
                                if (docId) {
                                    next.set('id', String(docId));
                                    next.delete('new');
                                } else {
                                    next.delete('id');
                                }
                                setSearchParams(next, { replace: true });
                            }}
                        />
                    </div>
                </aside>
            )}

            {/* Product Picker Overlay */}
            {isPickerOpen && (
                <div
                    role="dialog"
                    data-doc-picker-zone
                    style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: 1000, display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Package size={24} style={{ color: '#3b82f6' }} />
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{'\u7522\u54c1\u8cc7\u6599\u4e2d\u5fc3'}</h2>
                        </div>
                        <button onClick={() => setIsPickerOpen(false)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>[X] {'\u95dc\u9589'}</button>
                    </div>

                    {/* Search Panel */}
                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                        <form ref={pickerFormRef} onSubmit={(e) => e.preventDefault()} onKeyDown={handlePickerFormKeyDown} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', overflow: 'visible', paddingBottom: '0.15rem' }}>
                            <button
                                ref={pickerResetBtnRef}
                                type="button"
                                onClick={handleClearPicker}
                                className={styles.searchResetBtn}
                                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '36px', flexShrink: 0 }}
                                title={'\u91cd\u8a2d\u689d\u4ef6'}
                            >
                                <RotateCcw size={16} />
                            </button>
                            <div data-picker-field="0" style={{ display: 'flex', flexDirection: 'column', minWidth: '120px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u96f6\u4ef6\u865f\u78bc'} (Part No.)</label>
                                <input
                                    ref={pickerFirstInputRef}
                                    type="text"
                                    placeholder={'\u8f38\u5165\u95dc\u9375\u5b57'}
                                    value={pickerQuery.partNumber}
                                    onChange={e => setPickerQuery({ ...pickerQuery, partNumber: e.target.value })}
                                    style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', width: '100%', fontSize: '0.85rem' }}
                                />
                            </div>

                            <div data-picker-field="1" style={{ display: 'flex', flexDirection: 'column', minWidth: '130px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u8eca\u578b'}</label>
                                <AutocompleteInput
                                    value={pickerQuery.model}
                                    onChange={(val) => setPickerQuery({ ...pickerQuery, model: val })}
                                    placeholder={'\u8f38\u5165\u641c\u5c0b'}
                                    data={models}
                                    filterKey="shorthand"
                                    labelKey="fullname"
                                    compact={true}
                                />
                            </div>

                            <div data-picker-field="2" style={{ display: 'flex', flexDirection: 'column', minWidth: '130px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u54c1\u540d'}</label>
                                <AutocompleteInput
                                    value={pickerQuery.part}
                                    onChange={(val) => setPickerQuery({ ...pickerQuery, part: val })}
                                    placeholder={'\u8f38\u5165\u641c\u5c0b'}
                                    data={parts}
                                    filterKey="shorthand"
                                    labelKey="fullname"
                                    compact={true}
                                />
                            </div>

                            <div data-picker-field="3" style={{ display: 'flex', flexDirection: 'column', minWidth: '90px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u898f\u683c'}</label>
                                <input type="text" placeholder={'CC\u6216\u898f\u683c'} value={pickerQuery.spec} onChange={e => setPickerQuery({ ...pickerQuery, spec: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', width: '100%', fontSize: '0.85rem' }} />
                            </div>

                            <div data-picker-field="4" style={{ display: 'flex', flexDirection: 'column', minWidth: '80px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u5e74\u4efd'}</label>
                                <input type="text" placeholder={'\u4f8b\u5982 18-22'} value={pickerQuery.year} onChange={e => setPickerQuery({ ...pickerQuery, year: e.target.value })} style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', width: '100%', fontSize: '0.85rem' }} />
                            </div>

                            <div data-picker-field="5" style={{ display: 'flex', flexDirection: 'column', minWidth: '110px', flex: 1 }}>
                                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.45rem', whiteSpace: 'nowrap' }}>{'\u54c1\u724c'}</label>
                                <AutocompleteInput
                                    value={pickerQuery.brand}
                                    onChange={(val) => setPickerQuery({ ...pickerQuery, brand: val })}
                                    placeholder={'\u8f38\u5165\u641c\u5c0b'}
                                    data={brands}
                                    filterKey="shorthand"
                                    labelKey="fullname"
                                    compact={true}
                                />
                            </div>
                        </form>
                    </div>

                    <DocProductHistoryDrawer
                        open={historyDrawerOpen}
                        onClose={() => setHistoryDrawerOpen(false)}
                        focusPId={docHistoryFocusPId}
                    />

                    <div
                        ref={pickerListRef}
                        tabIndex={0}
                        onKeyDown={handlePickerListKeyDown}
                        style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none' }}
                    >
                        <div
                            style={{
                                padding: '0.75rem 1rem',
                                borderBottom: '1px solid var(--border-color)',
                                backgroundColor: 'var(--bg-tertiary)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '1rem',
                                flexShrink: 0
                            }}
                        >
                            <button
                                onClick={handlePickSelectedProducts}
                                disabled={selectedPickerProductIds.length === 0}
                                style={{
                                    background: selectedPickerProductIds.length === 0 ? 'var(--bg-tertiary)' : '#dc2626',
                                    color: selectedPickerProductIds.length === 0 ? 'var(--text-muted)' : 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.45rem 0.85rem',
                                    fontWeight: 700,
                                    cursor: selectedPickerProductIds.length === 0 ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {'\u6279\u6b21\u78ba\u8a8d\u53d6\u56de'}
                            </button>
                            <span
                                style={{
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    color: 'var(--text-secondary)',
                                    whiteSpace: 'nowrap'
                                }}
                                aria-live="polite"
                            >
                                {pickerMatchTotal > 50
                                    ? `\u641c\u5c0b\u7d50\u679c\uff1a\u5171 ${pickerMatchTotal} \u7b46\uff08\u986f\u793a\u524d 50 \u7b46\uff09`
                                    : `\u641c\u5c0b\u7d50\u679c\uff1a${pickerMatchTotal} \u7b46`}
                            </span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                <tr>
                                    <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                                        <input
                                            ref={pickerSelectAllRef}
                                            type="checkbox"
                                            checked={isPickerAllSelected}
                                            onChange={(e) => togglePickerSelectAll(e.target.checked)}
                                        />
                                    </th>
                                    <th style={{ padding: '1rem' }}>{'\u96f6\u4ef6\u865f\u78bc'} (ID)</th>
                                    <th style={{ padding: '1rem' }}>{'\u8eca\u578b'} / {'\u5e74\u4efd'}</th>
                                    <th style={{ padding: '1rem' }}>{'\u54c1\u540d'} / {'\u898f\u683c'}</th>
                                    <th style={{ padding: '1rem' }}>{'\u54c1\u724c'}</th>
                                    <th style={{ padding: '1rem' }}>{'\u5eab\u5b58'}</th>
                                    <th style={{ padding: '1rem' }}>{'\u55ae\u50f9'}</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>{'\u64cd\u4f5c'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pickerResults.map((p, idx) => {
                                    const pnObj = p.part_numbers?.[0] || {};
                                    const isPurch = type === 'purchase' || type === 'purchaseReturn';
                                    const isActive = idx === activePickerRowIndex;
                                    return (
                                        <tr
                                            key={p.p_id}
                                            data-picker-row-idx={idx}
                                            style={{
                                                borderBottom: '1px solid var(--border-color)',
                                                backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : undefined
                                            }}
                                        >
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
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
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>{pnObj.part_number || p.part_number || p.p_id}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.p_id}</div>
                                                {(p.part_numbers || []).length > 0 && (
                                                    <div
                                                        style={{ mt: '4px', fontSize: '10px', backgroundColor: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa', cursor: 'pointer', display: 'inline-block', border: '1px solid var(--border-color)' }}
                                                        onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }}
                                                    >
                                                        +{p.part_numbers.length} {'\u9069\u7528'}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{productLineCarModel(p) || '-'}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{productLineYear(p) || '\u5e74\u4efd\u672a\u77e5'}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{p.specifications || '-'}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.brand || pnObj.brand || '-'}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 700, color: p.stock > 0 ? '#10b981' : '#ef4444' }}>{p.stock ?? 0}</div>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <div style={{ fontWeight: 800 }}>NT$ {(isPurch ? productPurchaseUnitPrice(p) : productSalesUnitPrice(p)).toLocaleString()}</div>
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => handlePickProduct(p)}
                                                    style={{ backgroundColor: '#3b82f6', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                                                >
                                                    {'\u9078\u53d6'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {pickerResults.length === 0 && (
                                    <tr>
                                        <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }} >{'\u67e5\u7121\u7b26\u5408\u8cc7\u6599'}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    onClose={() => setMappingProduct(null)}
                />
            )}
            {isViewerOpen && (
                <DocumentViewer
                    doc={doc}
                    type={type}
                    onClose={handleCloseViewerAndFocusPrint}
                    onEdit={() => {
                        setIsViewerOpen(false);
                        if (canEditThisDocType) setIsReadOnly(false);
                    }}
                />
            )}

            {!isDocListDrawerOpen && (
                <button
                    type="button"
                    aria-label="開啟單據列表"
                    title="單據列表"
                    onClick={() => setIsDocListDrawerOpen(true)}
                    style={{
                        position: 'fixed',
                        right: 0,
                        top: '42%',
                        transform: 'translateY(-50%)',
                        zIndex: 999,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.4rem',
                        padding: '0.85rem 0.5rem',
                        border: '1px solid var(--border-color)',
                        borderRight: 'none',
                        borderTopLeftRadius: '12px',
                        borderBottomLeftRadius: '12px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        boxShadow: '-3px 2px 14px rgba(0,0,0,0.14)',
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        letterSpacing: '0.12em',
                    }}
                >
                    <FileText size={17} style={{ transform: 'rotate(90deg)' }} aria-hidden />
                    單據列表
                </button>
            )}

        </div>
    );
};

export default DocumentEditorPage;
