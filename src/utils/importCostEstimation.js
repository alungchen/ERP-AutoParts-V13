/**
 * 進口貿易落地成本試算（EXW → Landed，幣別統一為 TWD）
 */

/** 支援之外幣（TWD 免換匯） */
export const IMPORT_CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'CNY'];

/**
 * 將單位外幣換算為 TWD（含換匯緩衝：買方承擔匯率不利）
 * @param {number} amountForeign
 * @param {string} currency
 * @param {number} twdPerUnit - 1 單位外幣兌 TWD（與 useSourcingStore.rates 一致：TWD 買入外幣）
 * @param {number} buffer - 例 0.01 = +1%
 */
export function convertToTwd(amountForeign, currency, twdPerUnit, buffer) {
    const c = String(currency || 'TWD').toUpperCase();
    if (c === 'TWD') return amountForeign;
    const rate = Number(twdPerUnit);
    const b = Number(buffer) || 0;
    const adjusted = rate * (1 + b);
    return amountForeign * adjusted;
}

/**
 * @param {object} input
 * @param {number} input.exwForeign - EXW（原幣；TWD 時即台幣單價）
 * @param {string} input.currency
 * @param {number} input.twdPerUnit - 外幣兌 TWD
 * @param {number} [input.exchangeBuffer=0.01]
 * @param {number} input.inlandAndDocTwd - 國外內陸運 + 國外報關/文件（TWD）
 * @param {number} input.intlFreightTwd - 國際運費（TWD）
 * @param {number} [input.insuranceCifFactor=1.1] - 保險係數（預設 CIF 110%）
 * @param {number} [input.insuranceRate=0.001] - 保險費率（CFR × factor × rate）
 * @param {number} input.dutyRate - 進口稅率 0~1（第一欄）
 * @param {number} [input.exciseRate=0] - 貨物稅率 0~1
 * @param {number} input.customsFeeTwd
 * @param {number} input.doFeeTwd - 換單費
 * @param {number} input.ediFeeTwd - 電腦傳輸費
 * @param {number} input.lclFeeTwd - 拆櫃費等
 * @param {number} input.terminalFeeTwd - 櫃場規費
 * @param {number} input.domesticFreightTwd - 國內派送
 * @param {number} [input.vatRate=0.05]
 * @param {number} [input.tradePromoRate=0.0004]
 * @param {number} [input.miscBudgetRate=0.05] - 雜項預算比例
 * @param {number} [input.quantity=1]
 * @param {number} [input.retailMarginRate=0.2] - 建議零售底價 = 單件成本 × (1+此比例)
 */
