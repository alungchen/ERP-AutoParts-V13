import React from 'react';
import QuantityStepper from './QuantityStepper';
import styles from './LineItemRow.module.css';

const LineItemRow = ({ line, systemQty, isActive, readOnly, onQtyChange }) => {
    const counted = line.countedQty ?? 0;
    const delta = counted - systemQty;
    const diffClass = delta === 0 ? styles.diffOk : styles.diffWarn;

    return (
        <div
            className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
            data-line-id={line.lineId}
        >
            <div>
                <p className={styles.sku}>{line.sku}</p>
                <dl className={styles.metaList}>
                    <div className={`${styles.metaRow} ${styles.metaL1}`}>
                        <dt>車型</dt>
                        <dd>{line.carModelDisplay ?? '—'}</dd>
                    </div>
                    <div className={`${styles.metaRow} ${styles.metaR1}`}>
                        <dt>年分</dt>
                        <dd>{line.yearDisplay ?? '—'}</dd>
                    </div>
                    <div className={`${styles.metaRow} ${styles.metaL2}`}>
                        <dt>名稱</dt>
                        <dd>{line.productName ?? '—'}</dd>
                    </div>
                    <div className={`${styles.metaRow} ${styles.metaR2}`}>
                        <dt>品牌</dt>
                        <dd>{line.brandDisplay ?? '—'}</dd>
                    </div>
                    <div className={`${styles.metaRow} ${styles.metaL3}`}>
                        <dt>規格</dt>
                        <dd>{line.specDisplay ?? '—'}</dd>
                    </div>
                </dl>
                <p className={styles.book}>
                    帳上：{systemQty}
                    {' · '}
                    差異：
                    <span className={`${styles.diff} ${diffClass}`}>
                        {delta > 0 ? `+${delta}` : delta}
                    </span>
                </p>
            </div>
            <div className={styles.actions}>
                <QuantityStepper
                    value={counted}
                    onChange={onQtyChange}
                    disabled={readOnly}
                />
            </div>
        </div>
    );
};

export default LineItemRow;
