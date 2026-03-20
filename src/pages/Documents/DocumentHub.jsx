import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useProductStore } from '../../store/useProductStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import { canEditDocType } from '../../utils/permissions';
import { FileText, Plus, Printer, Eye, Search, RotateCcw, Trash2, ArrowRightLeft } from 'lucide-react';
import { useSearchFormKeyboardNav } from '../../hooks/useSearchFormKeyboardNav';
import styles from './Documents.module.css';
import DocumentViewer from './DocumentViewer';
import DocumentDarkPreview from './DocumentDarkPreview';

const TAB_GROUPS = [
    {
        title: { zh: '銷售業務', en: 'Sales' },
        type: 'sales',
        tabs: [
            { key: 'quotation', labelKey: 'docs.tabQuotation' },
            { key: 'sales', labelKey: 'docs.tabSales' },
            { key: 'salesReturn', labelKey: 'docs.tabSalesReturn' },
        ]
    },
    {
        title: { zh: '採購進貨', en: 'Procurement' },
        type: 'procurement',
        tabs: [
            { key: 'inquiry', labelKey: 'docs.tabInquiry' },
            { key: 'purchase', labelKey: 'docs.tabPurchase' },
            { key: 'shortageBook', labelKey: 'docs.tabShortageBook' },
            { key: 'purchaseReturn', labelKey: 'docs.tabPurchaseReturn' },
        ]
    }
];

const VALID_DOC_TABS = ['inquiry', 'purchase', 'quotation', 'sales', 'salesReturn', 'purchaseReturn', 'shortageBook'];
const KEYBOARD_TAB_GROUPS = {
    sales: ['quotation', 'sales', 'salesReturn'],
    procurement: ['inquiry', 'purchase', 'shortageBook', 'purchaseReturn'],
};

const STATUS_LABEL = {
    pending: { zh: '待處理', en: 'Pending' },
    replied: { zh: '已回覆', en: 'Replied' },
    sent: { zh: '已送出', en: 'Sent' },
    accepted: { zh: '已接受', en: 'Accepted' },
    received: { zh: '已入庫', en: 'Received' },
    in_transit: { zh: '運輸中', en: 'In Transit' },
    shipped: { zh: '已出貨', en: 'Shipped' },
    pending_payment: { zh: '待付款', en: 'Pending Payment' },
    cancelled: { zh: '已取消', en: 'Cancelled' },
};

const isTypingTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const DEFAULT_SEARCH_FILTERS = { docId: '', date: '', status: '', party: '', opener: '' };
const DOC_HUB_SEARCH_STATE_KEY = 'erp-doc-hub-search-state';

