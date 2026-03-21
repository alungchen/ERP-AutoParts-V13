import React, { useMemo, useState } from 'react';
import { ScanBarcode } from 'lucide-react';
import LineItemRow from '../components/LineItemRow';
import SubmitCountToolbar from '../components/SubmitCountToolbar';
import styles from './CountSheetDetailView.module.css';

const CountSheetDetailView = ({
    sheet,
    activeLineId,
    readOnly,
    onQtyChange,
    onOpenScan,
    onSubmit,
    onManualLookup,
}) => {
    const [manualCode, setManualCode] = useState('');

    const varianceLines = useMemo(
        () => sheet.lines.filter((l) => (l.countedQty ?? 0) !== l.systemQty).length,
        [sheet.lines]
    );

    const handleManual = () => {
        const ok = onManualLookup?.(manualCode.trim());
        if (ok) setManualCode('');
    };

    return (
        <>
            <div className={styles.panel}>
                <div className={styles.panelHead}>
                    <h2 className={styles.panelTitle}>{sheet.title}</h2>
                    <p className={styles.panelMeta}>
                        {sheet.warehouse} · {sheet.id}
                    </p>
                </div>
                <button
                    type="button"
                    className={styles.scanBtn}
                    disabled={readOnly}
                    onClick={onOpenScan}
                >
                    <ScanBarcode size={22} aria-hidden />
                    開啟掃碼盤點
                </button>
                <div className={styles.manualBox}>
                    <label className={styles.manualLabel} htmlFor="inv-manual-code">
                        手動輸入條碼／料號（無相機時）
                    </label>
                    <input
                        id="inv-manual-code"
                        className={styles.manualInput}
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleManual();
                        }}
                        placeholder="例如 4710012345678 或 BRK-F-001"
                        disabled={readOnly}
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        className={styles.manualBtn}
                        disabled={readOnly || !manualCode.trim()}
                        onClick={handleManual}
                    >
                        套用至明細
                    </button>
                </div>
            </div>

            <div className={styles.panel}>
                <div className={styles.panelHead}>
                    <h3 className={styles.panelTitle} style={{ fontSize: '0.88rem' }}>
                        盤點明細
                    </h3>
                </div>
                <div className={styles.lines}>
                    {sheet.lines.map((line) => (
                        <LineItemRow
                            key={line.lineId}
                            line={line}
                            systemQty={line.systemQty}
                            isActive={activeLineId === line.lineId}
                            readOnly={readOnly}
                            onQtyChange={(qty) => onQtyChange(line.lineId, qty)}
                        />
                    ))}
                </div>
            </div>

            <SubmitCountToolbar
                changedLines={varianceLines}
                totalLines={sheet.lines.length}
                readOnly={readOnly}
                onSubmit={onSubmit}
                submitDisabled={readOnly}
            />
        </>
    );
};

export default CountSheetDetailView;
