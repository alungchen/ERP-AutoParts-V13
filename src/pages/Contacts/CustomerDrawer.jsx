import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, MapPin } from 'lucide-react';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import drawerStyles from '../PIM/ProductDrawer.module.css';

const CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'CNY', 'GBP'];
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'T/T 30 days', 'T/T 45 days', 'Net 60', 'COD'];
const COUNTRIES = ['Taiwan', 'Japan', 'Germany', 'USA', 'South Korea', 'China', 'Thailand', 'Vietnam'];
const TIERS = ['A', 'B', 'C'];
import CountryFlag from '../../components/CountryFlag';

const CustomerDrawer = ({ customer, onClose }) => {
    const { addCustomer, updateCustomer, deleteCustomer } = useCustomerStore();
    const { isMultiCountryMode, defaultCurrency } = useAppStore();
    const { t } = useTranslation();
    const isNew = !customer?.cust_id;

    const emptyForm = {
        cust_id: '', customer_code: '', name: '', address: '', delivery_address: '',
        phone1: '', phone2: '', mobile: '', fax: '', contact_name: '', responsible_person: '',
        invoice_title: '', tax_id: '', invoice_address: '', closing_day: '', collection_day: '', notes: '',
        zip_code: '', business_items: '', website: '', email: '', full_invoice: false, region_code: '',
        salesperson: '', tier: 'B', accounting_code: '', offset_supplier: ''
    };

    const [form, setForm] = useState(emptyForm);

    useEffect(() => {
        if (customer) setForm({ ...emptyForm, ...customer });
        else setForm(emptyForm);
    }, [customer]);

    const handleSave = () => {
        if (isNew) addCustomer(form);
        else updateCustomer(form);
        onClose();
    };

    const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

    const tierColors = { A: '#34d399', B: '#60a5fa', C: '#fbbf24' };
    const confirmDelete = (label) => window.confirm(`確定要刪除「${label}」嗎？此操作無法復原。`);

    if (!customer && customer !== null) return null;

    return (
        <div className={`${drawerStyles.overlay} ${drawerStyles.open}`} onClick={onClose}>
            <div className={drawerStyles.drawer} onClick={e => e.stopPropagation()}>
                <div className={drawerStyles.header}>
                    <div className="flex-col gap-1">
                        <span className="text-muted text-xs font-mono">{isNew ? 'NEW' : form.cust_id}</span>
                        <span className={drawerStyles.title}>{isNew ? t('customers.add') : form.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className={`${drawerStyles.closeBtn} text-success hover:bg-success-subtle`} onClick={handleSave} title={t('pim.save')}>
                            <Save size={20} />
                        </button>
                        {!isNew && (
                            <button
                                className={`${drawerStyles.closeBtn} text-danger hover:bg-danger-subtle`}
                                onClick={() => {
                                    if (!confirmDelete(form.name || form.cust_id)) return;
                                    deleteCustomer(form.cust_id);
                                    onClose();
                                }}
                                title={t('pim.delete')}
                            >
                                <Trash2 size={20} />
                            </button>
                        )}
                        <div className="w-px h-6 bg-border-color mx-1"></div>
                        <button className={drawerStyles.closeBtn} onClick={onClose}><X size={22} /></button>
                    </div>
                </div>

                <div className={drawerStyles.content}>
                    {/* 基本資料 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>基本資料</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>代號</label>
                                <input className={drawerStyles.input} value={form.customer_code || ''} onChange={e => set('customer_code', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 2 }}>
                                <label className={drawerStyles.label}>客戶名稱</label>
                                <input className={drawerStyles.input} value={form.name || ''} onChange={e => set('name', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <div className="flex items-center gap-2 mb-1">
                                <label className={drawerStyles.label} style={{ margin: 0 }}>公司地址</label>
                                {form.address && (
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-accent hover:text-accent-hover flex items-center"
                                        title="在 Google 地圖開啟"
                                    >
                                        <MapPin size={14} />
                                    </a>
                                )}
                            </div>
                            <input className={drawerStyles.input} value={form.address || ''} onChange={e => set('address', e.target.value)} />
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>送貨地址</label>
                            <input className={drawerStyles.input} value={form.delivery_address || ''} onChange={e => set('delivery_address', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>電話一</label>
                                <input className={drawerStyles.input} value={form.phone1 || ''} onChange={e => set('phone1', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>電話二</label>
                                <input className={drawerStyles.input} value={form.phone2 || ''} onChange={e => set('phone2', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>行動電話</label>
                                <input className={drawerStyles.input} value={form.mobile || ''} onChange={e => set('mobile', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>傳真號碼</label>
                                <input className={drawerStyles.input} value={form.fax || ''} onChange={e => set('fax', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>聯絡人</label>
                                <input className={drawerStyles.input} value={form.contact_name || ''} onChange={e => set('contact_name', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>負責人</label>
                                <input className={drawerStyles.input} value={form.responsible_person || ''} onChange={e => set('responsible_person', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* 稅務與帳務資料 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>稅務與帳務資料</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 2 }}>
                                <label className={drawerStyles.label}>發票抬頭</label>
                                <input className={drawerStyles.input} value={form.invoice_title || ''} onChange={e => set('invoice_title', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>統一編號</label>
                                <input className={drawerStyles.input} value={form.tax_id || ''} onChange={e => set('tax_id', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>發票地址</label>
                            <input className={drawerStyles.input} value={form.invoice_address || ''} onChange={e => set('invoice_address', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>當月結帳日</label>
                                <input className={drawerStyles.input} value={form.closing_day || ''} onChange={e => set('closing_day', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>收帳日</label>
                                <input className={drawerStyles.input} value={form.collection_day || ''} onChange={e => set('collection_day', e.target.value)} />
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>備註</label>
                            <textarea
                                className={drawerStyles.input}
                                style={{ minHeight: '80px', resize: 'vertical' }}
                                value={form.notes || ''}
                                onChange={e => set('notes', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 其他資訊 */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>其他資訊</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>郵遞區號</label>
                                <input className={drawerStyles.input} value={form.zip_code || ''} onChange={e => set('zip_code', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 2 }}>
                                <label className={drawerStyles.label}>經營項目</label>
                                <input className={drawerStyles.input} value={form.business_items || ''} onChange={e => set('business_items', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>網址</label>
                                <input className={drawerStyles.input} value={form.website || ''} onChange={e => set('website', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>電郵</label>
                                <input className={drawerStyles.input} type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3 items-center mt-2 mb-2">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                                <input type="checkbox" checked={form.full_invoice || false} onChange={e => set('full_invoice', e.target.checked)} id="full_invoice_cb" />
                                <label htmlFor="full_invoice_cb" className={drawerStyles.label} style={{ margin: 0, cursor: 'pointer' }}>全額發票</label>
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>區域碼</label>
                                <input className={drawerStyles.input} value={form.region_code || ''} onChange={e => set('region_code', e.target.value)} />
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>歸屬業務</label>
                                <input className={drawerStyles.input} value={form.salesperson || ''} onChange={e => set('salesperson', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>報價等級</label>
                                <div className="flex gap-1">
                                    {TIERS.map(tier => (
                                        <button key={tier} onClick={() => set('tier', tier)} style={{
                                            flex: 1, padding: '0.3rem', border: '2px solid', borderRadius: '4px', fontWeight: 700, cursor: 'pointer',
                                            borderColor: form.tier === tier ? tierColors[tier] : 'var(--border-color)',
                                            color: form.tier === tier ? tierColors[tier] : 'var(--text-secondary)',
                                            background: form.tier === tier ? tierColors[tier] + '22' : 'var(--bg-tertiary)',
                                            transition: 'all 0.15s'
                                        }}>
                                            {tier}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>會計子目編號</label>
                                <input className={drawerStyles.input} value={form.accounting_code || ''} onChange={e => set('accounting_code', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>抵帳廠商</label>
                                <input className={drawerStyles.input} value={form.offset_supplier || ''} onChange={e => set('offset_supplier', e.target.value)} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDrawer;
// trigger HMR
