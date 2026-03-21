import React from 'react';
import { useTranslation } from '../../i18n';
import { useSourcingStore } from '../../store/useSourcingStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';
import { canEditDocType } from '../../utils/permissions';
import { useSearchFormKeyboardNav } from '../../hooks/useSearchFormKeyboardNav';
import { Globe, Plus, Search, FileText, Printer, Eye, Zap, RotateCcw, Download, Upload } from 'lucide-react';
import styles from './SourcingList.module.css';
import docStyles from '../Documents/Documents.module.css';
import DocumentViewer from '../Documents/DocumentViewer';
import DocumentDarkPreview from '../Documents/DocumentDarkPreview';
import CountryFlag from '../../components/CountryFlag';

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

const DEFAULT_SEARCH_FILTERS = { docId: '', date: '', status: '', party: '', opener: '' };
const SOURCING_SEARCH_STATE_KEY = 'erp-sourcing-search-state';

const isTypingTarget = (target) => {
    if (!target) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const SourcingList = () => {
    const { t, language } = useTranslation();
    const { rates } = useSourcingStore();
    const { inquiries = [], statusColors = {}, bulkUpdateInquiries } = useDocumentStore();
    const { suppliers } = useSupplierStore();
    const { employees } = useEmployeeStore();
    const { showImportExport, enableLoginSystem, enablePermissionRole, currentUserEmpId } = useAppStore();
    const [searchFilters, setSearchFilters] = React.useState(() => {
        try {
            const raw = localStorage.getItem(SOURCING_SEARCH_STATE_KEY);
            if (!raw) return DEFAULT_SEARCH_FILTERS;
            const saved = JSON.parse(raw);
            return { ...DEFAULT_SEARCH_FILTERS, ...(saved?.searchFilters || {}) };
        } catch {
            return DEFAULT_SEARCH_FILTERS;
        }
    });
    const [appliedSearchFilters, setAppliedSearchFilters] = React.useState(() => {
        try {
            const raw = localStorage.getItem(SOURCING_SEARCH_STATE_KEY);
            if (!raw) return DEFAULT_SEARCH_FILTERS;
            const saved = JSON.parse(raw);
            return { ...DEFAULT_SEARCH_FILTERS, ...(saved?.appliedSearchFilters || saved?.searchFilters || {}) };
        } catch {
            return DEFAULT_SEARCH_FILTERS;
        }
    });
    const [selectedDoc, setSelectedDoc] = React.useState(null);
    const [isQuickPreview, setIsQuickPreview] = React.useState(false);
    const [previewIndex, setPreviewIndex] = React.useState(0);
    const [isEditingInline, setIsEditingInline] = React.useState(false);
    const sourcingFileRef = React.useRef(null);
    const searchFormRef = React.useRef(null);
    const searchBtnRef = React.useRef(null);
    const searchResetBtnRef = React.useRef(null);
    const docListKeyboardRef = React.useRef(null);
    const addDocBtnRef = React.useRef(null);
    const [activeDocIndex, setActiveDocIndex] = React.useState(0);

    React.useEffect(() => {
        localStorage.setItem(SOURCING_SEARCH_STATE_KEY, JSON.stringify({ searchFilters, appliedSearchFilters }));
    }, [searchFilters, appliedSearchFilters]);

    const getOpenerName = (doc) => {
        if (doc.opener_emp_name) return `${doc.opener_emp_name} (${doc.opener_emp_id || '-'})`;
        if (doc.opener_emp_id) {
            const emp = employees.find((e) => e.emp_id === doc.opener_emp_id);
            if (emp) return `${emp.name} (${emp.emp_id})`;
            return doc.opener_emp_id;
        }
        return '-';
    };

    const handleSearchSubmit = (e) => {
        if (e) e.preventDefault();
        setAppliedSearchFilters(searchFilters);
    };

    const handleClearSearch = () => {
        setSearchFilters(DEFAULT_SEARCH_FILTERS);
        setAppliedSearchFilters(DEFAULT_SEARCH_FILTERS);
        localStorage.removeItem(SOURCING_SEARCH_STATE_KEY);
    };

    useSearchFormKeyboardNav(searchFormRef, searchBtnRef, searchResetBtnRef);

    const currentUser = employees.find((e) => e.emp_id === currentUserEmpId);
    const canEditSourcing = canEditDocType({
        enableLoginSystem,
        enablePermissionRole,
        currentUser,
        docType: 'inquiry',
    });

    const appliedSearchKey = React.useMemo(() => JSON.stringify(appliedSearchFilters), [appliedSearchFilters]);

    const getStatusColor = (status) => {
        const map = { success: '#34d399', warning: '#fbbf24', danger: '#ef4444', accent: '#60a5fa' };
        return map[statusColors[status]] || '#94a3b8';
    };

    const calcTotal = (doc) => {
        if (!doc.items) return 0;
        return doc.items.reduce((sum, item) => sum + (item.qty * (item.unit_price || 0)), 0);
    };

    // Helper to calculate landed cost in TWD per unit
    // Formula: (Price * ExchangeRate) * (1 + Tariff) + (TotalFreight / MOQ)

    const openIntlEditor = (docId = null) => {
        let url = `/document-editor?type=inquiry&mode=intl`;
        if (docId) url += `&id=${docId}`;
        window.open(url, '_blank');
    };

    const intlInquiries = React.useMemo(() => inquiries.filter((inq) => {
        if (appliedSearchFilters.docId && !inq.doc_id.toLowerCase().includes(appliedSearchFilters.docId.toLowerCase())) return false;
        if (appliedSearchFilters.date && !inq.date.includes(appliedSearchFilters.date)) return false;
        if (appliedSearchFilters.status && inq.status !== appliedSearchFilters.status) return false;
        if (appliedSearchFilters.party) {
            const name = (inq.supplier_name || '').toLowerCase();
            if (!name.includes(appliedSearchFilters.party.toLowerCase())) return false;
        }
        if (appliedSearchFilters.opener) {
            const opener = getOpenerName(inq).toLowerCase();
            if (!opener.includes(appliedSearchFilters.opener.toLowerCase())) return false;
        }
        return true;
    }), [inquiries, appliedSearchFilters, employees]);

    React.useEffect(() => {
        if (isQuickPreview) return;
        setActiveDocIndex(0);
    }, [appliedSearchKey, isQuickPreview]);

    React.useEffect(() => {
        setActiveDocIndex((i) => {
            if (intlInquiries.length === 0) return 0;
            return Math.min(i, intlInquiries.length - 1);
        });
    }, [intlInquiries.length]);

    const handleDocListKeyDown = (e) => {
        if (isQuickPreview) return;
        if (e.key === 'ArrowDown') {
            if (intlInquiries.length === 0) return;
            e.preventDefault();
            if (activeDocIndex === intlInquiries.length - 1) {
                addDocBtnRef.current?.focus();
                return;
            }
            setActiveDocIndex((prev) => Math.min(prev + 1, intlInquiries.length - 1));
        } else if (e.key === 'ArrowUp') {
            if (intlInquiries.length === 0) return;
            e.preventDefault();
            setActiveDocIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
            if (intlInquiries.length === 0) return;
            e.preventDefault();
            e.stopPropagation();
            const currentDoc = intlInquiries[activeDocIndex];
            if (currentDoc) openIntlEditor(currentDoc.doc_id);
        }
    };

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isQuickPreview || intlInquiries.length === 0 || isEditingInline) return;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setPreviewIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setPreviewIndex(prev => Math.min(intlInquiries.length - 1, prev + 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isQuickPreview, intlInquiries, isEditingInline]);

    React.useEffect(() => {
        if (isQuickPreview || selectedDoc || !docListKeyboardRef.current) return;
        const focusList = () => docListKeyboardRef.current?.focus();
        focusList();
        const t = setTimeout(focusList, 80);
        return () => clearTimeout(t);
    }, [isQuickPreview, selectedDoc, intlInquiries.length]);

    React.useEffect(() => {
        const handleGlobalDocFlowKeyDown = (e) => {
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

            if (e.target.closest('[data-search-form]')) return;
            if (isTypingTarget(e.target)) return;

            if (!selectedDoc && !isQuickPreview && intlInquiries.length > 0 && (e.key === ' ' || e.code === 'Space' || e.key === 'Enter')) {
                if (e.target === addDocBtnRef.current) return;
                e.preventDefault();
                e.stopPropagation();
                const currentDoc = intlInquiries[activeDocIndex];
                if (currentDoc) openIntlEditor(currentDoc.doc_id);
                return;
            }

            if (selectedDoc && !isQuickPreview) {
                if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    const tid = selectedDoc.doc_id;
                    setSelectedDoc(null);
                    openIntlEditor(tid);
                }
                return;
            }

            if (isQuickPreview) return;

            if (e.key === 'ArrowDown') {
                if (intlInquiries.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                if (activeDocIndex === intlInquiries.length - 1) {
                    addDocBtnRef.current?.focus();
                } else {
                    setActiveDocIndex((prev) => Math.min(prev + 1, intlInquiries.length - 1));
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                if (intlInquiries.length === 0) return;
                e.preventDefault();
                e.stopPropagation();
                if (e.target === addDocBtnRef.current) {
                    setActiveDocIndex(intlInquiries.length - 1);
                    docListKeyboardRef.current?.focus();
                } else {
                    setActiveDocIndex((prev) => Math.max(prev - 1, 0));
                }
                return;
            }

            if (e.key === ' ' || e.code === 'Space' || e.key === 'Enter') {
                if (intlInquiries.length === 0) return;
                if (e.target === addDocBtnRef.current) return;
                e.preventDefault();
                e.stopPropagation();
                const currentDoc = intlInquiries[activeDocIndex];
                if (currentDoc) openIntlEditor(currentDoc.doc_id);
            }
        };

        window.addEventListener('keydown', handleGlobalDocFlowKeyDown, true);
        return () => window.removeEventListener('keydown', handleGlobalDocFlowKeyDown, true);
    }, [selectedDoc, isQuickPreview, intlInquiries, activeDocIndex]);

    const handleExport = async () => {
        try {
            const headers = ['Doc ID', 'Date', 'Supplier', 'Currency', 'Total', 'Status'];
            const csvRows = [headers.join(',')];
            intlInquiries.forEach(inq => {
                const sName = (inq.supplier_name || '').replace(/"/g, '""');
                csvRows.push([inq.doc_id, inq.date, `"${sName}"`, inq.currency || 'USD', calcTotal(inq), inq.status].join(','));
            });
            const csvContent = "\uFEFF" + csvRows.join('\n');
            const fileName = `sourcing_export_${new Date().toISOString().slice(0, 10)}.csv`;

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(csvContent);
                    await writable.close();
                    alert("匯出成功！檔案已存入指定位置。");
                } catch (pickerErr) {
                    if (pickerErr.name === 'AbortError') return;
                    throw pickerErr;
                }
            } else {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                alert("匯出成功！檔案已存入您的下載資料夾。");
            }
        } catch (err) {
            console.error("Export failed:", err);
            alert("匯出發生錯誤。");
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = text.split('\n');
                if (rows.length < 2) return;

                const dataRows = rows.slice(1);
                const updates = [];

                dataRows.forEach(row => {
                    const trimmedRow = row.trim();
                    if (!trimmedRow) return;

                    const parts = trimmedRow.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                    if (parts.length >= 6) {
                        const [doc_id, date, supplier_name, currency, total, status] = parts.map(p =>
                            p.replace(/^"|"$/g, '').replace(/""/g, '"').trim()
                        );

                        const existing = inquiries.find(d => d.doc_id === doc_id);
                        if (existing) {
                            updates.push({
                                ...existing,
                                date: date || existing.date,
                                supplier_name: supplier_name || existing.supplier_name,
                                currency: currency || existing.currency,
                                status: status || existing.status
                            });
                        }
                    }
                });

                if (updates.length > 0) {
                    bulkUpdateInquiries(updates);
                    alert(`匯入完成！成功處理 ${updates.length} 筆採購詢價單。`);
                }
            } catch (err) {
                console.error("Import error:", err);
                alert("解析檔案時發生錯誤。");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className={styles.container}>
            <div className={styles.sourcingTop}>
                <div className={styles.header} style={{ alignItems: 'center', minHeight: '64px', marginBottom: 0 }}>
                    <div style={{ flex: 1 }}>
                        <h1 className={styles.title}>{t('sourcing.title')}</h1>
                        <p className={styles.subtitle}>{t('sourcing.subtitle')}</p>
                    </div>
                    <div className="flex gap-4 items-center" style={{ flex: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <div className={styles.ratesPanel}>
                            <div className="flex items-center gap-2 mr-2 text-muted">
                                <Globe size={18} />
                            </div>
                            {Object.entries(rates).filter(([cur]) => cur !== 'TWD').map(([currency, rate]) => (
                                <div key={currency} className={styles.rateCard}>
                                    <span className={styles.rateLabel}>{currency}</span>
                                    <span className={styles.rateValue}>{rate.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                className={styles.poButton}
                                style={{ backgroundColor: isQuickPreview ? '#f59e0b' : 'var(--bg-tertiary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                                onClick={() => { setIsQuickPreview(!isQuickPreview); setPreviewIndex(0); setIsEditingInline(false); }}
                                title="快速預覽"
                            >
                                <Zap size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '1rem' }}>
                    <form ref={searchFormRef} data-search-form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                        <button ref={searchResetBtnRef} type="button" data-search-reset="true" className={docStyles.searchResetBtn} onClick={handleClearSearch} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '36px', transition: '0.2s' }} title="重設全部條件">
                            <RotateCcw size={16} />
                        </button>
                        <div className={docStyles.searchField} data-search-field data-search-field-index="0" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px', flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>單據號碼</label>
                            <input
                                type="text"
                                placeholder="單號"
                                value={searchFilters.docId}
                                onChange={(e) => setSearchFilters({ ...searchFilters, docId: e.target.value })}
                                className={docStyles.searchInput}
                                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div className={docStyles.searchField} data-search-field data-search-field-index="1" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '140px', flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>日期</label>
                            <input
                                type="text"
                                placeholder="YYYY-MM-DD"
                                value={searchFilters.date}
                                onChange={(e) => setSearchFilters({ ...searchFilters, date: e.target.value })}
                                className={docStyles.searchInput}
                                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div className={docStyles.searchField} data-search-field data-search-field-index="2" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '170px', flex: 1.2 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>交易對象</label>
                            <input
                                type="text"
                                placeholder="供應商"
                                value={searchFilters.party}
                                onChange={(e) => setSearchFilters({ ...searchFilters, party: e.target.value })}
                                className={docStyles.searchInput}
                                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div className={docStyles.searchField} data-search-field data-search-field-index="3" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '130px', flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>狀態</label>
                            <select
                                value={searchFilters.status}
                                onChange={(e) => setSearchFilters({ ...searchFilters, status: e.target.value })}
                                className={docStyles.searchInput}
                                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                            >
                                <option value="">所有狀態</option>
                                <option value="pending">待處理</option>
                                <option value="replied">已回覆</option>
                                <option value="sent">已送出</option>
                                <option value="accepted">已接受</option>
                                <option value="received">已入庫</option>
                                <option value="in_transit">運輸中</option>
                                <option value="shipped">已出貨</option>
                                <option value="pending_payment">待付款</option>
                                <option value="cancelled">已取消</option>
                            </select>
                        </div>
                        <div className={docStyles.searchField} data-search-field data-search-field-index="4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '150px', flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>開單人員</label>
                            <input
                                type="text"
                                placeholder="姓名 / 員編"
                                value={searchFilters.opener}
                                onChange={(e) => setSearchFilters({ ...searchFilters, opener: e.target.value })}
                                className={docStyles.searchInput}
                                style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                            <button ref={searchBtnRef} type="submit" data-search-query className={docStyles.searchQueryBtn} style={{ background: 'var(--accent-primary)', color: 'white', padding: '0 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none', height: '36px', whiteSpace: 'nowrap' }}>
                                <Search size={16} /> 查詢
                            </button>
                        </div>
                        <div style={{ minWidth: '70px', textAlign: 'right', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700, paddingBottom: '6px' }}>
                            {intlInquiries.length} 筆
                        </div>
                    </form>
                </div>
            </div>

            {/* 單據列表：操作方式比照製單系統；新增單據於表格最末列 */}
            <div className={styles.sourcingListMain} style={isQuickPreview ? { flex: '0 0 auto' } : undefined}>
                <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                    <div className="flex-1" />
                    <div className="flex gap-2">
                        {showImportExport && (
                            <>
                                <input type="file" ref={sourcingFileRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />
                                <button type="button" className={styles.poButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={() => sourcingFileRef.current?.click()}>
                                    <Download size={16} /> {t('pim.import')}
                                </button>
                                <button type="button" className={styles.poButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={handleExport}>
                                    <Upload size={16} /> {t('pim.export')}
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {!isQuickPreview ? (
                    <div className={docStyles.docHubMain}>
                        <div
                            className={docStyles.card}
                            ref={docListKeyboardRef}
                            tabIndex={0}
                            onKeyDown={handleDocListKeyDown}
                        >
                            <div className={`${docStyles.docTableScroll} custom-scrollbar`}>
                                <table className={docStyles.table}>
                                    <thead>
                                        <tr>
                                            <th style={{ width: '140px' }}>{t('docs.thDocId')}</th>
                                            <th style={{ width: '120px' }}>{t('docs.thDate')}</th>
                                            <th>{t('docs.thSupplier')}</th>
                                            <th style={{ width: '100px' }}>{t('docs.thItems')}</th>
                                            <th style={{ width: '150px' }}>{t('docs.thTotal')}</th>
                                            <th style={{ width: '180px' }}>{t('docs.thCreator')}</th>
                                            <th style={{ width: '120px' }}>{t('docs.thStatus')}</th>
                                            <th style={{ width: '220px' }} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {intlInquiries.map((inq, idx) => (
                                            <tr
                                                key={inq.doc_id}
                                                data-sourcing-row-idx={idx}
                                                style={activeDocIndex === idx ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}
                                                onClick={() => {
                                                    setActiveDocIndex(idx);
                                                    docListKeyboardRef.current?.focus();
                                                }}
                                                onDoubleClick={(e) => {
                                                    e.preventDefault();
                                                    openIntlEditor(inq.doc_id);
                                                }}
                                            >
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={16} className="text-muted" />
                                                        <span className="font-mono font-semibold text-xs">{inq.doc_id}</span>
                                                    </div>
                                                </td>
                                                <td className="text-sm text-muted">{inq.date}</td>
                                                <td className="font-semibold">
                                                    <div className="flex items-center gap-2">
                                                        {(() => {
                                                            const sup = suppliers.find(s => s.sup_id === inq.supplier_id);
                                                            return sup ? <CountryFlag country={sup.country} size={16} /> : null;
                                                        })()}
                                                        <span>{inq.supplier_name}</span>
                                                    </div>
                                                </td>
                                                <td className="text-sm text-muted">{inq.items?.length || 0} {t('docs.items')}</td>
                                                <td>
                                                    <span className="font-mono font-semibold text-sm">
                                                        {inq.currency || 'USD'} {calcTotal(inq).toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="text-sm text-muted">{getOpenerName(inq)}</td>
                                                <td>
                                                    <span className={docStyles.statusBadge} style={{ color: getStatusColor(inq.status), background: `${getStatusColor(inq.status)}22` }}>
                                                        {STATUS_LABEL[inq.status]?.[language === 'zh' ? 'zh' : 'en'] || inq.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button type="button" tabIndex={-1} className={docStyles.editRowBtn} onClick={(e) => { e.stopPropagation(); openIntlEditor(inq.doc_id); }} onDoubleClick={(e) => e.stopPropagation()} title={t('docs.inspect')}>
                                                            <Eye size={14} /> {t('docs.inspect')}
                                                        </button>
                                                        <button type="button" tabIndex={-1} className={docStyles.viewBtn} onClick={(e) => { e.stopPropagation(); setSelectedDoc(inq); }} onDoubleClick={(e) => e.stopPropagation()}>
                                                            <Printer size={14} /> {t('docs.view')}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {intlInquiries.length === 0 && (
                                            <tr>
                                                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                                    {inquiries.length === 0 ? t('docs.empty') : '找不到符合條件的單據'}
                                                </td>
                                            </tr>
                                        )}
                                        <tr>
                                            <td
                                                colSpan={8}
                                                style={{
                                                    padding: '0.75rem 1.25rem',
                                                    background: 'var(--bg-tertiary)',
                                                    borderTop: '1px solid var(--border-color)',
                                                    verticalAlign: 'middle',
                                                }}
                                            >
                                                <button
                                                    ref={addDocBtnRef}
                                                    type="button"
                                                    className={docStyles.addDocBtn}
                                                    onClick={() => canEditSourcing && openIntlEditor()}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'ArrowUp' && intlInquiries.length > 0) {
                                                            e.preventDefault();
                                                            setActiveDocIndex(intlInquiries.length - 1);
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
                                                        cursor: canEditSourcing ? 'pointer' : 'not-allowed',
                                                        opacity: canEditSourcing ? 1 : 0.6,
                                                    }}
                                                    disabled={!canEditSourcing}
                                                    title="新增國外詢價單"
                                                >
                                                    <Plus size={18} strokeWidth={3} />
                                                    新增單據
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={styles.sourcingCard} style={{ background: 'var(--bg-secondary)' }}>
                        <table className={styles.quoteTable}>
                            <thead>
                                <tr>
                                    <th>{t('docs.thDocId')}</th>
                                    <th>{t('docs.thDate')}</th>
                                    <th>{t('docs.thSupplier')}</th>
                                    <th>{t('docs.thItems')}</th>
                                    <th>{t('docs.thTotal')}</th>
                                    <th>{t('docs.thCreator')}</th>
                                    <th>{t('docs.thStatus')}</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {[intlInquiries[previewIndex]].filter(Boolean).map((inq) => (
                                    <tr key={inq.doc_id} style={{ background: '#3b82f611' }}>
                                        <td style={{ width: '140px' }}>
                                            <div className="flex items-center gap-2">
                                                <FileText size={16} className="text-muted" />
                                                <span className="font-mono font-semibold text-xs tracking-tighter">{inq.doc_id}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm text-muted">{inq.date}</td>
                                        <td>
                                            <div className="flex items-center gap-2">
                                                {(() => {
                                                    const sup = suppliers.find(s => s.sup_id === inq.supplier_id);
                                                    return sup ? <CountryFlag country={sup.country} size={16} /> : null;
                                                })()}
                                                <span className="font-semibold">{inq.supplier_name}</span>
                                            </div>
                                        </td>
                                        <td className="text-sm text-muted">{inq.items?.length || 0} {t('docs.items')}</td>
                                        <td>
                                            <span className="font-mono font-semibold text-sm">
                                                {inq.currency || 'USD'} {calcTotal(inq).toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="text-sm text-muted">{getOpenerName(inq)}</td>
                                        <td>
                                            <span className={styles.statusBadge} style={{ color: getStatusColor(inq.status), background: getStatusColor(inq.status) + '22', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                                {STATUS_LABEL[inq.status]?.[language === 'zh' ? 'zh' : 'en'] || inq.status}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex gap-2 justify-end">
                                                <button type="button" className={styles.editRowBtn} onClick={() => openIntlEditor(inq.doc_id)} title={t('docs.inspect')}>
                                                    <Eye size={14} /> {t('docs.inspect')}
                                                </button>
                                                <button type="button" className={styles.viewRowBtn} onClick={() => setSelectedDoc(inq)}>
                                                    <Printer size={14} /> {t('docs.view')}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {intlInquiries.length > 0 && (
                            <div style={{ padding: '0.5rem 1rem', background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid #334155', width: '100%' }}>
                                <span>使用 <span style={{ color: '#60a5fa', fontWeight: 800 }}>↑ / ↓</span> 鍵快速切換單據</span>
                                <div style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px', color: 'white' }}>
                                    {previewIndex + 1} / {intlInquiries.length}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {isQuickPreview && intlInquiries[previewIndex] && (
                <div className={styles.sourcingPreviewPanel}>
                    <DocumentDarkPreview
                        doc={intlInquiries[previewIndex]}
                        type="inquiry"
                        inline={true}
                        isEditing={isEditingInline}
                        onEdit={() => setIsEditingInline(true)}
                        onSave={() => setIsEditingInline(false)}
                        onClose={() => { setIsQuickPreview(false); setIsEditingInline(false); }}
                    />
                </div>
            )}

            {selectedDoc && !isQuickPreview && (
                <DocumentViewer
                    doc={selectedDoc}
                    type="inquiry"
                    onClose={() => setSelectedDoc(null)}
                    onEdit={() => {
                        const tid = selectedDoc.doc_id;
                        setSelectedDoc(null);
                        openIntlEditor(tid);
                    }}
                />
            )}
        </div>
    );
};

export default SourcingList;
