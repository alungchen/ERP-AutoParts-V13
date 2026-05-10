import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../../i18n';
import { useSourcingStore } from '../../store/useSourcingStore';
import { useProductStore } from '../../store/useProductStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';
import { useImportEstimateStore, createDefaultEstimateLine } from '../../store/useImportEstimateStore';
import {
    Calculator,
    Search,
    AlertTriangle,
    Plus,
    Trash2,
    Layers,
    Package,
    ArrowLeft,
    FileOutput,
    Download,
    Upload,
    History,
    X,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { getSafeImageUrl, productHasExternalUrlImages } from '../../utils/imageUtils';
import { collectCustomerSalesHistory, collectSupplierPurchaseHistory } from '../../utils/buildProductTransactionHistory';
import ProductPriceHistoryBody from '../../components/ProductPriceHistoryBody';
import PartMappingModal from '../PIM/PartMappingModal';
import plStyles from '../PIM/ProductList.module.css';
import {
    loadTariffTable,
    findByHsCode,
    searchTariffByKeyword,
    normalizeHsCode,
    hasSpecialImportRestriction,
} from '../../utils/tariffService';
import { computeMultiLineLandedCost, IMPORT_CURRENCIES } from '../../utils/importCostEstimation';
import ProductPickerModal from '../../components/ProductPickerModal';
import { formatSupplierSelectLabel } from '../../utils/contactDisplay';
import {
    DEFAULT_LINES_CSV_KEYS,
    LINE_CSV_ALL_EXPORT_KEYS,
    buildEstimateLinesCsv,
    downloadLinesCsv,
    parseEstimateLinesCsv,
    processImportedEstimateLine,
} from '../../utils/importEstimateLinesCsv';
import styles from './SourcingList.module.css';

const LinesCsvExportModal = ({ lineItems, products, onClose, t }) => {
    const [sel, setSel] = useState(() => new Set(DEFAULT_LINES_CSV_KEYS));
    const toggle = (key) => {
        setSel((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };
    const label = (key) =>
        (key.startsWith('pim_') ? t(`importCost.linesCsv.pimField.${key}`) : null) ||
        t(`importCost.backup.field.${key}`) ||
        key;
    const doDownload = () => {
        if (sel.size === 0) return;
        const csvText = buildEstimateLinesCsv(lineItems, [...sel], products);
        downloadLinesCsv(`import-estimate-lines.csv`, csvText);
        onClose();
    };
    return (
        <div className={styles.hubModalBackdrop} role="presentation" onClick={onClose}>
            <div
                className={styles.hubModal}
                role="dialog"
                aria-labelledby="lines-csv-export-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.hubModalHeader}>
                    <h2 id="lines-csv-export-title" className={styles.hubModalTitle}>
                        {t('importCost.linesCsv.modalTitle')}
                    </h2>
                </div>
                <div className={styles.hubModalBody}>
                    <p className={styles.hubModalHint}>{t('importCost.linesCsv.pickColumns')}</p>
                    <div className={styles.hubExportGroupBtns} style={{ marginBottom: '0.5rem' }}>
                        <button
                            type="button"
                            className={styles.hubExportMiniBtn}
                            onClick={() => setSel(new Set(LINE_CSV_ALL_EXPORT_KEYS))}
                        >
                            {t('importCost.backup.selectAll')}
                        </button>
                        <button type="button" className={styles.hubExportMiniBtn} onClick={() => setSel(new Set())}>
                            {t('importCost.backup.selectNone')}
                        </button>
                    </div>
                    <div className={styles.hubExportChecks} style={{ maxHeight: 360 }}>
                        {LINE_CSV_ALL_EXPORT_KEYS.map((key) => (
                            <label key={key} className={styles.hubExportCheckLabel}>
                                <input type="checkbox" checked={sel.has(key)} onChange={() => toggle(key)} />
                                <span>{label(key)}</span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className={styles.hubModalFooter}>
                    <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                        {t('importCost.linesCsv.cancel')}
                    </button>
                    <button type="button" className={styles.primaryLinkBtn} onClick={doDownload} disabled={sel.size === 0}>
                        <Download size={16} /> {t('importCost.linesCsv.download')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const num = (v, fallback = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
};

/** 品項列進口試算欄位順序（Enter 往下一欄） */
const IMPORT_GRID_FIELDS = ['hs', 'qty', 'exw', 'vol', 'wt', 'duty', 'excise'];

const displayCarModel = (p) => {
    if (!p) return '-';
    const activeCar = (p.part_numbers || []).find((pn) => pn.car_model);
    if (activeCar) return activeCar.car_model;
    const c0 = (p.car_models || [])[0];
    return p.car_model || (typeof c0 === 'string' ? c0 : c0?.model) || '-';
};

const displayCarYear = (p) => {
    if (!p) return '不限年份';
    const activeCar = (p.part_numbers || []).find((pn) => pn.year);
    if (activeCar) return activeCar.year;
    const c0 = (p.car_models || [])[0];
    const cStr = typeof c0 === 'string' ? c0 : c0?.year;
    return p.year || (cStr?.match(/\d{4}-\d{4}/) ? cStr.match(/\d{4}-\d{4}/)[0] : cStr) || '不限年份';
};

const SourcingList = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { rates } = useSourcingStore();
    const { products } = useProductStore();
    const { suppliers } = useSupplierStore();
    const { employees } = useEmployeeStore();
    const { currentUserEmpId } = useAppStore();
    const addDocument = useDocumentStore((s) => s.addDocument);
    const purchaseOrders = useDocumentStore((s) => s.purchaseOrders ?? []);
    const salesOrders = useDocumentStore((s) => s.salesOrders ?? []);
    const quotations = useDocumentStore((s) => s.quotations ?? []);
    const inquiries = useDocumentStore((s) => s.inquiries ?? []);
    const addImportEstimate = useImportEstimateStore((s) => s.addImportEstimate);
    const getImportEstimate = useImportEstimateStore((s) => s.getImportEstimate);
    const updateImportEstimate = useImportEstimateStore((s) => s.updateImportEstimate);

    const [tariffIndex, setTariffIndex] = useState(null);
    const [tariffLoadError, setTariffLoadError] = useState(null);

    const [hydrated, setHydrated] = useState(false);
    const [estimateId, setEstimateId] = useState('');
    const [docDate, setDocDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [supplierId, setSupplierId] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [estimateNotes, setEstimateNotes] = useState('');
    const [saveStatus, setSaveStatus] = useState('');
    const creatingEstimateRef = useRef(false);

    const [lineItems, setLineItems] = useState(() => []);
    const lineItemsRef = useRef(lineItems);
    lineItemsRef.current = lineItems;
    const [activeLineId, setActiveLineId] = useState(() => null);
    const [sharedCostSplit, setSharedCostSplit] = useState('equal');

    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [linesCsvExportOpen, setLinesCsvExportOpen] = useState(false);
    const [importLineConflicts, setImportLineConflicts] = useState({});
    const linesCsvFileRef = useRef(null);

    const [hsInput, setHsInput] = useState('');
    const [keywordInput, setKeywordInput] = useState('');
    const [searchHits, setSearchHits] = useState([]);

    const [currency, setCurrency] = useState('USD');
    const [exchangeBuffer, setExchangeBuffer] = useState(0.01);
    const [inlandDocTwd, setInlandDocTwd] = useState('0');
    const [intlFreightTwd, setIntlFreightTwd] = useState('0');
    const [insuranceCifFactor, setInsuranceCifFactor] = useState('1.1');
    const [insuranceRate, setInsuranceRate] = useState('0.001');
    const [customsFeeTwd, setCustomsFeeTwd] = useState('3500');
    const [doFeeTwd, setDoFeeTwd] = useState('3500');
    const [ediFeeTwd, setEdiFeeTwd] = useState('600');
    const [lclFeeTwd, setLclFeeTwd] = useState('0');
    const [terminalFeeTwd, setTerminalFeeTwd] = useState('0');
    const [domesticFreightTwd, setDomesticFreightTwd] = useState('0');
    const [vatRatePct, setVatRatePct] = useState('5');
    const [miscBudgetPct, setMiscBudgetPct] = useState('5');
    const [retailMarginPct, setRetailMarginPct] = useState('20');

    const [mappingProduct, setMappingProduct] = useState(null);
    const [historyInlineOpen, setHistoryInlineOpen] = useState(false);
    const [imagePreviewProduct, setImagePreviewProduct] = useState(null);
    const [imagePreviewEnlargedIndex, setImagePreviewEnlargedIndex] = useState(null);
    const [imagePreviewZoom, setImagePreviewZoom] = useState(1);

    const [breakdown, setBreakdown] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const idx = await loadTariffTable();
                if (!cancelled) {
                    setTariffIndex(idx);
                    setTariffLoadError(null);
                }
            } catch (e) {
                if (!cancelled) {
                    setTariffLoadError(e?.message || String(e));
                }
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const idFromUrl = searchParams.get('id');
    const shortageProcessedRef = useRef('');

    useEffect(() => {
        shortageProcessedRef.current = '';
    }, [idFromUrl]);

    useEffect(() => {
            if (!idFromUrl) {
                if (creatingEstimateRef.current) return;
                creatingEstimateRef.current = true;
                const spBoot = new URLSearchParams(window.location.search);
                const shortageBoot = spBoot.get('shortage');
                const doc = addImportEstimate();
                const params = new URLSearchParams();
                params.set('id', doc.estimate_id);
                if (shortageBoot?.trim()) params.set('shortage', shortageBoot.trim());
                navigate(`/sourcing/estimate?${params.toString()}`, { replace: true });
                return;
            }
            creatingEstimateRef.current = false;
            const saved = getImportEstimate(idFromUrl);
            if (!saved) {
                navigate('/sourcing', { replace: true });
                return;
            }
            setHydrated(false);
            setEstimateId(saved.estimate_id);
            setDocDate(saved.date || new Date().toISOString().split('T')[0]);
            setSupplierId(saved.supplier_id || '');
            setSupplierName(saved.supplier_name || '');
            setEstimateNotes(saved.notes || '');
            setLineItems(Array.isArray(saved.lineItems) ? saved.lineItems : []);
            setSharedCostSplit(saved.sharedCostSplit || 'equal');
            setCurrency(saved.currency || 'USD');
            setExchangeBuffer(saved.exchangeBuffer ?? 0.01);
            setInlandDocTwd(String(saved.inlandDocTwd ?? '0'));
            setIntlFreightTwd(String(saved.intlFreightTwd ?? '0'));
            setInsuranceCifFactor(String(saved.insuranceCifFactor ?? '1.1'));
            setInsuranceRate(String(saved.insuranceRate ?? '0.001'));
            setCustomsFeeTwd(String(saved.customsFeeTwd ?? '3500'));
            setDoFeeTwd(String(saved.doFeeTwd ?? '3500'));
            setEdiFeeTwd(String(saved.ediFeeTwd ?? '600'));
            setLclFeeTwd(String(saved.lclFeeTwd ?? '0'));
            setTerminalFeeTwd(String(saved.terminalFeeTwd ?? '0'));
            setDomesticFreightTwd(String(saved.domesticFreightTwd ?? '0'));
            setVatRatePct(String(saved.vatRatePct ?? '5'));
            setMiscBudgetPct(String(saved.miscBudgetPct ?? '5'));
            setRetailMarginPct(String(saved.retailMarginPct ?? '20'));
            setBreakdown(saved.breakdown ?? null);
            setHydrated(true);
            setSaveStatus('');
    }, [idFromUrl, navigate, addImportEstimate, getImportEstimate]);

    useEffect(() => {
        if (!hydrated || !estimateId) return;
        const handle = window.setTimeout(() => {
            updateImportEstimate(estimateId, {
                date: docDate,
                supplier_id: supplierId,
                supplier_name: supplierName,
                notes: estimateNotes,
                lineItems,
                sharedCostSplit,
                currency,
                exchangeBuffer,
                inlandDocTwd,
                intlFreightTwd,
                insuranceCifFactor,
                insuranceRate,
                customsFeeTwd,
                doFeeTwd,
                ediFeeTwd,
                lclFeeTwd,
                terminalFeeTwd,
                domesticFreightTwd,
                vatRatePct,
                miscBudgetPct,
                retailMarginPct,
                breakdown,
            });
            setSaveStatus(`${t('importCost.autoSaved')} ${new Date().toLocaleTimeString()}`);
        }, 480);
        return () => window.clearTimeout(handle);
    }, [
        hydrated,
        estimateId,
        docDate,
        supplierId,
        supplierName,
        estimateNotes,
        lineItems,
        sharedCostSplit,
        currency,
        exchangeBuffer,
        inlandDocTwd,
        intlFreightTwd,
        insuranceCifFactor,
        insuranceRate,
        customsFeeTwd,
        doFeeTwd,
        ediFeeTwd,
        lclFeeTwd,
        terminalFeeTwd,
        domesticFreightTwd,
        vatRatePct,
        miscBudgetPct,
        retailMarginPct,
        breakdown,
        updateImportEstimate,
        t,
    ]);

    // F8 Key Listener for Price History
    useEffect(() => {
        const onKey = (e) => {
            if (e.repeat) return;
            if (e.code !== 'F8') return;
            e.preventDefault();
            setHistoryInlineOpen((v) => !v);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);


    useEffect(() => {
        setActiveLineId((cur) => {
            if (cur && lineItems.some((l) => l.id === cur)) return cur;
            return lineItems[0]?.id ?? null;
        });
    }, [lineItems]);

    const twdPerUnit = useMemo(() => {
        const r = rates?.[currency];
        if (currency === 'TWD') return 1;
        return num(r, 1);
    }, [rates, currency]);

    const activeLine = useMemo(
        () => lineItems.find((l) => l.id === activeLineId),
        [lineItems, activeLineId],
    );

    // F9 Key Listener for Photo Preview (must be after activeLine declaration)
    useEffect(() => {
        const onKey = (e) => {
            if (e.repeat) return;
            if (e.code !== 'F9') return;
            e.preventDefault();
            if (activeLine && activeLine.p_id) {
                const p = products.find(x => x.p_id === activeLine.p_id);
                if (p?.images?.length) {
                    setImagePreviewProduct(cur => cur?.p_id === p.p_id ? null : p);
                }
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [activeLine, products]);

    // Enlarged Image Controls Listener
    useEffect(() => {
        if (!imagePreviewProduct) return;
        const images = imagePreviewProduct.images || [];
        const onKey = (ev) => {
            if (imagePreviewEnlargedIndex !== null && images.length > 0) {
                if (ev.key === 'Escape' || ev.code === 'F9') {
                    ev.preventDefault();
                    setImagePreviewEnlargedIndex(null);
                    setImagePreviewZoom(1);
                    return;
                }
                if (images.length > 1 && ev.key === 'ArrowRight') {
                    ev.preventDefault();
                    setImagePreviewEnlargedIndex((prev) => ((prev ?? 0) + 1) % images.length);
                    setImagePreviewZoom(1);
                    return;
                }
                if (images.length > 1 && ev.key === 'ArrowLeft') {
                    ev.preventDefault();
                    setImagePreviewEnlargedIndex((prev) => ((prev ?? 0) - 1 + images.length) % images.length);
                    setImagePreviewZoom(1);
                    return;
                }
                return;
            }
            if (ev.key === 'Escape' || ev.code === 'F9') {
                ev.preventDefault();
                setImagePreviewProduct(null);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [imagePreviewProduct, imagePreviewEnlargedIndex]);

    useEffect(() => {
        setImagePreviewEnlargedIndex(null);
        setImagePreviewZoom(1);
    }, [imagePreviewProduct?.p_id]);

    const historyContextProduct = useMemo(() => {
        if (!activeLine?.p_id) return null;
        return products.find(p => p.p_id === activeLine.p_id) || null;
    }, [activeLine?.p_id, products]);

    const customerHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectCustomerSalesHistory(historyContextProduct, salesOrders, quotations);
    }, [historyContextProduct, salesOrders, quotations]);

    const supplierHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectSupplierPurchaseHistory(historyContextProduct, purchaseOrders, inquiries);
    }, [historyContextProduct, purchaseOrders, inquiries]);

    const bumpImagePreviewZoom = (delta) => {
        setImagePreviewZoom((z) => {
            const n = Math.round((z + delta) * 100) / 100;
            return Math.min(3, Math.max(0.5, n));
        });
    };

    const volWeightTotals = useMemo(() => {
        let vol = 0;
        let wt = 0;
        lineItems.forEach((l) => {
            const q = Math.max(0, num(l.quantity));
            vol += q * num(l.volPerUnit);
            wt += q * num(l.weightPerUnit);
        });
        return { vol, wt };
    }, [lineItems]);

    const lineResultByIndex = useMemo(() => {
        if (!breakdown?.lineResults?.length) return [];
        return lineItems.map((_, idx) => breakdown.lineResults[idx] ?? null);
    }, [breakdown, lineItems]);

    const applyTariffToLine = useCallback((lineId, row) => {
        if (!row || !lineId) return;
        setLineItems((prev) => prev.map((l) => (l.id === lineId ? {
            ...l,
            dutyRate: row.dutyRate,
            exciseRate: 0,
            hsCode: row.hsCode,
            nameZh: row.nameZh,
            inputRegulation: row.inputRegulation,
            dutyRateText: row.dutyRateText,
            goodsTaxRateHint: row.goodsTaxRateHint ?? 0,
            tariffMiss: false,
        } : l)));
    }, []);

    const updateLine = (lineId, patch) => {
        setImportLineConflicts((prev) => {
            if (!prev[lineId]) return prev;
            const cleared = { ...prev[lineId] };
            for (const k of Object.keys(patch)) delete cleared[k];
            if (Object.keys(cleared).length === 0) {
                const next = { ...prev };
                delete next[lineId];
                return next;
            }
            return { ...prev, [lineId]: cleared };
        });
        setLineItems((prev) => prev.map((l) => (l.id === lineId ? { ...l, ...patch } : l)));
    };

    const bindTariffIfHs = useCallback((lineId, hsRaw) => {
        if (!lineId) return;
        if (!tariffIndex) return;
        const k = normalizeHsCode(hsRaw);
        if (!k) {
            setLineItems((prev) => prev.map((l) => (l.id === lineId ? { ...l, tariffMiss: false } : l)));
            return;
        }
        const row = findByHsCode(tariffIndex, k);
        if (row) {
            applyTariffToLine(lineId, row);
            return;
        }
        setLineItems((prev) => prev.map((l) => ( l.id === lineId ? {
            ...l,
            tariffMiss: true,
            nameZh: '',
            dutyRateText: '',
            inputRegulation: '',
            goodsTaxRateHint: 0,
            dutyRate: 0,
        } : l)));
    }, [tariffIndex, applyTariffToLine]);

    const focusImportField = useCallback((lineId, fieldKey) => {
        requestAnimationFrame(() => {
            const el = document.querySelector(`input[data-import-line="${lineId}"][data-import-field="${fieldKey}"]`);
            el?.focus?.();
        });
    }, []);

    const handleImportFieldKeyDown = useCallback((e, lineId, fieldKey) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const idx = IMPORT_GRID_FIELDS.indexOf(fieldKey);
        const lineIds = lineItems.map((l) => l.id);
        const pos = lineIds.indexOf(lineId);
        if (idx < IMPORT_GRID_FIELDS.length - 1) {
            focusImportField(lineId, IMPORT_GRID_FIELDS[idx + 1]);
        } else if (pos >= 0 && pos < lineIds.length - 1) {
            focusImportField(lineIds[pos + 1], IMPORT_GRID_FIELDS[0]);
        } else if (lineIds.length > 0) {
            focusImportField(lineIds[0], IMPORT_GRID_FIELDS[0]);
        }
    }, [lineItems, focusImportField]);

    const addLine = () => {
        const L = createDefaultEstimateLine();
        setLineItems((prev) => [...prev, L]);
        setActiveLineId(L.id);
    };

    const buildLineFromProduct = useCallback(
        (product) => {
            if (!product) return null;
            const L = createDefaultEstimateLine();
            const rawHs = String(product.hs_code || '').trim();
            const digits = rawHs.replace(/\D/g, '');
            const merged = {
                ...L,
                p_id: product.p_id || '',
                productName: product.name || '',
                note: product.name || '',
                exwForeign:
                    product.base_cost != null && product.base_cost !== '' ? String(product.base_cost) : '',
                hsCode: digits.length >= 11 ? digits.slice(0, 11) : rawHs,
            };
            if (tariffIndex) {
                const k = normalizeHsCode(merged.hsCode);
                if (k) {
                    const row = findByHsCode(tariffIndex, k);
                    if (row) {
                        merged.dutyRate = row.dutyRate;
                        merged.nameZh = row.nameZh;
                        merged.inputRegulation = row.inputRegulation;
                        merged.dutyRateText = row.dutyRateText;
                        merged.goodsTaxRateHint = row.goodsTaxRateHint ?? 0;
                        merged.hsCode = row.hsCode;
                        merged.tariffMiss = false;
                    } else {
                        merged.tariffMiss = true;
                    }
                }
            }
            return merged;
        },
        [tariffIndex],
    );

    const addProductLines = useCallback(
        (productList) => {
            if (!productList?.length) return;
            const newLines = productList.map(buildLineFromProduct).filter(Boolean);
            if (!newLines.length) return;
            setLineItems((prev) => [...prev, ...newLines]);
            setActiveLineId(newLines[newLines.length - 1].id);
        },
        [buildLineFromProduct],
    );

    const shortageKey = searchParams.get('shortage');
    useEffect(() => {
        const raw = (shortageKey || '').trim();
        if (!raw || !hydrated || !estimateId || !tariffIndex) return;
        if (shortageProcessedRef.current === raw) return;
        shortageProcessedRef.current = raw;

        const pids = [...new Set(raw.split(/[,\s]+/).map((x) => x.trim()).filter(Boolean))];
        const shortageBook = useDocumentStore.getState().shortageBook || [];
        const existingPids = new Set((lineItemsRef.current || []).map((l) => l.p_id).filter(Boolean));
        const newLines = [];
        for (const pid of pids) {
            if (existingPids.has(pid)) continue;
            const p = products.find((x) => x.p_id === pid);
            if (!p) continue;
            const line = buildLineFromProduct(p);
            if (!line) continue;
            const sb = shortageBook.find((s) => s.p_id === pid);
            if (sb) {
                const q = Math.max(1, Math.floor(num(sb.suggested_qty, 0) || num(sb.shortage_qty, 0) || 1));
                line.quantity = String(q);
            }
            newLines.push(line);
            existingPids.add(pid);
        }
        if (newLines.length) {
            setLineItems((prev) => [...prev, ...newLines]);
            setActiveLineId(newLines[newLines.length - 1].id);
        }

        const next = new URLSearchParams(window.location.search);
        next.delete('shortage');
        navigate(`/sourcing/estimate?${next.toString()}`, { replace: true });
    }, [hydrated, estimateId, tariffIndex, shortageKey, products, buildLineFromProduct, navigate]);

    const removeLine = (id) => {
        setImportLineConflicts((prev) => {
            if (!prev[id]) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
        });
        setLineItems((prev) => {
            const next = prev.filter((l) => l.id !== id);
            setActiveLineId((aid) => {
                if (aid !== id) return aid;
                return next[0]?.id ?? null;
            });
            return next;
        });
    };

    const hasAnyLineConflict = useMemo(
        () => Object.values(importLineConflicts).some((m) => m && Object.keys(m).length > 0),
        [importLineConflicts],
    );

    const openLinesCsvImport = () => {
        if (!window.confirm(t('importCost.linesCsv.importReplaceConfirm'))) return;
        linesCsvFileRef.current?.click();
    };

    const onLinesCsvFileChange = useCallback(
        (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const text = typeof reader.result === 'string' ? reader.result : '';
                const parsed = parseEstimateLinesCsv(text);
                if (parsed.error) {
                    window.alert(t('importCost.linesCsv.importBadFile'));
                    return;
                }
                const conflictsMap = {};
                const newLines = parsed.rows.map((rowObj) => {
                    const { line, conflicts } = processImportedEstimateLine(
                        rowObj,
                        parsed.headerKeys,
                        tariffIndex,
                        products,
                    );
                    if (Object.keys(conflicts).length > 0) {
                        conflictsMap[line.id] = { ...conflicts };
                    }
                    return line;
                });
                setBreakdown(null);
                setLineItems(newLines);
                setImportLineConflicts(conflictsMap);
                setActiveLineId(newLines[0]?.id ?? null);
            };
            reader.readAsText(file, 'UTF-8');
        },
        [tariffIndex, products, t],
    );

    const handleHsLookup = () => {
        if (!tariffIndex || !activeLine) return;
        const key = normalizeHsCode(hsInput);
        if (!key) {
            window.alert(t('importCost.invalidHs'));
            return;
        }
        const row = findByHsCode(tariffIndex, key);
        if (!row) {
            setSearchHits([]);
            window.alert(t('importCost.emptyResults'));
            return;
        }
        setSearchHits([row]);
        applyTariffToLine(activeLine.id, row);
    };

    const handleKeywordSearch = () => {
        if (!tariffIndex || !activeLine) return;
        const hits = searchTariffByKeyword(tariffIndex, keywordInput);
        setSearchHits(hits);
        if (hits.length === 1) applyTariffToLine(activeLine.id, hits[0]);
    };

    const handleCalc = () => {
        const linesPayload = lineItems.map((l) => ({
            label: l.productName || l.p_id || l.note || l.hsCode || undefined,
            exwForeign: num(l.exwForeign),
            quantity: Math.max(1, num(l.quantity, 1)),
            dutyRate: num(l.dutyRate),
            exciseRate: num(l.exciseRate),
        }));

        const result = computeMultiLineLandedCost({
            lines: linesPayload,
            currency,
            twdPerUnit,
            exchangeBuffer: num(exchangeBuffer, 0.01),
            inlandAndDocTwd: num(inlandDocTwd),
            intlFreightTwd: num(intlFreightTwd),
            insuranceCifFactor: num(insuranceCifFactor, 1.1),
            insuranceRate: num(insuranceRate, 0.001),
            customsFeeTwd: num(customsFeeTwd),
            doFeeTwd: num(doFeeTwd),
            ediFeeTwd: num(ediFeeTwd),
            lclFeeTwd: num(lclFeeTwd),
            terminalFeeTwd: num(terminalFeeTwd),
            domesticFreightTwd: num(domesticFreightTwd),
            vatRate: num(vatRatePct) / 100,
            miscBudgetRate: num(miscBudgetPct) / 100,
            retailMarginRate: num(retailMarginPct) / 100,
            sharedCostSplit: sharedCostSplit === 'exwValue' ? 'exwValue' : 'equal',
        });
        setBreakdown(result);
    };

    const handleConvertToPurchase = useCallback(() => {
        if (!supplierId) {
            window.alert(t('importCost.convertNeedSupplier'));
            return;
        }
        const items = lineItems
            .filter((l) => l.p_id && String(l.p_id).trim() && num(l.quantity, 0) > 0)
            .map((l) => {
                const p = products.find((x) => x.p_id === l.p_id);
                const mainPN = p?.part_numbers?.[0] || {};
                return {
                    p_id: l.p_id,
                    name: l.productName || p?.name || '',
                    part_number: p?.part_number || mainPN?.part_number || '',
                    qty: Math.max(1, num(l.quantity, 1)),
                    unit_price: num(l.exwForeign, 0),
                    unit: 'PCS',
                    note: l.hsCode ? `HS ${l.hsCode}` : '',
                };
            });
        if (!items.length) {
            window.alert(t('importCost.convertNeedLines'));
            return;
        }
        const exRate = currency === 'TWD' ? 1 : num(rates?.[currency], 1);
        const emp = employees.find((e) => e.emp_id === currentUserEmpId);
        const poDoc = {
            supplier_id: supplierId,
            supplier_name: supplierName,
            opener_emp_id: currentUserEmpId || '',
            opener_emp_name: emp?.name || '',
            status: 'pending',
            expected_date: '',
            currency,
            exchange_rate: exRate,
            items,
            freight_cost: num(intlFreightTwd),
            tariff_rate: 0,
            notes: `[${t('importCost.convertToPo')}] ${estimateId}${estimateNotes ? ` — ${estimateNotes}` : ''}`,
            discount: 0,
        };
        const newDoc = addDocument('purchase', poDoc);
        navigate(`/document-editor?type=purchase&id=${encodeURIComponent(newDoc.doc_id)}`);
    }, [
        supplierId,
        supplierName,
        lineItems,
        products,
        currency,
        rates,
        employees,
        currentUserEmpId,
        addDocument,
        navigate,
        t,
        intlFreightTwd,
        estimateId,
        estimateNotes,
    ]);

    const handleManualSave = useCallback(() => {
        if (!estimateId) return;
        updateImportEstimate(estimateId, {
            date: docDate,
            supplier_id: supplierId,
            supplier_name: supplierName,
            notes: estimateNotes,
            lineItems,
            sharedCostSplit,
            currency,
            exchangeBuffer,
            inlandDocTwd,
            intlFreightTwd,
            insuranceCifFactor,
            insuranceRate,
            customsFeeTwd,
            doFeeTwd,
            ediFeeTwd,
            lclFeeTwd,
            terminalFeeTwd,
            domesticFreightTwd,
            vatRatePct,
            miscBudgetPct,
            retailMarginPct,
            breakdown,
        });
        setSaveStatus(`${t('importCost.manualSave')} OK ${new Date().toLocaleTimeString()}`);
    }, [
        estimateId,
        docDate,
        supplierId,
        supplierName,
        estimateNotes,
        lineItems,
        sharedCostSplit,
        currency,
        exchangeBuffer,
        inlandDocTwd,
        intlFreightTwd,
        insuranceCifFactor,
        insuranceRate,
        customsFeeTwd,
        doFeeTwd,
        ediFeeTwd,
        lclFeeTwd,
        terminalFeeTwd,
        domesticFreightTwd,
        vatRatePct,
        miscBudgetPct,
        retailMarginPct,
        breakdown,
        updateImportEstimate,
        t,
    ]);

    const restrictionWarn = useMemo(
        () => lineItems.some((l) => hasSpecialImportRestriction(l.inputRegulation)),
        [lineItems],
    );

    const COL_MAIN = 11;

    const renderStockCell = (p) => {
        if (!p) return <span className="text-muted">—</span>;
        const stockNum = Number(p.stock) || 0;
        const safetyNum = Number(p.safety_stock) || 0;
        const belowSafety = safetyNum > 0 && stockNum < safetyNum;
        const stockBadgeClass = belowSafety
            ? 'bg-danger-subtle text-primary'
            : stockNum > safetyNum
                ? 'bg-success-subtle text-success'
                : stockNum > 0
                    ? 'bg-warning-subtle text-warning'
                    : 'bg-danger-subtle text-danger';
        return (
            <div className="flex flex-col gap-1 items-start">
                <span className={`text-xs px-2 py-0.5 rounded-sm font-bold ${stockBadgeClass}`}>
                    {stockNum}
                    <span className={belowSafety ? 'text-danger' : undefined}> 現貨</span>
                </span>
                <span className="text-[10px] text-muted font-mono">安全庫存: {safetyNum}</span>
            </div>
        );
    };

    return (
        <div className={`${styles.container} ${styles.estimatorPage}`}>
            <input
                ref={linesCsvFileRef}
                type="file"
                accept=".csv,text/csv"
                className={styles.hubHiddenFile}
                aria-hidden
                onChange={onLinesCsvFileChange}
            />
            {linesCsvExportOpen && (
                <LinesCsvExportModal
                    lineItems={lineItems}
                    products={products}
                    onClose={() => setLinesCsvExportOpen(false)}
                    t={t}
                />
            )}
            <Link to="/sourcing" className={styles.backLink}>
                <ArrowLeft size={16} /> {t('importCost.backToList')}
            </Link>
            <div className={styles.sourcingTop}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>{t('importCost.pageTitle')}</h1>
                        <p className={styles.subtitle}>{t('importCost.pageSubtitle')}</p>
                    </div>
                    <div className={styles.estimatorHeadIcon} aria-hidden>
                        <Calculator size={28} />
                    </div>
                </div>
            </div>

            <div className={styles.docHeaderCard}>
                <h2 className={styles.docTitle}>{t('importCost.docHeader')}</h2>
                <div className={styles.docHeaderGrid}>
                    <label className={styles.formField}>
                        <span>{t('importCost.docNumber')}</span>
                        <input className={styles.input} readOnly value={estimateId || '—'} />
                    </label>
                    <label className={styles.formField}>
                        <span>{t('importCost.colDate')}</span>
                        <input
                            className={styles.input}
                            type="date"
                            value={docDate}
                            onChange={(e) => setDocDate(e.target.value)}
                        />
                    </label>
                    <label className={styles.formField} style={{ gridColumn: 'span 2' }}>
                        <span>{t('importCost.supplierField')}</span>
                        <select
                            className={styles.select}
                            value={supplierId}
                            onChange={(e) => {
                                const v = e.target.value;
                                setSupplierId(v);
                                const sup = suppliers.find((s) => s.sup_id === v);
                                setSupplierName(sup?.name || '');
                            }}
                        >
                            <option value="">—</option>
                            {suppliers.map((s) => (
                                <option key={s.sup_id} value={s.sup_id}>{formatSupplierSelectLabel(s)}</option>
                            ))}
                        </select>
                    </label>
                    <label className={styles.formField} style={{ gridColumn: '1 / -1' }}>
                        <span>{t('importCost.estimateNotes')}</span>
                        <input
                            className={styles.input}
                            value={estimateNotes}
                            onChange={(e) => setEstimateNotes(e.target.value)}
                            placeholder=""
                        />
                    </label>
                </div>
                <div className={styles.docHeaderActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={handleManualSave}>
                        {t('importCost.manualSave')}
                    </button>
                    <button type="button" className={styles.primaryBtn} onClick={handleConvertToPurchase}>
                        <FileOutput size={16} /> {t('importCost.convertToPo')}
                    </button>
                    <span className={styles.saveStatus}>{saveStatus}</span>
                </div>
            </div>

            {!tariffIndex && !tariffLoadError && (
                <div className={styles.mutedPanel}>{t('importCost.loadTariff')}</div>
            )}
            {tariffLoadError && (
                <div className={styles.errorPanel} role="alert">{t('importCost.tariffError')} {tariffLoadError}</div>
            )}

            {restrictionWarn && (
                <div className={styles.restrictionAlert} role="alert">
                    <AlertTriangle size={22} />
                    <span>{t('importCost.warnRestriction')}</span>
                </div>
            )}

            <div className={styles.estimatorLayout}>
                <div className={styles.estimatorStack}>
                    <section className={styles.estimatorCard}>
                        <h2 className={styles.docTitle}>{t('importCost.estimateDocTitle')}</h2>
                        <p className={styles.allocateNote}>{t('importCost.allocateNote')}</p>

                        <div style={{ marginTop: '0.25rem', marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <History size={14} style={{ flexShrink: 0, opacity: 0.85 }} aria-hidden />
                            <span>
                                按 <strong style={{ color: 'var(--text-secondary)' }}>F8</strong> 可開啟目前選中列的「價格歷史沿革」。
                                {' '}
                                有照片之列，按 <strong style={{ color: 'var(--text-secondary)' }}>F9</strong> 可預覽照片。
                            </span>
                        </div>

                        <label className={styles.formField} style={{ maxWidth: '22rem' }}>
                            <span>{t('importCost.splitMode')}</span>
                            <select
                                className={styles.select}
                                value={sharedCostSplit}
                                onChange={(e) => setSharedCostSplit(e.target.value)}
                            >
                                <option value="equal">{t('importCost.splitEqual')}</option>
                                <option value="exwValue">{t('importCost.splitExw')}</option>
                            </select>
                        </label>

                        <div className={styles.ratesPanel}>
                            <div className={styles.rateCard}>
                                <span className={styles.rateLabel}>{t('importCost.ratesTitle')}</span>
                                <div className={styles.rateRow}>
                                    {['USD', 'EUR', 'JPY', 'CNY'].map((c) => (
                                        <span key={c} className={styles.rateChip}>
                                            {c} <b>{num(rates?.[c], 0).toFixed(c === 'JPY' ? 4 : 2)}</b>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <h3 className={styles.sectionHeading}>{t('importCost.costStructureSection')}</h3>
                        <div className={styles.formGrid}>
                            <label className={styles.formField}>
                                <span>{t('importCost.currency')}</span>
                                <select className={styles.select} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                                    {IMPORT_CURRENCIES.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.fxBuffer')} (0.01=1%)</span>
                                <input className={styles.input} type="number" min={0} step="0.001" value={exchangeBuffer} onChange={(e) => setExchangeBuffer(num(e.target.value, 0))} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.inlandDoc')}</span>
                                <input className={styles.input} type="number" min={0} step={1} value={inlandDocTwd} onChange={(e) => setInlandDocTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.intlFreight')}</span>
                                <input className={styles.input} type="number" min={0} step={1} value={intlFreightTwd} onChange={(e) => setIntlFreightTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.insFactor')}</span>
                                <input className={styles.input} type="number" min={0} step="0.01" value={insuranceCifFactor} onChange={(e) => setInsuranceCifFactor(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.insRate')}</span>
                                <input className={styles.input} type="number" min={0} step="0.0001" value={insuranceRate} onChange={(e) => setInsuranceRate(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.customsFee')}</span>
                                <input className={styles.input} type="number" min={0} value={customsFeeTwd} onChange={(e) => setCustomsFeeTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.doFee')}</span>
                                <input className={styles.input} type="number" min={0} value={doFeeTwd} onChange={(e) => setDoFeeTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.ediFee')}</span>
                                <input className={styles.input} type="number" min={0} value={ediFeeTwd} onChange={(e) => setEdiFeeTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.lclFee')}</span>
                                <input className={styles.input} type="number" min={0} value={lclFeeTwd} onChange={(e) => setLclFeeTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.terminalFee')}</span>
                                <input className={styles.input} type="number" min={0} value={terminalFeeTwd} onChange={(e) => setTerminalFeeTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.domesticDelivery')}</span>
                                <input className={styles.input} type="number" min={0} value={domesticFreightTwd} onChange={(e) => setDomesticFreightTwd(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.vatRate')} (%)</span>
                                <input className={styles.input} type="number" min={0} max={100} value={vatRatePct} onChange={(e) => setVatRatePct(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.miscBudgetPct')} (%)</span>
                                <input className={styles.input} type="number" min={0} max={100} value={miscBudgetPct} onChange={(e) => setMiscBudgetPct(e.target.value)} />
                            </label>
                            <label className={styles.formField}>
                                <span>{t('importCost.retailMargin')} (%)</span>
                                <input className={styles.input} type="number" min={0} max={500} value={retailMarginPct} onChange={(e) => setRetailMarginPct(e.target.value)} />
                            </label>
                        </div>

                        <button type="button" className={styles.calcBtn} onClick={handleCalc}>
                            <Calculator size={18} /> {t('importCost.calc')}
                        </button>
                    </section>

                    <section className={styles.estimatorCard}>
                        <h3 className={styles.sectionHeading}>{t('importCost.lineItemsSection')}</h3>

                        <div className={styles.lineToolbar}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => setIsPickerOpen(true)}
                            >
                                <Package size={16} /> {t('importCost.addPartsFromCenter')}
                            </button>
                            <button type="button" className={styles.secondaryBtn} onClick={addLine}>
                                <Plus size={16} /> {t('importCost.addLine')}
                            </button>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => setLinesCsvExportOpen(true)}
                            >
                                <Upload size={16} /> {t('importCost.linesCsv.export')}
                            </button>
                            <button type="button" className={styles.secondaryBtn} onClick={openLinesCsvImport}>
                                <Download size={16} /> {t('importCost.linesCsv.import')}
                            </button>
                            <span className={styles.tariffTargetHint}>{t('importCost.tariffTarget')}</span>
                        </div>
                        <p className={styles.linesCsvPimHint}>{t('importCost.linesCsv.pimHint')}</p>
                        {hasAnyLineConflict && (
                            <div className={styles.linesCsvConflictBanner} role="status">
                                {t('importCost.linesCsv.conflictHint')}
                            </div>
                        )}

                        <div className={styles.lineTableWrap}>
                            <table className={styles.lineItemsTable}>
                                <thead>
                                    <tr>
                                        <th className={styles.thNarrow}>{t('pim.thIndex')}</th>
                                        <th>零件號碼 (ID)</th>
                                        <th>車種 / 年份</th>
                                        <th>品名 / 規格</th>
                                        <th>品牌</th>
                                        <th>庫存狀態</th>
                                        <th>{t('pim.thCost')}</th>
                                        <th>售價</th>
                                        <th>備註</th>
                                        <th>實體照片</th>
                                        <th className={styles.thActions} aria-label="actions" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lineItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={COL_MAIN} className="py-8 text-center text-sm text-muted">
                                                {t('importCost.lineItemsEmptyHint')}
                                            </td>
                                        </tr>
                                    ) : lineItems.map((line, lineIdx) => {
                                        const p = line.p_id ? products.find((x) => x.p_id === line.p_id) : null;
                                        const mainPN = p?.part_numbers?.[0] || {};
                                        const rowActive = line.id === activeLineId ? styles.lineRowActive : '';
                                        const lr = lineResultByIndex[lineIdx];
                                        const lc = importLineConflicts[line.id] || {};
                                        const cf = (field) => (lc[field] ? styles.lineInputConflict : '');
                                        return (
                                            <React.Fragment key={line.id}>
                                                <tr
                                                    className={`${styles.lineBlockRow} ${rowActive}`}
                                                    onClick={() => setActiveLineId(line.id)}
                                                >
                                                    <td className={styles.tdIndex}>{lineIdx + 1}</td>
                                                    <td className={lc.p_id ? styles.tdCellConflict : undefined}>
                                                        {p ? (
                                                            <>
                                                                <div className="font-mono text-accent-hover font-bold hover:underline" onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }}>
                                                                    {p.part_number || mainPN.part_number || '-'}
                                                                </div>
                                                                <div className="text-xs text-muted mt-1">{p.p_id}</div>
                                                                {(p.part_numbers || []).length > 0 && (
                                                                    <div className="mt-1 text-[10px] bg-bg-tertiary px-1.5 py-0.5 inline-block rounded border border-border-color text-secondary cursor-pointer hover:bg-border-color" 
                                                                         onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }}>
                                                                        +{p.part_numbers.length} 適用
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-xs text-muted">— {t('importCost.pickEmptyHint')}</div>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {p ? (
                                                            <>
                                                                <div className="font-semibold text-primary">{displayCarModel(p)}</div>
                                                                <div className="text-xs text-muted mt-1">{displayCarYear(p)}</div>
                                                            </>
                                                        ) : (
                                                            <span className="text-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className={lc.productName ? styles.tdCellConflict : undefined}>
                                                        <div className="font-bold text-primary">{p?.name || line.productName || line.note || '—'}</div>
                                                        <div className="text-xs text-muted mt-1">{p?.specifications || '—'}</div>
                                                    </td>
                                                    <td>
                                                        <span className="font-bold text-accent-primary">{p?.brand || mainPN.brand || '—'}</span>
                                                    </td>
                                                    <td>{renderStockCell(p)}</td>
                                                    <td>
                                                        <span className="font-mono font-semibold text-muted">
                                                            {p ? `NT$ ${p.base_cost?.toLocaleString() ?? 0}` : '—'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {p ? (
                                                            <div className="text-[10px] text-muted leading-tight">
                                                                A {p.price_a?.toLocaleString() ?? 0}<br />
                                                                B {p.price_b?.toLocaleString() ?? 0}<br />
                                                                C {p.price_c?.toLocaleString() ?? 0}
                                                            </div>
                                                        ) : '—'}
                                                    </td>
                                                    <td>
                                                        <div className="max-w-[90px] truncate text-xs text-muted" title={p?.notes}>{p?.notes || '—'}</div>
                                                    </td>
                                                    <td className={p && productHasExternalUrlImages(p.images) ? plStyles.tdListPhotoExternal : undefined}>
                                                        {p && (p?.images?.length || 0) > 0 ? (
                                                            <div className="flex flex-col gap-1 items-start">
                                                                <div className="flex items-center gap-1">
                                                                    {(p.images[0] || '').match(/^(data:|blob:|https?:)/) ? (
                                                                        <img src={getSafeImageUrl(p.images[0])} alt="" className={styles.pimThumb} />
                                                                    ) : null}
                                                                    <span className="text-xs text-accent-primary flex items-center gap-0.5">
                                                                        <Layers size={10} /> {p.images.length}
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    title="預覽實體照片 (按 F9)"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setActiveLineId(line.id);
                                                                        setImagePreviewProduct(cur => cur?.p_id === p.p_id ? null : p);
                                                                    }}
                                                                    style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                                                >
                                                                    F9
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted">無照片</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className={styles.iconDangerBtn}
                                                            onClick={(e) => { e.stopPropagation(); removeLine(line.id); }}
                                                            title={t('importCost.removeLine')}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                                <tr
                                                    className={`${styles.lineBlockRow2} ${rowActive} ${line.tariffMiss ? styles.lineTariffRowError : ''}`}
                                                    onClick={() => setActiveLineId(line.id)}
                                                >
                                                    <td colSpan={COL_MAIN}>
                                                        <div className={styles.importFieldsGrid}>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.hsCode')}</span>
                                                                <input
                                                                    className={`${styles.lineInput} ${line.tariffMiss ? styles.lineInputTariffMiss : ''} ${cf('hsCode')}`}
                                                                    value={line.hsCode}
                                                                    data-import-line={line.id}
                                                                    data-import-field="hs"
                                                                    onChange={(e) => updateLine(line.id, {
                                                                        hsCode: e.target.value.replace(/\s/g, ''),
                                                                        tariffMiss: false,
                                                                    })}
                                                                    onBlur={(e) => bindTariffIfHs(line.id, e.target.value)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'hs')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.qty')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('quantity')}`}
                                                                    type="number"
                                                                    min={1}
                                                                    step={1}
                                                                    value={line.quantity}
                                                                    data-import-line={line.id}
                                                                    data-import-field="qty"
                                                                    onChange={(e) => updateLine(line.id, { quantity: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'qty')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.exwPrice')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('exwForeign')}`}
                                                                    type="number"
                                                                    min={0}
                                                                    step="any"
                                                                    value={line.exwForeign}
                                                                    data-import-line={line.id}
                                                                    data-import-field="exw"
                                                                    onChange={(e) => updateLine(line.id, { exwForeign: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'exw')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.volM3')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('volPerUnit')}`}
                                                                    type="number"
                                                                    min={0}
                                                                    step="any"
                                                                    value={line.volPerUnit}
                                                                    data-import-line={line.id}
                                                                    data-import-field="vol"
                                                                    onChange={(e) => updateLine(line.id, { volPerUnit: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'vol')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.weightKg')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('weightPerUnit')}`}
                                                                    type="number"
                                                                    min={0}
                                                                    step="any"
                                                                    value={line.weightPerUnit}
                                                                    data-import-line={line.id}
                                                                    data-import-field="wt"
                                                                    onChange={(e) => updateLine(line.id, { weightPerUnit: e.target.value })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'wt')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.dutyShort')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('dutyRate')}`}
                                                                    type="number"
                                                                    min={0}
                                                                    max={1}
                                                                    step="0.001"
                                                                    value={line.dutyRate}
                                                                    data-import-line={line.id}
                                                                    data-import-field="duty"
                                                                    onChange={(e) => updateLine(line.id, { dutyRate: num(e.target.value) })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'duty')}
                                                                />
                                                            </label>
                                                            <label className={styles.inlineField}>
                                                                <span>{t('importCost.exciseRate')}</span>
                                                                <input
                                                                    className={`${styles.lineInputNum} ${cf('exciseRate')}`}
                                                                    type="number"
                                                                    min={0}
                                                                    max={1}
                                                                    step="0.001"
                                                                    value={line.exciseRate}
                                                                    data-import-line={line.id}
                                                                    data-import-field="excise"
                                                                    onChange={(e) => updateLine(line.id, { exciseRate: num(e.target.value) })}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onFocus={() => setActiveLineId(line.id)}
                                                                    onKeyDown={(e) => handleImportFieldKeyDown(e, line.id, 'excise')}
                                                                />
                                                            </label>
                                                        </div>
                                                    </td>
                                                </tr>
                                                <tr
                                                    className={`${styles.lineBlockRow3} ${rowActive}`}
                                                    onClick={() => setActiveLineId(line.id)}
                                                >
                                                    <td colSpan={COL_MAIN}>
                                                        {lr ? (
                                                            <div className={styles.perLineInlineResult}>
                                                                <span><strong>{t('importCost.perLineTitle')}</strong>：</span>
                                                                <span>{t('importCost.unitAvg')} <b>{Math.round(lr.unitAverageCost).toLocaleString()}</b> TWD</span>
                                                                <span className={styles.resultSep}>｜</span>
                                                                <span>{t('importCost.retailFloor')} <b>{Math.round(lr.suggestedRetailFloor).toLocaleString()}</b> TWD</span>
                                                                <span className={styles.resultSep}>｜</span>
                                                                <span>本列落地小計 <b>{Math.round(lr.lineTotalLandedTwd).toLocaleString()}</b> TWD</span>
                                                            </div>
                                                        ) : (
                                                            <div className={styles.perLinePlaceholder}>{t('importCost.perLineAfterCalc')}</div>
                                                        )}
                                                    </td>
                                                </tr>
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className={styles.totalsRow}>
                                        <td colSpan={COL_MAIN}>
                                            <strong>{t('importCost.totalVol')}</strong>
                                            {' '}
                                            {volWeightTotals.vol.toFixed(4)}
                                            {' · '}
                                            <strong>{t('importCost.totalWeight')}</strong>
                                            {' '}
                                            {volWeightTotals.wt.toFixed(2)}
                                            {' kg'}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {activeLine && (activeLine.hsCode || activeLine.nameZh) && (
                            <div className={styles.selectedTariff}>
                                <div className={styles.selectedTariffTitle}>
                                    {t('importCost.selected')}（{activeLine.productName || activeLine.p_id || activeLine.hsCode || '—'}）
                                </div>
                                <div><strong>{activeLine.hsCode || '—'}</strong> — {activeLine.nameZh || '—'}</div>
                                <div className={styles.tariffMetaGrid}>
                                    <div>
                                        <span className={styles.metaKey}>{t('importCost.dutyCol1')}</span>
                                        <span className={styles.metaVal}>{activeLine.dutyRateText || `${(num(activeLine.dutyRate) * 100).toFixed(2)}%`}</span>
                                    </div>
                                    <div>
                                        <span className={styles.metaKey}>{t('importCost.inputRule')}</span>
                                        <span className={styles.metaVal}>{activeLine.inputRegulation || '—'}</span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={styles.linkishBtn}
                                    onClick={() => updateLine(activeLine.id, { exciseRate: activeLine.goodsTaxRateHint || 0 })}
                                >
                                    {t('importCost.applyHintExcise')}
                                </button>
                                <p className={styles.exciseHint}>{t('importCost.exciseNote')}</p>
                            </div>
                        )}

                        <div className={styles.fieldRow}>
                            <label className={styles.fieldLabel}>{t('importCost.hsCode')}</label>
                            <input
                                className={styles.input}
                                value={hsInput}
                                onChange={(e) => setHsInput(e.target.value)}
                                placeholder="87089920909"
                            />
                            <button type="button" className={styles.primaryBtn} onClick={handleHsLookup} disabled={!tariffIndex}>
                                <Search size={16} /> {t('importCost.hsLookup')}
                            </button>
                        </div>
                        <div className={styles.fieldRow}>
                            <label className={styles.fieldLabel}>{t('importCost.keyword')}</label>
                            <input
                                className={styles.input}
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                placeholder={t('importCost.keywordHint')}
                            />
                            <button type="button" className={styles.secondaryBtn} onClick={handleKeywordSearch} disabled={!tariffIndex}>
                                {t('importCost.keywordSearch')}
                            </button>
                        </div>

                        {searchHits.length > 0 && (
                            <div className={styles.hitList}>
                                <div className={styles.hitListHeader}>{t('importCost.results')} ({searchHits.length})</div>
                                <div className={styles.hitScroll}>
                                    {searchHits.map((row) => (
                                        <div key={row.hsCode} className={styles.hitRow}>
                                            <div className={styles.hitMeta}>
                                                <span className={styles.hitHs}>{row.hsCode}</span>
                                                <span className={styles.hitName}>{row.nameZh}</span>
                                                <span className={styles.hitSub}>{row.dutyRateText}</span>
                                            </div>
                                            <button
                                                type="button"
                                                className={styles.pickBtn}
                                                onClick={() => activeLine && applyTariffToLine(activeLine.id, row)}
                                                disabled={!activeLine}
                                            >
                                                {t('importCost.pickRow')}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>
                </div>

                <section className={styles.estimatorCard}>
                    <h2 className={styles.estimatorCardTitle}>{t('importCost.breakdown')}</h2>
                    {!breakdown && (
                        <p className={styles.mutedPanel}>{t('importCost.calc')}</p>
                    )}
                    {breakdown && breakdown.lineResults.length > 0 && (
                        <>
                            <div className={styles.volWtRecap}>
                                <span>{t('importCost.totalVol')} <b>{volWeightTotals.vol.toFixed(4)}</b></span>
                                <span>{t('importCost.totalWeight')} <b>{volWeightTotals.wt.toFixed(2)} kg</b></span>
                            </div>
                            <div className={styles.summaryCards}>
                                <div className={styles.summaryCard}>
                                    <span className={styles.summaryLabel}>{t('importCost.batchTotal')}</span>
                                    <span className={styles.summaryValue}>{Math.round(breakdown.grandTotalLandedTwd).toLocaleString()} TWD</span>
                                </div>
                                <div className={styles.summaryCard}>
                                    <span className={styles.summaryLabel}>{t('importCost.weightedUnitAvg')}</span>
                                    <span className={styles.summaryValueAccent}>
                                        {Math.round(breakdown.weightedUnitCost).toLocaleString()} TWD
                                    </span>
                                </div>
                            </div>

                            <table className={styles.breakdownTable}>
                                <thead>
                                    <tr>
                                        <th>{t('importCost.breakdown')}（{t('importCost.batchTotal')}）</th>
                                        <th className={styles.numCol}>TWD</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {breakdown.aggregateLines.map((line) => (
                                        <tr key={line.key} className={line.key === 'total' ? styles.breakdownTotal : ''}>
                                            <td>{line.label}</td>
                                            <td className={styles.numCol}>{Math.round(line.amount).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </>
                    )}
                    {breakdown && breakdown.lineResults.length === 0 && (
                        <p className={styles.mutedPanel}>{t('importCost.emptyResults')}</p>
                    )}
                </section>
            </div>

            <ProductPickerModal
                open={isPickerOpen}
                onClose={() => setIsPickerOpen(false)}
                onConfirm={addProductLines}
                priceMode="purchase"
            />

            {/* F8 Price History Drawer */}
            <div
                className={`${plStyles.historyDrawerShell} ${historyInlineOpen ? plStyles.historyDrawerShellOpen : ''}`}
                aria-hidden={!historyInlineOpen}
                style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', boxShadow: '0 -4px 12px rgba(0,0,0,0.15)' }}
            >
                <div className={plStyles.historyDrawerShellInner}>
                    <div className={plStyles.historyDrawer}>
                        <div className={plStyles.historyDrawerHeader}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <History size={18} style={{ marginTop: '2px', opacity: 0.85 }} aria-hidden />
                                <div>
                                    <div className={plStyles.historyDrawerTitle}>
                                        {historyContextProduct
                                            ? `客戶前價 · 廠商前價沿革｜${historyContextProduct.name || '未命名'}（${historyContextProduct.part_number || historyContextProduct.p_id || '—'}）`
                                            : '客戶前價 · 廠商前價沿革'}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        左欄：銷貨單與報價單；右欄：進貨單與詢價單。
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setHistoryInlineOpen(false)}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-tertiary)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.35rem 0.6rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}
                            >
                                <X size={14} /> 收合 (F8)
                            </button>
                        </div>
                        <ProductPriceHistoryBody
                            contextProduct={historyContextProduct}
                            customerHistoryRows={customerHistoryRows}
                            supplierHistoryRows={supplierHistoryRows}
                        />
                    </div>
                </div>
            </div>

            {/* F9 Image Preview Modal */}
            {imagePreviewProduct && (imagePreviewProduct.images || []).length > 0 && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="實體照片預覽"
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 10050,
                        background: 'rgba(15, 23, 42, 0.72)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '1rem',
                        boxSizing: 'border-box'
                    }}
                    onClick={() => {
                        setImagePreviewEnlargedIndex(null);
                        setImagePreviewZoom(1);
                        setImagePreviewProduct(null);
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: 'min(960px, 96vw)',
                            maxHeight: 'min(90vh, 880px)',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.45)',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                gap: '0.75rem',
                                padding: '0.85rem 1rem',
                                borderBottom: '1px solid var(--border-color)',
                                background: 'var(--bg-tertiary)'
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                    實體照片 · {imagePreviewProduct.name || '未命名'}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                    {imagePreviewProduct.part_number || imagePreviewProduct.p_id || '—'} · 共 {(imagePreviewProduct.images || []).length} 張 · 縮圖可點擊放大 · Esc／F9 或點遮罩關閉
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setImagePreviewEnlargedIndex(null);
                                    setImagePreviewZoom(1);
                                    setImagePreviewProduct(null);
                                }}
                                style={{
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    flexShrink: 0
                                }}
                            >
                                <X size={14} /> 關閉
                            </button>
                        </div>
                        <div
                            className="custom-scrollbar"
                            style={{
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                padding: '1rem',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: '0.85rem',
                                alignContent: 'start'
                            }}
                        >
                            {(imagePreviewProduct.images || []).map((src, i) => (
                                <div
                                    key={`${imagePreviewProduct.p_id}-img-${i}`}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(ev) => {
                                        if (ev.key === 'Enter' || ev.key === ' ') {
                                            ev.preventDefault();
                                            setImagePreviewEnlargedIndex(i);
                                            setImagePreviewZoom(1);
                                        }
                                    }}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        setImagePreviewEnlargedIndex(i);
                                        setImagePreviewZoom(1);
                                    }}
                                    style={{
                                        borderRadius: '8px',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-tertiary)',
                                        cursor: 'pointer',
                                        outline: 'none'
                                    }}
                                >
                                    <img
                                        src={getSafeImageUrl(src)}
                                        alt={`${imagePreviewProduct.name || '產品'} 照片 ${i + 1}`}
                                        style={{ width: '100%', height: 'auto', maxHeight: '320px', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
                                        loading="lazy"
                                    />
                                    <div
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '0.35rem',
                                            padding: '0.35rem 0.5rem',
                                            fontSize: '10px',
                                            color: 'var(--text-muted)',
                                            borderTop: '1px solid var(--border-color)',
                                            background: 'var(--bg-secondary)'
                                        }}
                                    >
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 700, color: 'var(--accent-hover)' }}>
                                            <ZoomIn size={12} aria-hidden /> 點擊放大
                                        </span>
                                        <a
                                            href={src}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(ev) => ev.stopPropagation()}
                                            style={{ color: 'var(--accent-primary)', fontWeight: 600 }}
                                        >
                                            原圖
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* F9 Enlarged View */}
            {imagePreviewProduct &&
                imagePreviewEnlargedIndex !== null &&
                (imagePreviewProduct.images || [])[imagePreviewEnlargedIndex] != null && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="放大檢視照片"
                        style={{
                            position: 'fixed',
                            inset: 0,
                            zIndex: 10060,
                            background: 'rgba(0, 0, 0, 0.9)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.75rem',
                            boxSizing: 'border-box'
                        }}
                        onClick={() => {
                            setImagePreviewEnlargedIndex(null);
                            setImagePreviewZoom(1);
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                                flexShrink: 0
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => bumpImagePreviewZoom(-0.25)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: '#f8fafc',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                <ZoomOut size={14} /> 縮小
                            </button>
                            <span style={{ color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 800, minWidth: '3.5rem', textAlign: 'center' }}>
                                {Math.round(imagePreviewZoom * 100)}%
                            </span>
                            <button
                                type="button"
                                onClick={() => bumpImagePreviewZoom(0.25)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: '#f8fafc',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                <ZoomIn size={14} /> 放大
                            </button>
                            <button
                                type="button"
                                onClick={() => setImagePreviewZoom(1)}
                                style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    background: 'rgba(255,255,255,0.1)',
                                    color: '#f8fafc',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                重設比例
                            </button>
                            {(imagePreviewProduct.images || []).length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const imgs = imagePreviewProduct.images || [];
                                            setImagePreviewEnlargedIndex((prev) => ((prev ?? 0) - 1 + imgs.length) % imgs.length);
                                            setImagePreviewZoom(1);
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.2rem',
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.35)',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: '#f8fafc',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <ChevronLeft size={16} /> 上一張
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const imgs = imagePreviewProduct.images || [];
                                            setImagePreviewEnlargedIndex((prev) => ((prev ?? 0) + 1) % imgs.length);
                                            setImagePreviewZoom(1);
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '0.2rem',
                                            padding: '0.35rem 0.65rem',
                                            borderRadius: '8px',
                                            border: '1px solid rgba(255,255,255,0.35)',
                                            background: 'rgba(255,255,255,0.1)',
                                            color: '#f8fafc',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        下一張 <ChevronRight size={16} />
                                    </button>
                                </>
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    setImagePreviewEnlargedIndex(null);
                                    setImagePreviewZoom(1);
                                }}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '8px',
                                    border: '1px solid rgba(255,255,255,0.35)',
                                    background: 'rgba(220,38,38,0.35)',
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                }}
                            >
                                <X size={14} /> 關閉放大
                            </button>
                        </div>
                        <div
                            className="custom-scrollbar"
                            style={{
                                flex: 1,
                                minHeight: 0,
                                width: '100%',
                                maxWidth: '96vw',
                                maxHeight: 'calc(100vh - 5.5rem)',
                                overflow: 'auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '0.5rem'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={getSafeImageUrl((imagePreviewProduct.images || [])[imagePreviewEnlargedIndex])}
                                alt={`${imagePreviewProduct.name || '產品'} 放大 ${imagePreviewEnlargedIndex + 1}`}
                                style={{
                                    maxWidth: 'min(92vw, 1400px)',
                                    maxHeight: '75vh',
                                    width: 'auto',
                                    height: 'auto',
                                    objectFit: 'contain',
                                    transform: `scale(${imagePreviewZoom})`,
                                    transformOrigin: 'center center',
                                    transition: 'transform 0.12s ease-out'
                                }}
                            />
                        </div>
                    </div>
                )}

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    activeSearchTerms={null}
                    onClose={() => setMappingProduct(null)}
                />
            )}
        </div>
    );
};

export default SourcingList;
