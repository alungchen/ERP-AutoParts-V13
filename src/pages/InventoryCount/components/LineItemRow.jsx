import React from 'react';
import QuantityStepper from './QuantityStepper';
import styles from './LineItemRow.module.css';

const LineItemRow = ({ line, systemQty, isActive, readOnly, onQtyChange }) => {
    const counted = line.countedQty ?? 0;
    const delta = counted - systemQty;
    const diffClass =
        delta === 0 ? styles.diffOk : styles.diffWarn;

    return (
        <div
            className={`${styles.row} ${isActive ? styles.rowActive : ''}`}
            data-line-id={line.lineId}
        >
            <div>
                <p className={styles.sku}>{line.sku}</p>
                <p className={styles.name}>{line.productName}</p>
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
