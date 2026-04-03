import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useAppStore } from '../../store/useAppStore';
import { useSettlementStore } from '../../store/useSettlementStore';
import { toMinorFromTwd, toTwdFromMinor } from '../../domain/settlement/money';
import {
    getAllocatedToInvoice,
    invoiceBalanceMinor,
    paymentUnallocatedMinor,
    getAllocatedFromPayment,
} from '../../domain/settlement/engine';
import { sortedCustomersForSelect, sortedSuppliersForSelect } from '../../utils/sortContactsForSelect';
import styles from './SettlementPage.module.css';

function fmtTwdMinor(minor) {
    if (!Number.isFinite(minor)) return '—';
    const n = Math.round(toTwdFromMinor(minor));
    return `NT$ ${n.toLocaleString('zh-TW')}`;
}

/** 由付款底下沖銷連結之帳款彙總客戶／廠商名稱（多者併列） */
function partyNamesForPayment(paymentId, allocations, invoices) {
    const names = new Set();
    for (const a of allocations) {
        if (a.payment_id !== paymentId) continue;
        const inv = invoices.find((i) => i.id === a.invoice_id);
        const label = (inv?.party_name || inv?.party_id || '').trim();
        if (label) names.add(label);
    }
    if (names.size === 0) return '—';
    const arr = [...names].sort((x, y) => x.localeCompare(y, 'zh-TW'));
    if (arr.length <= 2) return arr.join('、');
    return `${arr.slice(0, 2).join('、')} 等 ${arr.length} 家`;
}

function statusBadgeClass(st) {
    if (st === 'open') return styles.badgeOpen;
    if (st === 'partial') return styles.badgePartial;
    if (st === 'paid') return styles.badgePaid;
    if (st === 'void') return styles.badgeVoid;
    return styles.badgeDraft;
}

/** 依列表順序、將一筆收款／付款金額流水沖入已勾選且仍有餘額之帳款 */
function buildWaterfallAllocLines(orderedInvoices, selectedIds, payAmountMinor, allocations) {
    const selected = new Set(selectedIds);
    let remaining = payAmountMinor;
    const lines = [];
    for (const inv of orderedInvoices) {
        if (!selected.has(inv.id)) continue;
        if (inv.status === 'void') continue;
        const bal = invoiceBalanceMinor(inv, allocations);
        if (bal <= 0) continue;
        const take = Math.min(bal, remaining);
        if (take <= 0) continue;
        lines.push({ invoice_id: inv.id, amount_minor: take });
        remaining -= take;
    }
    return { lines, leftoverMinor: remaining };
}

