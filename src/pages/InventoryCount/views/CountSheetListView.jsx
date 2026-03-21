import React from 'react';
import CountSheetCard from '../components/CountSheetCard';
import styles from './CountSheetListView.module.css';

const CountSheetListView = ({ sheets, onOpenSheet }) => {
    const sorted = [...sheets].sort((a, b) => {
        const order = { in_progress: 0, draft: 1, submitted: 2 };
        const ao = order[a.status] ?? 9;
        const bo = order[b.status] ?? 9;
        if (ao !== bo) return ao - bo;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return (
        <div className={styles.list}>
            {sorted.length === 0 ? (
                <div className={styles.empty}>尚無盤點單</div>
            ) : (
                sorted.map((s) => <CountSheetCard key={s.id} sheet={s} onOpen={onOpenSheet} />)
            )}
            <div className={styles.hint}>
                <strong>說明：</strong>
                選擇一張盤點單後可檢視明細、以相機掃描條碼或手動輸入數量，最後提交盤點結果。目前為前端示範資料，可日後串接 API。
            </div>
        </div>
    );
};

export default CountSheetListView;
