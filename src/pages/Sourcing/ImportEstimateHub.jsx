import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Calculator, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { useImportEstimateStore } from '../../store/useImportEstimateStore';
import { importEstimateFromBackupText } from '../../utils/importEstimateBackup';
import styles from './SourcingList.module.css';

const ImportEstimateHub = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
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

    const onFilePicked = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = typeof reader.result === 'string' ? reader.result : '';
                const result = importEstimateFromBackupText(text);
                if (result.error) {
                    window.alert(t('importCost.backup.invalidFile'));
                    return;
                }
                const doc = addImportEstimate(result.patch);
                showFlash(t('importCost.backup.doneNew'));
                navigate(`/sourcing/estimate?id=${encodeURIComponent(doc.estimate_id)}`);
            };
            reader.readAsText(file, 'UTF-8');
        },
        [addImportEstimate, navigate, t, showFlash],
    );

    return (
        <div className={`${styles.container} ${styles.estimatorPage}`}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv,.json,application/json"
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
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload size={16} /> {t('importCost.backup.importNew')}
                    </button>
                    <Link to="/sourcing/estimate" className={styles.primaryLinkBtn}>
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
                                        to={`/sourcing/estimate?id=${encodeURIComponent(row.estimate_id)}`}
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
                                            to={`/sourcing/estimate?id=${encodeURIComponent(row.estimate_id)}`}
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
