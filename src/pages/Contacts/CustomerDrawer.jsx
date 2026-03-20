import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
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
        cust_id: '', name: '', country: 'Taiwan', currency: 'TWD',
        contact_name: '', email: '', phone: '',
        payment_terms: 'Net 30', tier: 'B', credit_limit: 100000,
        address: '', website: '', notes: ''
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
                    {/* Basic Info */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('customers.sectionBasic')}</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('customers.thName')}</label>
                            <input className={drawerStyles.input} value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        {isMultiCountryMode && (
                            <div className="flex gap-3">
                                <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                    <label className={drawerStyles.label}>{t('customers.thCountry')}</label>
                                    <div className="flex items-center gap-2">
                                        <CountryFlag country={form.country} size={20} style={{ marginRight: 0 }} />
                                        <select className={drawerStyles.input} style={{ flex: 1 }} value={form.country} onChange={e => set('country', e.target.value)}>
                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                    <label className={drawerStyles.label}>{t('customers.thCurrency')}</label>
                                    <select className={drawerStyles.input} value={form.currency} onChange={e => set('currency', e.target.value)}>
                                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('customers.address')}</label>
                            <input className={drawerStyles.input} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Full mailing address..." />
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('customers.website')}</label>
                            <input className={drawerStyles.input} value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('customers.sectionContact')}</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('customers.thContact')}</label>
                            <input className={drawerStyles.input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>Email</label>
                                <input className={drawerStyles.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>Phone</label>
                                <input className={drawerStyles.input} value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Tier & Credit */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('customers.sectionPricing')}</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>{t('customers.thTier')}</label>
                                <div className="flex gap-2">
                                    {TIERS.map(tier => (
                                        <button key={tier} onClick={() => set('tier', tier)} style={{
                                            flex: 1, padding: '0.5rem', border: '2px solid', borderRadius: '8px', fontWeight: 700, cursor: 'pointer',
                                            borderColor: form.tier === tier ? tierColors[tier] : 'var(--border-color)',
                                            color: form.tier === tier ? tierColors[tier] : 'var(--text-secondary)',
                                            background: form.tier === tier ? tierColors[tier] + '22' : 'var(--bg-tertiary)',
                                            transition: 'all 0.15s'
                                        }}>
                                            {t('customers.tier')} {tier}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>{t('customers.thPayment')}</label>
                                <select className={drawerStyles.input} value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                                    {PAYMENT_TERMS.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('customers.thCredit')} ({defaultCurrency})</label>
                            <input className={drawerStyles.input} type="number" value={form.credit_limit} onChange={e => set('credit_limit', parseInt(e.target.value) || 0)} />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('customers.notes')}</div>
                        <textarea
                            className={drawerStyles.input}
                            style={{ minHeight: '100px', resize: 'vertical' }}
                            value={form.notes || ''}
                            onChange={e => set('notes', e.target.value)}
                            placeholder={t('customers.notesPlaceholder')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDrawer;
