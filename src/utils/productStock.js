/** 全店庫存：優先加總 stock_details，否則 fallback 至 product.stock */
export function getTotalStock(productOrDetails) {
    if (Array.isArray(productOrDetails)) {
        return productOrDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    }
    const details = productOrDetails?.stock_details || [];
    if (details.length > 0) {
        return details.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    }
    return Number(productOrDetails?.stock) || 0;
}

export const BRANCH_STOCK_COLORS = {
    songshan: '#3b82f6',
    xizhi: '#10b981',
    linkou: '#f59e0b',
};

export function getBranchStockColor(branchId) {
    return BRANCH_STOCK_COLORS[branchId] || '#3b82f6';
}

/** 依分店清單彙總庫位明細 */
export function groupStockByBranch(stockDetails = [], branches = []) {
    const list = branches.length > 0
        ? branches
        : [...new Set((stockDetails || []).map((s) => s.branch_id).filter(Boolean))]
            .map((branch_id) => ({ branch_id, name: branch_id }));

    return list.map((branch) => {
        const items = (stockDetails || []).filter((s) => s.branch_id === branch.branch_id);
        const total = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
        return { branch, items, total };
    });
}
