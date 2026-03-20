import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Filter, Download, Upload, Layers, Eye, EyeOff, RotateCcw, Printer, History, X } from 'lucide-react';
import { useProductStore } from '../../store/useProductStore';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useTranslation } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import AutocompleteInput from '../../components/AutocompleteInput';
import ProductDrawer from './ProductDrawer';
import PartMappingModal from './PartMappingModal';
import { useSearchFormKeyboardNav } from '../../hooks/useSearchFormKeyboardNav';
import { collectCustomerSalesHistory, collectSupplierPurchaseHistory } from '../../utils/buildProductTransactionHistory';
import ProductPriceHistoryBody from '../../components/ProductPriceHistoryBody';
import styles from './ProductList.module.css';

const getPrimaryPartNumber = (p) =>
    p?.part_number || p?.part_numbers?.[0]?.part_number || '';

const DEFAULT_QUERY = {
    partNumber: '',
    model: '',
    part: '',
    spec: '',
    year: '',
    brand: ''
};

const PIM_SEARCH_STATE_KEY = 'erp-pim-search-state';

const filterProductsByQuery = (sourceProducts, query) => {
    let filtered = sourceProducts;

    if (query.model) {
        const q = query.model.toLowerCase();
        filtered = filtered.filter(p =>
            (p.car_model || '').toLowerCase().includes(q) ||
            (p.part_numbers || []).some(pn => (pn.car_model || '').toLowerCase().includes(q)) ||
            (p.car_models || []).some(car => {
                const c = typeof car === 'string' ? car : ((car.model || '') + ' ' + (car.year || ''));
                return c.toLowerCase().includes(q);
            }) ||
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

    return filtered;
};

const ProductList = () => {
    const { products, setSelectedProduct, bulkUpdateProducts, selectedProduct } = useProductStore();
    const {
        purchaseOrders = [],
        salesOrders = [],
        quotations = [],
        inquiries = [],
        addProductsToShortageBook
    } = useDocumentStore();
    const { models, parts, brands } = useShorthandStore();
    const { t } = useTranslation();
    const showImportExport = useAppStore((s) => s.showImportExport);
    const setProductHistoryFocusPId = useAppStore((s) => s.setProductHistoryFocusPId);

    const [query, setQuery] = useState(() => {
        try {
            const raw = localStorage.getItem(PIM_SEARCH_STATE_KEY);
            if (!raw) return DEFAULT_QUERY;
            const saved = JSON.parse(raw);
            return { ...DEFAULT_QUERY, ...(saved?.query || {}) };
        } catch {
            return DEFAULT_QUERY;
        }
    });
    const [hasSearched, setHasSearched] = useState(() => {
        try {
            const raw = localStorage.getItem(PIM_SEARCH_STATE_KEY);
            if (!raw) return false;
            const saved = JSON.parse(raw);
            return !!saved?.hasSearched;
        } catch {
            return false;
        }
    });
    const [results, setResults] = useState(products);
    const [mappingProduct, setMappingProduct] = useState(null);
    const [showPrices, setShowPrices] = useState(false);
    const [showSalesPrices, setShowSalesPrices] = useState(false);
    const [selectedPriceLevel, setSelectedPriceLevel] = useState('A');
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [isImportResultOpen, setIsImportResultOpen] = useState(false);
    const [importResult, setImportResult] = useState({ processed: 0, updated: 0, added: 0, skipped: 0 });
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [activeRowIndex, setActiveRowIndex] = useState(0);
    const [historyInlineOpen, setHistoryInlineOpen] = useState(false);
    const [exportFields, setExportFields] = useState(() => {
        const defaultFields = {
            part_number: true, // mandatory key
            p_id: true,
            name: true,
            car_model: true,
            specifications: true,
            year: true,
            brand: true,
            notes: true,
            stock: true,
            safety_stock: true,
            base_cost: true,
            price_a: true,
            price_b: true,
            price_c: true,
            part_numbers: false,
            images: false,
        };
        try {
            const raw = localStorage.getItem('erp-pim-export-fields');
            if (!raw) return defaultFields;
            const saved = JSON.parse(raw);
            return { ...defaultFields, ...saved, part_number: true };
        } catch {
            return defaultFields;
        }
    });

    const resetBtnRef = useRef(null);
    const formRef = useRef(null);
    const firstInputRef = useRef(null);
    const fileInputRef = useRef(null);
    const selectAllRef = useRef(null);
    const productTbodyRef = useRef(null);
    const productListKeyboardRef = useRef(null);
    const hasAutoFocusedListRef = useRef(false);

    // Apply filters immediately when query changes (same behavior as document picker).
    useEffect(() => {
        const hasAnyQuery = Object.values(query).some((v) => String(v ?? '').trim() !== '');
        if (!hasAnyQuery) {
            setResults(products);
            setHasSearched(false);
            return;
        }
        setResults(filterProductsByQuery(products, query));
        setHasSearched(true);
    }, [products, query]);

    useEffect(() => {
        localStorage.setItem(PIM_SEARCH_STATE_KEY, JSON.stringify({ query, hasSearched }));
    }, [query, hasSearched]);

    useEffect(() => {
        localStorage.setItem('erp-pim-export-fields', JSON.stringify({ ...exportFields, part_number: true }));
    }, [exportFields]);

    useEffect(() => {
        setSelectedProductIds((prev) => prev.filter((id) => results.some((item) => item.p_id === id)));
    }, [results]);

    useEffect(() => {
        if (results.length === 0) {
            setActiveRowIndex(0);
            return;
        }
        setActiveRowIndex(0);
    }, [results]);

    const isAllSelected = results.length > 0 && selectedProductIds.length === results.length;
    const isPartiallySelected = selectedProductIds.length > 0 && selectedProductIds.length < results.length;

    useEffect(() => {
        if (!selectAllRef.current) return;
        selectAllRef.current.indeterminate = isPartiallySelected;
    }, [isPartiallySelected]);


    const focusProductRow = (rowIdx) => {
        const rowEl = productTbodyRef.current?.querySelector(`[data-product-row-idx="${rowIdx}"]`);
        if (!rowEl) return;
        rowEl.focus();
        rowEl.scrollIntoView({ block: 'nearest' });
    };

    const focusFirstSearchField = () => {
        const inputEl = firstInputRef.current;
        if (!inputEl) return;
        inputEl.focus();
        requestAnimationFrame(() => {
            const value = inputEl.value;
            if (typeof value === 'string' && value.length > 0 && typeof inputEl.select === 'function') {
                inputEl.select();
            }
        });
    };

    useEffect(() => {
        if (!productListKeyboardRef.current || results.length === 0) return;
        if (hasAutoFocusedListRef.current) return;
        hasAutoFocusedListRef.current = true;
        setActiveRowIndex(0);
        const focusFirst = () => {
            const firstRow = productTbodyRef.current?.querySelector('[data-product-row-idx="0"]');
            if (firstRow) focusProductRow(0);
            else productListKeyboardRef.current?.focus();
        };
        focusFirst();
        const t1 = setTimeout(focusFirst, 80);
        const t2 = setTimeout(focusFirst, 220);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, [results.length]);

    useEffect(() => {
        if (!productTbodyRef.current) return;
        const activeEl = document.activeElement;
        const listIsActive = productListKeyboardRef.current?.contains(activeEl);
        if (!listIsActive) return;
        focusProductRow(activeRowIndex);
    }, [activeRowIndex]);

    const handleProductListKeyDown = (e) => {
        if (results.length === 0) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            firstInputRef.current?.focus();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIdx = Math.min(activeRowIndex + 1, results.length - 1);
            setActiveRowIndex(nextIdx);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIdx = Math.max(activeRowIndex - 1, 0);
            setActiveRowIndex(prevIdx);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const activeItem = results[activeRowIndex];
            if (!activeItem) return;
            setSelectedProduct(activeItem); // 等同雙擊列，開啟檢視抽屜
        } else if (e.key === ' ' || e.code === 'Space') {
            e.preventDefault();
            const activeItem = results[activeRowIndex];
            if (!activeItem) return;
            const checked = selectedProductIds.includes(activeItem.p_id);
            toggleSelection(activeItem.p_id, !checked);
        }
    };

    const handleClear = () => {
        setQuery(DEFAULT_QUERY);
        setResults(products);
        setHasSearched(false);
        localStorage.removeItem(PIM_SEARCH_STATE_KEY);
    };

    useSearchFormKeyboardNav(formRef, null, resetBtnRef);

    const historyFocusPId = useMemo(() => {
        if (selectedProduct && !selectedProduct.isNew && selectedProduct.p_id) {
            return selectedProduct.p_id;
        }
        return results[activeRowIndex]?.p_id || null;
    }, [selectedProduct?.p_id, selectedProduct?.isNew, activeRowIndex, results[activeRowIndex]?.p_id]);

    useEffect(() => {
        setProductHistoryFocusPId(historyFocusPId);
        return () => setProductHistoryFocusPId(null);
    }, [historyFocusPId, setProductHistoryFocusPId]);

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

    const historyContextProduct = useMemo(() => {
        if (!historyFocusPId) return null;
        const canonical = products.find((p) => p.p_id === historyFocusPId);
        if (canonical) return canonical;
        if (selectedProduct?.p_id === historyFocusPId) return selectedProduct;
        return null;
    }, [historyFocusPId, products, selectedProduct]);

    const customerHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectCustomerSalesHistory(historyContextProduct, salesOrders, quotations);
    }, [historyContextProduct, salesOrders, quotations]);

    const supplierHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectSupplierPurchaseHistory(historyContextProduct, purchaseOrders, inquiries);
    }, [historyContextProduct, purchaseOrders, inquiries]);

    const handleSearchFormKeyDown = (e) => {
        if (e.defaultPrevented) return;
        const formEl = formRef.current;
        const activeEl = document.activeElement;
        if (!formEl || !activeEl || !formEl.contains(activeEl)) return;
        if (activeEl.closest?.('ul')) return; // Autocomplete list open; let component handle keys.

        const isInSearchField = !!activeEl.closest?.('[data-search-field]');
        if (!isInSearchField) return;

        if (e.key === 'Escape') {
            e.preventDefault();
            resetBtnRef.current?.focus();
            return;
        }

        if (e.key === 'ArrowDown' && results.length > 0) {
            e.preventDefault();
            setActiveRowIndex(0);
            requestAnimationFrame(() => focusProductRow(0));
        }
    };

    const handleAddProduct = () => {
        setSelectedProduct({
            isNew: true,
            p_id: `PN-${Date.now().toString().slice(-4)}`,
            part_number: '',
            car_model: '',
            name: '',
            specifications: '',
            year: '',
            brand: '',
            stock: 0,
            safety_stock: 0,
            base_cost: 0,
            part_numbers: [],
            car_models: [],
            notes: '',
            images: [],
            category: ''
        });
    };

    const toggleSelection = (pId, checked) => {
        setSelectedProductIds((prev) => {
            if (checked) {
                if (prev.includes(pId)) return prev;
                return [...prev, pId];
            }
            return prev.filter((id) => id !== pId);
        });
    };

    const toggleSelectAll = (checked) => {
        if (!checked) {
            setSelectedProductIds([]);
            return;
        }
        setSelectedProductIds(results.map((p) => p.p_id));
    };

    const handleAddSelectedToShortageBook = () => {
        if (selectedProductIds.length === 0) return;
        const selectedProducts = results.filter((p) => selectedProductIds.includes(p.p_id));
        addProductsToShortageBook(selectedProducts, purchaseOrders);
        setSelectedProductIds([]);
        alert(`已將 ${selectedProducts.length} 項加入缺貨簿`);
    };

    const getPrimaryPartNumber = (p) => p.part_number || p?.part_numbers?.[0]?.part_number || '';

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const parseCsvRow = (row) => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

    const parseJsonSafe = (value, fallback) => {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    };

    const fieldMeta = [
        { key: 'part_number', label: 'Part Number', mandatory: true, getter: (p) => getPrimaryPartNumber(p) },
        { key: 'p_id', label: 'P-ID', getter: (p) => p.p_id || '' },
        { key: 'name', label: 'Name', getter: (p) => p.name || '' },
        { key: 'car_model', label: 'Car Model', getter: (p) => p.car_model || '' },
        { key: 'specifications', label: 'Specifications', getter: (p) => p.specifications || '' },
        { key: 'year', label: 'Year', getter: (p) => p.year || '' },
        { key: 'brand', label: 'Brand', getter: (p) => p.brand || '' },
        { key: 'notes', label: 'Notes', getter: (p) => p.notes || '' },
        { key: 'stock', label: 'Stock', getter: (p) => p.stock || 0 },
        { key: 'safety_stock', label: 'Safety Stock', getter: (p) => p.safety_stock || 0 },
        { key: 'base_cost', label: 'Cost', getter: (p) => p.base_cost || 0 },
        { key: 'price_a', label: 'Price A', getter: (p) => p.price_a || 0 },
        { key: 'price_b', label: 'Price B', getter: (p) => p.price_b || 0 },
        { key: 'price_c', label: 'Price C', getter: (p) => p.price_c || 0 },
        { key: 'part_numbers', label: 'Part Numbers(JSON)', getter: (p) => JSON.stringify(p.part_numbers || []) },
        { key: 'images', label: 'Images(JSON)', getter: (p) => JSON.stringify(p.images || []) },
    ];

    const runExport = async () => {
        try {
            const selectedFields = fieldMeta.filter((f) => exportFields[f.key] || f.mandatory);
            const headers = selectedFields.map((f) => f.label);
            const csvRows = [headers.join(',')];
            results.forEach(p => {
                const row = selectedFields.map((f) => toCsvCell(f.getter(p)));
                csvRows.push(row.join(','));
            });

            // Add BOM for Excel UTF-8 compatibility
            const csvContent = "\uFEFF" + csvRows.join('\n');
            const fileName = `products_export_${new Date().toISOString().slice(0, 10)}.csv`;

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{
                            description: 'CSV File',
                            accept: { 'text/csv': ['.csv'] },
                        }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(csvContent);
                    await writable.close();
                    alert(`匯出成功！已匯出 ${results.length} 筆。`);
                } catch (pickerErr) {
                    if (pickerErr.name === 'AbortError') return;
                    throw pickerErr;
                }
            } else {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                alert(`匯出成功！已匯出 ${results.length} 筆。`);
            }
            setIsExportDialogOpen(false);
        } catch (err) {
            console.error("Export failed:", err);
            alert("匯出發生錯誤，請檢查主控台。");
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = text.split('\n').map((r) => r.trim()).filter(Boolean);
                if (rows.length < 2) return;
                const headers = parseCsvRow(rows[0]).map((h) => h.toLowerCase());
                const idx = {
                    part_number: headers.findIndex((h) => ['part number', 'part_number', '零件號碼', '零件號', 'partno'].includes(h)),
                    p_id: headers.findIndex((h) => ['p-id', 'p_id', 'pid'].includes(h)),
                    name: headers.findIndex((h) => ['name', '品名', '零件名稱'].includes(h)),
                    car_model: headers.findIndex((h) => ['car model', 'car_model', '車型'].includes(h)),
                    specifications: headers.findIndex((h) => ['specifications', 'specification', '規格'].includes(h)),
                    year: headers.findIndex((h) => ['year', '年份'].includes(h)),
                    brand: headers.findIndex((h) => ['brand', '品牌'].includes(h)),
                    notes: headers.findIndex((h) => ['notes', '備註'].includes(h)),
                    stock: headers.findIndex((h) => ['stock', '庫存'].includes(h)),
                    safety_stock: headers.findIndex((h) => ['safety stock', 'safety_stock', '安全庫存', 'safetystock'].includes(h)),
                    base_cost: headers.findIndex((h) => ['cost', 'base_cost', '進價', '成本'].includes(h)),
                    price_a: headers.findIndex((h) => ['price a', 'price_a', '售價a', '售價 a'].includes(h)),
                    price_b: headers.findIndex((h) => ['price b', 'price_b', '售價b', '售價 b'].includes(h)),
                    price_c: headers.findIndex((h) => ['price c', 'price_c', '售價c', '售價 c'].includes(h)),
                    part_numbers: headers.findIndex((h) => ['part numbers(json)', 'part_numbers(json)', 'part_numbers', '適用車型料號', '料號對照'].includes(h)),
                    images: headers.findIndex((h) => ['images(json)', 'images', '圖片'].includes(h)),
                };

                if (idx.part_number === -1) {
                    alert('匯入失敗：檔案缺少「零件號碼 / Part Number」欄位。');
                    return;
                }

                const dataRows = rows.slice(1);
                const updates = [];
                let processed = 0;
                let updated = 0;
                let added = 0;
                let skipped = 0;

                dataRows.forEach((row) => {
                    const parts = parseCsvRow(row);
                    const partNumber = (parts[idx.part_number] || '').trim();
                    if (!partNumber) {
                        skipped += 1;
                        return;
                    }

                    const existing = products.find((p) => getPrimaryPartNumber(p) === partNumber);
                    const base = existing
                        ? { ...existing }
                        : {
                            p_id: `P-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
                            part_numbers: [],
                            car_models: [],
                            images: [],
                            stock: 0,
                            base_cost: 0,
                            safety_stock: 0,
                            name: '',
                            brand: '',
                            notes: '',
                            category: '',
                            specifications: '',
                        };

                    const next = { ...base, part_number: partNumber };
                    if (idx.p_id !== -1 && parts[idx.p_id]) next.p_id = parts[idx.p_id];
                    if (idx.name !== -1 && parts[idx.name] !== '') next.name = parts[idx.name];
                    if (idx.car_model !== -1 && parts[idx.car_model] !== '') next.car_model = parts[idx.car_model];
                    if (idx.specifications !== -1 && parts[idx.specifications] !== '') next.specifications = parts[idx.specifications];
                    if (idx.year !== -1 && parts[idx.year] !== '') next.year = parts[idx.year];
                    if (idx.brand !== -1 && parts[idx.brand] !== '') next.brand = parts[idx.brand];
                    if (idx.notes !== -1 && parts[idx.notes] !== '') next.notes = parts[idx.notes];
                    if (idx.stock !== -1 && parts[idx.stock] !== '') next.stock = Number(parts[idx.stock]) || 0;
                    if (idx.safety_stock !== -1 && parts[idx.safety_stock] !== '') next.safety_stock = Number(parts[idx.safety_stock]) || 0;
                    if (idx.base_cost !== -1 && parts[idx.base_cost] !== '') next.base_cost = Number(parts[idx.base_cost]) || 0;
                    if (idx.price_a !== -1 && parts[idx.price_a] !== '') next.price_a = Number(parts[idx.price_a]) || 0;
                    if (idx.price_b !== -1 && parts[idx.price_b] !== '') next.price_b = Number(parts[idx.price_b]) || 0;
                    if (idx.price_c !== -1 && parts[idx.price_c] !== '') next.price_c = Number(parts[idx.price_c]) || 0;
                    if (idx.part_numbers !== -1 && parts[idx.part_numbers] !== '') next.part_numbers = parseJsonSafe(parts[idx.part_numbers], base.part_numbers || []);
                    if (idx.images !== -1 && parts[idx.images] !== '') next.images = parseJsonSafe(parts[idx.images], base.images || []);

                    updates.push(next);
                    processed += 1;
                    if (existing) updated += 1;
                    else added += 1;
                });

                if (updates.length > 0) {
                    bulkUpdateProducts(updates);
                    handleClear();
                }
                setImportResult({ processed, updated, added, skipped });
                setIsImportResultOpen(true);
            } catch (err) {
                console.error("Import error:", err);
                alert("解析檔案時發生錯誤，請確保檔案格式正確。");
            }
        };
        reader.readAsText(file);
        // Clear input so same file can be selected again
        e.target.value = '';
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            alert('無法開啟列印視窗，請允許瀏覽器彈出視窗後再試。');
            return;
        }

        const activeFilters = [
            query.partNumber && `零件號碼: ${query.partNumber}`,
            query.model && `車型: ${query.model}`,
            query.part && `零件名稱: ${query.part}`,
            query.spec && `規格: ${query.spec}`,
            query.year && `年份: ${query.year}`,
            query.brand && `品牌: ${query.brand}`
        ].filter(Boolean);

        const rowsHtml = results.map((p, idx) => {
            const mainPN = p?.part_numbers?.[0] || {};
            const activeCarModel = (p.part_numbers || []).find(pn => pn.car_model)?.car_model;
            const c0 = (p.car_models || [])[0];
            const fallbackCarModel = typeof c0 === 'string' ? c0 : c0?.model;
            const displayModel = activeCarModel || p.car_model || fallbackCarModel || '-';

            const activeYear = (p.part_numbers || []).find(pn => pn.year)?.year;
            const c0YearRaw = typeof c0 === 'string' ? c0 : c0?.year;
            const normalizedC0Year = c0YearRaw?.match(/\d{4}-\d{4}/) ? c0YearRaw.match(/\d{4}-\d{4}/)[0] : c0YearRaw;
            const displayYear = activeYear || p.year || normalizedC0Year || '不限年份';

            const saleValue = selectedPriceLevel === 'B'
                ? p.price_b
                : selectedPriceLevel === 'C'
                    ? p.price_c
                    : p.price_a;
            const displaySalePrice = showSalesPrices ? `售價${selectedPriceLevel}: NT$ ${(saleValue || 0).toLocaleString()}` : '***';

            const stockNum = Number(p.stock) || 0;
            const safetyNum = Number(p.safety_stock) || 0;
            const belowSafetyPrint = safetyNum > 0 && stockNum < safetyNum;
            const stockCellHtml = belowSafetyPrint
                ? `${escapeHtml(String(stockNum))}<span style="color:#dc2626;font-weight:800;"> 現貨</span>`
                : `${escapeHtml(String(stockNum))} 現貨`;

            return `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${escapeHtml(p.part_number || mainPN.part_number || '-')}</td>
                    <td>${escapeHtml(displayModel)} / ${escapeHtml(displayYear)}</td>
                    <td>${escapeHtml(p.name || '-')}<br><span class="muted">${escapeHtml(p.specifications || '-')}</span></td>
                    <td>${escapeHtml(p.brand || mainPN.brand || '-')}</td>
                    <td>${stockCellHtml}<br><span class="muted">安全庫存: ${escapeHtml(String(safetyNum))}</span></td>
                    <td>${showPrices ? `NT$ ${(p.base_cost || 0).toLocaleString()}` : '***'}</td>
                    <td>${escapeHtml(displaySalePrice)}</td>
                    <td>${escapeHtml(p.notes || '-')}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <!doctype html>
            <html lang="zh-Hant">
            <head>
                <meta charset="utf-8" />
                <title>產品資料庫列印</title>
                <style>
                    body { font-family: Arial, "Microsoft JhengHei", sans-serif; margin: 16px; color: #111827; }
                    h1 { margin: 0 0 6px 0; font-size: 20px; }
                    .meta { margin: 0 0 12px 0; color: #4b5563; font-size: 12px; }
                    .filters { margin: 0 0 12px 0; font-size: 12px; color: #1f2937; }
                    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                    th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 11px; vertical-align: top; word-break: break-word; }
                    th { background: #f3f4f6; font-weight: 700; text-align: left; }
                    .muted { color: #6b7280; font-size: 10px; }
                    @media print {
                        body { margin: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>產品資料庫（目前顯示資料）</h1>
                <p class="meta">列印時間: ${new Date().toLocaleString('zh-TW')} | 筆數: ${results.length}</p>
                <p class="filters">搜尋條件: ${escapeHtml(activeFilters.length > 0 ? activeFilters.join('、') : '無（顯示全部）')}</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width:40px;">#</th>
                            <th style="width:120px;">零件號碼</th>
                            <th style="width:160px;">車型 / 年份</th>
                            <th style="width:180px;">品名 / 規格</th>
                            <th style="width:90px;">品牌</th>
                            <th style="width:110px;">庫存</th>
                            <th style="width:90px;">進價</th>
                            <th style="width:130px;">售價</th>
                            <th>備註</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 200);
    };

    return (
        <div className={`${styles.container} anim-fade-in`}>
            <div className={styles.header}>
                <div className={styles.title}>
                    <h1>{t('pim.title')}</h1>
                    <span className={styles.subtitle}>{t('pim.subtitle')}</span>
                </div>
                <div className={styles.actions}>
                    {showImportExport && (
                        <>
                            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />
                            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => fileInputRef.current?.click()}>
                                <Download size={18} /> {t('pim.import')}
                            </button>
                            <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => setIsExportDialogOpen(true)}>
                                <Upload size={18} /> {t('pim.export')}
                            </button>
                        </>
                    )}
                    <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handlePrint}>
                        <Printer size={18} /> 列印
                    </button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleAddProduct}>
                        <Plus size={18} /> {t('pim.add')}
                    </button>
                </div>
            </div>

            {/* Merged Advanced Search Bar */}
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <form ref={formRef} data-search-form onSubmit={(e) => e.preventDefault()} onKeyDown={handleSearchFormKeyDown} style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <button ref={resetBtnRef} type="button" data-search-reset="true" className={styles.searchResetBtn} onClick={handleClear} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', padding: '0 12px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', height: '36px', transition: '0.2s' }} title="重設全部條件">
                        <RotateCcw size={16} />
                    </button>

                    <div className={styles.searchField} data-search-field data-search-field-index="0" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '120px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>零件號碼 (Part No.)</label>
                        <input
                            ref={firstInputRef}
                            className={styles.searchInput}
                            type="text"
                            placeholder="單號或號碼"
                            value={query.partNumber}
                            onChange={(e) => setQuery({ ...query, partNumber: e.target.value })}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>

                    <div className={styles.searchField} data-search-field data-search-field-index="1" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>車型 (Model)</label>
                        <AutocompleteInput
                            value={query.model}
                            onChange={(val) => setQuery({ ...query, model: val })}
                            placeholder="支援片語"
                            data={models}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                        />
                    </div>

                    <div className={styles.searchField} data-search-field data-search-field-index="2" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>零件名稱 (Part)</label>
                        <AutocompleteInput
                            value={query.part}
                            onChange={(val) => setQuery({ ...query, part: val })}
                            placeholder="支援片語"
                            data={parts}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                        />
                    </div>

                    <div className={styles.searchField} data-search-field data-search-field-index="3" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '100px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>規格 (Spec)</label>
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="CC數/尺寸"
                            value={query.spec}
                            onChange={(e) => setQuery({ ...query, spec: e.target.value })}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>

                    <div className={styles.searchField} data-search-field data-search-field-index="4" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '90px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>年份 (Year)</label>
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="例: 18-22"
                            value={query.year}
                            onChange={(e) => setQuery({ ...query, year: e.target.value })}
                            style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '0.85rem' }}
                        />
                    </div>

                    <div className={styles.searchField} data-search-field data-search-field-index="5" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '110px', flex: 1 }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>品牌 (Brand)</label>
                        <AutocompleteInput
                            value={query.brand}
                            onChange={(val) => setQuery({ ...query, brand: val })}
                            placeholder="支援片語"
                            data={brands}
                            filterKey="shorthand"
                            labelKey="fullname"
                            required={false}
                            compact={true}
                        />
                    </div>
                </form>
                <div style={{ marginTop: '0.55rem', fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                    <History size={14} style={{ flexShrink: 0, opacity: 0.85 }} aria-hidden />
                    <span>
                        按 <strong style={{ color: 'var(--text-secondary)' }}>F8</strong> 於搜尋區塊下方滑出／收合「客戶前價／廠商前價」沿革抽屜（列表反白列；若已開啟產品抽屜則以該品為主）。
                    </span>
                </div>

                <div
                    className={`${styles.historyDrawerShell} ${historyInlineOpen ? styles.historyDrawerShellOpen : ''}`}
                    aria-hidden={!historyInlineOpen}
                >
                    <div className={styles.historyDrawerShellInner}>
                        <div className={styles.historyDrawer}>
                            <div className={styles.historyDrawerHeader}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                    <History size={18} style={{ marginTop: '2px', opacity: 0.85 }} aria-hidden />
                                    <div>
                                        <div className={styles.historyDrawerTitle}>
                                            {historyContextProduct
                                                ? `客戶前價 · 廠商前價沿革｜${historyContextProduct.name || '未命名'}（${getPrimaryPartNumber(historyContextProduct) || historyContextProduct.p_id || '—'}）`
                                                : '客戶前價 · 廠商前價沿革'}
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                            左欄：銷貨單與報價單；右欄：進貨單與詢價單。
                                            {(!historyFocusPId || !historyContextProduct) && (
                                                <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> 目前無對應產品 p_id。</span>
                                            )}
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
                                    <X size={14} /> 收合（F8）
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
            </div>

            <div
                className={`${styles.tableContainer} ${styles.tableContainerFlexCol}`}
                ref={productListKeyboardRef}
                tabIndex={0}
                onKeyDown={handleProductListKeyDown}
                style={{ outline: 'none' }}
            >
                <div
                    style={{
                        padding: '0.75rem 1rem',
                        borderBottom: '1px solid var(--border-color)',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '1rem',
                        flexShrink: 0
                    }}
                >
                    <button
                        onClick={handleAddSelectedToShortageBook}
                        disabled={selectedProductIds.length === 0}
                        style={{
                            background: selectedProductIds.length === 0 ? 'var(--bg-tertiary)' : '#dc2626',
                            color: selectedProductIds.length === 0 ? 'var(--text-muted)' : 'white',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '0.45rem 0.85rem',
                            fontWeight: 700,
                            cursor: selectedProductIds.length === 0 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        加到缺貨簿
                    </button>
                    <span
                        style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap'
                        }}
                        aria-live="polite"
                    >
                        搜尋結果：{results.length} 筆
                    </span>
                </div>
                <div className={styles.tableScrollInner}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.thList} style={{ width: '48px', textAlign: 'center' }}>
                                <input
                                    ref={selectAllRef}
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                />
                            </th>
                            <th className={styles.thList}>{t('pim.thIndex')}</th>
                            <th className={styles.thList}>零件號碼 (ID)</th>
                            <th className={styles.thList}>車型 / 年份</th>
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
                    <tbody ref={productTbodyRef}>
                        {results.map((p, idx) => {
                            const mainPN = p?.part_numbers?.[0] || {};
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
                                <tr
                                    key={p.p_id}
                                    className={styles.trList}
                                    data-product-row-idx={idx}
                                    tabIndex={-1}
                                    style={activeRowIndex === idx ? { backgroundColor: 'var(--bg-tertiary)' } : undefined}
                                    onClick={() => {
                                        setActiveRowIndex(idx);
                                        focusProductRow(idx);
                                    }}
                                    onDoubleClick={(e) => {
                                        e.preventDefault();
                                        setSelectedProduct(p);
                                    }}
                                >
                                    <td className={styles.tdList} style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="checkbox"
                                            checked={selectedProductIds.includes(p.p_id)}
                                            onChange={(e) => {
                                                toggleSelection(p.p_id, e.target.checked);
                                                setActiveRowIndex(idx);
                                                requestAnimationFrame(() => focusProductRow(idx));
                                            }}
                                        />
                                    </td>
                                    <td className={styles.tdList}>{idx + 1}</td>

                                    <td className={styles.tdList}>
                                        <div className="font-mono text-accent-hover font-bold hover:underline" onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }} onDoubleClick={(e) => e.stopPropagation()}>
                                            {p.part_number || mainPN.part_number || '-'}
                                        </div>
                                        <div className="text-xs text-muted mt-1">{p?.p_id}</div>
                                        {(p?.part_numbers?.length || 0) > 0 && (
                                            <div className="mt-1 text-[10px] bg-bg-tertiary px-1.5 py-0.5 inline-block rounded border border-border-color text-secondary cursor-pointer hover:bg-border-color" onClick={(e) => { e.stopPropagation(); setMappingProduct(p); }} onDoubleClick={(e) => e.stopPropagation()}>
                                                +{(p?.part_numbers?.length || 0)} 適用
                                            </div>
                                        )}
                                    </td>

                                    <td className={styles.tdList}>
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

                                    <td className={styles.tdList}>
                                        <div className="font-bold text-primary max-w-[180px] truncate" title={p.name}>{p.name || '-'}</div>
                                        <div className="text-xs text-muted mt-1 max-w-[180px] truncate" title={p.specifications}>{p.specifications || '-'}</div>
                                    </td>

                                    <td className={styles.tdList}>
                                        <span className="font-bold text-accent-primary">{p.brand || mainPN.brand || '-'}</span>
                                    </td>

                                    <td className={styles.tdList}>
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className={`text-xs px-2 py-0.5 rounded-sm font-bold ${stockBadgeClass}`}>
                                                {stockNum}
                                                <span className={belowSafety ? 'text-danger' : undefined}> 現貨</span>
                                            </span>
                                            <span className="text-[10px] text-muted font-mono">安全庫存: {safetyNum}</span>
                                        </div>
                                    </td>

                                    <td className={styles.tdList}>
                                        <span className="font-mono font-semibold text-muted">
                                            {showPrices ? `NT$ ${p.base_cost?.toLocaleString() || 0}` : '***'}
                                        </span>
                                    </td>

                                    <td className={styles.tdList}>
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

                                    <td className={styles.tdList}>
                                        <div className="max-w-[120px] truncate text-xs text-muted" title={p.notes}>{p.notes || '-'}</div>
                                    </td>

                                    <td className={styles.tdList}>
                                        {(p?.images?.length || 0) > 0 ? (
                                            <span className="text-xs text-accent-primary bg-accent-subtle px-2 py-1 rounded border border-accent-primary flex items-center gap-1 max-w-fit">
                                                <Layers size={10} /> {(p?.images?.length || 0)} 張
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
            </div>

            <ProductDrawer />

            {mappingProduct && (
                <PartMappingModal
                    product={mappingProduct}
                    onClose={() => setMappingProduct(null)}
                />
            )}

            {isExportDialogOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ width: '100%', maxWidth: '460px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.4rem' }}>下載欄位選擇</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '0.8rem' }}>包含編輯視窗欄位。以「零件號碼」為唯一 key，固定必下載（已記憶上次勾選）。</div>
                        <div style={{ display: 'grid', gap: '0.45rem' }}>
                            {fieldMeta.map((f) => (
                                <label key={f.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: f.mandatory ? '#60a5fa' : 'var(--text-primary)' }}>
                                    <input
                                        type="checkbox"
                                        checked={f.mandatory ? true : !!exportFields[f.key]}
                                        disabled={!!f.mandatory}
                                        onChange={(e) => setExportFields((prev) => ({ ...prev, [f.key]: e.target.checked }))}
                                    />
                                    <span>{f.label}{f.mandatory ? '（必選）' : ''}</span>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                            <button type="button" onClick={() => setIsExportDialogOpen(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                取消
                            </button>
                            <button type="button" onClick={runExport} style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                確認下載
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isImportResultOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.1rem' }}>
                        <div style={{ fontWeight: 800, marginBottom: '0.7rem' }}>匯入完成</div>
                        <div style={{ display: 'grid', gap: '0.35rem', fontSize: '0.92rem' }}>
                            <div>處理筆數：<b>{importResult.processed}</b></div>
                            <div>更新筆數：<b>{importResult.updated}</b></div>
                            <div>新增筆數：<b style={{ color: '#34d399' }}>{importResult.added}</b></div>
                            <div>略過筆數：<b>{importResult.skipped}</b></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                            <button type="button" onClick={() => setIsImportResultOpen(false)} style={{ padding: '0.45rem 0.85rem', borderRadius: '8px', border: 'none', background: 'var(--accent-primary)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                確認
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductList;
