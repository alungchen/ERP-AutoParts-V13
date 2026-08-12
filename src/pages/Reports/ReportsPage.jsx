import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, Printer } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useProductStore } from '../../store/useProductStore';

const ReportsPage = () => {
    const { salesOrders = [], purchaseOrders = [], salesReturns = [], purchaseReturns = [] } = useDocumentStore();
    const { products = [], fetchProducts } = useProductStore();

    useEffect(() => {
        if (!products || products.length === 0) {
            fetchProducts();
        }
    }, [products, fetchProducts]);
    const [activeTab, setActiveTab] = useState('sales');
    const [activeView, setActiveView] = useState('report'); // report | detail
    const [filters, setFilters] = useState({
        party: '',
        status: '',
        dateFrom: '',
        dateTo: '',
    });

    const rows = activeTab === 'sales' 
        ? [...salesOrders, ...salesReturns] 
        : [...purchaseOrders, ...purchaseReturns];

    const latestPurchasePriceMap = useMemo(() => {
        const map = {};
        const sortedPOs = [...purchaseOrders].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        sortedPOs.forEach(po => {
            (po.items || []).forEach(item => {
                if (item.p_id && item.unit_price) {
                    map[item.p_id] = Number(item.unit_price) || 0;
                } else if (item.part_number && item.unit_price) {
                    map[item.part_number] = Number(item.unit_price) || 0;
                }
            });
        });
        return map;
    }, [purchaseOrders]);

    const productCostMap = useMemo(() => {
        const map = {};
        products.forEach(p => {
            const baseCost = Number(p.base_cost) || 0;
            if (baseCost > 0) {
                map[p.p_id] = baseCost;
            } else {
                map[p.p_id] = latestPurchasePriceMap[p.p_id] || 0;
            }
        });
        return map;
    }, [products, latestPurchasePriceMap]);

    const withAmount = useMemo(() => rows.map((doc) => {
        const isReturn = doc.type === 'salesReturn' || doc.type === 'purchaseReturn';
        const sign = isReturn ? -1 : 1;

        let amount = 0;
        let costAmount = 0;

        (doc.items || []).forEach(item => {
            const qty = (item.qty || 0) * sign;
            const unitPrice = item.unit_price || 0;
            amount += qty * unitPrice;
            
            if (activeTab === 'sales') {
                const unitCost = productCostMap[item.p_id] || latestPurchasePriceMap[item.p_id] || latestPurchasePriceMap[item.part_number] || 0;
                costAmount += qty * unitCost;
            }
        });

        return { ...doc, _amount: amount, _costAmount: costAmount, _isReturn: isReturn };
    }), [rows, activeTab, productCostMap, latestPurchasePriceMap]);

    const filteredRows = useMemo(() => {
        return withAmount.filter((doc) => {
            const partyName = (doc.customer_name || doc.supplier_name || '').toLowerCase();
            if (filters.party && !partyName.includes(filters.party.toLowerCase())) return false;
            if (filters.status && doc.status !== filters.status) return false;
            if (filters.dateFrom && (doc.date || '') < filters.dateFrom) return false;
            if (filters.dateTo && (doc.date || '') > filters.dateTo) return false;

            return true;
        });
    }, [withAmount, filters]);

    const summary = useMemo(() => {
        const totalAmount = filteredRows.reduce((sum, doc) => sum + (doc._amount || 0), 0);
        let totalCost = 0;
        if (activeTab === 'sales') {
            totalCost = filteredRows.reduce((sum, doc) => sum + (doc._costAmount || 0), 0);
        }
        const grossProfit = totalAmount - totalCost;
        const grossMargin = totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0;

        const totalItems = filteredRows.reduce((sum, doc) => sum + ((doc.items || []).length), 0);
        return { totalAmount, totalItems, grossProfit, grossMargin };
    }, [filteredRows, activeTab]);

    const partySummaryRows = useMemo(() => {
        const grouped = filteredRows.reduce((acc, doc) => {
            const party = doc.customer_name || doc.supplier_name || '-';
            if (!acc[party]) {
                acc[party] = { party, docCount: 0, itemCount: 0, amount: 0, costAmount: 0 };
            }
            acc[party].docCount += 1;
            acc[party].itemCount += (doc.items || []).length;
            acc[party].amount += (doc._amount || 0);
            if (activeTab === 'sales') {
                acc[party].costAmount += (doc._costAmount || 0);
            }
            return acc;
        }, {});

        return Object.values(grouped).map(row => {
            const grossProfit = row.amount - row.costAmount;
            const grossMargin = row.amount > 0 ? (grossProfit / row.amount) * 100 : 0;
            return { ...row, grossProfit, grossMargin };
        }).sort((a, b) => b.amount - a.amount);
    }, [filteredRows, activeTab]);

    const detailRows = useMemo(() => {
        return filteredRows.flatMap((doc) => {
            const isReturn = doc.type === 'salesReturn' || doc.type === 'purchaseReturn';
            const sign = isReturn ? -1 : 1;

            const base = {
                docId: doc.doc_id || '-',
                date: doc.date || '-',
                party: doc.customer_name || doc.supplier_name || '-',
                type: doc.type,
            };
            const items = doc.items || [];
            if (items.length === 0) {
                return [{ ...base, partNo: '-', itemName: '-', qty: 0, unitPrice: 0, amount: 0, cost: 0, grossProfit: 0 }];
            }
            return items.map((item) => {
                const qty = Number(item.qty || 0) * sign;
                const unitPrice = Number(item.unit_price || 0);
                const amount = qty * unitPrice;
                let cost = 0;
                let grossProfit = 0;

                if (activeTab === 'sales') {
                    const unitCost = productCostMap[item.p_id] || latestPurchasePriceMap[item.p_id] || latestPurchasePriceMap[item.part_number] || 0;
                    cost = qty * unitCost;
                    grossProfit = amount - cost;
                }

                return {
                    ...base,
                    partNo: item.part_number || item.p_id || '-',
                    itemName: item.name || '-',
                    qty,
                    unitPrice,
                    amount,
                    cost,
                    grossProfit
                };
            });
        });
    }, [filteredRows, activeTab, productCostMap, latestPurchasePriceMap]);

    const resetFilters = () => {
        setFilters({
            party: '',
            status: '',
            dateFrom: '',
            dateTo: '',
        });
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!printWindow) {
            alert('無法開啟列印視窗，請允許瀏覽器彈出視窗後再試。');
            return;
        }

        const reportLabel = activeTab === 'sales' ? '銷貨' : '進貨';
        const title = `${reportLabel}${activeView === 'report' ? '報表' : '明細'}`;
        const timeText = new Date().toLocaleString('zh-TW');
        const periodText = filters.dateFrom || filters.dateTo
            ? `${filters.dateFrom || '未設定'} ~ ${filters.dateTo || '未設定'}`
            : '全部期間';
        const partyText = filters.party || '全部';
        const statusText = filters.status || '全部';

        const rowsHtml = activeView === 'report'
            ? partySummaryRows.map((row, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${row.party}</td>
                    <td style="text-align:right;">${row.docCount}</td>
                    <td style="text-align:right;">${row.itemCount}</td>
                    <td style="text-align:right;">${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    ${activeTab === 'sales' ? `
                    <td style="text-align:right;">${row.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align:right;">${row.grossMargin.toFixed(2)}%</td>
                    ` : ''}
                </tr>
            `).join('')
            : detailRows.map((row, idx) => `
                <tr>
                    <td>${idx + 1}</td>
                    <td>${row.docId}</td>
                    <td>${row.date}</td>
                    <td>${row.party}</td>
                    <td>${row.partNo}</td>
                    <td>${row.itemName}</td>
                    <td style="text-align:right;">${row.qty}</td>
                    <td style="text-align:right;">${row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align:right;">${row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    ${activeTab === 'sales' ? `
                    <td style="text-align:right;">${row.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td style="text-align:right;">${row.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    ` : ''}
                </tr>
            `).join('');

        const html = `
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>${title}</title>
                <style>
                    body { font-family: Arial, "Microsoft JhengHei", sans-serif; margin: 24px; color: #111827; }
                    h1 { margin: 0; font-size: 26px; }
                    .sub { color: #6b7280; margin-top: 6px; font-size: 13px; }
                    .summary { margin-top: 16px; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #f8fafc; }
                    .summary-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px; }
                    .summary-total { font-weight: 800; font-size: 18px; margin-top: 8px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
                    th, td { border: 1px solid #e5e7eb; padding: 8px 10px; font-size: 13px; }
                    th { background: #f3f4f6; text-align: left; }
                    .empty { text-align: center; color: #6b7280; padding: 20px 0; }
                    @media print { @page { size: auto; margin: 10mm; } }
                </style>
            </head>
            <body>
                <h1>${title}</h1>
                <div class="sub">列印時間：${timeText}</div>
                <div class="summary">
                    <div class="summary-row"><span>期間</span><span>${periodText}</span></div>
                    <div class="summary-row"><span>對象篩選</span><span>${partyText}</span></div>
                    <div class="summary-row"><span>狀態篩選</span><span>${statusText}</span></div>
                    <div class="summary-row"><span>單據總數（篩選後）</span><span>${filteredRows.length} 張</span></div>
                    <div class="summary-row"><span>品項總數</span><span>${summary.totalItems} 項</span></div>
                    <div class="summary-row summary-total">
                        <span>總金額</span>
                        <span>${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    ${activeTab === 'sales' ? `
                    <div class="summary-row summary-total" style="margin-top: 4px;">
                        <span>總毛利</span>
                        <span>${summary.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (毛利率: ${summary.grossMargin.toFixed(2)}%)</span>
                    </div>
                    ` : ''}
                </div>
                <table>
                    <thead>
                        ${activeView === 'report'
                            ? `<tr>
                                <th style="width:60px;">#</th>
                                <th>對象</th>
                                <th style="text-align:right;">單據數</th>
                                <th style="text-align:right;">品項數</th>
                                <th style="text-align:right;">總金額</th>
                                ${activeTab === 'sales' ? `
                                <th style="text-align:right;">毛利</th>
                                <th style="text-align:right;">毛利率</th>
                                ` : ''}
                            </tr>`
                            : `<tr>
                                <th style="width:60px;">#</th>
                                <th>單據編號</th>
                                <th>日期</th>
                                <th>對象</th>
                                <th>料號</th>
                                <th>品項</th>
                                <th style="text-align:right;">數量</th>
                                <th style="text-align:right;">單價</th>
                                <th style="text-align:right;">小計</th>
                                ${activeTab === 'sales' ? `
                                <th style="text-align:right;">進貨成本</th>
                                <th style="text-align:right;">毛利</th>
                                ` : ''}
                            </tr>`
                        }
                    </thead>
                    <tbody>
                        ${rowsHtml ? rowsHtml : `<tr><td colspan="${activeView === 'report' ? (activeTab === 'sales' ? 7 : 5) : (activeTab === 'sales' ? 11 : 9)}" class="empty">找不到符合篩選條件的資料</td></tr>`}
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
        }, 220);
    };

    const tableHeaderCellBase = {
        padding: '0.75rem 1.25rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--border-color)'
    };

    return (
        <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                    <BarChart3 size={24} />
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>報表</h1>
                </div>
                <button
                    type="button"
                    onClick={handlePrint}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem'
                    }}
                >
                    <Printer size={16} /> 列印報表
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                    type="button"
                    onClick={() => setActiveTab('sales')}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeTab === 'sales' ? '#2563eb22' : 'var(--bg-secondary)',
                        color: activeTab === 'sales' ? '#60a5fa' : 'var(--text-secondary)'
                    }}
                >
                    銷貨
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('purchase')}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.5rem 0.9rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeTab === 'purchase' ? '#f59e0b22' : 'var(--bg-secondary)',
                        color: activeTab === 'purchase' ? '#fbbf24' : 'var(--text-secondary)'
                    }}
                >
                    進貨
                </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                    type="button"
                    onClick={() => setActiveView('report')}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeView === 'report'
                            ? (activeTab === 'sales' ? '#2563eb22' : '#f59e0b22')
                            : 'var(--bg-secondary)',
                        color: activeView === 'report'
                            ? (activeTab === 'sales' ? '#60a5fa' : '#fbbf24')
                            : 'var(--text-secondary)'
                    }}
                >
                    {activeTab === 'sales' ? '銷貨報表' : '進貨報表'}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveView('detail')}
                    style={{
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeView === 'detail'
                            ? (activeTab === 'sales' ? '#2563eb22' : '#f59e0b22')
                            : 'var(--bg-secondary)',
                        color: activeView === 'detail'
                            ? (activeTab === 'sales' ? '#60a5fa' : '#fbbf24')
                            : 'var(--text-secondary)'
                    }}
                >
                    {activeTab === 'sales' ? '銷貨明細' : '進貨明細'}
                </button>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.65rem' }}>
                    <input
                        placeholder={activeTab === 'sales' ? '客戶' : '供應商'}
                        value={filters.party}
                        onChange={(e) => setFilters({ ...filters, party: e.target.value })}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                    >
                        <option value="">全部狀態</option>
                        <option value="pending">待處理</option>
                        <option value="replied">已回覆</option>
                        <option value="sent">已送出</option>
                        <option value="accepted">已接受</option>
                        <option value="received">已入庫</option>
                        <option value="cancelled">已取消</option>
                    </select>
                    <button
                        type="button"
                        onClick={resetFilters}
                        style={{ border: '1px solid var(--border-color)', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontWeight: 700, cursor: 'pointer' }}
                    >
                        清空篩選
                    </button>
                    <div style={{ gridColumn: '1 / span 1', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.82rem', pointerEvents: 'none' }}>起</span>
                        <input
                            type="date"
                            value={filters.dateFrom}
                            onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                    <div style={{ gridColumn: '2 / span 1', position: 'relative' }}>
                        <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.82rem', pointerEvents: 'none' }}>迄</span>
                        <input
                            type="date"
                            value={filters.dateTo}
                            onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                            style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.7rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        />
                    </div>
                </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>單據總數（篩選後）：{filteredRows.length} 張</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>品項總數：{summary.totalItems} 項</div>
                <div style={{ marginTop: '0.35rem', fontWeight: 800, fontSize: '1.05rem', display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
                    <span>總金額：{summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    {activeTab === 'sales' && (
                        <>
                            <span>總毛利：{summary.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span>總毛利率：{summary.grossMargin.toFixed(2)}%</span>
                        </>
                    )}
                </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-tertiary)' }}>
                        {activeView === 'report' ? (
                            <tr>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>對象</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>單據數</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>品項數</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>總金額</th>
                                {activeTab === 'sales' && (
                                    <>
                                        <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>毛利</th>
                                        <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>毛利率</th>
                                    </>
                                )}
                            </tr>
                        ) : (
                            <tr>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>單據編號</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>日期</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>對象</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>料號</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'left' }}>品項</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>數量</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>單價</th>
                                <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>小計</th>
                                {activeTab === 'sales' && (
                                    <>
                                        <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>進貨成本</th>
                                        <th style={{ ...tableHeaderCellBase, textAlign: 'right' }}>毛利</th>
                                    </>
                                )}
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {activeView === 'report' ? partySummaryRows.map((row) => (
                            <tr key={row.party} style={{ borderTop: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.75rem' }}>{row.party}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{row.docCount}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{row.itemCount}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                {activeTab === 'sales' && (
                                    <>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: row.grossProfit < 0 ? 'var(--text-danger)' : 'inherit' }}>
                                            {row.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: row.grossMargin < 0 ? 'var(--text-danger)' : 'inherit' }}>
                                            {row.grossMargin.toFixed(2)}%
                                        </td>
                                    </>
                                )}
                            </tr>
                        )) : detailRows.map((row, idx) => (
                            <tr key={`${row.docId}-${row.partNo}-${idx}`} style={{ borderTop: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.docId}</td>
                                <td style={{ padding: '0.75rem' }}>{row.date}</td>
                                <td style={{ padding: '0.75rem' }}>{row.party}</td>
                                <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{row.partNo}</td>
                                <td style={{ padding: '0.75rem' }}>{row.itemName}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{row.qty}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right' }}>{row.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700 }}>{row.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                {activeTab === 'sales' && (
                                    <>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{row.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: row.grossProfit < 0 ? 'var(--text-danger)' : 'inherit' }}>
                                            {row.grossProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                        {((activeView === 'report' ? partySummaryRows.length : detailRows.length) === 0) && (
                            <tr>
                                <td colSpan={activeView === 'report' ? (activeTab === 'sales' ? 6 : 4) : (activeTab === 'sales' ? 10 : 8)} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    找不到符合篩選條件的資料
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ReportsPage;