export function computeLandedCostBreakdown(input) {
    const {
        exwForeign,
        currency,
        twdPerUnit,
        exchangeBuffer = 0.01,
        inlandAndDocTwd = 0,
        intlFreightTwd = 0,
        insuranceCifFactor = 1.1,
        insuranceRate = 0.001,
        dutyRate = 0,
        exciseRate = 0,
        customsFeeTwd = 0,
        doFeeTwd = 0,
        ediFeeTwd = 0,
        lclFeeTwd = 0,
        terminalFeeTwd = 0,
        domesticFreightTwd = 0,
        vatRate = 0.05,
        tradePromoRate = 0.0004,
        miscBudgetRate = 0.05,
        quantity = 1,
        retailMarginRate = 0.2,
    } = input;

    const qty = Math.max(1, Number(quantity) || 1);
    const exwTwd = convertToTwd(Number(exwForeign) || 0, currency, twdPerUnit, exchangeBuffer);
    const fcaTwd = exwTwd + (Number(inlandAndDocTwd) || 0);
    const cfrTwd = fcaTwd + (Number(intlFreightTwd) || 0);

    const insuranceTwd = cfrTwd * Number(insuranceCifFactor) * Number(insuranceRate);
    const cifTwd = cfrTwd + insuranceTwd;

    const dutyTwd = cifTwd * (Number(dutyRate) || 0);
    const tradePromoTwd = cifTwd * (Number(tradePromoRate) || 0);
    const exciseTwd = (cifTwd + dutyTwd) * (Number(exciseRate) || 0);
    const vatBase = cifTwd + dutyTwd + exciseTwd + tradePromoTwd;
    const vatTwd = vatBase * (Number(vatRate) || 0);

    const domesticSum =
        (Number(customsFeeTwd) || 0) +
        (Number(doFeeTwd) || 0) +
        (Number(ediFeeTwd) || 0) +
        (Number(lclFeeTwd) || 0) +
        (Number(terminalFeeTwd) || 0) +
        (Number(domesticFreightTwd) || 0);

    const subtotalBeforeMisc =
        cifTwd + dutyTwd + tradePromoTwd + exciseTwd + vatTwd + domesticSum;
    const miscBudgetTwd = subtotalBeforeMisc * (Number(miscBudgetRate) || 0);
    const totalLandedTwd = subtotalBeforeMisc + miscBudgetTwd;

    const unitAverageCost = totalLandedTwd / qty;
    const suggestedRetailFloor = unitAverageCost * (1 + (Number(retailMarginRate) || 0));

    const lines = [
        { key: 'exw', label: 'EXW（換匯後台幣）', amount: exwTwd },
        { key: 'fca_addon', label: '＋國外內陸／報關文件費', amount: inlandAndDocTwd },
        { key: 'fca', label: 'FCA 小計', amount: fcaTwd },
        { key: 'freight_intl', label: '＋國際運費 (CFR 增量)', amount: intlFreightTwd },
        { key: 'cfr', label: 'CFR 小計', amount: cfrTwd },
        { key: 'insurance', label: `＋保險費（CFR×${insuranceCifFactor}×${insuranceRate}）`, amount: insuranceTwd },
        { key: 'cif', label: 'CIF 小計', amount: cifTwd },
        { key: 'duty', label: `進口稅（CIF×${(Number(dutyRate) || 0) * 100}%）`, amount: dutyTwd },
        { key: 'promo', label: '推廣貿易服務費（CIF×0.04%）', amount: tradePromoTwd },
        { key: 'excise', label: `貨物稅（(CIF+進口稅)×${(Number(exciseRate) || 0) * 100}%）`, amount: exciseTwd },
        { key: 'vat', label: `營業稅（${(Number(vatRate) || 0) * 100}%）`, amount: vatTwd },
        { key: 'dom_customs', label: '國內報關規費', amount: customsFeeTwd + doFeeTwd + ediFeeTwd },
        { key: 'dom_logistics', label: '物流雜費（拆櫃／櫃場／派送）', amount: lclFeeTwd + terminalFeeTwd + domesticFreightTwd },
        { key: 'subtotal', label: '小計（含稅與國內費用）', amount: subtotalBeforeMisc },
        { key: 'misc', label: `雜項預算（${(Number(miscBudgetRate) || 0) * 100}%）`, amount: miscBudgetTwd },
        { key: 'total', label: '落地成本總計（本批）', amount: totalLandedTwd },
    ];

    return {
        quantity: qty,
        lines,
        exwTwd,
        fcaTwd,
        cfrTwd,
        cifTwd,
        dutyTwd,
        tradePromoTwd,
        exciseTwd,
        vatTwd,
        domesticSum,
        miscBudgetTwd,
        totalLandedTwd,
        unitAverageCost,
        suggestedRetailFloor,
        retailMarginRate: Number(retailMarginRate) || 0,
    };
}

/**
 * 多品項整批估價：國外內陸／國際運費／國內雜費等可依 **品項數平均** 或 **EXW 換算總價** 分攤；進口稅、貨物稅、營業稅仍逐品項計算。
 *
 * @param {object} input
 * @param {'equal'|'exwValue'} [input.sharedCostSplit='equal'] — equal：每品項分攤 1/n；exwValue：依 EXW×qty 台幣占比
 * @param {Array<{ exwForeign: number, quantity: number, dutyRate?: number, exciseRate?: number, label?: string }>} input.lines
 */
