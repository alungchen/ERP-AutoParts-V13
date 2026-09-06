import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ArrowDown, ArrowUp, ChevronDown, ChevronUp, FileSpreadsheet, History,
    Loader2, Printer, RotateCcw, Search, TrendingUp, Users, X,
} from 'lucide-react';
import AutocompleteInput from '../../components/AutocompleteInput';
import BranchStockDrawer from '../../components/BranchStockDrawer';
import ProductPriceHistoryBody from '../../components/ProductPriceHistoryBody';
import { collectCustomerSalesHistory, collectSupplierPurchaseHistory } from '../../utils/buildProductTransactionHistory';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useProductStore } from '../../store/useProductStore';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useSearchFormKeyboardNav } from '../../hooks/useSearchFormKeyboardNav';
import {
    DEFAULT_PRODUCT_QUERY,
    resolveProductQuery,
} from '../../utils/filterProductsByQuery';
import { buildSalesRanking, collectSalesLineRows, computeSalesDateExtent } from '../../utils/salesHistoryQuery';
import pimStyles from '../PIM/ProductList.module.css';
import styles from './SalesHistoryQuery.module.css';

const getMonthStart = (dateStr) => {
    if (!dateStr) {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    }
    const [y, m] = String(dateStr).split('-');
    return `${y}-${m}-01`;
};

// 與產品資料庫相同的料號正規化（忽略大小寫、空白、連字號）
const normalizePartNumber = (s) => {
    if (s == null || s === '') return '';
    return String(s)
        .trim()
        .normalize('NFKC')
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\u00ad\u200b-\u200f\uFEFF\s\-_]/g, '')
        .toLowerCase();
};

const getPrimaryPartNumber = (p) =>
    p?.part_number || p?.part_numbers?.[0]?.part_number || '';

const formatMoney = (n) => Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const toCsvCell = (val) => {
    const s = String(val ?? '');
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
};

const DETAIL_COLUMNS = [
    { key: 'date', label: '日期', numeric: false, align: 'left' },
    { key: 'doc_id', label: '單據編號', numeric: false, align: 'left' },
    { key: 'customer_name', label: '客戶', numeric: false, align: 'left' },
    { key: 'part_number', label: '零件號碼', numeric: false, align: 'left' },
    { key: 'name', label: '品名', numeric: false, align: 'left' },
    { key: 'car_model', label: '車型', numeric: false, align: 'left' },
    { key: 'brand', label: '品牌', numeric: false, align: 'left' },
    { key: 'stock', label: '庫存', numeric: true, align: 'right' },
    { key: 'qty', label: '數量', numeric: true, align: 'right' },
    { key: 'unit_price', label: '單價', numeric: true, align: 'right' },
    { key: 'amount', label: '金額', numeric: true, align: 'right' },
];

const RANKING_COLUMNS = [
    { key: 'part_number', label: '零件號碼', numeric: false, align: 'left' },
    { key: 'name', label: '品名', numeric: false, align: 'left' },
    { key: 'car_model', label: '車型', numeric: false, align: 'left' },
    { key: 'brand', label: '品牌', numeric: false, align: 'left' },
    { key: 'stock', label: '庫存', numeric: true, align: 'right' },
    { key: 'totalQty', label: '銷售數量', numeric: true, align: 'right' },
    { key: 'totalAmount', label: '銷售金額', numeric: true, align: 'right' },
    { key: 'docCount', label: '單據數', numeric: true, align: 'right' },
];

function getSortValue(row, key) {
    if (key === 'part_number') return row.part_number || row.p_id || '';
    return row[key];
}

function compareRows(a, b, key, dir, columns) {
    const av = getSortValue(a, key);
    const bv = getSortValue(b, key);
    const col = columns.find((c) => c.key === key);
    let cmp = 0;
    if (col?.numeric) {
        cmp = (Number(av) || 0) - (Number(bv) || 0);
    } else {
        cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'zh-Hant', { numeric: true });
    }
    return dir === 'desc' ? -cmp : cmp;
}