const SettlementPage = () => {
    const salesOrders = useDocumentStore((s) => s.salesOrders);
    const purchaseOrders = useDocumentStore((s) => s.purchaseOrders);
    const customers = useCustomerStore((s) => s.customers);
    const suppliers = useSupplierStore((s) => s.suppliers);
    const customersSorted = useMemo(() => sortedCustomersForSelect(customers), [customers]);
    const suppliersSorted = useMemo(() => sortedSuppliersForSelect(suppliers), [suppliers]);
    const { vatEnabled, vatRate, defaultCurrency } = useAppStore();

    const invoices = useSettlementStore((s) => s.invoices);
    const payments = useSettlementStore((s) => s.payments);
    const allocations = useSettlementStore((s) => s.allocations);
    const closedMonthsAr = useSettlementStore((s) => s.closedMonthsAr);
    const closedMonthsAp = useSettlementStore((s) => s.closedMonthsAp);
    const syncFromDocuments = useSettlementStore((s) => s.syncFromDocuments);
    const executePaymentTransaction = useSettlementStore((s) => s.executePaymentTransaction);
    const addInvoice = useSettlementStore((s) => s.addInvoice);
    const voidInvoice = useSettlementStore((s) => s.voidInvoice);
    const resetAll = useSettlementStore((s) => s.resetAll);
    const closeMonth = useSettlementStore((s) => s.closeMonth);
    const reopenMonth = useSettlementStore((s) => s.reopenMonth);
    const isPeriodClosed = useSettlementStore((s) => s.isPeriodClosed);

    const [ledger, setLedger] = useState('ar');
    const [closeMonthInput, setCloseMonthInput] = useState('');

    /** 應收：先選客戶，再於月度表選月份 → 下方沖銷 */
    const [arFocusCustomerId, setArFocusCustomerId] = useState('');
    const [arSelectedMonth, setArSelectedMonth] = useState('');
    /** 應付：先選廠商，再於月度表選月份 → 下方沖銷（流程同應收） */
    const [apFocusSupplierId, setApFocusSupplierId] = useState('');
    const [apSelectedMonth, setApSelectedMonth] = useState('');

    const [payAmount, setPayAmount] = useState('');
    const [payMethod, setPayMethod] = useState('匯款');
    const [payRef, setPayRef] = useState('');
    /** 應收：本月份明細中，勾選要沖銷的帳款 id（依表列順序流水沖銷） */
    const [arAllocSelectedIds, setArAllocSelectedIds] = useState([]);
    /** 應付：本月份明細勾選（同應收） */
    const [apAllocSelectedIds, setApAllocSelectedIds] = useState([]);
    const arAllocHeaderCbRef = useRef(null);
    const apAllocHeaderCbRef = useRef(null);
    const [msg, setMsg] = useState({ type: '', text: '' });

    const [showAddInv, setShowAddInv] = useState(false);
    const [newInvNo, setNewInvNo] = useState('');
    const [newInvAmt, setNewInvAmt] = useState('');
    const [newInvNote, setNewInvNote] = useState('');
    const [newInvPeriod, setNewInvPeriod] = useState(() => new Date().toISOString().slice(0, 7));
    const [newPartyId, setNewPartyId] = useState('');

    useEffect(() => {
        syncFromDocuments({
            salesOrders,
            purchaseOrders,
            vatEnabled,
            vatRate,
            defaultCurrency,
        });
    }, [salesOrders, purchaseOrders, vatEnabled, vatRate, defaultCurrency, syncFromDocuments]);

    useEffect(() => {
        setArSelectedMonth('');
    }, [arFocusCustomerId]);

    useEffect(() => {
        setApSelectedMonth('');
    }, [apFocusSupplierId]);

    const closedList = ledger === 'ap' ? closedMonthsAp : closedMonthsAr;

    const arInvoicesAll = useMemo(
        () => invoices.filter((i) => (i.ledger || 'ar') === 'ar'),
        [invoices]
    );
    const apInvoicesAll = useMemo(
        () => invoices.filter((i) => (i.ledger || 'ar') === 'ap'),
        [invoices]
    );

    const ledgerInvoices = useMemo(() => {
        return ledger === 'ar' ? arInvoicesAll : apInvoicesAll;
    }, [ledger, arInvoicesAll, apInvoicesAll]);

    const arCustomerChoices = useMemo(() => {
        const map = new Map();
        customers.forEach((c) => map.set(c.cust_id, c.name));
        salesOrders.forEach((d) => {
            if (d.customer_id) {
                map.set(d.customer_id, d.customer_name || map.get(d.customer_id) || d.customer_id);
            }
        });
        arInvoicesAll.forEach((i) => {
            if (i.party_id) map.set(i.party_id, i.party_name || map.get(i.party_id) || i.party_id);
        });
        return [...map.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-TW'));
    }, [customers, salesOrders, arInvoicesAll]);

    const apSupplierChoices = useMemo(() => {
        const map = new Map();
        suppliers.forEach((s) => map.set(s.sup_id, s.name));
        purchaseOrders.forEach((d) => {
            if (d.supplier_id) {
                map.set(d.supplier_id, d.supplier_name || map.get(d.supplier_id) || d.supplier_id);
            }
        });
        apInvoicesAll.forEach((i) => {
            if (i.party_id) map.set(i.party_id, i.party_name || map.get(i.party_id) || i.party_id);
        });
        return [...map.entries()]
            .map(([id, label]) => ({ id, label }))
            .sort((a, b) => a.label.localeCompare(b.label, 'zh-TW'));
    }, [suppliers, purchaseOrders, apInvoicesAll]);

    /** 應收：依客戶分月的應收／已收／餘額（不含作廢帳款） */
    const arMonthlyRows = useMemo(() => {
        if (!arFocusCustomerId) return [];
        const invs = arInvoicesAll.filter(
            (i) => (i.party_id || '') === arFocusCustomerId && i.status !== 'void'
        );
        const byMonth = new Map();
        for (const inv of invs) {
            const m = inv.period_month || '';
            if (!m) continue;
            if (!byMonth.has(m)) {
                byMonth.set(m, { month: m, invoices: [] });
            }
            byMonth.get(m).invoices.push(inv);
        }
        const rows = [...byMonth.values()].map(({ month, invoices: list }) => {
            let arMinor = 0;
            let collectedMinor = 0;
            let balanceMinor = 0;
            for (const inv of list) {
                arMinor += inv.amount_total_minor || 0;
                const coll = getAllocatedToInvoice(inv.id, allocations);
                collectedMinor += coll;
                balanceMinor += invoiceBalanceMinor(inv, allocations);
            }
            const closed = closedMonthsAr.includes(month);
            return {
                month,
                arMinor,
                collectedMinor,
                balanceMinor,
                closed,
            };
        });
        rows.sort((a, b) => b.month.localeCompare(a.month));
        return rows;
    }, [arFocusCustomerId, arInvoicesAll, allocations, closedMonthsAr]);

    /** 應收：目前選取月份之明細帳款 */
    const arDetailInvoices = useMemo(() => {
        if (!arFocusCustomerId || !arSelectedMonth) return [];
        return arInvoicesAll.filter(
            (i) =>
                (i.party_id || '') === arFocusCustomerId && (i.period_month || '') === arSelectedMonth
        );
    }, [arFocusCustomerId, arSelectedMonth, arInvoicesAll]);

    /** 應付：依廠商分月的應付／已付／餘額（不含作廢帳款） */
    const apMonthlyRows = useMemo(() => {
        if (!apFocusSupplierId) return [];
        const invs = apInvoicesAll.filter(
            (i) => (i.party_id || '') === apFocusSupplierId && i.status !== 'void'
        );
        const byMonth = new Map();
        for (const inv of invs) {
            const m = inv.period_month || '';
            if (!m) continue;
            if (!byMonth.has(m)) {
                byMonth.set(m, { month: m, invoices: [] });
            }
            byMonth.get(m).invoices.push(inv);
        }
        const rows = [...byMonth.values()].map(({ month, invoices: list }) => {
            let apMinor = 0;
            let paidMinor = 0;
            let balanceMinor = 0;
            for (const inv of list) {
                apMinor += inv.amount_total_minor || 0;
                const coll = getAllocatedToInvoice(inv.id, allocations);
                paidMinor += coll;
                balanceMinor += invoiceBalanceMinor(inv, allocations);
            }
            const closed = closedMonthsAp.includes(month);
            return {
                month,
                apMinor,
                paidMinor,
                balanceMinor,
                closed,
            };
        });
        rows.sort((a, b) => b.month.localeCompare(a.month));
        return rows;
    }, [apFocusSupplierId, apInvoicesAll, allocations, closedMonthsAp]);

    /** 應付：目前選取月份之明細帳款（含已沖完者，同應收明細表） */
    const apDetailInvoices = useMemo(() => {
        if (!apFocusSupplierId || !apSelectedMonth) return [];
        return apInvoicesAll.filter(
            (i) =>
                (i.party_id || '') === apFocusSupplierId && (i.period_month || '') === apSelectedMonth
        );
    }, [apFocusSupplierId, apSelectedMonth, apInvoicesAll]);

    const ledgerPayments = useMemo(
        () => payments.filter((p) => (p.ledger || 'ar') === ledger),
        [payments, ledger]
    );

    const allocationList = useMemo(() => {
        const invIds = new Set(ledgerInvoices.map((i) => i.id));
        return allocations
            .filter((a) => invIds.has(a.invoice_id))
            .slice()
            .reverse()
            .map((a) => {
                const inv = invoices.find((i) => i.id === a.invoice_id);
                const pay = payments.find((p) => p.id === a.payment_id);
                const partyName = (inv?.party_name || inv?.party_id || '').trim() || '—';
                return {
                    ...a,
                    invLabel: inv?.invoice_number || a.invoice_id,
                    payShort: pay?.id?.slice(-8) || a.payment_id,
                    partyName,
                };
            });
    }, [allocations, invoices, payments, ledgerInvoices]);

    const arAllocEligibleIds = useMemo(() => {
        return arDetailInvoices
            .filter((inv) => {
                if (inv.status === 'void') return false;
                const m = inv.period_month || '';
                if (m && closedMonthsAr.includes(m)) return false;
                return invoiceBalanceMinor(inv, allocations) > 0;
            })
            .map((inv) => inv.id);
    }, [arDetailInvoices, allocations, closedMonthsAr]);

    useEffect(() => {
        if (!arFocusCustomerId || !arSelectedMonth) {
            setArAllocSelectedIds([]);
            return;
        }
        setArAllocSelectedIds([...arAllocEligibleIds]);
    }, [arFocusCustomerId, arSelectedMonth, arAllocEligibleIds]);

    const apAllocEligibleIds = useMemo(() => {
        return apDetailInvoices
            .filter((inv) => {
                if (inv.status === 'void') return false;
                const m = inv.period_month || '';
                if (m && closedMonthsAp.includes(m)) return false;
                return invoiceBalanceMinor(inv, allocations) > 0;
            })
            .map((inv) => inv.id);
    }, [apDetailInvoices, allocations, closedMonthsAp]);

    useEffect(() => {
        if (!apFocusSupplierId || !apSelectedMonth) {
            setApAllocSelectedIds([]);
            return;
        }
        setApAllocSelectedIds([...apAllocEligibleIds]);
    }, [apFocusSupplierId, apSelectedMonth, apAllocEligibleIds]);

    const arHeaderAllSelected =
        arAllocEligibleIds.length > 0 && arAllocEligibleIds.every((id) => arAllocSelectedIds.includes(id));
    const arHeaderSomeSelected =
        arAllocSelectedIds.some((id) => arAllocEligibleIds.includes(id)) && !arHeaderAllSelected;

    useEffect(() => {
        const el = arAllocHeaderCbRef.current;
        if (el) el.indeterminate = arHeaderSomeSelected;
    }, [arHeaderSomeSelected]);

    const apHeaderAllSelected =
        apAllocEligibleIds.length > 0 && apAllocEligibleIds.every((id) => apAllocSelectedIds.includes(id));
    const apHeaderSomeSelected =
        apAllocSelectedIds.some((id) => apAllocEligibleIds.includes(id)) && !apHeaderAllSelected;

    useEffect(() => {
        const el = apAllocHeaderCbRef.current;
        if (el) el.indeterminate = apHeaderSomeSelected;
    }, [apHeaderSomeSelected]);

    const submitPayment = (e) => {
        e.preventDefault();
        setMsg({ type: '', text: '' });

        if (ledger === 'ar') {
            if (!arFocusCustomerId) {
                setMsg({ type: 'err', text: '請先於上方選擇客戶' });
                return;
            }
            if (!arSelectedMonth || !/^\d{4}-\d{2}$/.test(arSelectedMonth)) {
                setMsg({ type: 'err', text: '請先於月度表點選一個月份' });
                return;
            }
            if (isPeriodClosed('ar', arSelectedMonth)) {
                setMsg({ type: 'err', text: '該月應收已關帳，不可沖銷' });
                return;
            }
        } else {
            if (!apFocusSupplierId) {
                setMsg({ type: 'err', text: '請先於上方選擇廠商' });
                return;
            }
            if (!apSelectedMonth || !/^\d{4}-\d{2}$/.test(apSelectedMonth)) {
                setMsg({ type: 'err', text: '請先於月度表點選一個月份' });
                return;
            }
            if (isPeriodClosed('ap', apSelectedMonth)) {
                setMsg({ type: 'err', text: '該月應付已關帳，不可沖銷' });
                return;
            }
        }

        const totalMinor = toMinorFromTwd(payAmount);
        if (totalMinor <= 0) {
            setMsg({ type: 'err', text: ledger === 'ar' ? '請輸入有效收款金額（元）' : '請輸入有效付款金額（元）' });
            return;
        }

        const orderedInvoices = ledger === 'ar' ? arDetailInvoices : apDetailInvoices;
        const selectedIds = ledger === 'ar' ? arAllocSelectedIds : apAllocSelectedIds;
        const { lines } = buildWaterfallAllocLines(orderedInvoices, selectedIds, totalMinor, allocations);

        if (lines.length === 0) {
            setMsg({
                type: 'err',
                text:
                    ledger === 'ar'
                        ? '請勾選至少一筆仍有餘額之帳款；若已勾選，請確認收款金額大於 0 且未超過可沖銷餘額合計'
                        : '請勾選至少一筆仍有餘額之帳款；若已勾選，請確認付款金額大於 0',
            });
            return;
        }

        const r = executePaymentTransaction(
            {
                ledger,
                amount_total_minor: totalMinor,
                method: payMethod,
                ref: payRef,
            },
            lines
        );

        if (!r.ok) {
            setMsg({ type: 'err', text: r.error || '交易失敗' });
            return;
        }

        setMsg({ type: 'ok', text: ledger === 'ar' ? '收款與沖銷已入帳' : '付款與沖銷已入帳' });
        setPayAmount('');
        setPayRef('');
    };

    const handleAddInvoice = (e) => {
        e.preventDefault();
        const amt = toMinorFromTwd(newInvAmt);
        if (!newInvNo.trim()) {
            setMsg({ type: 'err', text: '請輸入帳款編號' });
            return;
        }
        if (!newInvPeriod || !/^\d{4}-\d{2}$/.test(newInvPeriod)) {
            setMsg({ type: 'err', text: '請選擇認列月份（YYYY-MM）' });
            return;
        }
        if (isPeriodClosed(ledger, newInvPeriod)) {
            setMsg({ type: 'err', text: '該月份已月結，不可新增' });
            return;
        }
        if (amt <= 0) {
            setMsg({ type: 'err', text: ledger === 'ar' ? '請輸入正確應收金額' : '請輸入正確應付金額' });
            return;
        }
        if (ledger === 'ar' && !newPartyId) {
            setMsg({ type: 'err', text: '請選擇客戶' });
            return;
        }
        if (ledger === 'ap' && !newPartyId) {
            setMsg({ type: 'err', text: '請選擇廠商' });
            return;
        }
        const partyName =
            ledger === 'ar'
                ? customersSorted.find((c) => c.cust_id === newPartyId)?.name || ''
                : suppliersSorted.find((s) => s.sup_id === newPartyId)?.name || '';
        const r = addInvoice({
            ledger,
            invoice_number: newInvNo.trim(),
            amount_total_minor: amt,
            status: 'open',
            note: newInvNote.trim(),
            period_month: newInvPeriod,
            issued_at: `${newInvPeriod}-01T12:00:00.000Z`,
            party_id: newPartyId,
            party_name: partyName,
        });
        if (!r.ok) {
            setMsg({ type: 'err', text: r.error });
            return;
        }
        setShowAddInv(false);
        setNewInvNo('');
        setNewInvAmt('');
        setNewInvNote('');
        setNewPartyId('');
        setMsg({ type: 'ok', text: ledger === 'ar' ? '已新增應收帳款' : '已新增應付帳款' });
    };

    const tryCloseMonth = () => {
        setMsg({ type: '', text: '' });
        const m = closeMonthInput;
        if (!m || !/^\d{4}-\d{2}$/.test(m)) {
            setMsg({ type: 'err', text: '請選擇要月結之 YYYY-MM' });
            return;
        }
        const r = closeMonth(ledger, m);
        if (!r.ok) setMsg({ type: 'err', text: r.error });
        else setMsg({ type: 'ok', text: `已月結關帳：${m}` });
    };

    const tryReopenMonth = (m) => {
        setMsg({ type: '', text: '' });
        reopenMonth(ledger, m);
        setMsg({ type: 'ok', text: `已重新開放月份：${m}` });
    };

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        <Wallet size={28} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                        結帳與沖銷（月結）
                    </h1>
                    <p className={styles.sub}>
                        <strong>應收</strong>：先選客戶，檢視每月應收／已收／餘額，點選月份後於下方明細錄收款並沖銷。
                        <strong>應付</strong>：先選廠商，檢視每月應付／已付／餘額，點選月份後於下方明細錄付款並沖銷（操作與應收相同）。金額為
                        TWD；關帳月不可沖銷。
                    </p>
                </div>
                <div className={styles.toolbar}>
                    <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                            syncFromDocuments({
                                salesOrders,
                                purchaseOrders,
                                vatEnabled,
                                vatRate,
                                defaultCurrency,
                            });
                            setMsg({ type: 'ok', text: '已自單據同步帳款' });
                        }}
                    >
                        自單據同步
                    </button>
                    <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                            setNewPartyId('');
                            setShowAddInv(true);
                        }}
                    >
                        {ledger === 'ar' ? '手動新增應收' : '手動新增應付'}
                    </button>
                    <button
                        type="button"
                        className={styles.btn}
                        onClick={() => {
                            if (window.confirm('清除所有帳款、沖銷與月結紀錄？')) resetAll();
                        }}
                    >
                        清空帳款資料
                    </button>
                </div>
            </div>

            <div className={styles.tabs}>
                <button
                    type="button"
                    className={`${styles.tab} ${ledger === 'ar' ? styles.tabActive : ''}`}
                    onClick={() => {
                        setLedger('ar');
                        setMsg({ type: '', text: '' });
                        setArFocusCustomerId('');
                        setArSelectedMonth('');
                        setApFocusSupplierId('');
                        setApSelectedMonth('');
                        setArAllocSelectedIds([]);
                        setApAllocSelectedIds([]);
                    }}
                >
                    應收帳（AR）
                </button>
                <button
                    type="button"
                    className={`${styles.tab} ${ledger === 'ap' ? styles.tabActive : ''}`}
                    onClick={() => {
                        setLedger('ap');
                        setMsg({ type: '', text: '' });
                        setArFocusCustomerId('');
                        setArSelectedMonth('');
                        setApFocusSupplierId('');
                        setApSelectedMonth('');
                        setArAllocSelectedIds([]);
                        setApAllocSelectedIds([]);
                    }}
                >
                    應付帳（AP）
                </button>
            </div>

            {msg.text ? (
                <p className={`${styles.msg} ${msg.type === 'err' ? styles.msgErr : styles.msgOk}`}>{msg.text}</p>
            ) : null}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>篩選與月結</h2>
                <div className={styles.card} style={{ padding: '1rem' }}>
                    <div className={styles.formGrid}>
                        <div className={styles.field}>
                            <label>月結關帳月份</label>
                            <input
                                type="month"
                                value={closeMonthInput}
                                onChange={(e) => setCloseMonthInput(e.target.value)}
                                lang="zh-TW"
                            />
                        </div>
                    </div>
                    <p className={styles.sub} style={{ marginTop: '0.5rem' }}>
                        {ledger === 'ar'
                            ? '應收之客戶／月份請使用下方「月度帳款」；此處僅處理月結關帳。'
                            : '應付之廠商／月份請使用下方「月度帳款」；此處僅處理月結關帳。'}
                    </p>
                    <p className={styles.sub} style={{ marginBottom: '0.5rem' }}>
                        關帳前該月所有{ledger === 'ar' ? '應收' : '應付'}須已沖銷完畢。已關帳月份不會再從單據同步變更。
                    </p>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={tryCloseMonth}>
                        執行月結關帳
                    </button>
                    {closedList.length ? (
                        <div style={{ marginTop: '0.75rem' }}>
                            <span className={styles.sub}>已關帳：</span>
                            {closedList.map((m) => (
                                <span key={m} className={styles.chip}>
                                    {m}
                                    <button
                                        type="button"
                                        className={styles.chipBtn}
                                        title="重新開放"
                                        onClick={() => tryReopenMonth(m)}
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>

            {ledger === 'ar' ? (
                <>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>應收 · 客戶月度帳款</h2>
                        <p className={styles.sub} style={{ marginBottom: '0.65rem' }}>
                            先選客戶，列表為<strong>每月</strong>應收合計、已收款合計、當月餘額。點選一列月份後，於下方進行錄收款與沖銷。
                        </p>
                        <div className={styles.card} style={{ padding: '1rem' }}>
                            <div className={styles.field} style={{ maxWidth: '420px' }}>
                                <label>客戶</label>
                                <select
                                    value={arFocusCustomerId}
                                    onChange={(e) => setArFocusCustomerId(e.target.value)}
                                >
                                    <option value="">請選擇客戶…</option>
                                    {arCustomerChoices.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.label}（{o.id}）
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.tableWrap} style={{ marginTop: '0.85rem' }}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>認列月份</th>
                                            <th className={styles.num}>應收帳金額</th>
                                            <th className={styles.num}>已收金額</th>
                                            <th className={styles.num}>當月餘額</th>
                                            <th>關帳</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!arFocusCustomerId ? (
                                            <tr>
                                                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                                                    請先選擇客戶
                                                </td>
                                            </tr>
                                        ) : arMonthlyRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                                                    此客戶尚無應收帳款（請自單據同步或手動新增）
                                                </td>
                                            </tr>
                                        ) : (
                                            arMonthlyRows.map((row) => (
                                                <tr
                                                    key={row.month}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`${styles.rowSelectable} ${arSelectedMonth === row.month ? styles.rowSelected : ''}`}
                                                    onClick={() => setArSelectedMonth(row.month)}
                                                    onKeyDown={(ev) => {
                                                        if (ev.key === 'Enter' || ev.key === ' ') {
                                                            ev.preventDefault();
                                                            setArSelectedMonth(row.month);
                                                        }
                                                    }}
                                                >
                                                    <td className={styles.mono}>{row.month}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.arMinor)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.collectedMinor)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.balanceMinor)}</td>
                                                    <td>{row.closed ? '是' : '否'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            {arFocusCustomerId && arSelectedMonth
                                ? `${arSelectedMonth} 帳款明細與收款沖銷`
                                : '帳款明細與收款沖銷'}
                        </h2>
                        {!arFocusCustomerId || !arSelectedMonth ? (
                            <div className={styles.card} style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>
                                請於上方選擇客戶，並點選一個認列月份。
                            </div>
                        ) : (
                            <>
                                <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                                    <div className={styles.tableWrap}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th
                                                        className={styles.thCheckbox}
                                                        title="勾選本月份要沖銷的帳款（依表列順序分配收款金額）"
                                                    >
                                                        <input
                                                            ref={arAllocHeaderCbRef}
                                                            type="checkbox"
                                                            checked={arHeaderAllSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setArAllocSelectedIds([...arAllocEligibleIds]);
                                                                } else {
                                                                    setArAllocSelectedIds([]);
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                    <th>帳款編號</th>
                                                    <th>銷貨單（製單）</th>
                                                    <th>月份</th>
                                                    <th>狀態</th>
                                                    <th className={styles.num}>應收</th>
                                                    <th className={styles.num}>已沖</th>
                                                    <th className={styles.num}>餘額</th>
                                                    <th>關帳</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {arDetailInvoices.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={10} style={{ color: 'var(--text-muted)' }}>
                                                            此月份無帳款明細
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    arDetailInvoices.map((inv) => {
                                                        const paid = getAllocatedToInvoice(inv.id, allocations);
                                                        const bal = invoiceBalanceMinor(inv, allocations);
                                                        const closed = isPeriodClosed(
                                                            inv.ledger || 'ar',
                                                            inv.period_month || ''
                                                        );
                                                        const canCheck =
                                                            inv.status !== 'void' &&
                                                            !closed &&
                                                            bal > 0;
                                                        const isChecked = arAllocSelectedIds.includes(inv.id);
                                                        return (
                                                            <tr key={inv.id}>
                                                                <td className={styles.tdCheckbox}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={canCheck && isChecked}
                                                                        disabled={!canCheck}
                                                                        onChange={(e) => {
                                                                            if (!canCheck) return;
                                                                            const on = e.target.checked;
                                                                            setArAllocSelectedIds((prev) => {
                                                                                if (on) {
                                                                                    return prev.includes(inv.id)
                                                                                        ? prev
                                                                                        : [...prev, inv.id];
                                                                                }
                                                                                return prev.filter((id) => id !== inv.id);
                                                                            });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className={styles.mono}>
                                                                    {inv.invoice_number || inv.id}
                                                                </td>
                                                                <td>
                                                                    {inv.source_doc_id ? (
                                                                        <Link
                                                                            className={styles.docLink}
                                                                            title="開啟製單系統對應單據"
                                                                            to={`/document-editor?type=${inv.source_doc_type || 'sales'}&id=${encodeURIComponent(inv.source_doc_id)}`}
                                                                        >
                                                                            {inv.source_doc_id}
                                                                        </Link>
                                                                    ) : (
                                                                        <span title="手動帳款">—</span>
                                                                    )}
                                                                </td>
                                                                <td className={styles.mono}>
                                                                    {inv.period_month || '—'}
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`${styles.badge} ${statusBadgeClass(inv.status)}`}
                                                                    >
                                                                        {inv.status}
                                                                    </span>
                                                                </td>
                                                                <td className={styles.num}>
                                                                    {fmtTwdMinor(inv.amount_total_minor)}
                                                                </td>
                                                                <td className={styles.num}>{fmtTwdMinor(paid)}</td>
                                                                <td className={styles.num}>{fmtTwdMinor(bal)}</td>
                                                                <td>{closed ? '是' : '否'}</td>
                                                                <td>
                                                                    {inv.status !== 'void' &&
                                                                    paid === 0 &&
                                                                    !closed ? (
                                                                        <button
                                                                            type="button"
                                                                            className={styles.btn}
                                                                            onClick={() => {
                                                                                if (window.confirm('確定作廢？')) {
                                                                                    const v = voidInvoice(inv.id);
                                                                                    if (!v.ok) {
                                                                                        setMsg({
                                                                                            type: 'err',
                                                                                            text: v.error,
                                                                                        });
                                                                                    }
                                                                                }
                                                                            }}
                                                                        >
                                                                            作廢
                                                                        </button>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                        <h3
                                            style={{
                                                margin: '0 0 0.75rem',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            登錄收款並沖銷
                                        </h3>
                                        <form onSubmit={submitPayment}>
                                            <div className={styles.formGrid}>
                                                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                                                    <label>沖銷範圍（與上方選取一致）</label>
                                                    <div
                                                        style={{
                                                            padding: '0.5rem 0.65rem',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--border-color)',
                                                            background: 'var(--bg-tertiary)',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {arCustomerChoices.find((o) => o.id === arFocusCustomerId)
                                                            ?.label || '—'}{' '}
                                                        · {arSelectedMonth || '—'}
                                                    </div>
                                                </div>
                                                <div className={styles.field}>
                                                    <label>收款金額（元）</label>
                                                    <input
                                                        value={payAmount}
                                                        onChange={(e) => setPayAmount(e.target.value)}
                                                        inputMode="decimal"
                                                        placeholder="例如 1500"
                                                    />
                                                </div>
                                                <div className={styles.field}>
                                                    <label>方式</label>
                                                    <input
                                                        value={payMethod}
                                                        onChange={(e) => setPayMethod(e.target.value)}
                                                        placeholder="匯款／現金…"
                                                    />
                                                </div>
                                                <div className={styles.field}>
                                                    <label>參考號碼</label>
                                                    <input
                                                        value={payRef}
                                                        onChange={(e) => setPayRef(e.target.value)}
                                                        placeholder="流水號…"
                                                    />
                                                </div>
                                            </div>
                                            <p className={styles.sub} style={{ marginBottom: '0.5rem' }}>
                                                請於上方明細勾選要沖銷的帳款；僅需輸入一筆<strong>收款金額</strong>
                                                ，系統會依表列順序依次沖銷（先沖滿上一筆餘額再沖下一筆）。未勾選者不沖銷；收款金額大於已勾選帳款餘額合計時，餘額列為未分配收款。
                                                {arAllocEligibleIds.length === 0 &&
                                                arFocusCustomerId &&
                                                arSelectedMonth ? (
                                                    <strong> 目前無可沖銷帳款。</strong>
                                                ) : null}
                                            </p>
                                            <div style={{ marginTop: '0.85rem' }}>
                                                <button
                                                    type="submit"
                                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                                >
                                                    執行沖銷交易
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                </>
            ) : (
                <>
                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>應付 · 廠商月度帳款</h2>
                        <p className={styles.sub} style={{ marginBottom: '0.65rem' }}>
                            先選廠商，列表為<strong>每月</strong>應付合計、已付款合計、當月餘額。點選一列月份後，於下方進行錄付款與沖銷。
                        </p>
                        <div className={styles.card} style={{ padding: '1rem' }}>
                            <div className={styles.field} style={{ maxWidth: '420px' }}>
                                <label>廠商</label>
                                <select
                                    value={apFocusSupplierId}
                                    onChange={(e) => setApFocusSupplierId(e.target.value)}
                                >
                                    <option value="">請選擇廠商…</option>
                                    {apSupplierChoices.map((o) => (
                                        <option key={o.id} value={o.id}>
                                            {o.label}（{o.id}）
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.tableWrap} style={{ marginTop: '0.85rem' }}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>認列月份</th>
                                            <th className={styles.num}>應付帳金額</th>
                                            <th className={styles.num}>已付金額</th>
                                            <th className={styles.num}>當月餘額</th>
                                            <th>關帳</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!apFocusSupplierId ? (
                                            <tr>
                                                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                                                    請先選擇廠商
                                                </td>
                                            </tr>
                                        ) : apMonthlyRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ color: 'var(--text-muted)' }}>
                                                    此廠商尚無應付帳款（請自單據同步或手動新增）
                                                </td>
                                            </tr>
                                        ) : (
                                            apMonthlyRows.map((row) => (
                                                <tr
                                                    key={row.month}
                                                    role="button"
                                                    tabIndex={0}
                                                    className={`${styles.rowSelectable} ${apSelectedMonth === row.month ? styles.rowSelected : ''}`}
                                                    onClick={() => setApSelectedMonth(row.month)}
                                                    onKeyDown={(ev) => {
                                                        if (ev.key === 'Enter' || ev.key === ' ') {
                                                            ev.preventDefault();
                                                            setApSelectedMonth(row.month);
                                                        }
                                                    }}
                                                >
                                                    <td className={styles.mono}>{row.month}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.apMinor)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.paidMinor)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(row.balanceMinor)}</td>
                                                    <td>{row.closed ? '是' : '否'}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </section>

                    <section className={styles.section}>
                        <h2 className={styles.sectionTitle}>
                            {apFocusSupplierId && apSelectedMonth
                                ? `${apSelectedMonth} 帳款明細與付款沖銷`
                                : '帳款明細與付款沖銷'}
                        </h2>
                        {!apFocusSupplierId || !apSelectedMonth ? (
                            <div className={styles.card} style={{ padding: '1.25rem', color: 'var(--text-muted)' }}>
                                請於上方選擇廠商，並點選一個認列月份。
                            </div>
                        ) : (
                            <>
                                <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
                                    <div className={styles.tableWrap}>
                                        <table className={styles.table}>
                                            <thead>
                                                <tr>
                                                    <th
                                                        className={styles.thCheckbox}
                                                        title="勾選本月份要沖銷的帳款（依表列順序分配付款金額）"
                                                    >
                                                        <input
                                                            ref={apAllocHeaderCbRef}
                                                            type="checkbox"
                                                            checked={apHeaderAllSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setApAllocSelectedIds([...apAllocEligibleIds]);
                                                                } else {
                                                                    setApAllocSelectedIds([]);
                                                                }
                                                            }}
                                                        />
                                                    </th>
                                                    <th>帳款編號</th>
                                                    <th>進貨單（製單）</th>
                                                    <th>月份</th>
                                                    <th>狀態</th>
                                                    <th className={styles.num}>應付</th>
                                                    <th className={styles.num}>已沖</th>
                                                    <th className={styles.num}>餘額</th>
                                                    <th>關帳</th>
                                                    <th />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {apDetailInvoices.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={10} style={{ color: 'var(--text-muted)' }}>
                                                            此月份無帳款明細
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    apDetailInvoices.map((inv) => {
                                                        const paid = getAllocatedToInvoice(inv.id, allocations);
                                                        const bal = invoiceBalanceMinor(inv, allocations);
                                                        const closed = isPeriodClosed(
                                                            inv.ledger || 'ap',
                                                            inv.period_month || ''
                                                        );
                                                        const canCheck =
                                                            inv.status !== 'void' && !closed && bal > 0;
                                                        const isChecked = apAllocSelectedIds.includes(inv.id);
                                                        return (
                                                            <tr key={inv.id}>
                                                                <td className={styles.tdCheckbox}>
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={canCheck && isChecked}
                                                                        disabled={!canCheck}
                                                                        onChange={(e) => {
                                                                            if (!canCheck) return;
                                                                            const on = e.target.checked;
                                                                            setApAllocSelectedIds((prev) => {
                                                                                if (on) {
                                                                                    return prev.includes(inv.id)
                                                                                        ? prev
                                                                                        : [...prev, inv.id];
                                                                                }
                                                                                return prev.filter(
                                                                                    (id) => id !== inv.id
                                                                                );
                                                                            });
                                                                        }}
                                                                    />
                                                                </td>
                                                                <td className={styles.mono}>
                                                                    {inv.invoice_number || inv.id}
                                                                </td>
                                                                <td>
                                                                    {inv.source_doc_id ? (
                                                                        <Link
                                                                            className={styles.docLink}
                                                                            title="開啟製單系統對應單據"
                                                                            to={`/document-editor?type=${inv.source_doc_type || 'purchase'}&id=${encodeURIComponent(inv.source_doc_id)}`}
                                                                        >
                                                                            {inv.source_doc_id}
                                                                        </Link>
                                                                    ) : (
                                                                        <span title="手動帳款">—</span>
                                                                    )}
                                                                </td>
                                                                <td className={styles.mono}>
                                                                    {inv.period_month || '—'}
                                                                </td>
                                                                <td>
                                                                    <span
                                                                        className={`${styles.badge} ${statusBadgeClass(inv.status)}`}
                                                                    >
                                                                        {inv.status}
                                                                    </span>
                                                                </td>
                                                                <td className={styles.num}>
                                                                    {fmtTwdMinor(inv.amount_total_minor)}
                                                                </td>
                                                                <td className={styles.num}>{fmtTwdMinor(paid)}</td>
                                                                <td className={styles.num}>{fmtTwdMinor(bal)}</td>
                                                                <td>{closed ? '是' : '否'}</td>
                                                                <td>
                                                                    {inv.status !== 'void' &&
                                                                    paid === 0 &&
                                                                    !closed ? (
                                                                        <button
                                                                            type="button"
                                                                            className={styles.btn}
                                                                            onClick={() => {
                                                                                if (window.confirm('確定作廢？')) {
                                                                                    const v = voidInvoice(inv.id);
                                                                                    if (!v.ok) {
                                                                                        setMsg({
                                                                                            type: 'err',
                                                                                            text: v.error,
                                                                                        });
                                                                                    }
                                                                                }
                                                                            }}
                                                                        >
                                                                            作廢
                                                                        </button>
                                                                    ) : null}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
                                        <h3
                                            style={{
                                                margin: '0 0 0.75rem',
                                                fontSize: '1rem',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                            }}
                                        >
                                            登錄付款並沖銷
                                        </h3>
                                        <form onSubmit={submitPayment}>
                                            <div className={styles.formGrid}>
                                                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                                                    <label>沖銷範圍（與上方選取一致）</label>
                                                    <div
                                                        style={{
                                                            padding: '0.5rem 0.65rem',
                                                            borderRadius: '8px',
                                                            border: '1px solid var(--border-color)',
                                                            background: 'var(--bg-tertiary)',
                                                            fontSize: '0.9rem',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {apSupplierChoices.find((o) => o.id === apFocusSupplierId)
                                                            ?.label || '—'}{' '}
                                                        · {apSelectedMonth || '—'}
                                                    </div>
                                                </div>
                                                <div className={styles.field}>
                                                    <label>付款金額（元）</label>
                                                    <input
                                                        value={payAmount}
                                                        onChange={(e) => setPayAmount(e.target.value)}
                                                        inputMode="decimal"
                                                        placeholder="例如 1500"
                                                    />
                                                </div>
                                                <div className={styles.field}>
                                                    <label>方式</label>
                                                    <input
                                                        value={payMethod}
                                                        onChange={(e) => setPayMethod(e.target.value)}
                                                        placeholder="匯款／現金…"
                                                    />
                                                </div>
                                                <div className={styles.field}>
                                                    <label>參考號碼</label>
                                                    <input
                                                        value={payRef}
                                                        onChange={(e) => setPayRef(e.target.value)}
                                                        placeholder="流水號…"
                                                    />
                                                </div>
                                            </div>
                                            <p className={styles.sub} style={{ marginBottom: '0.5rem' }}>
                                                請於上方明細勾選要沖銷的帳款；僅需輸入一筆<strong>付款金額</strong>
                                                ，系統會依表列順序依次沖銷（先沖滿上一筆餘額再沖下一筆）。未勾選者不沖銷；付款金額大於已勾選帳款餘額合計時，餘額列為未分配付款。
                                                {apAllocEligibleIds.length === 0 &&
                                                apFocusSupplierId &&
                                                apSelectedMonth ? (
                                                    <strong> 目前無可沖銷帳款。</strong>
                                                ) : null}
                                            </p>
                                            <div style={{ marginTop: '0.85rem' }}>
                                                <button
                                                    type="submit"
                                                    className={`${styles.btn} ${styles.btnPrimary}`}
                                                >
                                                    執行沖銷交易
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </>
                        )}
                    </section>
                </>
            )}

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>{ledger === 'ar' ? '收款紀錄' : '付款紀錄'}</h2>
                <div className={styles.card}>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>{ledger === 'ar' ? '客戶名稱' : '廠商名稱'}</th>
                                    <th className={styles.num}>金額</th>
                                    <th className={styles.num}>已沖</th>
                                    <th className={styles.num}>未分配</th>
                                    <th>方式</th>
                                    <th>參考</th>
                                    <th>時間</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerPayments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} style={{ color: 'var(--text-muted)' }}>
                                            尚無紀錄
                                        </td>
                                    </tr>
                                ) : (
                                    ledgerPayments
                                        .slice()
                                        .reverse()
                                        .map((p) => {
                                            const alloc = getAllocatedFromPayment(p.id, allocations);
                                            const un = paymentUnallocatedMinor(p, allocations);
                                            const partyLabel = partyNamesForPayment(p.id, allocations, invoices);
                                            return (
                                                <tr key={p.id}>
                                                    <td className={styles.mono}>{p.id}</td>
                                                    <td>{partyLabel}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(p.amount_total_minor)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(alloc)}</td>
                                                    <td className={styles.num}>{fmtTwdMinor(un)}</td>
                                                    <td>{p.method || '—'}</td>
                                                    <td>{p.ref || '—'}</td>
                                                    <td className={styles.mono}>{p.paid_at?.slice(0, 19) || '—'}</td>
                                                </tr>
                                            );
                                        })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            <section className={styles.section}>
                <h2 className={styles.sectionTitle}>沖銷明細</h2>
                <div className={styles.card}>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>{ledger === 'ar' ? '客戶名稱' : '廠商名稱'}</th>
                                    <th>帳款</th>
                                    <th>{ledger === 'ar' ? '收款' : '付款'}</th>
                                    <th className={styles.num}>沖銷金額</th>
                                    <th>時間</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allocationList.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ color: 'var(--text-muted)' }}>
                                            尚無沖銷
                                        </td>
                                    </tr>
                                ) : (
                                    allocationList.map((a) => (
                                        <tr key={a.id}>
                                            <td className={styles.mono}>{a.id?.slice(-12)}</td>
                                            <td>{a.partyName}</td>
                                            <td>{a.invLabel}</td>
                                            <td className={styles.mono}>{a.payShort}</td>
                                            <td className={styles.num}>{fmtTwdMinor(a.amount_minor)}</td>
                                            <td className={styles.mono}>{a.created_at?.slice(0, 19)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {showAddInv ? (
                <div
                    className={styles.modalBackdrop}
                    role="dialog"
                    aria-modal="true"
                    onMouseDown={(ev) => {
                        if (ev.target === ev.currentTarget) setShowAddInv(false);
                    }}
                >
                    <form className={styles.modal} onSubmit={handleAddInvoice}>
                        <h3>{ledger === 'ar' ? '手動新增應收' : '手動新增應付'}（無單據連結）</h3>
                        <div className={styles.field}>
                            <label>{ledger === 'ar' ? '客戶' : '廠商'}</label>
                            <select
                                value={newPartyId}
                                onChange={(e) => setNewPartyId(e.target.value)}
                                autoFocus
                            >
                                <option value="">請選擇…</option>
                                {ledger === 'ar'
                                    ? customersSorted.map((c) => (
                                          <option key={c.cust_id} value={c.cust_id}>
                                              {c.name}（{c.cust_id}）
                                          </option>
                                      ))
                                    : suppliersSorted.map((s) => (
                                          <option key={s.sup_id} value={s.sup_id}>
                                              {s.name}（{s.sup_id}）
                                          </option>
                                      ))}
                            </select>
                        </div>
                        <div className={styles.field}>
                            <label>帳款編號</label>
                            <input value={newInvNo} onChange={(e) => setNewInvNo(e.target.value)} />
                        </div>
                        <div className={styles.field}>
                            <label>認列月份</label>
                            <input
                                type="month"
                                value={newInvPeriod}
                                onChange={(e) => setNewInvPeriod(e.target.value)}
                                lang="zh-TW"
                            />
                        </div>
                        <div className={styles.field}>
                            <label>{ledger === 'ar' ? '應收金額（元）' : '應付金額（元）'}</label>
                            <input value={newInvAmt} onChange={(e) => setNewInvAmt(e.target.value)} inputMode="decimal" />
                        </div>
                        <div className={styles.field}>
                            <label>備註</label>
                            <input value={newInvNote} onChange={(e) => setNewInvNote(e.target.value)} />
                        </div>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.btn} onClick={() => setShowAddInv(false)}>
                                取消
                            </button>
                            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                                建立
                            </button>
                        </div>
                    </form>
                </div>
            ) : null}
        </div>
    );
};

export default SettlementPage;