const DocumentHub = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const {
        inquiries = [],
        purchaseOrders = [],
        quotations = [],
        salesOrders = [],
        salesReturns = [],
        purchaseReturns = [],
        shortageBook = [],
        syncShortageBook,
        updateShortageSupplier,
        updateShortageSuggestedQty,
        deleteShortageItems,
        transferShortageToInquiry,
        statusColors = {}
    } = useDocumentStore();
    const { products } = useProductStore();
    const { defaultCurrency, isMultiCountryMode, enableLoginSystem, enablePermissionRole, currentUserEmpId } = useAppStore();
    const { suppliers } = useSupplierStore();
    const { customers } = useCustomerStore();
    const { employees } = useEmployeeStore();
    const { t, language } = useTranslation();
    const initialTab = searchParams.get('tab');
    // 進入製單系統預設為 銷售業務/報價單
    const tabFromQuery = VALID_DOC_TABS.includes(initialTab) ? initialTab : 'quotation';
    const isDocFocusMode = false; // 始終顯示銷售業務/採購進貨分頁，不再依 URL 隱藏
    const [activeTab, setActiveTab] = useState(tabFromQuery);
    const tabGroupMap = useMemo(() => ({
        quotation: 'sales',
        sales: 'sales',
        salesReturn: 'sales',
        inquiry: 'procurement',
        purchase: 'procurement',
        shortageBook: 'procurement',
        purchaseReturn: 'procurement',
    }), []);
    const [activeBusinessGroup, setActiveBusinessGroup] = useState(tabGroupMap[tabFromQuery] || 'sales');
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [isQuickPreview, setIsQuickPreview] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isSearching, setIsSearching] = useState(true); // Search is now always active
    const [searchFilters, setSearchFilters] = useState(() => {
        try {
            const raw = localStorage.getItem(DOC_HUB_SEARCH_STATE_KEY);
            if (!raw) return DEFAULT_SEARCH_FILTERS;
            const saved = JSON.parse(raw);
            return { ...DEFAULT_SEARCH_FILTERS, ...(saved?.searchFilters || {}) };
        } catch {
            return DEFAULT_SEARCH_FILTERS;
        }
    });
    const [appliedSearchFilters, setAppliedSearchFilters] = useState(() => {
        try {
            const raw = localStorage.getItem(DOC_HUB_SEARCH_STATE_KEY);
            if (!raw) return DEFAULT_SEARCH_FILTERS;
            const saved = JSON.parse(raw);
            return { ...DEFAULT_SEARCH_FILTERS, ...(saved?.appliedSearchFilters || saved?.searchFilters || {}) };
        } catch {
            return DEFAULT_SEARCH_FILTERS;
        }
    });
    const [isEditingInline, setIsEditingInline] = useState(false);
    const [activeDocIndex, setActiveDocIndex] = useState(0);
    const docListKeyboardRef = useRef(null);
    const addDocBtnRef = useRef(null);
    const searchFormRef = useRef(null);
    const searchBtnRef = useRef(null);
    const searchResetBtnRef = useRef(null);
    const [selectedShortageIds, setSelectedShortageIds] = useState([]);
    const [activeShortageIndex, setActiveShortageIndex] = useState(0);
    const shortageSelectAllRef = useRef(null);
    const shortageBodyRef = useRef(null);
    const shortageListKeyboardRef = useRef(null);

    useEffect(() => {
        const nextTab = searchParams.get('tab');
        if (VALID_DOC_TABS.includes(nextTab)) {
            setActiveTab(nextTab);
        }
    }, [searchParams]);

    useEffect(() => {
        localStorage.setItem(DOC_HUB_SEARCH_STATE_KEY, JSON.stringify({ searchFilters, appliedSearchFilters }));
    }, [searchFilters, appliedSearchFilters]);

    // 鍵盤切換分頁時同步 URL，與銷售業務行為一致
    useEffect(() => {
        if (VALID_DOC_TABS.includes(activeTab) && searchParams.get('tab') !== activeTab) {
            setSearchParams({ tab: activeTab }, { replace: true });
        }
    }, [activeTab]);

    useEffect(() => {
        const nextGroup = tabGroupMap[activeTab];
        if (nextGroup && nextGroup !== activeBusinessGroup) {
            setActiveBusinessGroup(nextGroup);
        }
    }, [activeTab, activeBusinessGroup, tabGroupMap]);

    // 移除：不再在非 focus 模式下強制重置分頁，避免覆蓋使用者的分頁選擇

    const DOC_TAB_META = {
        quotation: { label: '報價單', color: '#2563eb' },
        sales: { label: '銷貨單', color: '#16a34a' },
        salesReturn: { label: '銷貨退回', color: '#0ea5e9' },
        inquiry: { label: '詢價單', color: '#8b5cf6' },
        purchase: { label: '進貨單', color: '#f59e0b' },
        shortageBook: { label: '缺貨簿', color: '#dc2626' },
        purchaseReturn: { label: '進貨退回', color: '#f97316' },
    };
    const focusedMeta = DOC_TAB_META[activeTab] || { label: t('docs.title'), color: '#60a5fa' };
    const activeGroupTabs = TAB_GROUPS.find((group) => group.type === activeBusinessGroup)?.tabs || TAB_GROUPS[0].tabs;

    const isShortageTab = activeTab === 'shortageBook';

    const getDocList = () => {
        if (activeTab === 'inquiry') return inquiries;
        if (activeTab === 'purchase') return purchaseOrders;
        if (activeTab === 'quotation') return quotations;
        if (activeTab === 'sales') return salesOrders;
        if (activeTab === 'salesReturn') return salesReturns;
        if (activeTab === 'purchaseReturn') return purchaseReturns;
        if (activeTab === 'shortageBook') return shortageBook;
        return [];
    };

    const docs = getDocList();

    const filteredDocs = docs.filter(doc => {
        if (isShortageTab) {
            const keyword = appliedSearchFilters.docId.trim().toLowerCase();
            if (keyword) {
                const target = `${doc.p_id || ''} ${doc.part_number || ''} ${doc.name || ''}`.toLowerCase();
                if (!target.includes(keyword)) return false;
            }
            if (appliedSearchFilters.party && !(doc.supplier_name || '').toLowerCase().includes(appliedSearchFilters.party.toLowerCase())) return false;
            return true;
        }

        // DocID search
        if (appliedSearchFilters.docId && !doc.doc_id.toLowerCase().includes(appliedSearchFilters.docId.toLowerCase())) return false;

        // Date search
        if (appliedSearchFilters.date && !doc.date.includes(appliedSearchFilters.date)) return false;

        // Status search
        if (appliedSearchFilters.status && doc.status !== appliedSearchFilters.status) return false;

        // Party (Customer/Supplier) search
        if (appliedSearchFilters.party) {
            const name = getPartyName(doc).toLowerCase();
            if (!name.includes(appliedSearchFilters.party.toLowerCase())) return false;
        }

        // Opener (creator) search
        if (appliedSearchFilters.opener) {
            const opener = getOpenerName(doc).toLowerCase();
            if (!opener.includes(appliedSearchFilters.opener.toLowerCase())) return false;
        }

        return true;
    });

    // 僅在切換分頁時重置 activeDocIndex，避免 filteredDocs 變動導致無法移動到第 2 項
    useEffect(() => {
        if (isShortageTab || isQuickPreview) return;
        if (filteredDocs.length === 0) {
            setActiveDocIndex(0);
            return;
        }
        setActiveDocIndex(0);
    }, [activeTab, isShortageTab, isQuickPreview]);

    const handleQuickPreviewToggle = () => {
        setIsQuickPreview(!isQuickPreview);
        setPreviewIndex(0);
        setIsSearching(false);
        setIsEditingInline(false);
    };

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setAppliedSearchFilters(searchFilters);
    };

    useSearchFormKeyboardNav(searchFormRef, searchBtnRef, searchResetBtnRef);

    const handleClearSearch = () => {
        setSearchFilters(DEFAULT_SEARCH_FILTERS);
        setAppliedSearchFilters(DEFAULT_SEARCH_FILTERS);
        localStorage.removeItem(DOC_HUB_SEARCH_STATE_KEY);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isQuickPreview || filteredDocs.length === 0 || isEditingInline || isShortageTab) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPreviewIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPreviewIndex(prev => Math.min(filteredDocs.length - 1, prev + 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isQuickPreview, filteredDocs, isEditingInline, isShortageTab]);

    useEffect(() => {
        if (isQuickPreview || isShortageTab || selectedDoc || !docListKeyboardRef.current) return;
        const focusList = () => docListKeyboardRef.current?.focus();
        focusList();
        const t = setTimeout(focusList, 80);
        return () => clearTimeout(t);
    }, [isQuickPreview, isShortageTab, selectedDoc, activeTab, filteredDocs.length]);

    // 進入快速預覽時聚焦「編輯」按鈕（由父層主動聚焦，確保不被其他元素搶走）
    useEffect(() => {
        if (!isQuickPreview || isShortageTab || isEditingInline || filteredDocs.length === 0) return;
        const focusEdit = () => document.getElementById('doc-quick-preview-edit-btn')?.focus();
        focusEdit();
        const t1 = setTimeout(focusEdit, 150);
        const t2 = setTimeout(focusEdit, 400);
        const t3 = setTimeout(focusEdit, 700);
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
    }, [isQuickPreview, isShortageTab, isEditingInline, filteredDocs.length, previewIndex]);

    useEffect(() => {
        syncShortageBook(products, purchaseOrders);
    }, [products, purchaseOrders, syncShortageBook]);

    useEffect(() => {
        if (!isShortageTab) {
            setSelectedShortageIds([]);
            setActiveShortageIndex(0);
        }
    }, [isShortageTab]);

    useEffect(() => {
        if (!isShortageTab) return;
        if (filteredDocs.length === 0) {
            setActiveShortageIndex(0);
            return;
        }
        setActiveShortageIndex(0);
    }, [isShortageTab, filteredDocs]);

    const isAllShortageSelected = isShortageTab && filteredDocs.length > 0 && selectedShortageIds.length === filteredDocs.length;
    const isShortageIndeterminate = isShortageTab && selectedShortageIds.length > 0 && selectedShortageIds.length < filteredDocs.length;

    useEffect(() => {
        if (!shortageSelectAllRef.current) return;
        shortageSelectAllRef.current.indeterminate = isShortageIndeterminate;
    }, [isShortageIndeterminate]);

    useEffect(() => {
        if (!isShortageTab || !shortageListKeyboardRef.current || filteredDocs.length === 0) return;
        shortageListKeyboardRef.current.focus();
    }, [isShortageTab, filteredDocs.length]);

    useEffect(() => {
        if (!isShortageTab || !shortageBodyRef.current) return;
        const rowEl = shortageBodyRef.current.querySelector(`[data-shortage-row-idx="${activeShortageIndex}"]`);
        if (rowEl) rowEl.scrollIntoView({ block: 'nearest' });
    }, [isShortageTab, activeShortageIndex]);

    const handleShortageListKeyDown = (e) => {
        if (!isShortageTab) return;

        // ESC：清除選取（與銷售 ESC 關閉 modal 行為一致）
        if (e.key === 'Escape') {
            if (selectedShortageIds.length > 0) {
                e.preventDefault();
                setSelectedShortageIds([]);
            }
            return;
        }

        const procurementTabs = KEYBOARD_TAB_GROUPS.procurement;
        const procurementTabIndex = procurementTabs.indexOf(activeTab);

        if (e.key === 'ArrowRight' && procurementTabIndex !== -1) {
            e.preventDefault();
            const nextIndex = Math.min(procurementTabIndex + 1, procurementTabs.length - 1);
            const nextTab = procurementTabs[nextIndex];
            setActiveBusinessGroup('procurement');
            setActiveTab(nextTab);
        } else if (e.key === 'ArrowLeft' && procurementTabIndex !== -1) {
            e.preventDefault();
            const nextIndex = Math.max(procurementTabIndex - 1, 0);
            const nextTab = procurementTabs[nextIndex];
            setActiveBusinessGroup('procurement');
            setActiveTab(nextTab);
        } else if (e.key === 'ArrowDown') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            setActiveShortageIndex((prev) => Math.min(prev + 1, filteredDocs.length - 1));
        } else if (e.key === 'ArrowUp') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            setActiveShortageIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            const current = filteredDocs[activeShortageIndex];
            if (!current) return;
            const checked = selectedShortageIds.includes(current.p_id);
            toggleShortageSelection(current.p_id, !checked);
        }
    };

    // Auto-refresh when returning to this tab to ensure data from new window is synced
    const [, setTick] = useState(0);
    useEffect(() => {
        const handleFocus = () => {
            // Ensure cross-tab changes (e.g. delete from editor tab) are rehydrated.
            useDocumentStore.persist.rehydrate();
            // Check if we need to switch tabs based on the last editor action
            const lastType = localStorage.getItem('erp-last-doc-type');
            if (lastType) {
                setActiveTab(lastType);
                localStorage.removeItem('erp-last-doc-type');
            }
            setTick(prev => prev + 1);
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const openEditor = (type, id = null) => {
        let url = `/document-editor?type=${type}`;
        if (id) url += `&id=${id}`;
        // Open in a normal browser tab instead of popup window
        window.open(url, '_blank');
    };

    const getStatusColor = (status) => {
        const map = { success: '#34d399', warning: '#fbbf24', danger: '#ef4444', accent: '#60a5fa' };
        return map[statusColors[status]] || '#94a3b8';
    };

    const getPartyName = (doc) => {
        if (doc.supplier_name) return doc.supplier_name;
        if (doc.customer_name) return doc.customer_name;

        // Fallback to searching in stores if name is missing
        if (doc.supplier_id) {
            const s = suppliers.find(sup => sup.sup_id === doc.supplier_id);
            if (s) return s.name;
        }
        if (doc.customer_id) {
            const c = customers.find(cust => cust.cust_id === doc.customer_id);
            if (c) return c.name;
        }

        return '-';
    };

    const getOpenerName = (doc) => {
        if (doc.opener_emp_name) return `${doc.opener_emp_name} (${doc.opener_emp_id || '-'})`;
        if (doc.opener_emp_id) {
            const emp = employees.find((e) => e.emp_id === doc.opener_emp_id);
            if (emp) return `${emp.name} (${emp.emp_id})`;
            return doc.opener_emp_id;
        }
        return '-';
    };

    const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);
    const permissionDocType = isShortageTab ? 'inquiry' : activeTab;
    const canEditCurrentTab = canEditDocType({
        enableLoginSystem,
        enablePermissionRole,
        currentUser,
        docType: permissionDocType
    });

    const toggleShortageSelection = (pId, checked) => {
        setSelectedShortageIds((prev) => {
            if (checked) {
                if (prev.includes(pId)) return prev;
                return [...prev, pId];
            }
            return prev.filter((id) => id !== pId);
        });
    };

    const toggleSelectAllShortage = (checked) => {
        if (!checked) {
            setSelectedShortageIds([]);
            return;
        }
        setSelectedShortageIds(filteredDocs.map((item) => item.p_id));
    };

    const handleDeleteSelectedShortage = () => {
        if (selectedShortageIds.length === 0) return;
        deleteShortageItems(selectedShortageIds);
        setSelectedShortageIds([]);
    };

    const handleTransferSelectedShortage = () => {
        if (selectedShortageIds.length === 0) return;
        const opener = currentUser || employees[0];
        transferShortageToInquiry({
            pIds: selectedShortageIds,
            openerEmpId: opener?.emp_id || '',
            openerEmpName: opener?.name || ''
        });
        setSelectedShortageIds([]);
        setActiveTab('inquiry');
    };

    const openSelectedDocInInlineEdit = (doc) => {
        const targetId = doc?.doc_id;
        const nextPreviewIndex = filteredDocs.findIndex((d) => d.doc_id === targetId);
        setSelectedDoc(null);
        setIsQuickPreview(true);
        setIsEditingInline(true);
        setPreviewIndex(nextPreviewIndex >= 0 ? nextPreviewIndex : 0);
    };

    /** 子分頁列（詢價單/進貨單/缺貨簿/進貨退回、或報價單/銷貨單/銷貨退回）左/右鍵切換 */
    const handleTabBarKeyDown = (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const keyboardTabs = KEYBOARD_TAB_GROUPS[activeBusinessGroup] || KEYBOARD_TAB_GROUPS.sales;
        const currentTabIndex = keyboardTabs.indexOf(activeTab);
        if (currentTabIndex === -1) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'ArrowRight') {
            const nextIndex = Math.min(currentTabIndex + 1, keyboardTabs.length - 1);
            const nextTab = keyboardTabs[nextIndex];
            setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
            setActiveTab(nextTab);
        } else {
            const nextIndex = Math.max(currentTabIndex - 1, 0);
            const nextTab = keyboardTabs[nextIndex];
            setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
            setActiveTab(nextTab);
        }
    };

    const handleDocListKeyDown = (e) => {
        if (isQuickPreview || isShortageTab) return;

        const keyboardTabs = KEYBOARD_TAB_GROUPS[activeBusinessGroup] || KEYBOARD_TAB_GROUPS.sales;
        const currentTabIndex = keyboardTabs.indexOf(activeTab);

        if (e.key === 'ArrowRight' && currentTabIndex !== -1) {
            e.preventDefault();
            e.stopPropagation();
            const nextIndex = Math.min(currentTabIndex + 1, keyboardTabs.length - 1);
            const nextTab = keyboardTabs[nextIndex];
            setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
            setActiveTab(nextTab);
            return;
        }

        if (e.key === 'ArrowLeft' && currentTabIndex !== -1) {
            e.preventDefault();
            e.stopPropagation();
            const nextIndex = Math.max(currentTabIndex - 1, 0);
            const nextTab = keyboardTabs[nextIndex];
            setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
            setActiveTab(nextTab);
            return;
        }

        if (e.key === 'ArrowDown') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            if (activeDocIndex === filteredDocs.length - 1) {
                addDocBtnRef.current?.focus();
                return;
            }
            setActiveDocIndex((prev) => Math.min(prev + 1, filteredDocs.length - 1));
        } else if (e.key === 'ArrowUp') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            setActiveDocIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
            if (filteredDocs.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            const currentDoc = filteredDocs[activeDocIndex];
            if (!currentDoc) return;
            openEditor(activeTab, currentDoc.doc_id); // 等同按「檢視」(眼睛)按鈕，另開分頁
        }
    };

    // 新增單據按鈕：ArrowUp 時聚焦回列表最後一筆
    const handleAddDocBtnKeyDown = (e) => {
        if (e.key === 'ArrowUp' && filteredDocs.length > 0) {
            e.preventDefault();
            setActiveDocIndex(filteredDocs.length - 1);
            docListKeyboardRef.current?.focus();
        }
    };

    useEffect(() => {
        // 缺貨簿：僅註冊左/右鍵切換分頁（當焦點不在 input 時），其餘由 handleShortageListKeyDown 處理
        if (isShortageTab) {
            const handleShortageTabSwitch = (e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                if (isTypingTarget(e.target)) return;
                const procurementTabs = KEYBOARD_TAB_GROUPS.procurement;
                const idx = procurementTabs.indexOf(activeTab);
                if (idx === -1) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.key === 'ArrowRight') {
                    const next = procurementTabs[Math.min(idx + 1, procurementTabs.length - 1)];
                    setActiveBusinessGroup('procurement');
                    setActiveTab(next);
                } else {
                    const prev = procurementTabs[Math.max(idx - 1, 0)];
                    setActiveBusinessGroup('procurement');
                    setActiveTab(prev);
                }
            };
            window.addEventListener('keydown', handleShortageTabSwitch, true);
            return () => window.removeEventListener('keydown', handleShortageTabSwitch, true);
        }
        const handleGlobalDocFlowKeyDown = (e) => {
            // ESC 優先處理：無論焦點在哪都可關閉（不受 isTypingTarget 限制）
            if (e.key === 'Escape') {
                if (selectedDoc) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedDoc(null);
                    return;
                }
                if (isQuickPreview) {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsQuickPreview(false);
                    setIsEditingInline(false);
                    return;
                }
            }

            // 焦點在單據搜尋區塊時，不攔截（由 useSearchFormKeyboardNav 處理 開單人員↔查詢↔重設 左/右鍵）
            if (e.target.closest('[data-search-form]')) return;

            if (isTypingTarget(e.target)) return;

            // 在列表時，Space / Enter 等同按「檢視」(眼睛)按鈕，開啟該筆單據
            // 若焦點在「新增單據」按鈕，則不攔截 Enter/Space，讓按鈕處理「新增」
            if (!selectedDoc && !isQuickPreview && filteredDocs.length > 0 && (e.key === ' ' || e.code === 'Space' || e.key === 'Enter')) {
                if (e.target === addDocBtnRef.current) return; // 焦點在新增按鈕 -> 執行新增，不檢視最後一筆
                e.preventDefault();
                e.stopPropagation();
                const currentDoc = filteredDocs[activeDocIndex];
                if (currentDoc) openEditor(activeTab, currentDoc.doc_id);
                return;
            }

            if (selectedDoc && !isQuickPreview) {
                if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    openSelectedDocInInlineEdit(selectedDoc);
                }
                return;
            }

            if (isQuickPreview) return;

            const keyboardTabs = KEYBOARD_TAB_GROUPS[activeBusinessGroup] || KEYBOARD_TAB_GROUPS.sales;
            const currentTabIndex = keyboardTabs.indexOf(activeTab);

            if (e.key === 'ArrowRight' && currentTabIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                const nextIndex = Math.min(currentTabIndex + 1, keyboardTabs.length - 1);
                const nextTab = keyboardTabs[nextIndex];
                setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
                setActiveTab(nextTab);
                return;
            }

            if (e.key === 'ArrowLeft' && currentTabIndex !== -1) {
                e.preventDefault();
                e.stopPropagation();
                const nextIndex = Math.max(currentTabIndex - 1, 0);
                const nextTab = keyboardTabs[nextIndex];
                setActiveBusinessGroup(tabGroupMap[nextTab] || activeBusinessGroup);
                setActiveTab(nextTab);
                return;
            }

            if (e.key === 'ArrowDown') {
                if (filteredDocs.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                if (activeDocIndex === filteredDocs.length - 1) {
                    addDocBtnRef.current?.focus();
                } else {
                    setActiveDocIndex((prev) => Math.min(prev + 1, filteredDocs.length - 1));
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                if (filteredDocs.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.target === addDocBtnRef.current) {
                    setActiveDocIndex(filteredDocs.length - 1);
                    docListKeyboardRef.current?.focus();
                } else {
                    setActiveDocIndex((prev) => Math.max(prev - 1, 0));
                }
                return;
            }

            if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
                if (filteredDocs.length === 0) return;
                if (e.target === addDocBtnRef.current) return; // 焦點在新增按鈕 -> 讓按鈕處理新增
                e.preventDefault();
                e.stopPropagation();
                const currentDoc = filteredDocs[activeDocIndex];
                if (currentDoc) openEditor(activeTab, currentDoc.doc_id); // 等同按「檢視」(眼睛)按鈕
            }
        };

        window.addEventListener('keydown', handleGlobalDocFlowKeyDown, true);
        return () => window.removeEventListener('keydown', handleGlobalDocFlowKeyDown, true);
    }, [isShortageTab, selectedDoc, isQuickPreview, filteredDocs, activeTab, activeDocIndex, activeBusinessGroup, tabGroupMap]);

    const calcTotal = (doc) => {
        if (!doc.items) return 0;
        return doc.items.reduce((sum, item) => sum + (item.qty * (item.unit_price || 0)), 0);
    };

    const getDisplayCurrency = (doc) => {
        const isSupplierDoc = doc.type === 'inquiry' || doc.type === 'purchase';
        const isCustomerDoc = doc.type === 'quotation' || doc.type === 'sales';
        if (isSupplierDoc || (!isMultiCountryMode && isCustomerDoc)) {
            return defaultCurrency;
        }
        return doc.currency || defaultCurrency;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header} style={{ alignItems: 'center', minHeight: '64px' }}>
                {/* Left: Title Zone */}
                <div style={{ flex: 1 }}>
                    <h1 className={styles.title} style={isDocFocusMode ? { color: focusedMeta.color } : {}}>
                        {isDocFocusMode ? focusedMeta.label : t('docs.title')}
                    </h1>
                    <p className={styles.subtitle}>
                        {isDocFocusMode ? `目前顯示：${focusedMeta.label} 列表` : t('docs.subtitle')}
                    </p>
                </div>

                {/* Right: Actions Zone - 新增單據已移至左下角 */}
                <div className={styles.actions} style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }} />
            </div>

            {/* Search Panel aligned with ProductList style */}
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '1rem' }}>
                <form ref={searchFormRef} data-search-form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <button ref={searchResetBtnRef} type="button" data-search-reset="true" className={styles.searchResetBtn} onClick={handleClearSearch} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '36px', transition: '0.2s' }} title="重設全部條件">
                        <RotateCcw size={16} />
                    </button>
                    <div className={styles.searchField} data-search-field data-search-field-index="0" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>單據號碼</label>
                        <input
                            type="text"
                            placeholder="單號"
                            value={searchFilters.docId}
                            onChange={e => setSearchFilters({ ...searchFilters, docId: e.target.value })}
                            className={styles.searchInput}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div className={styles.searchField} data-search-field data-search-field-index="1" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>日期</label>
                        <input
                            type="text"
                            placeholder="YYYY-MM-DD"
                            value={searchFilters.date}
                            onChange={e => setSearchFilters({ ...searchFilters, date: e.target.value })}
                            className={styles.searchInput}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div className={styles.searchField} data-search-field data-search-field-index="2" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '170px', flex: 1.2 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>交易對象</label>
                        <input
                            type="text"
                            placeholder="客戶 / 供應商"
                            value={searchFilters.party}
                            onChange={e => setSearchFilters({ ...searchFilters, party: e.target.value })}
                            className={styles.searchInput}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>
                    <div className={styles.searchField} data-search-field data-search-field-index="3" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '130px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>狀態</label>
                        <select
                            value={searchFilters.status}
                            onChange={e => setSearchFilters({ ...searchFilters, status: e.target.value })}
                            className={styles.searchInput}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        >
                            <option value="">所有狀態</option>
                            <option value="pending">待處理</option>
                            <option value="accepted">已核准</option>
                            <option value="received">已入庫</option>
                            <option value="sent">已送出</option>
                        </select>
                    </div>
                    <div className={styles.searchField} data-search-field data-search-field-index="4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>開單人員</label>
                        <input
                            type="text"
                            placeholder="姓名 / 員編"
                            value={searchFilters.opener}
                            onChange={e => setSearchFilters({ ...searchFilters, opener: e.target.value })}
                            className={styles.searchInput}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button ref={searchBtnRef} type="submit" data-search-query className={styles.searchQueryBtn} style={{ background: 'var(--accent-primary)', color: 'white', padding: '0 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none', height: '36px', whiteSpace: 'nowrap' }}>
                            <Search size={16} /> 查詢
                        </button>
                    </div>
                    <div style={{ minWidth: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, paddingBottom: '6px' }}>
                        {filteredDocs.length} 筆
                    </div>
                </form>
            </div>

            {/* Low stock alert banner removed */}

            {/* Tab navigation grouped - 始終顯示銷售業務/採購進貨分頁 */}
            <div className={styles.tabsContainer} style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.65rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{ display: 'flex', gap: '0.65rem' }}>
                            {TAB_GROUPS.map((group) => {
                                const isActiveGroup = activeBusinessGroup === group.type;
                                const activeColor = group.type === 'sales' ? '#3b82f6' : '#8b5cf6';
                                return (
                                    <button
                                        key={group.type}
                                        type="button"
                                        onClick={() => {
                                            setActiveBusinessGroup(group.type);
                                            setActiveTab(group.tabs[0].key);
                                        }}
                                        style={{
                                            border: `1px solid ${isActiveGroup ? `${activeColor}66` : 'var(--border-color)'}`,
                                            background: isActiveGroup ? `${activeColor}22` : 'var(--bg-secondary)',
                                            color: isActiveGroup ? activeColor : 'var(--text-secondary)',
                                            borderRadius: '999px',
                                            padding: '0.35rem 0.9rem',
                                            fontSize: '0.82rem',
                                            fontWeight: 800,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {group.title[language === 'zh' ? 'zh' : 'en']}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs font-bold text-muted uppercase tracking-wider pl-2">
                            {activeBusinessGroup === 'sales' ? '目前分區：銷售業務' : '目前分區：採購進貨'}
                        </div>
                        <div className={styles.tabs} style={{ borderBottom: 'none', marginBottom: 0 }} tabIndex={0} onKeyDown={handleTabBarKeyDown} role="tablist">
                            {activeGroupTabs.map(tab => (
                                <div key={tab.key} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                                    <button
                                        className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''} `}
                                        style={activeTab === tab.key ? {
                                            color: activeBusinessGroup === 'sales' ? '#3b82f6' : '#8b5cf6',
                                            borderBottomColor: activeBusinessGroup === 'sales' ? '#3b82f6' : '#8b5cf6',
                                            paddingRight: '36px'
                                        } : { paddingRight: '36px' }}
                                        onClick={() => setActiveTab(tab.key)}
                                    >
                                        {t(tab.labelKey)}
                                        <span className={styles.tabCount} style={activeTab === tab.key ? {
                                            background: activeBusinessGroup === 'sales' ? '#3b82f622' : '#8b5cf622',
                                            color: activeBusinessGroup === 'sales' ? '#3b82f6' : '#8b5cf6'
                                        } : {}}>
                                            {{
                                                inquiry: inquiries.length,
                                                purchase: purchaseOrders.length,
                                                shortageBook: shortageBook.length,
                                                quotation: quotations.length,
                                                sales: salesOrders.length,
                                                salesReturn: salesReturns.length,
                                                purchaseReturn: purchaseReturns.length,
                                            }[tab.key] ?? 0}
                                        </span>
                                    </button>
                                    <button
                                        className={styles.miniAddBtn}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '20px',
                                            height: '20px',
                                            borderRadius: '4px',
                                            background: activeTab === tab.key ? (activeBusinessGroup === 'sales' ? '#3b82f622' : '#8b5cf622') : 'var(--bg-tertiary)',
                                            color: activeTab === tab.key ? (activeBusinessGroup === 'sales' ? '#3b82f6' : '#8b5cf6') : 'var(--text-muted)',
                                            border: 'none',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            zIndex: 5
                                        }}
                                        onClick={(e) => { e.stopPropagation(); if (tab.key !== 'shortageBook') openEditor(tab.key); }}
                                        disabled={!canEditDocType({ enableLoginSystem, enablePermissionRole, currentUser, docType: tab.key })}
                                        title={`新增${t(tab.labelKey)} `}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            ))}
                            <button
                                className={styles.btn}
                                onClick={handleQuickPreviewToggle}
                                disabled={isShortageTab}
                                title={isQuickPreview ? "關閉快速預覽" : "開啟快速預覽"}
                                style={{
                                    marginLeft: 'auto',
                                    alignSelf: 'center',
                                    height: '36px',
                                    minWidth: '120px',
                                    padding: '0 20px',
                                    borderRadius: '8px',
                                    fontWeight: 600,
                                    background: 'var(--accent-primary)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '0.4rem'
                                }}
                            >
                                {isShortageTab ? "缺貨簿不適用" : (isQuickPreview ? "退出預覽" : "快速預覽")}
                            </button>
                        </div>
                    </div>
                </div>

            {isDocFocusMode && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
                    <button
                        className={styles.btn}
                        onClick={handleQuickPreviewToggle}
                        disabled={isShortageTab}
                        title={isQuickPreview ? "關閉快速預覽" : "開啟快速預覽"}
                        style={{
                            height: '36px',
                            minWidth: '120px',
                            padding: '0 20px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        {isShortageTab ? "缺貨簿不適用" : (isQuickPreview ? "退出預覽" : "快速預覽")}
                    </button>
                </div>
            )}

            {!isQuickPreview && isShortageTab && (
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button
                        onClick={handleDeleteSelectedShortage}
                        disabled={selectedShortageIds.length === 0}
                        style={{
                            background: selectedShortageIds.length === 0 ? 'var(--bg-tertiary)' : '#ef4444',
                            color: selectedShortageIds.length === 0 ? 'var(--text-muted)' : 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.5rem 0.9rem',
                            fontWeight: 700,
                            cursor: selectedShortageIds.length === 0 ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <Trash2 size={14} /> 刪除選取
                    </button>
                    <button
                        onClick={handleTransferSelectedShortage}
                        disabled={selectedShortageIds.length === 0 || !canEditCurrentTab}
                        style={{
                            background: (selectedShortageIds.length === 0 || !canEditCurrentTab) ? 'var(--bg-tertiary)' : '#8b5cf6',
                            color: (selectedShortageIds.length === 0 || !canEditCurrentTab) ? 'var(--text-muted)' : 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.5rem 0.9rem',
                            fontWeight: 700,
                            cursor: (selectedShortageIds.length === 0 || !canEditCurrentTab) ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem'
                        }}
                    >
                        <ArrowRightLeft size={14} /> 轉詢價單
                    </button>
                </div>
            )}

            {/* Document table - Hidden in Quick Preview mode to achieve minimalist look */}
            {!isQuickPreview && (
                <div
                    className={styles.card}
                    ref={!isShortageTab ? docListKeyboardRef : undefined}
                    tabIndex={!isShortageTab ? 0 : undefined}
                    onKeyDown={!isShortageTab ? handleDocListKeyDown : undefined}
                >
                    <div
                        className={isShortageTab ? 'custom-scrollbar' : ''}
                        style={isShortageTab ? { height: '260px', overflowY: 'scroll', overflowX: 'auto' } : undefined}
                        ref={isShortageTab ? shortageListKeyboardRef : undefined}
                        tabIndex={isShortageTab ? 0 : undefined}
                        onKeyDown={isShortageTab ? handleShortageListKeyDown : undefined}
                    >
                        <table className={styles.table}>
                        <thead style={isShortageTab ? { position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-tertiary)' } : undefined}>
                            {isShortageTab ? (
                                <tr>
                                    <th style={{ width: '52px', textAlign: 'center' }}>
                                        <input
                                            ref={shortageSelectAllRef}
                                            type="checkbox"
                                            checked={isAllShortageSelected}
                                            onChange={(e) => toggleSelectAllShortage(e.target.checked)}
                                        />
                                    </th>
                                    <th style={{ width: '160px' }}>零件代號</th>
                                    <th>品名</th>
                                    <th style={{ width: '180px' }}>規格</th>
                                    <th style={{ width: '120px' }}>目前庫存</th>
                                    <th style={{ width: '120px' }}>安全庫存</th>
                                    <th style={{ width: '120px' }}>缺貨量</th>
                                    <th style={{ width: '140px' }}>建議詢價量</th>
                                    <th style={{ width: '260px' }}>進貨廠商</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th style={{ width: '140px' }}>{t('docs.thDocId')}</th>
                                    <th style={{ width: '120px' }}>{t('docs.thDate')}</th>
                                    <th>交易對象</th>
                                    <th style={{ width: '100px' }}>{t('docs.thItems')}</th>
                                    <th style={{ width: '150px' }}>{t('docs.thTotal')}</th>
                                    <th style={{ width: '180px' }}>{t('docs.thCreator')}</th>
                                    <th style={{ width: '120px' }}>{t('docs.thStatus')}</th>
                                    <th style={{ width: '220px' }}></th>
                                </tr>
                            )}
                        </thead>
                        <tbody ref={shortageBodyRef}>
                            {isShortageTab ? (
                                filteredDocs.map((item, idx) => (
                                    <tr
                                        key={item.p_id}
                                        data-shortage-row-idx={idx}
                                        style={activeShortageIndex === idx ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}
                                        onClick={() => {
                                            setActiveShortageIndex(idx);
                                            shortageListKeyboardRef.current?.focus();
                                        }}
                                    >
                                        <td style={{ textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedShortageIds.includes(item.p_id)}
                                                onChange={(e) => toggleShortageSelection(item.p_id, e.target.checked)}
                                            />
                                        </td>
                                        <td>
                                            <div className="font-mono font-semibold text-xs">{item.part_number || item.p_id}</div>
                                            <div className="text-sm text-muted">{item.p_id}</div>
                                        </td>
                                        <td className="font-semibold">{item.name}</td>
                                        <td>{item.spec || '-'}</td>
                                        <td className="font-mono font-semibold">{item.stock}</td>
                                        <td className="font-mono font-semibold">{item.safety_stock}</td>
                                        <td><span style={{ color: '#ef4444', fontWeight: 700 }}>{item.shortage_qty}</span></td>
                                        <td>
                                            <input
                                                type="number"
                                                min={1}
                                                value={item.suggested_qty}
                                                onChange={(e) => updateShortageSuggestedQty(item.p_id, e.target.value)}
                                                style={{
                                                    width: '96px',
                                                    padding: '0.4rem 0.45rem',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-primary)'
                                                }}
                                            />
                                        </td>
                                        <td>
                                            <select
                                                value={item.supplier_id || ''}
                                                onChange={(e) => {
                                                    const selectedSupplier = suppliers.find((s) => s.sup_id === e.target.value);
                                                    updateShortageSupplier(item.p_id, selectedSupplier || null);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.45rem 0.5rem',
                                                    background: 'var(--bg-tertiary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-primary)'
                                                }}
                                            >
                                                <option value="">-- 選擇進貨廠商 --</option>
                                                {suppliers.map((s) => (
                                                    <option key={s.sup_id} value={s.sup_id}>{s.sup_id} | {s.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                filteredDocs.map((doc, idx) => (
                                    <tr
                                        key={doc.doc_id}
                                        style={activeDocIndex === idx ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}
                                        onClick={() => {
                                            setActiveDocIndex(idx);
                                            docListKeyboardRef.current?.focus();
                                        }}
                                    >
                                        <td>
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-muted" />
                                                <span className="font-mono font-semibold text-xs">{doc.doc_id}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm text-muted">{doc.date}</td>
                                        <td className="font-semibold">{getPartyName(doc)}</td>
                                        <td className="text-sm text-muted">{doc.items?.length || 0} {t('docs.items')}</td>
                                        <td>
                                            {doc.items && doc.items[0]?.unit_price
                                                ? <span className="font-mono font-semibold">{getDisplayCurrency(doc)} {calcTotal(doc).toLocaleString()}</span>
                                                : <span className="text-muted text-sm">—</span>
                                            }
                                        </td>
                                        <td className="text-sm text-muted">{getOpenerName(doc)}</td>
                                        <td>
                                            <span className={styles.statusBadge} style={{ color: getStatusColor(doc.status), background: getStatusColor(doc.status) + '22' }}>
                                                {STATUS_LABEL[doc.status]?.[language === 'zh' ? 'zh' : 'en'] || doc.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button tabIndex={-1} className={styles.editRowBtn} onClick={() => openEditor(activeTab, doc.doc_id)} title={t('docs.inspect')}>
                                                    <Eye size={14} /> {t('docs.inspect')}
                                                </button>
                                                <button tabIndex={-1} className={styles.viewBtn} onClick={() => setSelectedDoc(doc)}>
                                                    <Printer size={14} /> {t('docs.view')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                            {filteredDocs.length === 0 && (
                                <tr>
                                    <td colSpan={isShortageTab ? 9 : 8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                        {isShortageTab ? '目前沒有低於安全庫存的零件' : (docs.length === 0 ? t('docs.empty') : '找不到符合條件的單據')}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 新增單據按鈕 - 置於列表下方左側 */}
            {!isQuickPreview && !isShortageTab && (
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                        ref={addDocBtnRef}
                        type="button"
                        className={styles.addDocBtn}
                        onClick={() => canEditCurrentTab && openEditor(activeTab)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowUp' && filteredDocs.length > 0) {
                                e.preventDefault();
                                setActiveDocIndex(filteredDocs.length - 1);
                                docListKeyboardRef.current?.focus();
                            }
                        }}
                        style={{
                            height: '36px',
                            minWidth: '120px',
                            padding: '0 20px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            background: 'var(--accent-primary)',
                            color: 'white',
                            border: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            cursor: canEditCurrentTab ? 'pointer' : 'not-allowed',
                            opacity: canEditCurrentTab ? 1 : 0.6
                        }}
                        disabled={!canEditCurrentTab}
                        title={`新增${focusedMeta.label}`}
                    >
                        <Plus size={18} strokeWidth={3} />
                        新增單據
                    </button>
                </div>
            )}

            {isQuickPreview && !isShortageTab && filteredDocs[previewIndex] && (
                <div style={{ marginTop: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <DocumentDarkPreview
                        doc={filteredDocs[previewIndex]}
                        type={activeTab}
                        inline={true}
                        isEditing={isEditingInline}
                        canEdit={canEditCurrentTab}
                        onEdit={() => canEditCurrentTab && setIsEditingInline(true)}
                        onSave={() => setIsEditingInline(false)}
                        onClose={() => { setIsQuickPreview(false); setIsEditingInline(false); }}
                    />
                </div>
            )}

            {isQuickPreview && !isShortageTab && isSearching && filteredDocs.length === 0 && (
                <div style={{ marginTop: '1rem', padding: '4rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <Search size={48} style={{ marginBottom: '1rem', opacity: 0.2 }} />
                    <p>找不到符合搜尋條件的單據</p>
                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>請調整搜尋條件後再試一次</p>
                    <button
                        onClick={handleClearSearch}
                        style={{ marginTop: '1.5rem', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0.5rem 1.5rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        重設搜尋
                    </button>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                        {/* Render inputs floating above so user can still edit filters? No, the filters are in the preview component's header. 
                            Since filteredDocs is empty, we still need to render the HEADER of the preview.
                        */}
                    </div>
                </div>
            )}

            {selectedDoc && !isQuickPreview && !isShortageTab && (
                <DocumentViewer
                    doc={selectedDoc}
                    type={activeTab}
                    onClose={() => setSelectedDoc(null)}
                    onEdit={() => openSelectedDocInInlineEdit(selectedDoc)}
                />
            )}
        </div>
    );
};

export default DocumentHub;
