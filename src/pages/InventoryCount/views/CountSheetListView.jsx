import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import CountSheetCard from '../components/CountSheetCard';
import styles from './CountSheetListView.module.css';

const CountSheetListView = ({ sheets, onOpenSheet, onCreateSheet }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [warehouse, setWarehouse] = useState('');

    const sorted = [...sheets].sort((a, b) => {
        const order = { in_progress: 0, draft: 1, submitted: 2 };
        const ao = order[a.status] ?? 9;
        const bo = order[b.status] ?? 9;
        if (ao !== bo) return ao - bo;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    const handleSubmitCreate = (e) => {
        e.preventDefault();
        onCreateSheet?.({ title: title.trim(), warehouse: warehouse.trim() });
        setTitle('');
        setWarehouse('');
        setModalOpen(false);
    };

    return (
        <div className={styles.list}>
            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => setModalOpen(true)}
                >
                    <Plus size={18} aria-hidden />
                    新增盤點單
                </button>
            </div>

            {sorted.length === 0 ? (
                <div className={styles.empty}>尚無盤點單，請按「新增盤點單」建立。</div>
            ) : (
                sorted.map((s) => <CountSheetCard key={s.id} sheet={s} onOpen={onOpenSheet} />)
            )}
            <div className={styles.hint}>
                <strong>說明：</strong>
                明細以 <strong>P-ID</strong> 連結產品資料庫；帳載數量為目前庫存，提交後會回寫庫存。掃碼／手動輸入可為 P-ID 或任一零件料號。
            </div>

            {modalOpen && (
                <div
                    className={styles.backdrop}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="new-sheet-title"
                    onMouseDown={(ev) => {
                        if (ev.target === ev.currentTarget) setModalOpen(false);
                    }}
                >
                    <form className={styles.modal} onSubmit={handleSubmitCreate}>
                        <h2 id="new-sheet-title">新增盤點單</h2>
                        <div className={styles.field}>
                            <label htmlFor="new-sheet-name">盤點名稱</label>
                            <input
                                id="new-sheet-name"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例如：2025 Q2 主倉盤點"
                                autoComplete="off"
                                autoFocus
                            />
                        </div>
                        <div className={styles.field}>
                            <label htmlFor="new-sheet-wh">倉別／區域</label>
                            <input
                                id="new-sheet-wh"
                                value={warehouse}
                                onChange={(e) => setWarehouse(e.target.value)}
                                placeholder="例如：主倉 A 區"
                                autoComplete="off"
                            />
                        </div>
                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.btnGhost}
                                onClick={() => setModalOpen(false)}
                            >
                                取消
                            </button>
                            <button type="submit" className={styles.btnPrimary}>
                                建立並開啟
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default CountSheetListView;