const SortableTh = ({ col, sortKey, sortDir, onSort }) => {
    const active = sortKey === col.key;
    const thClass = col.align === 'right'
        ? `${styles.th} ${styles.tdRight} ${styles.sortTh}`
        : `${styles.th} ${styles.sortTh}`;

    return (
        <th className={thClass}>
            <button
                type="button"
                className={`${styles.sortThBtn} ${active ? styles.sortThBtnActive : ''}`}
                onClick={() => onSort(col.key)}
                title={active ? (sortDir === 'asc' ? '升冪（點擊改降冪）' : '降冪（點擊改升冪）') : '點擊排序'}
            >
                <span>{col.label}</span>
                {active ? (
                    sortDir === 'asc' ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />
                ) : (
                    <span className={styles.sortThIconMuted} aria-hidden>↕</span>
                )}
            </button>
        </th>
    );
};

const StockCell = ({ row, onOpen }) => (
    <td className={`${styles.td} ${styles.tdRight}`}>
        <button
            type="button"
            className={styles.stockLinkBtn}
            onClick={() => onOpen({
                p_id: row.p_id,
                part_number: row.part_number,
                name: row.name,
                stock: row.stock,
                stock_details: row.stock_details,
            })}
            title="全店庫存，點擊查看分店明細"
        >
            {formatMoney(row.stock)}
        </button>
    </td>
);

