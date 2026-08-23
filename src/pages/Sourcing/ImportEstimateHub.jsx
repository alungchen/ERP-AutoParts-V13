import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Calculator, FileDown, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useImportEstimateStore } from '../../store/useImportEstimateStore';
import {
    importEstimateFromBackupText,
    DEFAULT_EXPORT_HEADER_KEYS,
    DEFAULT_EXPORT_LINE_KEYS,
} from '../../utils/importEstimateBackup';
import styles from './SourcingList.module.css';

const ImportEstimateHub = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    // 新分頁模式（standalone=1）下導覽需保留該參數，否則會被啟動器頁面攔截
    const isStandalonePage = new URLSearchParams(location.search).get('standalone') === '1';
    const estimatePath = (id) => {
        const params = new URLSearchParams();
        if (id) params.set('id', id);
        if (isStandalonePage) params.set('standalone', '1');
        const qs = params.toString();
        return qs ? `/sourcing/estimate?${qs}` : '/sourcing/estimate';
    };
    const importEstimates = useImportEstimateStore((s) => s.importEstimates);
    const deleteImportEstimate = useImportEstimateStore((s) => s.deleteImportEstimate);
    const addImportEstimate = useImportEstimateStore((s) => s.addImportEstimate);

    const [q, setQ] = useState('');
    const [flash, setFlash] = useState('');
    const fileInputRef = useRef(null);

    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        const list = [...importEstimates].sort((a, b) =>
            (b.updatedAt || '').localeCompare(a.updatedAt || ''),
        );
        if (!s) return list;
        return list.filter((row) => {
            const hay = [
                row.estimate_id,
                row.supplier_name,
                row.supplier_id,
                row.date,
                row.notes,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return hay.includes(s);
        });
    }, [importEstimates, q]);

    const fmtTime = (iso) => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
        } catch {
            return iso;
        }
    };

    const showFlash = useCallback((msg) => {
        setFlash(msg);
        window.setTimeout(() => setFlash(''), 3200);
    }, []);

    const applyImportedText = useCallback((text) => {
        const result = importEstimateFromBackupText(text);
        if (result.error) {
            window.alert(t('importCost.backup.invalidFile'));
            return;
        }
        const doc = addImportEstimate(result.patch);
        showFlash(t('importCost.backup.doneNew'));
        navigate(estimatePath(doc.estimate_id));
    }, [addImportEstimate, navigate, t, showFlash, isStandalonePage]);

    const onFilePicked = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const isExcel = /\.xlsx?$/i.test(file.name);
            const reader = new FileReader();
            reader.onload = async () => {
                if (isExcel) {
                    // Excel 檔：取第一個工作表轉為 CSV 後沿用相同匯入流程
                    try {
                        const XLSX = await import('xlsx');
                        const wb = XLSX.read(reader.result, { type: 'array' });
                        const ws = wb.Sheets[wb.SheetNames[0]];
                        const csvText = XLSX.utils.sheet_to_csv(ws);
                        applyImportedText(csvText);
                    } catch {
                        window.alert(t('importCost.backup.invalidFile'));
                    }
                    return;
                }
                applyImportedText(typeof reader.result === 'string' ? reader.result : '');
            };
            if (isExcel) reader.readAsArrayBuffer(file);
            else reader.readAsText(file, 'UTF-8');
        },
        [applyImportedText, t],
    );

    // 下載 Excel 匯入範本：第一張工作表為可直接匯入的資料格式，第二張為欄位說明
    const onDownloadTemplate = useCallback(async () => {
        const XLSX = await import('xlsx');
        const cols = [...DEFAULT_EXPORT_HEADER_KEYS, ...DEFAULT_EXPORT_LINE_KEYS];
        const headerSample = {
            estimate_id: '',
            date: new Date().toISOString().split('T')[0],
            supplier_id: '',
            supplier_name: '範例貿易公司',
            notes: '範本示例，匯入後可再編輯',
            sharedCostSplit: 'equal',
            currency: 'USD',
            exchangeBuffer: 0.01,
            inlandDocTwd: 0,
            intlFreightTwd: 15000,
            insuranceCifFactor: 1.1,
            insuranceRate: 0.001,
            customsFeeTwd: 3500,
            doFeeTwd: 3500,
            ediFeeTwd: 600,
            lclFeeTwd: 0,
            terminalFeeTwd: 0,
            domesticFreightTwd: 0,
            vatRatePct: 5,
            miscBudgetPct: 5,
            retailMarginPct: 20,
        };
        const lineSamples = [
            { id: '', p_id: 'EUE-1130', productName: '高壓管', note: '', exwForeign: 12.5, quantity: 10, volPerUnit: 0.002, weightPerUnit: 0.8, dutyRate: 0.05, exciseRate: 0, hsCode: '', nameZh: '', inputRegulation: '', dutyRateText: '', goodsTaxRateHint: 0, tariffMiss: '' },
            { id: '', p_id: 'RD-062-2C', productName: '乾燥包', note: '', exwForeign: 3.2, quantity: 50, volPerUnit: 0.001, weightPerUnit: 0.2, dutyRate: 0, exciseRate: 0, hsCode: '', nameZh: '', inputRegulation: '', dutyRateText: '', goodsTaxRateHint: 0, tariffMiss: '' },
        ];
        const dataRows = lineSamples.map((line) => cols.map((k) => {
            if (k in headerSample) return headerSample[k];
            if (k in line) return line[k];
            return '';
        }));
        const ws = XLSX.utils.aoa_to_sheet([cols, ...dataRows]);
        ws['!cols'] = cols.map(() => ({ wch: 14 }));

        const fieldDocs = [
            ['欄位', '區分', '說明'],
            ['estimate_id', '單頭', '估價單號；留空由系統自動編號（匯入一律建立新單）'],
            ['date', '單頭', '日期，格式 YYYY-MM-DD'],
            ['supplier_id', '單頭', '廠商代號（可留空）'],
            ['supplier_name', '單頭', '廠商名稱'],
            ['notes', '單頭', '備註'],
            ['sharedCostSplit', '單頭', '共同費用分攤方式：equal（平均）或 exwValue（依貨值）'],
            ['currency', '單頭', '外幣幣別，如 USD、JPY、EUR'],
            ['exchangeBuffer', '單頭', '匯率緩衝，例 0.01 代表 +1%'],
            ['inlandDocTwd', '單頭', '出口地內陸／文件費（台幣）'],
            ['intlFreightTwd', '單頭', '國際運費（台幣）'],
            ['insuranceCifFactor', '單頭', '保險 CIF 係數，預設 1.1'],
            ['insuranceRate', '單頭', '保險費率，預設 0.001'],
            ['customsFeeTwd', '單頭', '報關費（台幣）'],
            ['doFeeTwd', '單頭', 'D/O 費（台幣）'],
            ['ediFeeTwd', '單頭', 'EDI 費（台幣）'],
            ['lclFeeTwd', '單頭', '併櫃費（台幣）'],
            ['terminalFeeTwd', '單頭', '碼頭／吊櫃費（台幣）'],
            ['domesticFreightTwd', '單頭', '國內運費（台幣）'],
            ['vatRatePct', '單頭', '營業稅率 %，預設 5'],
            ['miscBudgetPct', '單頭', '雜費預算 %，預設 5'],
            ['retailMarginPct', '單頭', '零售毛利 %，預設 20'],
            ['id', '品項', '品項列識別碼；留空自動產生'],
            ['p_id', '品項', '零件號碼（料號）'],
            ['productName', '品項', '品名'],
            ['note', '品項', '品項備註'],
            ['exwForeign', '品項', 'EXW 外幣單價'],
            ['quantity', '品項', '數量'],
            ['volPerUnit', '品項', '單件材積（CBM）'],
            ['weightPerUnit', '品項', '單件重量（KG）'],
            ['dutyRate', '品項', '關稅稅率，例 0.05 代表 5%'],
            ['exciseRate', '品項', '貨物稅稅率，例 0.15 代表 15%'],
            ['hsCode', '品項', 'HS 稅則號列（11 碼，可留空）'],
            ['nameZh', '品項', '稅則中文名稱（可留空）'],
            ['inputRegulation', '品項', '輸入規定（可留空）'],
            ['dutyRateText', '品項', '稅率原文（可留空）'],
            ['goodsTaxRateHint', '品項', '貨物稅提示值（可留空）'],
            ['tariffMiss', '品項', '稅則查無資料註記（留空即可）'],
            [],
            ['使用方式', '', '1. 於「估價單範本」工作表填寫資料：每一列為一個品項，單頭欄位（日期、廠商、費用等）各列填相同值。'],
            ['', '', '2. 儲存後於「進口估價單總表」按「從檔案匯入新增」選擇本檔案（支援 .xlsx 或另存 .csv）。'],
            ['', '', '3. 匯入會建立一張新估價單，單號自動產生，匯入後可繼續編輯。'],
        ];
        const wsDoc = XLSX.utils.aoa_to_sheet(fieldDocs);
        wsDoc['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 70 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '估價單範本');
        XLSX.utils.book_append_sheet(wb, wsDoc, '欄位說明');
        XLSX.writeFile(wb, '進口估價單_匯入範本.xlsx');
    }, []);

    return (
        <div className={`${styles.container} ${styles.estimatorPage}`}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.json,application/json,.xlsx,.xls"
                className={styles.hubHiddenFile}
                aria-hidden
                onChange={onFilePicked}
            />

            <div className={styles.sourcingTop}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>{t('importCost.hubTitle')}</h1>
                        <p className={styles.subtitle}>{t('importCost.hubSubtitle')}</p>
                    </div>
                    <div className={styles.estimatorHeadIcon} aria-hidden>
                        <Calculator size={28} />
                    </div>
                </div>
            </div>

            <div className={styles.hubToolbar}>
                <div className={styles.hubSearchWrap}>
                    <Search size={18} className={styles.hubSearchIcon} aria-hidden />
                    <input
                        type="search"
                        className={styles.hubSearchInput}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t('importCost.hubSearch')}
                        aria-label={t('importCost.hubSearch')}
                    />
                </div>
                <div className={styles.hubToolbarActions}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={onDownloadTemplate}
                        title="下載 Excel 匯入範本（含欄位說明）"
                    >
                        <FileDown size={16} /> 下載範本
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={16} /> {t('importCost.backup.importNew')}
                    </button>
                    <Link to={estimatePath()} className={styles.primaryLinkBtn}>
                        <Plus size={18} /> {t('importCost.newEstimate')}
                    </Link>
                </div>
            </div>

            {flash && <div className={styles.hubFlash}>{flash}</div>}

            <div className={styles.hubTableWrap}>
                <table className={styles.hubTable}>
                    <thead>
                        <tr>
                            <th>{t('importCost.colEstimateNo')}</th>
                            <th>{t('importCost.colDate')}</th>
                            <th>{t('importCost.colSupplier')}</th>
                            <th className={styles.hubNumCol}>{t('importCost.colLineCount')}</th>
                            <th>{t('importCost.colUpdated')}</th>
                            <th className={styles.hubActionsCol} aria-label="actions" />
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((row) => (
                            <tr key={row.estimate_id}>
                                <td>
                                    <Link
                                        className={styles.hubIdLink}
                                        to={estimatePath(row.estimate_id)}
                                    >
                                        {row.estimate_id}
                                    </Link>
                                </td>
                                <td>{row.date || '—'}</td>
                                <td>{row.supplier_name || row.supplier_id || '—'}</td>
                                <td className={styles.hubNumCol}>{(row.lineItems || []).length}</td>
                                <td className={styles.hubMuted}>{fmtTime(row.updatedAt)}</td>
                                <td className={styles.hubActionsCol}>
                                    <div className={styles.hubRowActions}>
                                        <Link
                                            className={styles.secondaryBtn}
                                            to={estimatePath(row.estimate_id)}
                                        >
                                            {t('importCost.open')}
                                        </Link>
                                        <button
                                            type="button"
                                            className={styles.iconDangerBtn}
                                            title={t('importCost.delete')}
                                            onClick={() => {
                                                if (window.confirm(t('importCost.deleteConfirm'))) {
                                                    deleteImportEstimate(row.estimate_id);
                                                }
                                            }}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && (
                    <p className={styles.mutedPanel}>{t('importCost.emptyResults')}</p>
                )}
            </div>
        </div>
    );
};

export default ImportEstimateHub;
