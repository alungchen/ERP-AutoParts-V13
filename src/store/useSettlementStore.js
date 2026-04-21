import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { erpPersistStorage } from '../lib/erpPersistStorage';
import { toMinorFromTwd } from '../domain/settlement/money';
import {
    applyPaymentTransaction,
    assertInvoiceTotals,
    deriveInvoiceStatus,
    getAllocatedFromPayment,
    getAllocatedToInvoice,
    invoiceBalanceMinor,
    paymentUnallocatedMinor,
} from '../domain/settlement/engine';
import {
    docAmountMinorTwd,
    monthKeyFromISODate,
    purchaseOrderQualifiesForAP,
    salesOrderQualifiesForAR,
} from '../domain/settlement/docTotals';

/** @param {string} prefix */
function makeId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** @param {'ar'|'ap'} ledger @param {string} docId */
export function invoiceIdForSourceDoc(ledger, docId) {
    return `${ledger}_src_${docId}`;
}

function emptyState() {
    return {
        invoices: [],
        payments: [],
        allocations: [],
        closedMonthsAr: [],
        closedMonthsAp: [],
    };
}

/**
 * @param {*} invoice
 * @param {'ar'|'ap'} ledger
 * @param {string[]} closed
 */
function isInvoicePeriodClosed(invoice, ledger, closedAr, closedAp) {
    const month = invoice?.period_month || '';
    if (!month) return false;
    const list = ledger === 'ap' ? closedAp : closedAr;
    return list.includes(month);
}

