import { sumMinor } from './money';

/**
 * Settlement / 結帳模型 — 純函式引擎（可於單一交易中呼叫）
 *
 * 實體：
 * - invoices：帳單（應收 amount_total_minor）
 * - payments：付款（實付 amount_total_minor）
 * - invoice_payment_allocations：沖銷明細（多對多：一筆付款可拆多張發票，一張發票可收多筆款）
 *
 * 餘額：invoice 未沖銷 = amount_total_minor − Σ(allocations 指向該發票)
 * 付款剩餘可分配額 = payment.amount_total_minor − Σ(allocations 指向該付款)
 *
 * --- 若對應後端 SQL（概念）---
 * invoices(id PK, invoice_number, customer_id, amount_total_minor BIGINT, status, issued_at, due_at, ...)
 * payments(id PK, amount_total_minor BIGINT, paid_at, ref, method, status, ...)
 * invoice_payment_allocations(
 *   id PK, invoice_id FK, payment_id FK, amount_minor BIGINT NOT NULL,
 *   UNIQUE 可不設；應以「應用層交易」一次寫入 payment + 多筆 allocation
 * )
 * CHECK(amount_minor > 0); 應用層再驗證 Σalloc per payment <= payment.amount_total、per invoice <= 剩餘應收。
 */

export function getAllocatedToInvoice(invoiceId, allocations) {
    return sumMinor(
        allocations.filter((a) => a.invoice_id === invoiceId).map((a) => a.amount_minor)
    );
}

export function getAllocatedFromPayment(paymentId, allocations) {
    return sumMinor(
        allocations.filter((a) => a.payment_id === paymentId).map((a) => a.amount_minor)
    );
}

/** 發票未沖銷餘額（分）。void 發票固定為 0（不可再沖） */
export function invoiceBalanceMinor(invoice, allocations) {
    if (!invoice || invoice.status === 'void') return 0;
    return Math.max(0, invoice.amount_total_minor - getAllocatedToInvoice(invoice.id, allocations));
}

export function paymentUnallocatedMinor(payment, allocations) {
    if (!payment) return 0;
    return Math.max(0, payment.amount_total_minor - getAllocatedFromPayment(payment.id, allocations));
}

/** 匯出供同步後重算狀態 */
export function deriveInvoiceStatus(invoice, allocations) {
    if (!invoice) return 'draft';
    if (invoice.status === 'void') return 'void';
    const bal = invoiceBalanceMinor(invoice, allocations);
    if (bal <= 0) return 'paid';
    const paid = getAllocatedToInvoice(invoice.id, allocations);
    if (paid > 0) return 'partial';
    return invoice.status === 'draft' ? 'draft' : 'open';
}

function recomputeInvoiceStatuses(invoices, allocations) {
    return invoices.map((inv) => ({
        ...inv,
        status: deriveInvoiceStatus(inv, allocations),
    }));
}

/**
 * 建立「付款 + 多筆沖銷」交易，回傳新狀態；失敗時不修改任何資料。
 *
 * @param {object} state — { invoices, payments, allocations }
 * @param {object} paymentDraft — { amount_total_minor, paid_at?, ref?, method?, note? }（無 id）
 * @param {Array<{ invoice_id: string, amount_minor: number }>} lines — 沖銷明細
 * @param {(prefix: string) => string} idPayment
 * @param {(prefix: string) => string} idAlloc
 * @returns {{ ok: true, invoices, payments, allocations } | { ok: false, error: string }}
 */
export function applyPaymentTransaction(
    state,
    paymentDraft,
    lines,
    idPayment = () => `pay_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    idAlloc = () => `ipa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
) {
    const { invoices, payments, allocations } = state;

    const payTotal = paymentDraft?.amount_total_minor;
    if (!Number.isFinite(payTotal) || payTotal <= 0) {
        return { ok: false, error: '付款總額須為大於 0 的整數（分）' };
    }

    if (!Array.isArray(lines) || lines.length === 0) {
        return { ok: false, error: '至少需一筆沖銷明細（帳單與金額）' };
    }

    const invMap = new Map(invoices.map((i) => [i.id, i]));
    let allocSum = 0;

    for (let i = 0; i < lines.length; i += 1) {
        const row = lines[i];
        const invId = row?.invoice_id;
        const amt = row?.amount_minor;

        if (!invId || typeof invId !== 'string') {
            return { ok: false, error: `第 ${i + 1} 筆沖銷缺少有效 invoice_id` };
        }
        if (!Number.isFinite(amt) || amt <= 0) {
            return { ok: false, error: `第 ${i + 1} 筆沖銷金額須為大於 0 的整數（分）` };
        }
        if (!Number.isInteger(amt)) {
            return { ok: false, error: `第 ${i + 1} 筆沖銷金額必須為整數分，不可用浮點` };
        }

        const inv = invMap.get(invId);
        if (!inv) {
            return { ok: false, error: `找不到帳單：${invId}` };
        }
        const payLedger = paymentDraft?.ledger;
        if (payLedger && inv.ledger && inv.ledger !== payLedger) {
            return { ok: false, error: '帳款類別（應收／應付）與沖銷交易不一致' };
        }
        if (payLedger && !inv.ledger) {
            return { ok: false, error: '帳單缺少 ledger，無法沖銷（請同步或遷移資料）' };
        }
        if (inv.status === 'void') {
            return { ok: false, error: `帳單 ${invId} 已作廢，不可沖銷` };
        }
        if (inv.status === 'draft') {
            return { ok: false, error: `帳單 ${invId} 仍為草稿，不可沖銷` };
        }

        const balanceBefore = invoiceBalanceMinor(inv, allocations);
        if (amt > balanceBefore) {
            return {
                ok: false,
                error: `帳單 ${invId} 僅可沖銷餘額 ${balanceBefore} 分，本筆填寫 ${amt} 分`,
            };
        }

        allocSum += amt;
    }

    if (allocSum > payTotal) {
        return {
            ok: false,
            error: `沖銷加總 ${allocSum} 分不可超過付款金額 ${payTotal} 分`,
        };
    }

    const paymentId = idPayment('pay');
    const paidAt = paymentDraft.paid_at || new Date().toISOString();

    const newPayment = {
        id: paymentId,
        ledger: paymentDraft.ledger || 'ar',
        amount_total_minor: payTotal,
        paid_at: paidAt,
        ref: paymentDraft.ref || '',
        method: paymentDraft.method || '',
        note: paymentDraft.note || '',
        status: 'completed',
    };

    const created = lines.map((row) => ({
        id: idAlloc('ipa'),
        invoice_id: row.invoice_id,
        payment_id: paymentId,
        amount_minor: row.amount_minor,
        created_at: paidAt,
    }));

    const nextAllocations = [...allocations, ...created];
    const nextPayments = [...payments, newPayment];
    const nextInvoices = recomputeInvoiceStatuses(invoices, nextAllocations);

    return {
        ok: true,
        invoices: nextInvoices,
        payments: nextPayments,
        allocations: nextAllocations,
    };
}

/**
 * 新增帳單（不含沖銷）。draft 可轉 open 由 UI 另叫 markInvoiceOpen。
 */
export function assertInvoiceTotals(invoice) {
    if (!invoice?.id) return { ok: false, error: '帳單需有 id' };
    if (!Number.isFinite(invoice.amount_total_minor) || invoice.amount_total_minor < 0) {
        return { ok: false, error: 'amount_total_minor 須為非負整數（分）' };
    }
    if (!Number.isInteger(invoice.amount_total_minor)) {
        return { ok: false, error: 'amount_total_minor 必須為整數分' };
    }
    return { ok: true };
}
