import React from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './CountSheetCard.module.css';

const statusLabel = {
    draft: '草稿',
    in_progress: '進行中',
    submitted: '已提交',
};

const statusClass = {
    draft: styles.badgeDraft,
    in_progress: styles.badgeProgress,
    submitted: styles.badgeDone,
};

const CountSheetCard = ({ sheet, onOpen }) => (
    <button type="button" className={styles.card} onClick={() => onOpen(sheet.id)}>
        <div className={styles.row}>
            <div>
                <h3 className={styles.title}>{sheet.title}</h3>
                <p className={styles.meta}>
                    {sheet.warehouse} · {sheet.createdAt}
                </p>
            </div>
            <span className={`${styles.badge} ${statusClass[sheet.status] || ''}`}>
                {statusLabel[sheet.status] || sheet.status}
            </span>
        </div>
        <div className={styles.row} style={{ marginTop: '0.65rem' }}>
            <p className={styles.meta} style={{ margin: 0 }}>
                明細 {sheet.lines?.length ?? 0} 筆
            </p>
            <ChevronRight size={20} className={styles.chevron} aria-hidden />
        </div>
    </button>
);

export default CountSheetCard;
