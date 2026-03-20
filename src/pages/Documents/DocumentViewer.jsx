import React, { useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Printer, Download, Edit2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import styles from './Documents.module.css';

const DocumentViewer = ({ doc, type, onClose, onEdit, inline = false }) => {
    const { t, language } = useTranslation();
    const { isMultiCountryMode, defaultCurrency, vatEnabled, vatRate } = useAppStore();
    const printRef = useRef(null);
    const editBtnRef = useRef(null);

    if (!doc) return null;

    const isSupplierDoc = type === 'inquiry' || type === 'purchase' || type === 'purchaseReturn';
    const isCustomerDoc = type === 'quotation' || type === 'sales' || type === 'salesReturn';
    const displayCurrency = (isSupplierDoc || (!isMultiCountryMode && isCustomerDoc))
        ? defaultCurrency
        : (doc.currency || defaultCurrency);

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        let scvContent = "data:text/csv;charset=utf-8,\uFEFF";
        // Header
        scvContent += `Item,Unit Price,Quantity,Total\n`;
        // Rows
        doc.items.forEach(item => {
            const itemName = `"${item.p_id} - ${item.name || ''}"`.replace(/\n/g, " ");
            const price = item.unit_price || 0;
            const qty = item.qty || 0;
            const total = price * qty;
            scvContent += `${itemName},${price},${qty},${total}\n`;
        });

        const encodedUri = encodeURI(scvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${doc.doc_id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getPartyLabel = () => {
        if (type === 'inquiry' || type === 'purchase' || type === 'purchaseReturn') return t('docs.thSupplier');
        return t('docs.thCustomer');
    };

    const getPartyName = () => {
        return doc.supplier_name || doc.customer_name || '-';
    };

    const calcSubtotal = () => {
        if (!doc.items) return 0;
        return doc.items.reduce((sum, item) => sum + (item.qty * (item.unit_price || 0)), 0);
    };
    const formatAmount = (value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const subtotal = calcSubtotal();
    const vatAmount = vatEnabled ? subtotal * ((Number(vatRate) || 0) / 100) : 0;
    const total = subtotal + vatAmount;

    useEffect(() => {
        const focusEdit = () => editBtnRef.current?.focus();
        focusEdit();
        requestAnimationFrame(() => focusEdit());
        const t2 = setTimeout(focusEdit, 80);
        const t3 = setTimeout(focusEdit, 200);
        const t4 = setTimeout(focusEdit, 400);
        return () => {
            clearTimeout(t2);
            clearTimeout(t3);
            clearTimeout(t4);
        };
    }, []);

    useEffect(() => {
        if (inline) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
                return;
            }
            if (!onEdit) return;
            const target = e.target;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
            }
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [onEdit, inline, onClose]);

    useEffect(() => {
        if (!onEdit || inline) return undefined;
        const handleViewerSpaceToEdit = (e) => {
            const target = e.target;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                e.stopPropagation();
                onEdit();
            }
        };

        window.addEventListener('keydown', handleViewerSpaceToEdit, true);
        return () => window.removeEventListener('keydown', handleViewerSpaceToEdit, true);
    }, [onEdit, inline]);

    const content = (
        <div className={inline ? "" : styles.viewerModal} style={inline ? { width: '100%', maxHeight: 'none', borderRadius: 0 } : {}} onClick={e => e.stopPropagation()}>
            {/* Action Bar - Edit 排第一以便進入檢視時自動取得焦點，空白鍵直接進編輯 */}
            <div className={styles.viewerActions}>
                <div className="flex items-center gap-2">
                    <button className={styles.actionBtn} onClick={onEdit} ref={editBtnRef} autoFocus>
                        <Edit2 size={16} /> <span className="text-sm font-semibold">Edit</span>
                    </button>
                    <button className={styles.actionBtn} onClick={handlePrint} title="Print or Save as PDF">
                        <Printer size={16} /> <span className="text-sm font-semibold">Print / PDF</span>
                    </button>
                    <button className={styles.actionBtn} onClick={handleExportExcel}>
                        <Download size={16} /> <span className="text-sm font-semibold">Export Excel (CSV)</span>
                    </button>
                </div>
                {!inline && (
                    <button className={`${styles.actionBtn} ${styles.actionBtnClose}`} onClick={onClose}>
                        <X size={20} />
                    </button>
                )}
            </div>

            {/* Printable Area */}
            <div className={styles.viewerPaper} ref={printRef} style={inline ? { maxHeight: '600px', overflowY: 'auto' } : {}}>
                <div className={styles.viewerHeader}>
                    <div>
                        <h2 className={styles.viewerLogo}>ARUFA</h2>
                        <div className={styles.viewerType}>
                            {type === 'inquiry' ? t('docs.tabInquiry') :
                                type === 'purchase' ? t('docs.tabPurchase') :
                                    type === 'quotation' ? t('docs.tabQuotation') :
                                        type === 'sales' ? t('docs.tabSales') :
                                            type === 'salesReturn' ? t('docs.tabSalesReturn') :
                                                t('docs.tabPurchaseReturn')}
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={styles.viewerDocId}>{doc.doc_id}</div>
                        <div className="text-sm text-gray-500">{t('docs.thDate')}: {doc.date}</div>
                    </div>
                </div>

                <div className={styles.viewerDetails}>
                    <div className={styles.viewerParty}>
                        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">{getPartyLabel()}</div>
                        <div className="text-lg font-bold text-gray-800">{getPartyName()}</div>
                        <div className="text-sm text-gray-600 mt-1">{doc.currency} Trading</div>
                        <div className="text-sm text-gray-600 mt-1">開單人員：{doc.opener_emp_name || doc.opener_emp_id || '-'}</div>
                    </div>
                </div>

                <table className={styles.viewerTable}>
                    <thead>
                        <tr>
                            <th className="text-left">Item Description</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Unit Price</th>
                            <th className="text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {doc.items?.map((item, idx) => (
                            <tr key={idx}>
                                <td>
                                    <div className="font-bold text-gray-800">{item.p_id}</div>
                                    <div className="text-sm text-gray-500">{item.name}</div>
                                </td>
                                <td className="text-right">{item.qty}</td>
                                <td className="text-right">{item.unit_price ? `${displayCurrency} ${item.unit_price.toLocaleString()}` : '—'}</td>
                                <td className="text-right font-semibold">
                                    {item.unit_price ? `${displayCurrency} ${(item.qty * item.unit_price).toLocaleString()}` : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className={styles.viewerTotals}>
                    <div className="flex justify-between py-2 text-sm text-gray-600">
                        <span>未稅 Subtotal</span>
                        <span>{displayCurrency} {formatAmount(subtotal)}</span>
                    </div>
                    {vatEnabled && (
                        <div className="flex justify-between py-2 text-sm text-blue-600">
                            <span>VAT ({Number(vatRate || 0).toFixed(2)}%) (含稅)</span>
                            <span>{displayCurrency} {formatAmount(vatAmount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between py-3 text-xl font-bold text-gray-800 border-t border-gray-300 mt-2">
                        <span>{vatEnabled ? '含稅 Total' : '未稅 Total'}</span>
                        <span>{displayCurrency} {formatAmount(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    if (inline) return content;

    const modalJsx = (
        <div
            className={styles.viewerOverlay}
            onClick={onClose}
            onKeyDown={(e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    onClose?.();
                }
            }}
            role="dialog"
            aria-modal="true"
            tabIndex={0}
        >
            {content}
        </div>
    );
    return ReactDOM.createPortal(modalJsx, document.body);
};

export default DocumentViewer;
