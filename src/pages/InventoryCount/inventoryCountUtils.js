/**
 * 將盤點行與 PIM（useProductStore）產品合併，帳載量使用目前庫存 stock。
 * 顯示欄位與 ProductDrawer 一致：車型可來自 part_numbers[0]、頂層 car_model 或 car_models 陣列。
 */

function dash(s) {
    const t = (s ?? '').toString().trim();
    return t || '—';
}

/** 車型：優先對照列之適用車型 → 產品主檔車型 → car_models 列表 */
export function formatCarModelForProduct(p) {
    if (!p) return '—';
    const pn0 = p.part_numbers?.[0];
    if (pn0?.car_model?.trim()) return pn0.car_model.trim();
    if (p.car_model?.trim()) return p.car_model.trim();
    if (Array.isArray(p.car_models) && p.car_models.length) {
        return p.car_models.join('、');
    }
    return '—';
}

/** 年分：優先 part_numbers[0].year，其次產品 year */
export function formatYearForProduct(p) {
    if (!p) return '—';
    const pn0 = p.part_numbers?.[0];
    return dash(pn0?.year || p.year);
}

/** 品牌：優先對照列品牌，其次產品品牌 */
export function formatBrandForProduct(p) {
    if (!p) return '—';
    const pn0 = p.part_numbers?.[0];
    return dash(pn0?.brand || p.brand);
}

export function enrichInventorySheet(sheet, products) {
    if (!sheet) return null;
    return {
        ...sheet,
        lines: sheet.lines.map((line) => {
            const p = products.find((x) => x.p_id === line.p_id);
            const stock = p?.stock ?? 0;
            const primaryPn =
                p?.part_number || p?.part_numbers?.[0]?.part_number || line.p_id;
            return {
                ...line,
                systemQty: stock,
                productName: p?.name ?? '(未知產品)',
                sku: primaryPn,
                barcode: primaryPn,
                carModelDisplay: formatCarModelForProduct(p),
                specDisplay: dash(p?.specifications),
                yearDisplay: formatYearForProduct(p),
                brandDisplay: formatBrandForProduct(p),
            };
        }),
    };
}
