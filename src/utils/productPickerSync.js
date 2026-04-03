/**
 * Align document-line product picker with PIM fields (car_models[], specifications, prices).
 */

export function productCarModelsSearchText(p) {
    const parts = [];
    if (p?.car_model) parts.push(String(p.car_model));
    if (Array.isArray(p?.car_models)) {
        p.car_models.forEach((cm) => {
            if (cm != null && cm !== '') parts.push(String(cm));
        });
    }
    return parts.join(' ');
}

/** Year token match: explicit year fields + text inside car_models (e.g. 2018-2022). */
export function productYearSearchBlob(p) {
    const chunks = [];
    if (p?.year != null && p.year !== '') chunks.push(String(p.year));
    chunks.push(productCarModelsSearchText(p));
    (p?.part_numbers || []).forEach((pn) => {
        if (pn?.year != null && pn.year !== '') chunks.push(String(pn.year));
        if (pn?.car_model) chunks.push(String(pn.car_model));
    });
    return chunks.join(' ');
}

export function productLineCarModel(p) {
    const pn0 = p?.part_numbers?.[0] || {};
    if (pn0.car_model) return String(pn0.car_model);
    if (p?.car_model) return String(p.car_model);
    if (Array.isArray(p?.car_models) && p.car_models.length > 0) return String(p.car_models[0]);
    return '';
}

export function productLineYear(p) {
    const pn0 = p?.part_numbers?.[0] || {};
    if (pn0.year != null && pn0.year !== '') return String(pn0.year);
    if (p?.year != null && p.year !== '') return String(p.year);
    return '';
}

/** Sales line price: use price_a when set; otherwise PIM often only has base_cost. */
export function productSalesUnitPrice(p) {
    const raw = p?.price_a;
    if (raw != null && raw !== '' && Number.isFinite(Number(raw))) return Number(raw);
    const bc = Number(p?.base_cost);
    return Number.isFinite(bc) ? bc : 0;
}

export function productPurchaseUnitPrice(p) {
    const bc = Number(p?.base_cost);
    return Number.isFinite(bc) ? bc : 0;
}
