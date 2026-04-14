import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Package, RotateCcw } from 'lucide-react';
import { useProductStore } from '../store/useProductStore';
import { useShorthandStore } from '../store/useShorthandStore';
import { useAppStore } from '../store/useAppStore';
import AutocompleteInput from './AutocompleteInput';
import PartMappingModal from '../pages/PIM/PartMappingModal';
import DocProductHistoryDrawer from './DocProductHistoryDrawer';
import { useSearchFormKeyboardNav } from '../hooks/useSearchFormKeyboardNav';
import { isElementInDocPartEditingZone } from '../utils/docHistoryFocusZones';
import { filterProductsByPickerQuery } from '../utils/productCatalog';
import docStyles from '../pages/Documents/Documents.module.css';

const initialQuery = () => ({
    partNumber: '',
    model: '',
    part: '',
    spec: '',
    year: '',
    brand: '',
});

/**
 * 產品資料中心（與製單選貨 overlay 相同行為）：六欄搜尋、批次勾選取回、單筆「選取」、+適用對應、F8 單據歷程。
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(products: unknown[]) => void} props.onConfirm — 傳入已選商品陣列（單筆為長度 1）
 * @param {'purchase' | 'sales'} props.priceMode — 單價欄顯示進價或 A 級售價
 */
export default function ProductPickerModal({ open, onClose, onConfirm, priceMode = 'purchase' }) {
    const { products } = useProductStore();
    const { models, parts, brands } = useShorthandStore();
    const setProductHistoryFocusPId = useAppStore((s) => s.setProductHistoryFocusPId);

    const [pickerQuery, setPickerQuery] = useState(initialQuery);
    const [pickerResults, setPickerResults] = useState([]);
    const [pickerMatchTotal, setPickerMatchTotal] = useState(0);
    const [selectedPickerProductIds, setSelectedPickerProductIds] = useState([]);
    const [mappingProduct, setMappingProduct] = useState(null);
    const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);

    const pickerFirstInputRef = useRef(null);
    const pickerFormRef = useRef(null);
    const pickerResetBtnRef = useRef(null);
    const pickerListRef = useRef(null);
    const pickerSelectAllRef = useRef(null);
    const [activePickerRowIndex, setActivePickerRowIndex] = useState(0);

    const pickerFocusPId = useMemo(() => {
        if (!open || pickerResults.length === 0) return null;
        return pickerResults[activePickerRowIndex]?.p_id || null;
    }, [open, pickerResults, activePickerRowIndex, pickerResults[activePickerRowIndex]?.p_id]);

    useEffect(() => {
        if (!open) {
            setProductHistoryFocusPId(null);
            return;
        }
        setProductHistoryFocusPId(pickerFocusPId);
        return () => setProductHistoryFocusPId(null);
    }, [open, pickerFocusPId, setProductHistoryFocusPId]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.repeat || e.code !== 'F8') return;
            if (!isElementInDocPartEditingZone(document.activeElement)) return;
            if (!open) return;
            e.preventDefault();
            setHistoryDrawerOpen((v) => !v);
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);

    useEffect(() => {
        if (!open) setHistoryDrawerOpen(false);
    }, [open]);

    useEffect(() => {
        const { total, slice } = filterProductsByPickerQuery(products, pickerQuery, brands);
        setPickerMatchTotal(total);
        setPickerResults(slice);
    }, [pickerQuery, products, brands]);

    useEffect(() => {
        if (!open) return;
        if (pickerResults.length === 0) {
            setActivePickerRowIndex(0);
            return;
        }
        setActivePickerRowIndex((prev) => Math.min(prev, pickerResults.length - 1));
    }, [open, pickerResults.length]);

    useEffect(() => {
        if (!open || pickerResults.length === 0) return;
        const list = pickerListRef.current;
        if (!list?.contains(document.activeElement)) return;
        const row = list.querySelector(`[data-picker-row-idx="${activePickerRowIndex}"]`);
        row?.scrollIntoView({ block: 'nearest' });
    }, [activePickerRowIndex, open, pickerResults.length]);

    useEffect(() => {
        if (open && pickerResetBtnRef.current) {
            const t = setTimeout(() => pickerResetBtnRef.current?.focus(), 100);
            return () => clearTimeout(t);
        }
    }, [open]);

    useEffect(() => {
        if (!open) setSelectedPickerProductIds([]);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (pickerFormRef.current?.contains(document.activeElement)) return;
                e.preventDefault();
                onClose();
            }
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [open, onClose]);

    const isPickerAllSelected =
        selectedPickerProductIds.length === pickerResults.length && pickerResults.length > 0;
    const isPickerPartiallySelected =
        selectedPickerProductIds.length > 0 && selectedPickerProductIds.length < pickerResults.length;

    useEffect(() => {
        if (!pickerSelectAllRef.current || !open) return;
        pickerSelectAllRef.current.indeterminate = isPickerPartiallySelected;
    }, [isPickerPartiallySelected, open]);

    const togglePickerSelection = useCallback((pId, checked) => {
        setSelectedPickerProductIds((prev) => {
            if (checked) return prev.includes(pId) ? prev : [...prev, pId];
            return prev.filter((id) => id !== pId);
        });
    }, []);

    const togglePickerSelectAll = useCallback(
        (checked) => {
            if (!checked) {
                setSelectedPickerProductIds([]);
                return;
            }
            setSelectedPickerProductIds(pickerResults.map((p) => p.p_id));
        },
        [pickerResults]
    );

    const finishPick = useCallback(
        (selectedProducts) => {
            if (!selectedProducts?.length) return;
            onConfirm(selectedProducts);
            setSelectedPickerProductIds([]);
            onClose();
        },
        [onConfirm, onClose]
    );

    const handlePickProduct = useCallback(
        (p) => {
            finishPick([p]);
        },
        [finishPick]
    );

    const handlePickSelectedProducts = useCallback(() => {
        if (selectedPickerProductIds.length === 0) return;
        const selectedProducts = pickerResults.filter((p) => selectedPickerProductIds.includes(p.p_id));
        finishPick(selectedProducts);
    }, [selectedPickerProductIds, pickerResults, finishPick]);

    const handleClearPicker = useCallback(() => {
        setPickerQuery(initialQuery());
        requestAnimationFrame(() => pickerFirstInputRef.current?.focus());
    }, []);

    const handlePickerListKeyDown = useCallback(
        (e) => {
            if (pickerResults.length === 0) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActivePickerRowIndex((prev) => Math.min(prev + 1, pickerResults.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (activePickerRowIndex === 0) {
                    pickerResetBtnRef.current?.focus();
                    return;
                }
                setActivePickerRowIndex((prev) => Math.max(prev - 1, 0));
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                const p = pickerResults[activePickerRowIndex];
                if (p) {
                    const checked = selectedPickerProductIds.includes(p.p_id);
                    togglePickerSelection(p.p_id, !checked);
                }
            } else if (e.key === 'Enter') {
                if (selectedPickerProductIds.length > 0) {
                    e.preventDefault();
                    handlePickSelectedProducts();
                }
            }
        },
        [
            pickerResults,
            activePickerRowIndex,
            selectedPickerProductIds,
            togglePickerSelection,
            handlePickSelectedProducts,
        ]
    );

    useSearchFormKeyboardNav(pickerFormRef, null, pickerResetBtnRef, {
        enabled: open,
        searchEscapeGoesToReset: true,
    });

    const handlePickerFormKeyDown = useCallback(
        (e) => {
            if (e.defaultPrevented) return;
            if (e.key !== 'ArrowDown') return;
            const active = document.activeElement;
            if (!pickerFormRef.current?.contains(active)) return;
            if (active?.closest?.('ul')) return;
            if (pickerResults.length === 0) return;
            e.preventDefault();
            setActivePickerRowIndex(0);
            pickerListRef.current?.focus();
        },
        [pickerResults.length]
    );

    const unitPrice = useCallback(
        (p) => (priceMode === 'purchase' ? p.base_cost : p.price_a),
        [priceMode]
    );

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            data-doc-picker-zone
            style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.55)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                padding: '1.5rem',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Package size={24} style={{ color: '#3b82f6' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{'\u7522\u54c1\u8cc7\u6599\u4e2d\u5fc3'}</h2>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 600,
                    }}
                >
                    [X] {'\u95dc\u9589'}
                </button>
            </div>

            <div
                style={{
                    background: 'var(--bg-secondary)',
                    padding: '1.25rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    marginBottom: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
            >
                <form
                    ref={pickerFormRef}
                    onSubmit={(e) => e.preventDefault()}
                    onKeyDown={handlePickerFormKeyDown}
                    style={{
                        display: 'flex',
                        flexWrap: 'nowrap',
                        gap: '0.75rem',
                        alignItems: 'flex-end',
                        overflowX: 'auto',
                        paddingBottom: '0.15rem',
                    }}
                >
                    <button
                        ref={pickerResetBtnRef}
                        type="button"
                        onClick={handleClearPicker}
                        className={docStyles.searchResetBtn}
                        style={{
                            background: 'var(--bg-tertiary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            padding: '0 12px',
                            borderRadius: '8px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            height: '36px',
                            flexShrink: 0,
                        }}
                        title={'\u91cd\u8a2d\u689d\u4ef6'}
                    >
                        <RotateCcw size={16} />
                    </button>
                    <div data-picker-field="0" style={{ display: 'flex', flexDirection: 'column', minWidth: '120px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u96f6\u4ef6\u865f\u78bc'} (Part No.)
                        </label>
                        <input
                            ref={pickerFirstInputRef}
                            type="text"
                            placeholder={'\u8f38\u5165\u95dc\u9375\u5b57'}
                            value={pickerQuery.partNumber}
                            onChange={(e) => setPickerQuery({ ...pickerQuery, partNumber: e.target.value })}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                width: '100%',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>

                    <div data-picker-field="1" style={{ display: 'flex', flexDirection: 'column', minWidth: '130px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u8eca\u578b'}
                        </label>
                        <AutocompleteInput
                            value={pickerQuery.model}
                            onChange={(val) => setPickerQuery({ ...pickerQuery, model: val })}
                            placeholder={'\u8f38\u5165\u641c\u5c0b'}
                            data={models}
                            filterKey="shorthand"
                            labelKey="fullname"
                            compact={true}
                        />
                    </div>

                    <div data-picker-field="2" style={{ display: 'flex', flexDirection: 'column', minWidth: '130px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u54c1\u540d'}
                        </label>
                        <AutocompleteInput
                            value={pickerQuery.part}
                            onChange={(val) => setPickerQuery({ ...pickerQuery, part: val })}
                            placeholder={'\u8f38\u5165\u641c\u5c0b'}
                            data={parts}
                            filterKey="shorthand"
                            labelKey="fullname"
                            compact={true}
                        />
                    </div>

                    <div data-picker-field="3" style={{ display: 'flex', flexDirection: 'column', minWidth: '90px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u898f\u683c'}
                        </label>
                        <input
                            type="text"
                            placeholder={'CC\u6216\u898f\u683c'}
                            value={pickerQuery.spec}
                            onChange={(e) => setPickerQuery({ ...pickerQuery, spec: e.target.value })}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                width: '100%',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>

                    <div data-picker-field="4" style={{ display: 'flex', flexDirection: 'column', minWidth: '80px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u5e74\u4efd'}
                        </label>
                        <input
                            type="text"
                            placeholder={'\u4f8b\u5982 18-22'}
                            value={pickerQuery.year}
                            onChange={(e) => setPickerQuery({ ...pickerQuery, year: e.target.value })}
                            style={{
                                padding: '8px 12px',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-primary)',
                                width: '100%',
                                fontSize: '0.85rem',
                            }}
                        />
                    </div>

                    <div data-picker-field="5" style={{ display: 'flex', flexDirection: 'column', minWidth: '110px', flex: 1 }}>
                        <label
                            style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                color: 'var(--text-secondary)',
                                marginBottom: '0.45rem',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {'\u54c1\u724c'}
                        </label>
                        <AutocompleteInput
                            value={pickerQuery.brand}
                            onChange={(val) => setPickerQuery({ ...pickerQuery, brand: val })}
                            placeholder={'\u8f38\u5165\u641c\u5c0b'}
                            data={brands}
                            filterKey="shorthand"
                            labelKey="fullname"
                            compact={true}
                        />
                    </div>
                </form>
            </div>

            <DocProductHistoryDrawer
                open={historyDrawerOpen}
                onClose={() => setHistoryDrawerOpen(false)}
                focusPId={pickerFocusPId}
            />

            <div
                ref={pickerListRef}
                tabIndex={0}
                onKeyDown={handlePickerListKeyDown}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    outline: 'none',
                }}
            >
                <div
                    style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-tertiary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexShrink: 0,
                    }}
                >
                    <button
                        type="button"
                        onClick={handlePickSelectedProducts}
                        disabled={selectedPickerProductIds.length === 0}
                        style={{
                            background: selectedPickerProductIds.length === 0 ? 'var(--bg-tertiary)' : '#dc2626',
                            color: selectedPickerProductIds.length === 0 ? 'var(--text-muted)' : 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.45rem 0.85rem',
                            fontWeight: 700,
                            cursor: selectedPickerProductIds.length === 0 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {'\u6279\u6b21\u78ba\u8a8d\u53d6\u56de'}
                    </button>
                    <span
                        style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                        }}
                        aria-live="polite"
                    >
                        {pickerMatchTotal > 50
                            ? `\u641c\u5c0b\u7d50\u679c\uff1a\u5171 ${pickerMatchTotal} \u7b46\uff08\u986f\u793a\u524d 50 \u7b46\uff09`
                            : `\u641c\u5c0b\u7d50\u679c\uff1a${pickerMatchTotal} \u7b46`}
                    </span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead
                        style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                            fontSize: '0.75rem',
                        }}
                    >
                        <tr>
                            <th style={{ padding: '1rem', width: '48px', textAlign: 'center' }}>
                                <input
                                    ref={pickerSelectAllRef}
                                    type="checkbox"
                                    checked={isPickerAllSelected}
                                    onChange={(e) => togglePickerSelectAll(e.target.checked)}
                                />
                            </th>
                            <th style={{ padding: '1rem' }}>{'\u96f6\u4ef6\u865f\u78bc'} (ID)</th>
                            <th style={{ padding: '1rem' }}>
                                {'\u8eca\u578b'} / {'\u5e74\u4efd'}
                            </th>
                            <th style={{ padding: '1rem' }}>
                                {'\u54c1\u540d'} / {'\u898f\u683c'}
                            </th>
                            <th style={{ padding: '1rem' }}>{'\u54c1\u724c'}</th>
                            <th style={{ padding: '1rem' }}>{'\u5eab\u5b58'}</th>
                            <th style={{ padding: '1rem' }}>{'\u55ae\u50f9'}</th>
                            <th style={{ padding: '1rem', textAlign: 'center' }}>{'\u64cd\u4f5c'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pickerResults.map((p, idx) => {
                            const pnObj = p.part_numbers?.[0] || {};
                            const isActive = idx === activePickerRowIndex;
                            const zebra = idx % 2 === 1 ? 'rgba(0,0,0,0.03)' : undefined;
                            return (
                                <tr
                                    key={p.p_id}
                                    data-picker-row-idx={idx}
                                    style={{
                                        borderBottom: '1px solid var(--border-color)',
                                        backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : zebra,
                                    }}
                                >
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedPickerProductIds.includes(p.p_id)}
                                            onChange={(e) => {
                                                togglePickerSelection(p.p_id, e.target.checked);
                                                setActivePickerRowIndex(idx);
                                                requestAnimationFrame(() => pickerListRef.current?.focus());
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ color: '#60a5fa', fontWeight: 800, fontFamily: 'monospace' }}>
                                            {pnObj.part_number || p.part_number || p.p_id}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p.p_id}</div>
                                        {(p.part_numbers || []).length > 0 && (
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                style={{
                                                    marginTop: '4px',
                                                    fontSize: '10px',
                                                    backgroundColor: 'var(--bg-tertiary)',
                                                    padding: '2px 6px',
                                                    borderRadius: '4px',
                                                    color: '#60a5fa',
                                                    cursor: 'pointer',
                                                    display: 'inline-block',
                                                    border: '1px solid var(--border-color)',
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setMappingProduct(p);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.preventDefault();
                                                        setMappingProduct(p);
                                                    }
                                                }}
                                            >
                                                +{p.part_numbers.length} {'\u9069\u7528'}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {p.car_model || pnObj.car_model || '-'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {p.year || pnObj.year || '\u5e74\u4efd\u672a\u77e5'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            {p.specifications || '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                                            {p.brand || pnObj.brand || '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div
                                            style={{
                                                fontWeight: 700,
                                                color: p.stock > 0 ? '#10b981' : '#ef4444',
                                            }}
                                        >
                                            {p.stock ?? 0}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ fontWeight: 800 }}>NT$ {(unitPrice(p) ?? 0)?.toLocaleString?.() ?? 0}</div>
                                    </td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => handlePickProduct(p)}
                                            style={{
                                                backgroundColor: '#3b82f6',
                                                color: 'white',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                            }}
                                        >
                                            {'\u9078\u53d6'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {pickerResults.length === 0 && (
                            <tr>
                                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                                    {'\u67e5\u7121\u7b26\u5408\u8cc7\u6599'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {mappingProduct && (
                <PartMappingModal product={mappingProduct} onClose={() => setMappingProduct(null)} />
            )}
        </div>
    );
}
