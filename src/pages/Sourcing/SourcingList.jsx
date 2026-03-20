import React from 'react';
import { useTranslation } from '../../i18n';
import { useSourcingStore } from '../../store/useSourcingStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useAppStore } from '../../store/useAppStore';
import { Globe, Plane, ShieldCheck, ShoppingCart, Target, Plus, Search, FileText, Edit3, ChevronRight, Printer, Eye, Zap, ChevronDown, Download, Upload } from 'lucide-react';
import styles from './SourcingList.module.css';
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

const SourcingList = () => {
    const { t, language } = useTranslation();
    const { rates } = useSourcingStore();
    const { inquiries = [], statusColors = {}, bulkUpdateInquiries } = useDocumentStore();
    const { suppliers } = useSupplierStore();
    const { isMultiCountryMode, defaultCurrency, showImportExport } = useAppStore();
    const [searchFilters, setSearchFilters] = React.useState({
        docId: '',
        date: '',
        party: '',
        status: ''
    });
    const [selectedDoc, setSelectedDoc] = React.useState(null);
    const [isQuickPreview, setIsQuickPreview] = React.useState(false);
    const [previewIndex, setPreviewIndex] = React.useState(0);
    const [isEditingInline, setIsEditingInline] = React.useState(false);
    const sourcingFileRef = React.useRef(null);

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

    // Filter for international inquiries (those that have non-default currency or are explicitly marked in our future logic, 
    // but for now let's just show inquiries in this list to fulfill the UI request)
    const intlInquiries = inquiries.filter(inq => {
        const matchDocId = inq.doc_id.toLowerCase().includes(searchFilters.docId.toLowerCase());
        const matchDate = !searchFilters.date || inq.date.includes(searchFilters.date);
        const matchParty = (inq.supplier_name || '').toLowerCase().includes(searchFilters.party.toLowerCase());
        const matchStatus = !searchFilters.status || inq.status === searchFilters.status;

        return matchDocId && matchDate && matchParty && matchStatus;
    });

    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isQuickPreview || intlInquiries.length === 0) return;

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
    }, [isQuickPreview, intlInquiries]);

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
            <div className={styles.header} style={{ gap: '1rem', flexWrap: 'nowrap' }}>
                <div style={{ flex: 1 }}>
                    <h1 className={styles.title}>{t('sourcing.title')}</h1>
                    <p className={styles.subtitle}>{t('sourcing.subtitle')}</p>
                </div>

                {/* Center: Search Zone - Always Visible */}
                <div style={{ flex: 3.5, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        background: '#1e293b',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        <Search size={16} color="#60a5fa" style={{ opacity: 0.7 }} />
                        <input
                            placeholder="單號..."
                            value={searchFilters.docId}
                            onChange={e => setSearchFilters({ ...searchFilters, docId: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', width: '90px', outline: 'none' }}
                        />
                        <div style={{ width: '1px', height: '1.5rem', background: '#334155' }} />
                        <input
                            placeholder="日期 (YYYY-MM-DD)"
                            value={searchFilters.date}
                            onChange={e => setSearchFilters({ ...searchFilters, date: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', width: '110px', outline: 'none' }}
                        />
                        <div style={{ width: '1px', height: '1.5rem', background: '#334155' }} />
                        <input
                            placeholder="搜尋供應商..."
                            value={searchFilters.party}
                            onChange={e => setSearchFilters({ ...searchFilters, party: e.target.value })}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '0.85rem', width: '140px', outline: 'none' }}
                        />
                        <div style={{ width: '1px', height: '1.5rem', background: '#334155' }} />
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <select
                                value={searchFilters.status}
                                onChange={e => setSearchFilters({ ...searchFilters, status: e.target.value })}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'white',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    cursor: 'pointer',
                                    width: '100px',
                                    appearance: 'none',
                                    paddingRight: '1.25rem'
                                }}
                            >
                                <option value="" style={{ background: '#1e293b' }}>所有狀態</option>
                                <option value="pending" style={{ background: '#1e293b' }}>待處理</option>
                                <option value="replied" style={{ background: '#1e293b' }}>已回覆</option>
                                <option value="sent" style={{ background: '#1e293b' }}>已送出</option>
                                <option value="accepted" style={{ background: '#1e293b' }}>已接受</option>
                                <option value="received" style={{ background: '#1e293b' }}>已入庫</option>
                            </select>
                            <ChevronDown size={12} color="#60a5fa" style={{ position: 'absolute', right: 0, pointerEvents: 'none', opacity: 0.8 }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 700, marginLeft: '0.5rem', minWidth: '40px', textAlign: 'right' }}>
                            {intlInquiries.length} 筆
                        </span>
                    </div>
                </div>

                <div className="flex gap-4 items-center" style={{ flex: 2, justifyContent: 'flex-end' }}>
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
                            className={styles.poButton}
                            style={{ backgroundColor: isQuickPreview ? '#f59e0b' : '#334155' }}
                            onClick={() => { setIsQuickPreview(!isQuickPreview); setPreviewIndex(0); setIsEditingInline(false); }}
                        >
                            <Zap size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* International Inquiry View */}
            <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex-1" />
                    <div className="flex gap-2">
                        {showImportExport && (
                            <>
                                <input type="file" ref={sourcingFileRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />
                                <button className={styles.poButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={() => sourcingFileRef.current?.click()}>
                                    <Download size={16} /> {t('pim.import')}
                                </button>
                                <button className={styles.poButton} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={handleExport}>
                                    <Upload size={16} /> {t('pim.export')}
                                </button>
                            </>
                        )}
                        <button className={styles.poButton} style={{ background: '#3b82f6' }} onClick={() => openIntlEditor()}>
                            <Plus size={16} /> 建立國外詢價單
                        </button>
                    </div>
                </div>

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
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(isQuickPreview ? [intlInquiries[previewIndex]].filter(Boolean) : intlInquiries).map(inq => (
                                <tr key={inq.doc_id} style={isQuickPreview ? { background: '#3b82f611' } : {}}>
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
                                    <td className="text-sm text-muted">
                                        {inq.opener_emp_name || inq.opener_emp_id || '-'}
                                    </td>
                                    <td>
                                        <span className={styles.statusBadge} style={{ color: getStatusColor(inq.status), background: getStatusColor(inq.status) + '22', padding: '3px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>
                                            {STATUS_LABEL[inq.status]?.[language === 'zh' ? 'zh' : 'en'] || inq.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex gap-2 justify-end">
                                            <button className={styles.editRowBtn} onClick={() => openIntlEditor(inq.doc_id)} title={t('docs.inspect')}>
                                                <Eye size={14} /> {t('docs.inspect')}
                                            </button>
                                            <button className={styles.viewRowBtn} onClick={() => setSelectedDoc(inq)}>
                                                <Printer size={14} /> {t('docs.view')}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {intlInquiries.length === 0 && (
                                <tr>
                                    <td colSpan={8} className="p-12 text-center text-muted">{t('docs.empty')}</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                    {isQuickPreview && intlInquiries.length > 0 && (
                        <div style={{ padding: '0.5rem 1rem', background: '#0f172a', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8', borderTop: '1px solid #334155', width: '100%' }}>
                            <span>使用 <span style={{ color: '#60a5fa', fontWeight: 800 }}>↑ / ↓</span> 鍵快速切換單據</span>
                            <div style={{ background: '#334155', padding: '2px 8px', borderRadius: '4px', color: 'white' }}>
                                {previewIndex + 1} / {intlInquiries.length}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isQuickPreview && intlInquiries[previewIndex] && (
                <div style={{ marginTop: '1rem', borderRadius: '8px', border: '1px solid #334155' }}>
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
