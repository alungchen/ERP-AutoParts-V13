const escapeRegExp = (string) => string.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

export const normalizePartNumber = (s) => {
    if (s == null || s === '') return '';
    return String(s)
        .trim()
        .normalize('NFKC')
        .replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\u00ad\u200b-\u200f\uFEFF\s\-_]/g, '')
        .toLowerCase();
};

export const DEFAULT_PRODUCT_QUERY = {
    partNumber: '',
    model: '',
    part: '',
    spec: '',
    year: '',
    brand: '',
};

/** 片語代碼轉換：輸入代碼 → 取得顯示名 */
export function resolveShorthand(inputVal, list = []) {
    if (!inputVal) return inputVal;
    const v = String(inputVal).toLowerCase();
    const matched = list.find((item) => (item.shorthand || '').toLowerCase() === v);
    return matched ? matched.fullname : inputVal;
}

/** 將表單 query 轉成已解析片語的 appliedQuery */
export function resolveProductQuery(query, { models = [], parts = [], brands = [] } = {}) {
    return {
        partNumber: String(query.partNumber || '').trim(),
        model: resolveShorthand(query.model, models),
        part: resolveShorthand(query.part, parts),
        spec: String(query.spec || '').trim(),
        year: String(query.year || '').trim(),
        brand: resolveShorthand(query.brand, brands),
    };
}

export function hasAnyProductQuery(query) {
    return Object.values(query || {}).some((v) => String(v ?? '').trim() !== '');
}

export function filterProductsByQuery(sourceProducts, query) {
    let filtered = sourceProducts || [];

    if (query.model) {
        const q = query.model.toLowerCase();
        filtered = filtered.filter((p) =>
            (p.car_model || '').toLowerCase().includes(q) ||
            (p.part_numbers || []).some((pn) => (pn.car_model || '').toLowerCase().includes(q)) ||
            (p.car_models || []).some((car) => {
                const c = typeof car === 'string' ? car : `${car.model || ''} ${car.year || ''}`;
                return c.toLowerCase().includes(q);
            }) ||
            (p.name || '').toLowerCase().includes(q)
        );
    }

    if (query.part) {
        const q = query.part.toLowerCase();
        filtered = filtered.filter((p) => (p.name || '').toLowerCase().includes(q));
    }

    if (query.partNumber) {
        const cleanQuery = query.partNumber.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D\u00ad\u200b-\u200f\uFEFF\s\-_]/g, '');
        const pattern = cleanQuery.split('*').map(escapeRegExp).join('.*');
        const regex = new RegExp(pattern, 'i');
        filtered = filtered.filter((p) =>
            regex.test(normalizePartNumber(p.part_number)) ||
            (p.part_numbers || []).some((pn) => regex.test(normalizePartNumber(pn.part_number))) ||
            regex.test(normalizePartNumber(p.p_id))
        );
    }

    if (query.year) {
        filtered = filtered.filter((p) =>
            (p.year || '').includes(query.year) ||
            (p.part_numbers || []).some((pn) =>
                (pn.year || '').includes(query.year) ||
                (pn.car_model || '').includes(query.year)
            ) ||
            (p.car_models || []).some((car) => {
                const c = typeof car === 'string' ? car : `${car.model || ''} ${car.year || ''}`;
                return c.includes(query.year);
            })
        );
    }

    if (query.spec) {
        const q = query.spec.toLowerCase();
        filtered = filtered.filter((p) =>
            (p.specifications || '').toLowerCase().includes(q) ||
            (p.notes || '').toLowerCase().includes(q) ||
            (p.part_numbers || []).some((pn) => (pn.note || '').toLowerCase().includes(q))
        );
    }

    if (query.brand) {
        const q = query.brand.toLowerCase();
        filtered = filtered.filter((p) =>
            (p.brand || '').toLowerCase().includes(q) ||
            (p.part_numbers || []).some((pn) => (pn.brand || '').toLowerCase().includes(q))
        );
    }

    return filtered;
}
