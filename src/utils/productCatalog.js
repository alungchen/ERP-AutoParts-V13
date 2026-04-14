/** 與產品資料庫列表一致之主編號 */
export function getPrimaryPartNumber(p) {
    return p?.part_number || p?.part_numbers?.[0]?.part_number || '';
}

/**
 * 單一關鍵字：於料號、P-ID、品名、品牌、車型、年份、規格、備註、HS、分類、各 pn 等欄位中任一包含即命中（比照 PIM 多欄綜合搜尋體驗）
 */
export function filterProductsCombined(products, rawQuery) {
    const s = String(rawQuery || '').trim().toLowerCase();
    if (!s) return [];
    return products.filter((p) => {
        const parts = [];
        const push = (v) => {
            if (v != null && v !== '') parts.push(String(v).toLowerCase());
        };
        push(p.p_id);
        push(p.name);
        push(p.brand);
        push(p.car_model);
        push(p.year);
        push(p.specifications);
        push(p.notes);
        push(p.hs_code);
        push(p.category);
        push(p.part_number);
        for (const pn of p.part_numbers || []) {
            push(pn.part_number);
            push(pn.car_model);
            push(pn.year);
            push(pn.brand);
            push(pn.note);
        }
        for (const car of p.car_models || []) {
            if (typeof car === 'string') push(car);
            else if (car) push([car.model, car.year].filter(Boolean).join(' '));
        }
        return parts.some((chunk) => chunk.includes(s));
    });
}

/**
 * 製單／產品資料中心：六欄篩選（與 DocumentEditor 選貨視窗邏輯一致）
 * @returns {{ total: number, slice: unknown[] }} total 為符合筆數；slice 為列表顯示用（最多 50 筆）
 */
export function filterProductsByPickerQuery(products, pickerQuery, brands) {
    let filtered = Array.isArray(products) ? products : [];

    if (pickerQuery.model) {
        const q = pickerQuery.model.toLowerCase();
        filtered = filtered.filter(
            (p) =>
                (p.car_model || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some((pn) => (pn.car_model || '').toLowerCase().includes(q))
        );
    }

    if (pickerQuery.part) {
        const q = pickerQuery.part.toLowerCase();
        filtered = filtered.filter(
            (p) =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.notes || '').toLowerCase().includes(q)
        );
    }

    if (pickerQuery.partNumber) {
        const q = pickerQuery.partNumber.toLowerCase();
        filtered = filtered.filter(
            (p) =>
                (p.p_id || '').toLowerCase().includes(q) ||
                (p.part_number || '').toLowerCase().includes(q) ||
                (p.part_numbers || []).some((pn) => (pn.part_number || '').toLowerCase().includes(q))
        );
    }

    if (pickerQuery.year) {
        filtered = filtered.filter(
            (p) =>
                (p.year || '').includes(pickerQuery.year) ||
                (p.part_numbers || []).some((pn) => (pn.year || '').includes(pickerQuery.year))
        );
    }

    if (pickerQuery.spec) {
        const q = pickerQuery.spec.toLowerCase();
        filtered = filtered.filter(
            (p) =>
                (p.specifications || '').toLowerCase().includes(q) ||
                (p.name || '').toLowerCase().includes(q)
        );
    }

    if (pickerQuery.brand) {
        const normalize = (v) => String(v ?? '').toLowerCase();
        const q = normalize(pickerQuery.brand).trim();
        const matchedBrandPhrases = (brands || []).filter((item) => {
            const shorthand = normalize(item?.shorthand);
            const fullname = normalize(item?.fullname);
            return shorthand.includes(q) || fullname.includes(q);
        });
        const brandKeywords = new Set([q]);
        matchedBrandPhrases.forEach((item) => {
            brandKeywords.add(normalize(item?.shorthand));
            brandKeywords.add(normalize(item?.fullname));
        });

        filtered = filtered.filter((p) => {
            const brandText = normalize(
                `${p.brand || ''} ${(p.part_numbers || []).map((pn) => pn?.brand || '').join(' ')}`
            );
            return Array.from(brandKeywords).some((keyword) => keyword && brandText.includes(keyword));
        });
    }

    const total = filtered.length;
    const slice = filtered.slice(0, 50);
    return { total, slice };
}
