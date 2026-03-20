import React, { useMemo } from 'react';
import { History, X } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { useDocumentStore } from '../store/useDocumentStore';
import { collectCustomerSalesHistory, collectSupplierPurchaseHistory } from '../utils/buildProductTransactionHistory';
import ProductPriceHistoryBody from './ProductPriceHistoryBody';
import plStyles from '../pages/PIM/ProductList.module.css';

const getPrimaryPartNumber = (p) =>
    p?.part_number || p?.part_numbers?.[0]?.part_number || '';

/**
 * 製單：搜尋／表頭區塊下方滑出之沿革抽屜（左客戶前價、右廠商前價）
 */
const DocProductHistoryDrawer = ({ open, onClose, focusPId }) => {
    const { products } = useProductStore();
    const {
        salesOrders = [],
        quotations = [],
        purchaseOrders = [],
        inquiries = []
    } = useDocumentStore();

    const contextProduct = useMemo(() => {
        if (!focusPId) return null;
        return products.find((p) => p.p_id === focusPId) || null;
    }, [focusPId, products]);

    const customerHistoryRows = useMemo(() => {
        if (!contextProduct) return [];
        return collectCustomerSalesHistory(contextProduct, salesOrders, quotations);
    }, [contextProduct, salesOrders, quotations]);

    const supplierHistoryRows = useMemo(() => {
        if (!contextProduct) return [];
        return collectSupplierPurchaseHistory(contextProduct, purchaseOrders, inquiries);
    }, [contextProduct, purchaseOrders, inquiries]);

    return (
        <div
            className={`${plStyles.historyDrawerShell} ${open ? plStyles.historyDrawerShellOpen : ''}`}
            aria-hidden={!open}
        >
            <div className={plStyles.historyDrawerShellInner}>
                <div className={plStyles.historyDrawer}>
                    <div className={plStyles.historyDrawerHeader}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <History size={18} style={{ marginTop: '2px', opacity: 0.85 }} aria-hidden />
                            <div>
                                <div className={plStyles.historyDrawerTitle}>
                                    {contextProduct
                                        ? `客戶前價 · 廠商前價沿革｜${contextProduct.name || '未命名'}（${getPrimaryPartNumber(contextProduct) || contextProduct.p_id || '—'}）`
                                        : '客戶前價 · 廠商前價沿革'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                    左欄：客戶前價（銷貨／報價）；右欄：廠商前價（進貨／詢價）。
                                    {(!focusPId || !contextProduct) && (
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> 目前列無有效 p_id。</span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-tertiary)',
                                color: 'var(--text-secondary)',
                                padding: '0.35rem 0.6rem',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                            }}
                        >
                            <X size={14} /> 收合（F8）
                        </button>
                    </div>
                    <ProductPriceHistoryBody
                        contextProduct={contextProduct}
                        customerHistoryRows={customerHistoryRows}
                        supplierHistoryRows={supplierHistoryRows}
                    />
                </div>
            </div>
        </div>
    );
};

export default DocProductHistoryDrawer;