const SalesHistoryQuery = () => {
    const {
        salesOrders = [],
        salesReturns = [],
        quotations = [],
        purchaseOrders = [],
        inquiries = [],
        isDocumentsLoaded,
    } = useDocumentStore();
    const { products = [], fetchProducts } = useProductStore();
    const { models, parts, brands } = useShorthandStore();
    const { customers = [] } = useCustomerStore();

    const salesDateExtent = useMemo(
        () => computeSalesDateExtent(salesOrders, salesReturns),
        [salesOrders, salesReturns],
    );

    const [activeTab, setActiveTab] = useState('customer');
    const [appliedTab, setAppliedTab] = useState('customer');
    const [hasSearched, setHasSearched] = useState(false);
    const [defaultsApplied, setDefaultsApplied] = useState(false);
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('desc');
    const [searchPanelOpen, setSearchPanelOpen] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [resultRows, setResultRows] = useState([]);
    const [stockDrawerItem, setStockDrawerItem] = useState(null);
    // F8 前價沿革抽屜：列表反白列
    const [activeRowIdx, setActiveRowIdx] = useState(null);
    const [historyInlineOpen, setHistoryInlineOpen] = useState(false);

    const [query, setQuery] = useState({
        ...DEFAULT_PRODUCT_QUERY,
        customer: '',
        dateFrom: '',
        dateTo: '',
    });
    const [applied, setApplied] = useState(null);

    const activeColumns = appliedTab === 'ranking' ? RANKING_COLUMNS : DETAIL_COLUMNS;

    useEffect(() => {
        if (!products || products.length === 0) {
            void fetchProducts();
        }
    }, [products, fetchProducts]);

    useEffect(() => {
        if (defaultsApplied || !isDocumentsLoaded) return;
        if (!salesDateExtent.max) return;
        setQuery((prev) => ({
            ...prev,
            dateFrom: getMonthStart(salesDateExtent.max),
            dateTo: salesDateExtent.max,
        }));
        setDefaultsApplied(true);
    }, [defaultsApplied, isDocumentsLoaded, salesDateExtent.max]);

    const formRef = useRef(null);
    const resetBtnRef = useRef(null);
    const searchBtnRef = useRef(null);

    useSearchFormKeyboardNav(formRef, searchBtnRef, resetBtnRef);

    const customerOptions = useMemo(() => {
        const seen = new Set();
        const list = [];
        for (const c of customers) {
            const label = c.company_name || c.name || c.cust_id || '';
            const key = `${c.cust_id || ''}|${label}`;
            if (!label || seen.has(key)) continue;
            seen.add(key);
            list.push({
                shorthand: c.cust_id || label,
                fullname: label,
                cust_id: c.cust_id,
            });
        }
        return list.sort((a, b) => String(a.fullname).localeCompare(String(b.fullname), 'zh-Hant'));
    }, [customers]);

    const switchTab = (tab) => {
        setActiveTab(tab);
        setHasSearched(false);
        setApplied(null);
        setResultRows([]);
        setStockDrawerItem(null);
        setSortKey(tab === 'ranking' ? 'totalAmount' : 'date');
        setSortDir('desc');
    };

    const handleClear = () => {
        setQuery({
            ...DEFAULT_PRODUCT_QUERY,
            customer: '',
            dateFrom: getMonthStart(salesDateExtent.max),
            dateTo: salesDateExtent.max || '',
        });
        setApplied(null);
        setResultRows([]);
        setHasSearched(false);
        setSearchPanelOpen(true);
    };

    const handleSearch = useCallback((e) => {
        if (e) e.preventDefault();

        if (!query.dateFrom && !query.dateTo) {
            alert('請至少設定查詢期間（起日或迄日）。');
            return;
        }

        const appliedQuery = resolveProductQuery(query, { models, parts, brands });
        const nextApplied = {
            productQuery: appliedQuery,
            customer: String(query.customer || '').trim(),
            dateFrom: query.dateFrom,
            dateTo: query.dateTo,
        };

        setSearchPanelOpen(false);
        setIsSearching(true);
        setSortKey(activeTab === 'ranking' ? 'totalAmount' : 'date');
        setSortDir('desc');

        window.setTimeout(() => {
            const rows = activeTab === 'ranking'
                ? buildSalesRanking({
                    salesOrders,
                    salesReturns,
                    dateFrom: nextApplied.dateFrom,
                    dateTo: nextApplied.dateTo,
                    appliedQuery: nextApplied.productQuery,
                    products,
                })
                : collectSalesLineRows({
                    salesOrders,
                    salesReturns,
                    dateFrom: nextApplied.dateFrom,
                    dateTo: nextApplied.dateTo,
                    customer: nextApplied.customer,
                    appliedQuery: nextApplied.productQuery,
                    products,
                });
            setApplied(nextApplied);
            setAppliedTab(activeTab);
            setResultRows(rows);
            setHasSearched(true);
            setIsSearching(false);
        }, 0);
    }, [activeTab, models, parts, brands, query, salesOrders, salesReturns, products]);

    const summary = useMemo(() => {
        if (appliedTab === 'ranking') {
            const totalQty = resultRows.reduce((sum, r) => sum + (Number(r.totalQty) || 0), 0);
            const totalAmount = resultRows.reduce((sum, r) => sum + (Number(r.totalAmount) || 0), 0);
            return { count: resultRows.length, totalQty, totalAmount };
        }
        const totalQty = resultRows.reduce((sum, r) => sum + (Number(r.qty) || 0), 0);
        const totalAmount = resultRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
        return { count: resultRows.length, totalQty, totalAmount };
    }, [resultRows, appliedTab]);

    const sortedRows = useMemo(() => {
        if (!resultRows.length) return [];
        return [...resultRows].sort((a, b) => compareRows(a, b, sortKey, sortDir, activeColumns));
    }, [resultRows, sortKey, sortDir, activeColumns]);

    const handleSort = useCallback((key) => {
        setActiveRowIdx(null);
        if (sortKey === key) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
            return;
        }
        const col = activeColumns.find((c) => c.key === key);
        setSortKey(key);
        setSortDir(col?.numeric ? 'desc' : 'asc');
    }, [sortKey, activeColumns]);

    // ── F8 客戶前價／廠商前價沿革抽屜（同產品資料庫）──
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

    // 查詢結果變動時重置反白列
    useEffect(() => {
        setActiveRowIdx(null);
    }, [resultRows]);

    const historyContextProduct = useMemo(() => {
        const row = activeRowIdx == null ? null : sortedRows[activeRowIdx];
        if (!row) return null;
        if (row.p_id) {
            const byId = products.find((p) => p.p_id === row.p_id);
            if (byId) return byId;
        }
        const pn = normalizePartNumber(row.part_number);
        if (!pn) return null;
        return products.find((p) => {
            if (normalizePartNumber(getPrimaryPartNumber(p)) === pn) return true;
            if (normalizePartNumber(p.p_id) === pn) return true;
            return (p.part_numbers || []).some((x) => normalizePartNumber(x.part_number) === pn);
        }) || null;
    }, [activeRowIdx, sortedRows, products]);

    const customerHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectCustomerSalesHistory(historyContextProduct, salesOrders, quotations);
    }, [historyContextProduct, salesOrders, quotations]);

    const supplierHistoryRows = useMemo(() => {
        if (!historyContextProduct) return [];
        return collectSupplierPurchaseHistory(historyContextProduct, purchaseOrders, inquiries);
    }, [historyContextProduct, purchaseOrders, inquiries]);

    const handleExportCsv = useCallback(() => {
        if (!sortedRows.length) {
            alert('沒有可匯出的資料。');
            return;
        }
        let headers;
        let csvRows = [headers];
        if (appliedTab === 'ranking') {
            headers = ['排名', ...RANKING_COLUMNS.map((c) => c.label)];
            csvRows = [headers.join(',')];
            sortedRows.forEach((row, idx) => {
                csvRows.push([
                    idx + 1,
                    toCsvCell(row.part_number || row.p_id),
                    toCsvCell(row.name),
                    toCsvCell(row.car_model),
                    toCsvCell(row.brand),
                    toCsvCell(row.stock),
                    toCsvCell(row.totalQty),
                    toCsvCell(row.totalAmount),
                    toCsvCell(row.docCount),
                ].join(','));
            });
        } else {
            headers = DETAIL_COLUMNS.map((c) => c.label);
            csvRows = [headers.join(',')];
            for (const row of sortedRows) {
                csvRows.push([
                    toCsvCell(row.date),
                    toCsvCell(row.doc_type === '銷退' ? `${row.doc_id} (銷退)` : row.doc_id),
                    toCsvCell(row.customer_name),
                    toCsvCell(row.part_number || row.p_id),
                    toCsvCell(row.name),
                    toCsvCell(row.car_model),
                    toCsvCell(row.brand),
                    toCsvCell(row.stock),
                    toCsvCell(row.qty),
                    toCsvCell(row.unit_price),
                    toCsvCell(row.amount),
                ].join(','));
            }
        }
        const suffix = appliedTab === 'ranking' ? 'ranking' : 'detail';
        const fileName = `sales_history_${suffix}_${applied?.dateFrom || 'start'}_${applied?.dateTo || 'end'}.csv`;
        const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, [sortedRows, applied, appliedTab]);

    const handlePrint = useCallback(() => {
        if (!sortedRows.length) {
            alert('沒有可列印的資料。');
            return;
        }
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            alert('無法開啟列印視窗，請允許瀏覽器彈出視窗後再試。');
            return;
        }
        const customerText = applied?.customer || '全部客戶';
        const periodText = `${applied?.dateFrom || '—'} ~ ${applied?.dateTo || '—'}`;
        const title = appliedTab === 'ranking' ? '歷史查詢－產品銷售排行' : '歷史查詢－銷售明細';
        const countLabel = appliedTab === 'ranking' ? '產品數' : '明細筆數';

        const rowsHtml = appliedTab === 'ranking'
            ? sortedRows.map((row, idx) => `
                <tr>
                    <td style="text-align:right;font-weight:700">${idx + 1}</td>
                    <td style="font-family:monospace">${row.part_number || row.p_id || ''}</td>
                    <td>${row.name || ''}</td>
                    <td>${row.car_model || ''}</td>
                    <td>${row.brand || ''}</td>
                    <td style="text-align:right">${formatMoney(row.stock)}</td>
                    <td style="text-align:right">${formatMoney(row.totalQty)}</td>
                    <td style="text-align:right;font-weight:700">${formatMoney(row.totalAmount)}</td>
                    <td style="text-align:right">${row.docCount}</td>
                </tr>
            `).join('')
            : sortedRows.map((row, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${row.date || ''}</td>
                    <td style="font-family:monospace">${row.doc_id || ''}${row.doc_type === '銷退' ? ' (銷退)' : ''}</td>
                    <td>${row.customer_name || ''}</td>
                    <td style="font-family:monospace">${row.part_number || row.p_id || ''}</td>
                    <td>${row.name || ''}</td>
                    <td>${row.car_model || ''}</td>
                    <td>${row.brand || ''}</td>
                    <td style="text-align:right">${formatMoney(row.stock)}</td>
                    <td style="text-align:right">${formatMoney(row.qty)}</td>
                    <td style="text-align:right">${formatMoney(row.unit_price)}</td>
                    <td style="text-align:right;font-weight:700">${formatMoney(row.amount)}</td>
                </tr>
            `).join('');

        const tableHead = appliedTab === 'ranking'
            ? `<tr><th>#</th><th>零件號碼</th><th>品名</th><th>車型</th><th>品牌</th>
               <th style="text-align:right">庫存</th><th style="text-align:right">銷售數量</th><th style="text-align:right">銷售金額</th><th style="text-align:right">單據數</th></tr>`
            : `<tr><th>#</th><th>日期</th><th>單據編號</th><th>客戶</th><th>零件號碼</th>
               <th>品名</th><th>車型</th><th>品牌</th><th style="text-align:right">庫存</th>
               <th style="text-align:right">數量</th><th style="text-align:right">單價</th><th style="text-align:right">金額</th></tr>`;

        const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${title}</title>
            <style>body{font-family:Arial,"Microsoft JhengHei",sans-serif;margin:24px;color:#111827}
            h1{margin:0;font-size:22px}.sub{color:#6b7280;margin-top:6px;font-size:13px}
            .summary{margin-top:14px;padding:12px;border:1px solid #d1d5db;border-radius:8px;background:#f8fafc;font-size:14px}
            table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
            th,td{border:1px solid #e5e7eb;padding:6px 8px}th{background:#f3f4f6;text-align:left}
            @media print{@page{size:landscape;margin:10mm}}</style></head><body>
            <h1>${title}</h1><div class="sub">列印時間：${new Date().toLocaleString('zh-TW')}</div>
            <div class="summary">
                <div>期間：${periodText}</div>
                ${appliedTab === 'customer' ? `<div>客戶：${customerText}</div>` : ''}
                <div>${countLabel}：${summary.count}｜總數量：${formatMoney(summary.totalQty)}｜總金額：${formatMoney(summary.totalAmount)}</div>
            </div>
            <table><thead>${tableHead}</thead><tbody>${rowsHtml}</tbody></table>
            </body></html>`;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 220);
    }, [sortedRows, applied, appliedTab, summary]);

    const searchSummaryText = useMemo(() => {
        const parts = [];
        if (query.dateFrom || query.dateTo) parts.push(`${query.dateFrom || '—'} ~ ${query.dateTo || '—'}`);
        if (activeTab === 'customer') parts.push(query.customer?.trim() || '全部客戶');
        if (query.partNumber) parts.push(`料號:${query.partNumber}`);
        if (query.part) parts.push(`品名:${query.part}`);
        return parts.join(' · ');
    }, [query, activeTab]);

    return (
        <div className={`${styles.container} anim-fade-in`}>
            <div className={styles.header}>
                <div className={styles.titleBlock}>
                    <h1>歷史查詢</h1>
                    <p className={styles.subtitle}>依期間與產品條件，查詢銷售排行或客戶銷售明細</p>
                </div>
            </div>

            <div className={styles.tabRow}>
                <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === 'ranking' ? styles.tabBtnActive : ''}`}
                    onClick={() => switchTab('ranking')}
                >
                    <TrendingUp size={16} /> 產品銷售排行
                </button>
                <button
                    type="button"
                    className={`${styles.tabBtn} ${activeTab === 'customer' ? styles.tabBtnActive : ''}`}
                    onClick={() => switchTab('customer')}
                >
                    <Users size={16} /> 客戶銷售明細
                </button>
            </div>

            <div className={`${styles.searchDrawer} ${searchPanelOpen ? styles.searchDrawerOpen : styles.searchDrawerCollapsed}`}>
                <button
                    type="button"
                    className={styles.searchDrawerToggle}
                    onClick={() => setSearchPanelOpen((v) => !v)}
                    aria-expanded={searchPanelOpen}
                >
                    <Search size={16} />
                    <span className={styles.searchDrawerToggleLabel}>搜尋條件</span>
                    {!searchPanelOpen && (
                        <span className={styles.searchDrawerSummary}>{searchSummaryText}</span>
                    )}
                    {searchPanelOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                <div className={styles.searchDrawerBody}>
                    <div className={styles.searchPanel}>
                        <form
                            ref={formRef}
                            data-search-form
                            className={styles.searchFormStack}
                            onSubmit={handleSearch}
                        >
                            <div className={styles.searchFormRow}>
                                <button
                                    ref={resetBtnRef}
                                    type="button"
                                    data-search-reset="true"
                                    className={styles.resetBtn}
                                    onClick={handleClear}
                                    title="重設全部條件"
                                >
                                    <RotateCcw size={16} />
                                </button>
                                <div className={styles.searchField} style={{ minWidth: '140px', maxWidth: '180px', flex: '0 1 180px' }}>
                                    <label className={styles.searchLabel}>期間起</label>
                                    <input
                                        type="date"
                                        className={styles.searchInput}
                                        value={query.dateFrom}
                                        onChange={(e) => setQuery({ ...query, dateFrom: e.target.value })}
                                    />
                                </div>
                                <div className={styles.searchField} style={{ minWidth: '140px', maxWidth: '180px', flex: '0 1 180px' }}>
                                    <label className={styles.searchLabel}>期間迄</label>
                                    <input
                                        type="date"
                                        className={styles.searchInput}
                                        value={query.dateTo}
                                        onChange={(e) => setQuery({ ...query, dateTo: e.target.value })}
                                    />
                                </div>
                            </div>

                            {activeTab === 'customer' && (
                                <div className={styles.searchFormRow}>
                                    <div className={styles.searchField} style={{ flex: '1 1 100%', maxWidth: '100%' }}>
                                        <label className={styles.searchLabel}>客戶</label>
                                        <AutocompleteInput
                                            value={query.customer}
                                            onChange={(val) => setQuery({ ...query, customer: val })}
                                            placeholder="客戶名稱或代碼（留空＝全部客戶）"
                                            data={customerOptions}
                                            filterKey="shorthand"
                                            labelKey="fullname"
                                            required={false}
                                            compact
                                        />
                                    </div>
                                </div>
                            )}

                            <div className={styles.searchFormRow}>
                                <div className={`${styles.searchField} ${pimStyles.searchField}`} data-search-field data-search-field-index="0">
                                    <label className={styles.searchLabel}>零件號碼 (Part No.)</label>
                                    <input
                                        className={`${styles.searchInput} ${pimStyles.searchInput}`}
                                        type="text"
                                        placeholder="單號或號碼"
                                        value={query.partNumber}
                                        onChange={(e) => setQuery({ ...query, partNumber: e.target.value })}
                                    />
                                </div>
                                <div className={styles.searchField}>
                                    <label className={styles.searchLabel}>車種</label>
                                    <AutocompleteInput
                                        value={query.model}
                                        onChange={(val) => setQuery({ ...query, model: val })}
                                        placeholder="支援片語"
                                        data={models}
                                        filterKey="shorthand"
                                        labelKey="fullname"
                                        required={false}
                                        compact
                                    />
                                </div>
                                <div className={styles.searchField}>
                                    <label className={styles.searchLabel}>品名</label>
                                    <AutocompleteInput
                                        value={query.part}
                                        onChange={(val) => setQuery({ ...query, part: val })}
                                        placeholder="支援片語"
                                        data={parts}
                                        filterKey="shorthand"
                                        labelKey="fullname"
                                        required={false}
                                        compact
                                    />
                                </div>
                                <div className={styles.searchField}>
                                    <label className={styles.searchLabel}>規格 (Spec)</label>
                                    <input
                                        className={styles.searchInput}
                                        type="text"
                                        placeholder="CC數/尺寸"
                                        value={query.spec}
                                        onChange={(e) => setQuery({ ...query, spec: e.target.value })}
                                    />
                                </div>
                                <div className={styles.searchField} style={{ minWidth: '90px' }}>
                                    <label className={styles.searchLabel}>年份 (Year)</label>
                                    <input
                                        className={styles.searchInput}
                                        type="text"
                                        placeholder="例: 18-22"
                                        value={query.year}
                                        onChange={(e) => setQuery({ ...query, year: e.target.value })}
                                    />
                                </div>
                                <div className={styles.searchField}>
                                    <label className={styles.searchLabel}>品牌 (Brand)</label>
                                    <AutocompleteInput
                                        value={query.brand}
                                        onChange={(val) => setQuery({ ...query, brand: val })}
                                        placeholder="支援片語"
                                        data={brands}
                                        filterKey="shorthand"
                                        labelKey="fullname"
                                        required={false}
                                        compact
                                    />
                                </div>
                                <button ref={searchBtnRef} type="submit" className={styles.searchBtn} disabled={isSearching}>
                                    {isSearching ? <Loader2 size={16} className={styles.spin} /> : <Search size={16} />}
                                    {isSearching ? '查詢中…' : '搜尋'}
                                </button>
                            </div>
                        </form>

                        <p className={styles.hint}>
                            {activeTab === 'ranking'
                                ? '統計期間內全部客戶的銷貨／銷退，依產品彙總數量與金額；產品條件可留空查全部。'
                                : '需指定期間；客戶可留空查全部客戶，亦可再加產品條件篩選明細。'}
                            {salesDateExtent.max && (
                                <> 目前銷貨資料期間：<strong>{salesDateExtent.min || '—'} ~ {salesDateExtent.max}</strong>。</>
                            )}
                            {!isDocumentsLoaded && '（單據資料載入中…）'}
                        </p>
                        <p className={styles.hint} style={{ marginTop: '0.35rem' }}>
                            <History size={14} style={{ verticalAlign: 'text-bottom', marginRight: '0.3rem', opacity: 0.85 }} aria-hidden />
                            點選查詢結果任一列後，按 <strong>F8</strong> 於搜尋區塊下方滑出／收合該零件的「客戶前價／廠商前價」沿革抽屜。
                        </p>
                    </div>
                </div>
            </div>

            <div
                className={`${pimStyles.historyDrawerShell} ${historyInlineOpen ? pimStyles.historyDrawerShellOpen : ''}`}
                aria-hidden={!historyInlineOpen}
            >
                <div className={pimStyles.historyDrawerShellInner}>
                    <div className={pimStyles.historyDrawer} style={{ borderTop: 'none', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '0.85rem 1rem 1rem', marginTop: '0.25rem' }}>
                        <div className={pimStyles.historyDrawerHeader}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                                <History size={18} style={{ marginTop: '2px', opacity: 0.85 }} aria-hidden />
                                <div>
                                    <div className={pimStyles.historyDrawerTitle}>
                                        {historyContextProduct
                                            ? `客戶前價 · 廠商前價沿革｜${historyContextProduct.name || '未命名'}（${getPrimaryPartNumber(historyContextProduct) || historyContextProduct.p_id || '—'}）`
                                            : '客戶前價 · 廠商前價沿革'}
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                        左欄：銷貨單與報價單；右欄：進貨單與詢價單。
                                        {!historyContextProduct && (
                                            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}> 請先點選查詢結果列以指定零件。</span>
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

            <div className={styles.resultsArea}>
                {(hasSearched || isSearching) && (
                    <>
                        <div className={styles.summaryBar}>
                            <button
                                type="button"
                                className={styles.expandSearchBtn}
                                onClick={() => setSearchPanelOpen(true)}
                                title="展開搜尋條件"
                            >
                                <Search size={14} /> 修改條件
                            </button>
                            <span>
                                期間：<span className={styles.summaryStrong}>{applied?.dateFrom || '—'} ~ {applied?.dateTo || '—'}</span>
                            </span>
                            {appliedTab === 'customer' && (
                                <span>
                                    客戶：<span className={styles.summaryStrong}>{applied?.customer || '全部客戶'}</span>
                                </span>
                            )}
                            <span>
                                {appliedTab === 'ranking' ? '產品數' : '明細筆數'}：
                                <span className={styles.summaryStrong}>{isSearching ? '…' : summary.count}</span>
                            </span>
                            <span>
                                總數量：<span className={styles.summaryStrong}>{isSearching ? '…' : formatMoney(summary.totalQty)}</span>
                            </span>
                            <span>
                                總金額：<span className={styles.summaryStrong}>{isSearching ? '…' : formatMoney(summary.totalAmount)}</span>
                            </span>
                            <div className={styles.resultsActions}>
                                <button type="button" className={styles.actionBtn} onClick={handleExportCsv} disabled={!sortedRows.length || isSearching}>
                                    <FileSpreadsheet size={16} /> 匯出 CSV
                                </button>
                                <button type="button" className={styles.actionBtn} onClick={handlePrint} disabled={!sortedRows.length || isSearching}>
                                    <Printer size={16} /> 列印
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableWrap}>
                            {isSearching ? (
                                <div className={styles.loadingState}>
                                    <Loader2 size={32} className={styles.spin} />
                                    <span>查詢中，請稍候…</span>
                                </div>
                            ) : appliedTab === 'ranking' ? (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th className={`${styles.th} ${styles.tdRight}`}>排名</th>
                                            {RANKING_COLUMNS.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    col={col}
                                                    sortKey={sortKey}
                                                    sortDir={sortDir}
                                                    onSort={handleSort}
                                                />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className={styles.empty}>
                                                    <History size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                                    此期間內找不到符合條件的銷售資料
                                                </td>
                                            </tr>
                                        ) : sortedRows.map((row, idx) => (
                                            <tr
                                                key={row.key || `${row.part_number}-${idx}`}
                                                onClick={() => setActiveRowIdx(idx)}
                                                style={{ cursor: 'pointer', background: activeRowIdx === idx ? 'rgba(59,130,246,0.12)' : undefined }}
                                                title="點選反白後按 F8 查看客戶前價／廠商前價"
                                            >
                                                <td className={`${styles.td} ${styles.tdRight} ${styles.rankCell}`}>{idx + 1}</td>
                                                <td className={`${styles.td} ${styles.mono}`}>
                                                    <div>{row.part_number || '—'}</div>
                                                    {row.p_id && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{row.p_id}</div>}
                                                </td>
                                                <td className={styles.td}>{row.name || '—'}</td>
                                                <td className={styles.td}>{row.car_model || '—'}</td>
                                                <td className={styles.td}>{row.brand || '—'}</td>
                                                <StockCell row={row} onOpen={setStockDrawerItem} />
                                                <td className={`${styles.td} ${styles.tdRight}`}>{formatMoney(row.totalQty)}</td>
                                                <td className={`${styles.td} ${styles.tdRight}`} style={{ fontWeight: 700 }}>{formatMoney(row.totalAmount)}</td>
                                                <td className={`${styles.td} ${styles.tdRight}`}>{row.docCount}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            {DETAIL_COLUMNS.map((col) => (
                                                <SortableTh
                                                    key={col.key}
                                                    col={col}
                                                    sortKey={sortKey}
                                                    sortDir={sortDir}
                                                    onSort={handleSort}
                                                />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={11} className={styles.empty}>
                                                    <History size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                                                    找不到符合條件的銷售明細
                                                    {salesDateExtent.max && applied && (applied.dateFrom > salesDateExtent.max || applied.dateTo < salesDateExtent.min) && (
                                                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                                                            所選期間可能超出資料範圍（資料至 {salesDateExtent.max}），請調整起迄日後再試。
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ) : sortedRows.map((row, idx) => (
                                            <tr
                                                key={`${row.doc_id}-${row.part_number}-${idx}`}
                                                onClick={() => setActiveRowIdx(idx)}
                                                style={{ cursor: 'pointer', background: activeRowIdx === idx ? 'rgba(59,130,246,0.12)' : undefined }}
                                                title="點選反白後按 F8 查看客戶前價／廠商前價"
                                            >
                                                <td className={styles.td}>{row.date}</td>
                                                <td className={`${styles.td} ${styles.mono}`}>
                                                    {row.doc_id}
                                                    {row.doc_type === '銷退' && <span className={styles.badgeReturn}>銷退</span>}
                                                </td>
                                                <td className={styles.td}>{row.customer_name}</td>
                                                <td className={`${styles.td} ${styles.mono}`}>{row.part_number || row.p_id || '—'}</td>
                                                <td className={styles.td}>{row.name || '—'}</td>
                                                <td className={styles.td}>{row.car_model || '—'}</td>
                                                <td className={styles.td}>{row.brand || '—'}</td>
                                                <StockCell row={row} onOpen={setStockDrawerItem} />
                                                <td className={`${styles.td} ${styles.tdRight}`}>{formatMoney(row.qty)}</td>
                                                <td className={`${styles.td} ${styles.tdRight}`}>{formatMoney(row.unit_price)}</td>
                                                <td className={`${styles.td} ${styles.tdRight}`} style={{ fontWeight: 700 }}>{formatMoney(row.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </>
                )}
            </div>

            <BranchStockDrawer
                open={Boolean(stockDrawerItem)}
                item={stockDrawerItem}
                onClose={() => setStockDrawerItem(null)}
            />
        </div>
    );
};

export default SalesHistoryQuery;
