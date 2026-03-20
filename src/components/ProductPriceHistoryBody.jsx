import React from 'react';
import plStyles from '../pages/PIM/ProductList.module.css';

const formatHistoryPrice = (row) => {
    if (!row.hasUnitPrice) return '—';
    const u = row.unit_price ?? 0;
    const cur = row.currency || 'TWD';
    return `${cur} ${Number(u).toLocaleString()}`;
};

/**
 * 客戶前價／廠商前價雙欄表格（沿革內容本體）
 */
const ProductPriceHistoryBody = ({ contextProduct, customerHistoryRows, supplierHistoryRows }) => (
    <div className={plStyles.historyDrawerGrid} style={{ flex: 1, minHeight: 0, padding: '0 0 0.35rem' }}>
        <div className={plStyles.historyPanel}>
            <div className={plStyles.historyPanelHead}>客戶前價（銷貨／報價）</div>
            <div className={plStyles.historyPanelScroll}>
                {!contextProduct ? (
                    <div className={plStyles.historyEmpty}>無產品內容可對照</div>
                ) : customerHistoryRows.length === 0 ? (
                    <div className={plStyles.historyEmpty}>尚無包含本商品的銷貨單或報價單紀錄</div>
                ) : (
                    <table className={plStyles.historyTable}>
                        <thead>
                            <tr>
                                <th>類型</th>
                                <th>客戶</th>
                                <th>日期</th>
                                <th>單價</th>
                                <th>數量</th>
                                <th>備註</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customerHistoryRows.map((row, i) => (
                                <tr key={`cs-${row.doc_id}-${i}`}>
                                    <td>{row.doc_kind || '—'}</td>
                                    <td>{row.party}</td>
                                    <td>{row.date || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>{formatHistoryPrice(row)}</td>
                                    <td>{row.qty}</td>
                                    <td>{row.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
        <div className={plStyles.historyPanel}>
            <div className={plStyles.historyPanelHead}>廠商前價（進貨／詢價）</div>
            <div className={plStyles.historyPanelScroll}>
                {!contextProduct ? (
                    <div className={plStyles.historyEmpty}>無產品內容可對照</div>
                ) : supplierHistoryRows.length === 0 ? (
                    <div className={plStyles.historyEmpty}>尚無包含本商品的進貨單或詢價單紀錄</div>
                ) : (
                    <table className={plStyles.historyTable}>
                        <thead>
                            <tr>
                                <th>類型</th>
                                <th>廠商</th>
                                <th>日期</th>
                                <th>單價</th>
                                <th>數量</th>
                                <th>備註</th>
                            </tr>
                        </thead>
                        <tbody>
                            {supplierHistoryRows.map((row, i) => (
                                <tr key={`sp-${row.doc_id}-${i}`}>
                                    <td>{row.doc_kind || '—'}</td>
                                    <td>{row.party}</td>
                                    <td>{row.date || '—'}</td>
                                    <td style={{ fontWeight: 700 }}>{formatHistoryPrice(row)}</td>
                                    <td>{row.qty}</td>
                                    <td>{row.note}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    </div>
);

export default ProductPriceHistoryBody;