export function computeMultiLineLandedCost(input) {
    const {
        lines: rawLines,
        currency,
        twdPerUnit,
        exchangeBuffer = 0.01,
        inlandAndDocTwd = 0,
        intlFreightTwd = 0,
        insuranceCifFactor = 1.1,
        insuranceRate = 0.001,
        customsFeeTwd = 0,
        doFeeTwd = 0,
        ediFeeTwd = 0,
        lclFeeTwd = 0,
        terminalFeeTwd = 0,
        domesticFreightTwd = 0,
        vatRate = 0.05,
        tradePromoRate = 0.0004,
        miscBudgetRate = 0.05,
        retailMarginRate = 0.2,
        sharedCostSplit = 'equal',
    } = input;

    const domesticSum =
        (Number(customsFeeTwd) || 0) +
        (Number(doFeeTwd) || 0) +
        (Number(ediFeeTwd) || 0) +
        (Number(lclFeeTwd) || 0) +
        (Number(terminalFeeTwd) || 0) +
        (Number(domesticFreightTwd) || 0);

    const inland = Number(inlandAndDocTwd) || 0;
    const intlF = Number(intlFreightTwd) || 0;
    const insF = Number(insuranceCifFactor);
    const insR = Number(insuranceRate);
    const vatR = Number(vatRate) || 0;
    const promoR = Number(tradePromoRate) || 0;
    const miscR = Number(miscBudgetRate) || 0;
    const marginR = Number(retailMarginRate) || 0;
    const buf = Number(exchangeBuffer) || 0;

    const normLines = (rawLines || [])
        .map((L, idx) => {
            const qty = Math.max(0, Number(L.quantity) || 0);
            const exw = Number(L.exwForeign) || 0;
            const dutyRate = Number(L.dutyRate) || 0;
            const exciseRate = Number(L.exciseRate) || 0;
            const label = String(L.label || `品項 ${idx + 1}`).trim() || `品項 ${idx + 1}`;
            return { label, qty, exw, dutyRate, exciseRate };
        })
        .filter((L) => L.qty > 0);

    if (normLines.length === 0) {
        return {
            lineResults: [],
            aggregateLines: [],
            subtotalBeforeMisc: 0,
            miscBudgetTwd: 0,
            grandTotalLandedTwd: 0,
            totalQty: 0,
            weightedUnitCost: 0,
            retailMarginRate: marginR,
            sharedCostSplit,
        };
    }

    const batchExwTwdList = normLines.map((L) =>
        convertToTwd(L.exw * L.qty, currency, twdPerUnit, buf)
    );
    const totalExwTwd = batchExwTwdList.reduce((a, b) => a + b, 0);
    const n = normLines.length;
    const equalShare = 1 / n;
    const shares = sharedCostSplit === 'exwValue'
        ? (totalExwTwd > 0
            ? batchExwTwdList.map((v) => v / totalExwTwd)
            : normLines.map(() => equalShare))
        : normLines.map(() => equalShare);

    const splitLabel = sharedCostSplit === 'equal' ? '（品項均分）' : '（依 EXW 金額占比）';

    const lineResults = normLines.map((L, i) => {
        const share = shares[i];
        const batchExwTwd = batchExwTwdList[i];
        const allocInland = inland * share;
        const allocIntl = intlF * share;
        const allocDomestic = domesticSum * share;

        const fcaTwd = batchExwTwd + allocInland;
        const cfrTwd = fcaTwd + allocIntl;
        const insuranceTwd = cfrTwd * insF * insR;
        const cifTwd = cfrTwd + insuranceTwd;

        const dutyTwd = cifTwd * L.dutyRate;
        const tradePromoTwd = cifTwd * promoR;
        const exciseTwd = (cifTwd + dutyTwd) * L.exciseRate;
        const vatBase = cifTwd + dutyTwd + exciseTwd + tradePromoTwd;
        const vatTwd = vatBase * vatR;

        const subBeforeMisc = cifTwd + dutyTwd + tradePromoTwd + exciseTwd + vatTwd + allocDomestic;

        return {
            label: L.label,
            quantity: L.qty,
            share,
            batchExwTwd,
            allocInland,
            allocIntl,
            allocDomestic,
            fcaTwd,
            cfrTwd,
            insuranceTwd,
            cifTwd,
            dutyTwd,
            tradePromoTwd,
            exciseTwd,
            vatTwd,
            subBeforeMisc,
        };
    });

    const subtotalBeforeMisc = lineResults.reduce((a, r) => a + r.subBeforeMisc, 0);
    const miscBudgetTwd = subtotalBeforeMisc * miscR;
    const grandTotalLandedTwd = subtotalBeforeMisc + miscBudgetTwd;

    /** 雜項預算同樣按品項數均分，與共同費用一致 */
    const miscPerLine = miscBudgetTwd / lineResults.length;
    const lineWithMisc = lineResults.map((r) => {
        const lineTotal = r.subBeforeMisc + miscPerLine;
        const unitAverageCost = lineTotal / r.quantity;
        const suggestedRetailFloor = unitAverageCost * (1 + marginR);
        return {
            ...r,
            miscAlloc: miscPerLine,
            lineTotalLandedTwd: lineTotal,
            unitAverageCost,
            suggestedRetailFloor,
        };
    });

    const totalQty = normLines.reduce((a, L) => a + L.qty, 0);
    const weightedUnitCost = totalQty > 0 ? grandTotalLandedTwd / totalQty : 0;

    const aggregateLines = [
        { key: 'exw', label: 'EXW（換匯後台幣，全批）', amount: totalExwTwd },
        { key: 'fca_addon', label: `＋國外內陸／報關文件費（全批）${splitLabel}`, amount: inland },
        { key: 'freight_intl', label: `＋國際運費（全批）${splitLabel}`, amount: intlF },
        { key: 'insurance', label: `＋保險費（逐品項 CFR×${insF}×${insR} 合計）`, amount: lineResults.reduce((a, r) => a + r.insuranceTwd, 0) },
        { key: 'cif', label: 'CIF 合計', amount: lineResults.reduce((a, r) => a + r.cifTwd, 0) },
        { key: 'duty', label: '進口稅合計', amount: lineResults.reduce((a, r) => a + r.dutyTwd, 0) },
        { key: 'promo', label: '推廣貿易服務費合計', amount: lineResults.reduce((a, r) => a + r.tradePromoTwd, 0) },
        { key: 'excise', label: '貨物稅合計', amount: lineResults.reduce((a, r) => a + r.exciseTwd, 0) },
        { key: 'vat', label: `營業稅合計（${vatR * 100}%）`, amount: lineResults.reduce((a, r) => a + r.vatTwd, 0) },
        { key: 'domestic', label: `國內報關／物流雜費（全批）${splitLabel}`, amount: domesticSum },
        { key: 'subtotal', label: '小計（含稅與國內費用）', amount: subtotalBeforeMisc },
        { key: 'misc', label: `雜項預算（${miscR * 100}%，品項均分）`, amount: miscBudgetTwd },
        { key: 'total', label: '落地成本總計（本批）', amount: grandTotalLandedTwd },
    ];

    return {
        lineResults: lineWithMisc,
        aggregateLines,
        subtotalBeforeMisc,
        miscBudgetTwd,
        grandTotalLandedTwd,
        totalQty,
        weightedUnitCost,
        retailMarginRate: marginR,
        sharedCostSplit,
    };
}
