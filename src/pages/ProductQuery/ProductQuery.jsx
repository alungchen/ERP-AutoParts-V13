import React, { useState, useRef, useEffect } from 'react';
import { Search, Filter, Layers, RotateCcw, Eye, EyeOff } from 'lucide-react';
import AutocompleteInput from '../../components/AutocompleteInput';
import ProductDrawer from '../PIM/ProductDrawer';
import PartMappingModal from '../PIM/PartMappingModal';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useProductStore } from '../../store/useProductStore';
import { useTranslation } from '../../i18n';
import styles from '../PIM/ProductList.module.css';

const ProductQuery = () => {
    const { t } = useTranslation();
    const { models, parts, brands } = useShorthandStore();
    const { products, setSelectedProduct } = useProductStore();

    const [query, setQuery] = useState({
        partNumber: '',
        model: '',
        part: '',
        spec: '',
        year: '',
        brand: ''
    });

    const [results, setResults] = useState([]);
    const [hasSearched, setHasSearched] = useState(false);
    const searchBtnRef = useRef(null);
    const clearBtnRef = useRef(null);

    const [mappingProduct, setMappingProduct] = useState(null);
    const [showPrices, setShowPrices] = useState(false);
    const [showSalesPrices, setShowSalesPrices] = useState(false);
    const [selectedPriceLevel, setSelectedPriceLevel] = useState('A');
    const firstInputRef = useRef(null);

    useEffect(() => {
        if (firstInputRef.current) {
            firstInputRef.current.focus();
        }
    }, []);

    const handleClear = () => {
        setQuery({
            partNumber: '',
            model: '',
            part: '',
            spec: '',
            year: '',
            brand: ''
        });
        setResults([]);
        setHasSearched(false);
    };

    const handleSearch = (e) => {
        if (e) e.preventDefault();

        let filtered = products;

        if (query.model) {
            const q = query.model.toLowerCase();
            filtered = filtered.filter(p =>
                // ✅ Top-level car_model field (used by new ProductDrawer)
                (p.car_model || '').toLowerCase().includes(q) ||
                // ✅ part_numbers[].car_model (mapping rows)
                (p.part_numbers || []).some(pn =>
                    (pn.car_model || '').toLowerCase().includes(q)
                ) ||
                // ✅ Legacy car_models[] array
                (p.car_models || []).some(car => {
                    const c = typeof car === 'string' ? car : ((car.model || '') + ' ' + (car.year || ''));
                    return c.toLowerCase().includes(q);
                }) ||
                // ✅ Also search product name as fallback
                (p.name || '').toLowerCase().includes(q)
            );
        }

        if (query.part) {
            const q = query.part.toLowerCase();
            filtered = filtered.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q) ||
                (p.notes || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some(pn =>
                    (pn.part_number || '').toLowerCase().includes(q) ||
                    (pn.note || '').toLowerCase().includes(q)
                )
            );
        }

        if (query.partNumber) {
            const q = query.partNumber.toLowerCase();
            filtered = filtered.filter(p =>
                (p.part_number || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some(pn => (pn.part_number || '').toLowerCase().includes(q)) ||
                (p.p_id || '').toLowerCase().includes(q)
            );
        }

        if (query.year) {
            filtered = filtered.filter(p =>
                (p.year || '').includes(query.year) ||
                (p.part_numbers || []).some(pn =>
                    (pn.year || '').includes(query.year) ||
                    (pn.car_model || '').includes(query.year)
                ) ||
                (p.car_models || []).some(car => {
                    const c = typeof car === 'string' ? car : ((car.model || '') + ' ' + (car.year || ''));
                    return c.includes(query.year);
                })
            );
        }

        if (query.spec) {
            const q = query.spec.toLowerCase();
            filtered = filtered.filter(p =>
                (p.specifications || '').toLowerCase().includes(q) ||
                (p.name || '').toLowerCase().includes(q)
            );
        }

        if (query.brand) {
            const q = query.brand.toLowerCase();
            filtered = filtered.filter(p =>
                (p.brand || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some(pn => (pn.brand || '').toLowerCase().includes(q))
            );
        }

        setResults(filtered);
        setHasSearched(true);
    };

    const handleJumpToSearch = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            setTimeout(() => {
                if (searchBtnRef.current) {
                    searchBtnRef.current.focus();
                }
            }, 100);
        } else if (e.key === 'Enter') {
            e.preventDefault();

            // Allow default form submission behavior or custom enter jump logic
            // To focus next input:
            const form = e.target.closest('form');
            if (form) {
                // Find all inputs in the form
                const allInputs = Array.from(form.querySelectorAll('input:not([disabled])'));
                const index = allInputs.indexOf(e.target);

                if (e.shiftKey) {
                    if (index > 0) {
                        allInputs[index - 1].focus();
                    } else if (index === 0 && clearBtnRef.current) {
                        clearBtnRef.current.focus();
                    }
                } else {
                    if (index > -1 && index < allInputs.length - 1) {
                        allInputs[index + 1].focus();
                    } else if (searchBtnRef.current) {
                        searchBtnRef.current.focus();
                    }
                }
            }
        }
    };

    return (
        <div className={`${styles.container} anim-fade-in`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <h1>產品查詢</h1>
                    <span className={styles.subtitle}>透過車型與零件片語快速精準搜尋產品資料</span>
                </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <form onSubmit={handleSearch} style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '0.75rem', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0, paddingRight: '0.5rem' }}>
                        <button ref={clearBtnRef} type="button" onClick={handleClear} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 16px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', height: '36px', transition: 'all 0.2s', whiteSpace: 'nowrap' }} className="hover:bg-bg-secondary focus-ring-blue">
                            <RotateCcw size={16} /> 清空
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>零件號碼 (Part No.)</label>
                        <input
                            ref={firstInputRef}
                            autoFocus
                            className="input"
                            type="text"
                            placeholder="零件號"
                            value={query.partNumber}
                            onChange={(e) => setQuery({ ...query, partNumber: e.target.value })}
                            onKeyDown={handleJumpToSearch}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            車種
                        </label>
                        <AutocompleteInput
                            value={query.model}
                            onChange={(val) => setQuery({ ...query, model: val })}
                            placeholder="支援片語"
                            data={models}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                            onKeyDown={handleJumpToSearch}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            品名
                        </label>
                        <AutocompleteInput
                            value={query.part}
                            onChange={(val) => setQuery({ ...query, part: val })}
                            placeholder="支援片語"
                            data={parts}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                            onKeyDown={handleJumpToSearch}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '100px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>規格 (Spec)</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="CC數"
                            value={query.spec}
                            onChange={(e) => setQuery({ ...query, spec: e.target.value })}
                            onKeyDown={handleJumpToSearch}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '90px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>年份 (Year)</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="例: 18-22"
                            value={query.year}
                            onChange={(e) => setQuery({ ...query, year: e.target.value })}
                            onKeyDown={handleJumpToSearch}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%' }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                            品牌 (Brand)
                        </label>
                        <AutocompleteInput
                            value={query.brand}
                            onChange={(val) => setQuery({ ...query, brand: val })}
                            placeholder="支援片語"
                            data={brands}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                            onKeyDown={handleJumpToSearch}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                        <button ref={searchBtnRef} type="submit" style={{ background: 'var(--accent-primary)', color: 'white', padding: '0 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', border: 'none', height: '36px', transition: 'all 0.2s', whiteSpace: 'nowrap' }} className="hover:opacity-90 focus-ring-blue">
                            <Search size={16} /> 查詢
                        </button>
                    </div>
                </form>
            </div>

            {hasSearched && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, minHeight: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>查詢結果</h2>
                        <button className={`${styles.btn} ${styles.btnSecondary}`}>
                            <Filter size={16} /> 進階篩選
                        </button>
                    </div>

                    {results.length > 0 ? (
                        <>
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center',
                                    marginBottom: '-0.25rem',
                                    paddingRight: '2px'
                                }}
                                aria-live="polite"
                            >
                                <span
                                    style={{
                                        fontSize: '0.8125rem',
                                        fontWeight: 600,
                                        color: 'var(--text-secondary)'
                                    }}
                                >
                                    搜尋結果：{results.length} 筆
                                </span>
                            </div>
                            <div className={`${styles.tableContainer} ${styles.tableContainerQueryResults}`}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th className={styles.thList}>{t('pim.thIndex')}</th>
                                        <th className={styles.thList}>零件號碼 (ID)</th>
                                        <th className={styles.thList}>車種 / 年份</th>
                                        <th className={styles.thList}>品名 / 規格</th>
                                        <th className={styles.thList}>品牌</th>
                                        <th className={styles.thList}>庫存狀態</th>
                                        <th className={styles.thList}>
                                            <div className="flex items-center gap-1">
                                                {t('pim.thCost')}
                                                <button
                                                    className="text-secondary hover:text-primary transition p-0.5 m-0 bg-transparent border-0 cursor-pointer rounded-full hover:bg-bg-tertiary"
                                                    onClick={() => setShowPrices(!showPrices)}
                                                    title={showPrices ? "隱藏進價" : "顯示進價"}
                                                >
                                                    {showPrices ? <Eye size={14} /> : <EyeOff size={14} />}
                                                </button>
                                            </div>
                                        </th>
                                        <th className={styles.thList}>
                                            <div className="flex items-center gap-1">
                                                售價
                                                <button
                                                    className="text-secondary hover:text-primary transition p-0.5 m-0 bg-transparent border-0 cursor-pointer rounded-full hover:bg-bg-tertiary"
                                                    onClick={() => setShowSalesPrices(!showSalesPrices)}
                                                    title={showSalesPrices ? "隱藏售價" : "顯示售價"}
                                                >
                                                    {showSalesPrices ? <Eye size={14} /> : <EyeOff size={14} />}
                                                </button>
                                            </div>
                                        </th>
                                        <th className={styles.thList}>備註</th>
                                        <th className={styles.thList}>實體照片</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((p, idx) => {
                                        const mainPN = (p.part_numbers || [])[0] || {};
                                        return (
                                            <tr key={p.p_id} className={styles.trList}>
                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>{idx + 1}</td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <div className="font-mono text-accent-hover font-bold hover:underline">
                                                        {p.part_number || mainPN.part_number || '-'}
                                                    </div>
                                                    <div className="text-xs text-muted mt-1">{p.p_id}</div>
                                                    {(p.part_numbers || []).length > 0 && (
                                                        <div className="mt-1 text-[10px] bg-bg-tertiary px-1.5 py-0.5 inline-block rounded border border-border-color text-secondary cursor-pointer hover:bg-border-color" onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }}>
                                                            +{p.part_numbers.length} 適用
                                                        </div>
                                                    )}
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <div className="font-semibold text-primary">
                                                        {(() => {
                                                            const activeCar = (p.part_numbers || []).find(pn => pn.car_model);
                                                            if (activeCar) return activeCar.car_model;
                                                            const c0 = (p.car_models || [])[0];
                                                            return p.car_model || (typeof c0 === 'string' ? c0 : c0?.model) || '-';
                                                        })()}
                                                    </div>
                                                    {((p.part_numbers || []).filter(pn => pn.car_model).length > 1 || (p.car_models || []).length > 1) &&
                                                        <div className="text-[10px] text-accent-hover">
                                                            +{(p.part_numbers || []).filter(pn => pn.car_model).length > 1 ? (p.part_numbers || []).filter(pn => pn.car_model).length - 1 : (p.car_models || []).length - 1} 車型
                                                        </div>
                                                    }
                                                    <div className="text-xs text-muted mt-1">
                                                        {(() => {
                                                            const activeCar = (p.part_numbers || []).find(pn => pn.year);
                                                            if (activeCar) return activeCar.year;
                                                            const c0 = (p.car_models || [])[0];
                                                            const cStr = typeof c0 === 'string' ? c0 : c0?.year;
                                                            return p.year || (cStr?.match(/\d{4}-\d{4}/) ? cStr.match(/\d{4}-\d{4}/)[0] : cStr) || '不限年份';
                                                        })()}
                                                    </div>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <div className="font-bold text-primary max-w-[180px] truncate" title={p.name}>{p.name || '-'}</div>
                                                    <div className="text-xs text-muted mt-1 max-w-[180px] truncate" title={p.specifications}>{p.specifications || '-'}</div>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <span className="font-bold text-accent-primary">{p.brand || mainPN.brand || '-'}</span>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <div className="flex flex-col gap-1 items-start">
                                                        <span className={`text-xs px-2 py-0.5 rounded-sm font-bold ${p.stock > p.safety_stock ? 'bg-success-subtle text-success' : p.stock > 0 ? 'bg-warning-subtle text-warning' : 'bg-danger-subtle text-danger'}`}>
                                                            {p.stock || 0} 現貨
                                                        </span>
                                                        <span className="text-[10px] text-muted font-mono">安全庫存: {p.safety_stock || 0}</span>
                                                    </div>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <span className="font-mono font-semibold text-muted">
                                                        {showPrices ? `NT$ ${p.base_cost?.toLocaleString() || 0}` : '***'}
                                                    </span>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    {showSalesPrices ? (
                                                        <select
                                                            className="bg-bg-secondary border border-border-color text-primary text-xs rounded px-1 py-1 w-[120px] outline-none cursor-pointer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            value={selectedPriceLevel}
                                                            onChange={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedPriceLevel(e.target.value);
                                                            }}
                                                        >
                                                            <option value="A">售價A: NT$ {p.price_a?.toLocaleString() || 0}</option>
                                                            <option value="B">售價B: NT$ {p.price_b?.toLocaleString() || 0}</option>
                                                            <option value="C">售價C: NT$ {p.price_c?.toLocaleString() || 0}</option>
                                                        </select>
                                                    ) : (
                                                        <span className="font-mono font-semibold text-muted">***</span>
                                                    )}
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    <div className="max-w-[120px] truncate text-xs text-muted" title={p.notes}>{p.notes || '-'}</div>
                                                </td>

                                                <td className={styles.tdList} onClick={() => setSelectedProduct(p)}>
                                                    {(p.images || []).length > 0 ? (
                                                        <span className="text-xs text-accent-primary bg-accent-subtle px-2 py-1 rounded border border-accent-primary flex items-center gap-1 max-w-fit">
                                                            <Layers size={10} /> {p.images.length} 張
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-muted bg-bg-secondary px-2 py-1 rounded border border-border-color">無照片</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <Layers size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
                            <p>沒有找到符合條件的產品，請嘗試調整關鍵字或片語。</p>
                        </div>
                    )}
                </div>
            )}

            <ProductDrawer />

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    onClose={() => setMappingProduct(null)}
                />
            )}
        </div>
    );
};

export default ProductQuery;
