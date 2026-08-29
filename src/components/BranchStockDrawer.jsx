import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getBranchStockColor, getTotalStock, groupStockByBranch } from '../utils/productStock';
import styles from './BranchStockDrawer.module.css';

const formatQty = (n) => Number(n || 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
});

/** 小型 Popup：顯示產品各分店／庫位庫存明細 */
const BranchStockDrawer = ({ open, onClose, item }) => {
    const branches = useAppStore((s) => s.branches || []);

    const stockDetails = item?.stock_details || [];
    const totalStock = useMemo(
        () => getTotalStock({ stock_details: stockDetails, stock: item?.stock }),
        [stockDetails, item?.stock],
    );

    const branchRows = useMemo(
        () => groupStockByBranch(stockDetails, branches),
        [stockDetails, branches],
    );

    useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [open, onClose]);

    if (!open || !item) return null;

    const partLabel = item.part_number || item.p_id || '—';

    return (
        <div className={styles.overlay} onClick={onClose} role="presentation">
            <div
                className={styles.popup}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="分店庫存"
            >
                <div className={styles.header}>
                    <div style={{ minWidth: 0 }}>
                        <div className={styles.title}>分店庫存</div>
                        <div className={styles.subtitle}>
                            <span className={styles.mono}>{partLabel}</span>
                            {item.name && (
                                <span style={{ display: 'block', marginTop: '0.1rem' }}>{item.name}</span>
                            )}
                        </div>
                    </div>
                    <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="關閉">
                        <X size={16} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.totalRow}>
                        <span>全店總計</span>
                        <span className={styles.totalValue}>{formatQty(totalStock)}</span>
                    </div>

                    {branchRows.length === 0 ? (
                        <div className={styles.empty}>尚無分店庫存資料</div>
                    ) : branchRows.map(({ branch, items, total }) => {
                        const color = getBranchStockColor(branch.branch_id);
                        const hasStock = total > 0;
                        return (
                            <div key={branch.branch_id} className={styles.branchBlock}>
                                <div className={styles.branchHead}>
                                    <span
                                        className={styles.branchName}
                                        style={{ color: hasStock ? color : `${color}99` }}
                                    >
                                        {branch.name || branch.branch_id}
                                    </span>
                                    <span
                                        className={styles.branchTotal}
                                        style={{ color: hasStock ? 'var(--text-primary)' : 'var(--text-muted)' }}
                                    >
                                        {formatQty(total)}
                                    </span>
                                </div>
                                {items.map((loc) => (
                                    <div
                                        key={`${branch.branch_id}-${loc.location_code}`}
                                        className={styles.locRow}
                                    >
                                        <span className={styles.locCode} style={{ color }}>
                                            {loc.location_code || '—'}
                                        </span>
                                        <span className={styles.locQty}>{formatQty(loc.qty)}</span>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default BranchStockDrawer;