export const useSettlementStore = create(
    persist(
        (set, get) => ({
            ...emptyState(),

            resetAll: () => set(emptyState()),

            isPeriodClosed: (ledger, monthKey) => {
                const { closedMonthsAr, closedMonthsAp } = get();
                const list = ledger === 'ap' ? closedMonthsAp : closedMonthsAr;
                return list.includes(monthKey);
            },

            /**
             * 月結：該月所有該類帳款須已結清（餘額 0）或作廢
             */
            closeMonth: (ledger, monthKey) => {
                if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
                    return { ok: false, error: '月別格式須為 YYYY-MM' };
                }
                const { invoices, allocations, closedMonthsAr, closedMonthsAp } = get();
                const relevant = invoices.filter(
                    (inv) => inv.ledger === ledger && (inv.period_month || '') === monthKey && inv.status !== 'void'
                );
                for (const inv of relevant) {
                    const bal = invoiceBalanceMinor(inv, allocations);
                    if (bal > 0) {
                        return {
                            ok: false,
                            error: `月份 ${monthKey} 仍有未結清帳款：${inv.invoice_number || inv.id}（餘額未沖完）`,
                        };
                    }
                }
                const key = ledger === 'ap' ? 'closedMonthsAp' : 'closedMonthsAr';
                const cur = ledger === 'ap' ? closedMonthsAp : closedMonthsAr;
                if (cur.includes(monthKey)) {
                    return { ok: false, error: '該月已關帳' };
                }
                set({ [key]: [...cur, monthKey].sort() });
                return { ok: true };
            },

            reopenMonth: (ledger, monthKey) => {
                const key = ledger === 'ap' ? 'closedMonthsAp' : 'closedMonthsAr';
                const cur = get()[key];
                set({ [key]: cur.filter((m) => m !== monthKey) });
                return { ok: true };
            },

            /**
             * 由銷貨單／進貨單建立或更新未沖銷之帳款（不刪除已存在之沖銷）
             */
            syncFromDocuments: ({ salesOrders = [], purchaseOrders = [], vatEnabled, vatRate, defaultCurrency }) => {
                const state = get();
                let invoices = [...state.invoices];
                const { allocations, closedMonthsAr, closedMonthsAp } = state;

                const upsert = (draft) => {
                    const chk = assertInvoiceTotals(draft);
                    if (!chk.ok) return;

                    const closed = draft.ledger === 'ap' ? closedMonthsAp : closedMonthsAr;
                    if (closed.includes(draft.period_month)) return;

                    const idx = invoices.findIndex((i) => i.id === draft.id);
                    if (idx === -1) {
                        invoices = [...invoices, draft];
                        return;
                    }
                    const existing = invoices[idx];
                    const allocated = getAllocatedToInvoice(existing.id, allocations);
                    if (allocated > 0 && existing.amount_total_minor !== draft.amount_total_minor) {
                        return;
                    }
                    invoices = invoices.map((i) => (i.id === draft.id ? { ...existing, ...draft } : i));
                };

                for (const doc of salesOrders) {
                    if (!salesOrderQualifiesForAR(doc)) continue;
                    const id = invoiceIdForSourceDoc('ar', doc.doc_id);
                    const period_month = monthKeyFromISODate(doc.date || '') || monthKeyFromISODate(new Date().toISOString().slice(0, 10));
                    const amount_total_minor = docAmountMinorTwd(doc, vatEnabled, vatRate, defaultCurrency);
                    if (amount_total_minor <= 0) continue;
                    upsert({
                        id,
                        ledger: 'ar',
                        invoice_number: doc.doc_id,
                        source_doc_id: doc.doc_id,
                        source_doc_type: 'sales',
                        party_id: doc.customer_id || '',
                        party_name: doc.customer_name || '',
                        amount_total_minor,
                        status: 'open',
                        issued_at: `${doc.date || new Date().toISOString().slice(0, 10)}T12:00:00.000Z`,
                        due_at: '',
                        period_month,
                        note: doc.notes || '',
                    });
                }

                for (const doc of purchaseOrders) {
                    if (!purchaseOrderQualifiesForAP(doc)) continue;
                    const id = invoiceIdForSourceDoc('ap', doc.doc_id);
                    const period_month = monthKeyFromISODate(doc.date || '') || monthKeyFromISODate(new Date().toISOString().slice(0, 10));
                    const amount_total_minor = docAmountMinorTwd(doc, vatEnabled, vatRate, defaultCurrency);
                    if (amount_total_minor <= 0) continue;
                    upsert({
                        id,
                        ledger: 'ap',
                        invoice_number: doc.doc_id,
                        source_doc_id: doc.doc_id,
                        source_doc_type: 'purchase',
                        party_id: doc.supplier_id || '',
                        party_name: doc.supplier_name || '',
                        amount_total_minor,
                        status: 'open',
                        issued_at: `${doc.date || new Date().toISOString().slice(0, 10)}T12:00:00.000Z`,
                        due_at: '',
                        period_month,
                        note: doc.notes || '',
                    });
                }

                const nextInv = invoices.map((inv) => ({
                    ...inv,
                    status: deriveInvoiceStatus(inv, allocations),
                }));
                set({ invoices: nextInv });
                return { ok: true };
            },

            addInvoice: (draft) => {
                const ledger = draft.ledger || 'ar';
                const id = draft.id || makeId('inv');
                const period_month =
                    draft.period_month || monthKeyFromISODate(draft.issued_at || new Date().toISOString().slice(0, 10));
                const invoice = {
                    id,
                    ledger,
                    invoice_number: draft.invoice_number || '',
                    source_doc_id: draft.source_doc_id || '',
                    source_doc_type: draft.source_doc_type || '',
                    party_id: draft.party_id || draft.customer_id || '',
                    party_name: draft.party_name || '',
                    amount_total_minor: draft.amount_total_minor ?? 0,
                    status: draft.status || 'draft',
                    issued_at: draft.issued_at || new Date().toISOString(),
                    due_at: draft.due_at || '',
                    period_month,
                    note: draft.note || '',
                };
                const chk = assertInvoiceTotals(invoice);
                if (!chk.ok) return chk;

                const { closedMonthsAr, closedMonthsAp } = get();
                if (isInvoicePeriodClosed(invoice, ledger, closedMonthsAr, closedMonthsAp)) {
                    return { ok: false, error: `會計月份 ${period_month} 已月結，不可新增帳款` };
                }

                set((s) => ({
                    invoices: [...s.invoices, invoice],
                }));
                return { ok: true, id };
            },

            markInvoiceOpen: (invoiceId) => {
                set((s) => ({
                    invoices: s.invoices.map((inv) =>
                        inv.id === invoiceId && inv.status === 'draft' ? { ...inv, status: 'open' } : inv
                    ),
                }));
            },

            voidInvoice: (invoiceId) => {
                const { invoices, allocations, closedMonthsAr, closedMonthsAp } = get();
                const inv = invoices.find((i) => i.id === invoiceId);
                if (!inv) return { ok: false, error: '找不到帳單' };
                if (isInvoicePeriodClosed(inv, inv.ledger || 'ar', closedMonthsAr, closedMonthsAp)) {
                    return { ok: false, error: '該帳款所屬月份已月結，不可作廢' };
                }
                const allocated = getAllocatedToInvoice(invoiceId, allocations);
                if (allocated > 0) {
                    return { ok: false, error: '已有沖銷紀錄的帳單不可作廢' };
                }
                set({
                    invoices: invoices.map((i) => (i.id === invoiceId ? { ...i, status: 'void' } : i)),
                });
                return { ok: true };
            },

            executePaymentTransaction: (paymentDraft, lines) => {
                const state = get();
                const ledger = paymentDraft?.ledger || 'ar';

                for (const row of lines || []) {
                    const inv = state.invoices.find((i) => i.id === row.invoice_id);
                    if (!inv) continue;
                    if (isInvoicePeriodClosed(inv, inv.ledger || ledger, state.closedMonthsAr, state.closedMonthsAp)) {
                        return { ok: false, error: `帳款 ${inv.invoice_number || inv.id} 所屬月 ${inv.period_month} 已關帳，不可沖銷` };
                    }
                }

                const result = applyPaymentTransaction(
                    {
                        invoices: state.invoices,
                        payments: state.payments,
                        allocations: state.allocations,
                    },
                    { ...paymentDraft, ledger },
                    lines,
                    () => makeId('pay'),
                    () => makeId('ipa')
                );

                if (!result.ok) {
                    return result;
                }

                set({
                    invoices: result.invoices,
                    payments: result.payments,
                    allocations: result.allocations,
                });
                return { ok: true, paymentId: result.payments[result.payments.length - 1]?.id };
            },

            getInvoiceBalanceMinor: (invoiceId) => {
                const { invoices, allocations } = get();
                const inv = invoices.find((i) => i.id === invoiceId);
                return inv ? invoiceBalanceMinor(inv, allocations) : 0;
            },

            getPaymentUnallocatedMinor: (paymentId) => {
                const { payments, allocations } = get();
                const pay = payments.find((p) => p.id === paymentId);
                return pay ? paymentUnallocatedMinor(pay, allocations) : 0;
            },

            sumAllocatedToInvoice: (invoiceId) => {
                const { allocations } = get();
                return getAllocatedToInvoice(invoiceId, allocations);
            },

            sumAllocatedFromPayment: (paymentId) => {
                const { allocations } = get();
                return getAllocatedFromPayment(paymentId, allocations);
            },
        }),
        {
            name: 'erp-settlement-store',
            storage: erpPersistStorage,
            merge: (persisted, current) => {
                const p = persisted && typeof persisted === 'object' ? { ...persisted } : {};
                if (!Array.isArray(p.closedMonthsAr)) p.closedMonthsAr = [];
                if (!Array.isArray(p.closedMonthsAp)) p.closedMonthsAp = [];
                if (Array.isArray(p.invoices)) {
                    p.invoices = p.invoices.map((inv) => {
                        const issued = inv.issued_at || '';
                        const fallbackMonth = issued.length >= 7 ? issued.slice(0, 7) : '';
                        return {
                            ...inv,
                            ledger: inv.ledger || 'ar',
                            period_month: inv.period_month || fallbackMonth,
                            source_doc_id: inv.source_doc_id ?? '',
                            source_doc_type: inv.source_doc_type ?? '',
                            party_id: inv.party_id ?? inv.customer_id ?? '',
                            party_name: inv.party_name ?? '',
                        };
                    });
                }
                if (Array.isArray(p.payments)) {
                    p.payments = p.payments.map((pay) => ({
                        ...pay,
                        ledger: pay.ledger || 'ar',
                    }));
                }
                return { ...current, ...p };
            },
        }
    )
);

/** 供表單：元轉分 */
export { toMinorFromTwd };
