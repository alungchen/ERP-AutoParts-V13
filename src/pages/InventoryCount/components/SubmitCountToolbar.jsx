import React from 'react';
import { Send } from 'lucide-react';
import styles from './SubmitCountToolbar.module.css';

const SubmitCountToolbar = ({
    changedLines,
    totalLines,
    readOnly,
    onSubmit,
    submitDisabled,
}) => (
    <div className={styles.bar}>
        <div className={styles.summary}>
            共 <strong>{totalLines}</strong> 筆明細 · 與帳載差異{' '}
            <strong>{changedLines}</strong> 筆
        </div>
        <div className={styles.actions}>
            <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={readOnly || submitDisabled}
                onClick={onSubmit}
            >
                <Send size={18} aria-hidden />
                提交盤點結果
            </button>
        </div>
    </div>
);

export default SubmitCountToolbar;
