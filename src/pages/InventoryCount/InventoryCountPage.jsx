import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useInventoryCountStore } from '../../store/useInventoryCountStore';
import CountSheetListView from './views/CountSheetListView';
import CountSheetDetailView from './views/CountSheetDetailView';
import ScanSessionView from './views/ScanSessionView';
import styles from './InventoryCountPage.module.css';

const InventoryCountPage = () => {
    const sheets = useInventoryCountStore((s) => s.sheets);
    const setLineQty = useInventoryCountStore((s) => s.setLineQty);
    const bumpLineQty = useInventoryCountStore((s) => s.bumpLineQty);
    const matchScan = useInventoryCountStore((s) => s.matchScan);
    const submitSheet = useInventoryCountStore((s) => s.submitSheet);
    const startSheet = useInventoryCountStore((s) => s.startSheet);

    const [view, setView] = useState('list');
    const [sheetId, setSheetId] = useState(null);
    const [activeLineId, setActiveLineId] = useState(null);

    const sheet = useMemo(
        () => sheets.find((s) => s.id === sheetId) || null,
        [sheets, sheetId]
    );

    const readOnly = sheet?.status === 'submitted';

    useEffect(() => {
        if (!sheetId || !sheet || sheet.status !== 'draft') return;
        startSheet(sheetId);
    }, [sheetId, sheet, startSheet]);

    useEffect(() => {
        if (!activeLineId || view !== 'detail') return;
        const el = document.querySelector(`[data-line-id="${activeLineId}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, [activeLineId, view]);

    const openSheet = (id) => {
        setSheetId(id);
        setActiveLineId(null);
        setView('detail');
    };

    const goList = () => {
        setView('list');
        setSheetId(null);
        setActiveLineId(null);
    };

    const goDetail = () => {
        setView('detail');
    };

    const handleQtyChange = useCallback(
        (lineId, qty) => {
            if (!sheetId || readOnly) return;
            setLineQty(sheetId, lineId, qty);
        },
        [sheetId, readOnly, setLineQty]
    );

    const applyScanOrCode = useCallback(
        (text) => {
            if (!sheetId || readOnly) return null;
            const hit = matchScan(sheetId, text);
            if (!hit) return null;
            bumpLineQty(sheetId, hit.lineId, 1);
            setActiveLineId(hit.lineId);
            const line = sheet?.lines.find((l) => l.lineId === hit.lineId);
            return { ok: true, label: line?.sku || line?.productName };
        },
        [sheetId, readOnly, matchScan, bumpLineQty, sheet?.lines]
    );

    const handleScanText = useCallback(
        (text) => {
            const r = applyScanOrCode(text);
            if (r?.ok) return r;
            return { ok: false };
        },
        [applyScanOrCode]
    );

    const handleManualLookup = useCallback(
        (code) => {
            const r = applyScanOrCode(code);
            return Boolean(r?.ok);
        },
        [applyScanOrCode]
    );

    const handleSubmit = () => {
        if (!sheetId || readOnly) return;
        const ok = window.confirm('確定提交此張盤點單？提交後將無法再修改。');
        if (!ok) return;
        submitSheet(sheetId);
        setView('list');
        setSheetId(null);
        setActiveLineId(null);
    };

    const title =
        view === 'list'
            ? '手機端庫存盤點'
            : view === 'detail'
              ? '盤點明細'
              : '掃碼盤點';

    const subtitle =
        view === 'list'
            ? '選擇盤點單後可檢視明細、掃碼或手動輸入數量並提交。'
            : view === 'detail'
              ? sheet
                  ? `${sheet.id} · ${sheet.warehouse}`
                  : ''
              : '對準條碼掃描，成功後會自動為該品項 +1。';

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.titleBlock}>
                    <h1>{title}</h1>
                    <p className={styles.subtitle}>{subtitle}</p>
                </div>
                {view !== 'list' && (
                    <button type="button" className={styles.backBtn} onClick={view === 'scan' ? goDetail : goList}>
                        <ArrowLeft size={18} aria-hidden />
                        {view === 'scan' ? '返回明細' : '盤點單列表'}
                    </button>
                )}
            </header>

            <div className={styles.body}>
                {view === 'list' && (
                    <CountSheetListView sheets={sheets} onOpenSheet={openSheet} />
                )}
                {view === 'detail' && sheet && (
                    <CountSheetDetailView
                        sheet={sheet}
                        activeLineId={activeLineId}
                        readOnly={readOnly}
                        onQtyChange={handleQtyChange}
                        onOpenScan={() => setView('scan')}
                        onSubmit={handleSubmit}
                        onManualLookup={handleManualLookup}
                    />
                )}
                {view === 'scan' && sheet && (
                    <ScanSessionView sheetTitle={sheet.title} onScanText={handleScanText} />
                )}
            </div>
        </div>
    );
};

export default InventoryCountPage;
