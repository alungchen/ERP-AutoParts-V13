import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import drawerStyles from '../PIM/ProductDrawer.module.css';
import styles from './Contacts.module.css';

const CURRENCIES = ['TWD', 'USD', 'EUR', 'JPY', 'CNY', 'GBP'];
const PAYMENT_TERMS = ['Net 15', 'Net 30', 'T/T 30 days', 'T/T 45 days', 'L/C 60 days', 'COD'];
const COUNTRIES = ['Taiwan', 'Japan', 'Germany', 'USA', 'South Korea', 'China', 'Thailand', 'Vietnam'];
const CATEGORIES = ['Brake System', 'Filters', 'Ignition', 'Suspension', 'Electrical', 'Engine', 'Transmission'];
import CountryFlag from '../../components/CountryFlag';

const SupplierDrawer = ({ supplier, onClose }) => {
    const { addSupplier, updateSupplier, deleteSupplier } = useSupplierStore();
    const { isMultiCountryMode } = useAppStore();
    const { t } = useTranslation();
    const isNew = !supplier?.sup_id;

    const emptyForm = {
        sup_id: '', name: '', country: 'Taiwan', currency: 'TWD',
        contact_name: '', email: '', phone: '',
        payment_terms: 'Net 30', lead_time_avg: 14, rating: 5.0,
        address: '', website: '', categories: [], notes: ''
    };

    const [form, setForm] = useState(emptyForm);
    const [newCategory, setNewCategory] = useState('');

    useEffect(() => {
        if (supplier) setForm({ ...emptyForm, ...supplier });
        else setForm(emptyForm);
    }, [supplier]);

    const handleSave = () => {
        if (isNew) addSupplier(form);
        else updateSupplier(form);
        onClose();
    };

    const toggleCategory = (cat) => {
        const cats = form.categories.includes(cat)
            ? form.categories.filter(c => c !== cat)
            : [...form.categories, cat];
        setForm({ ...form, categories: cats });
    };

    const handleAddCategory = (e) => {
        if (e.key === 'Enter' && newCategory.trim()) {
            e.preventDefault();
            const cat = newCategory.trim();
            if (!form.categories.includes(cat)) {
                setForm({ ...form, categories: [...form.categories, cat] });
            }
            setNewCategory('');
        }
    };

    const set = (field, val) => setForm(f => ({ ...f, [field]: val }));
    const confirmDelete = (label) => window.confirm(`確定要刪除「${label}」嗎？此操作無法復原。`);

    if (!supplier && supplier !== null) return null;

    return (
        <div className={`${drawerStyles.overlay} ${drawerStyles.open}`} onClick={onClose}>
            <div className={drawerStyles.drawer} onClick={e => e.stopPropagation()}>
                <div className={drawerStyles.header}>
                    <div className="flex-col gap-1">
                        <span className="text-muted text-xs font-mono">{isNew ? 'NEW' : form.sup_id}</span>
                        <span className={drawerStyles.title}>{isNew ? t('suppliers.add') : form.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className={`${drawerStyles.closeBtn} text-success hover:bg-success-subtle`} onClick={handleSave} title={t('pim.save')}>
                            <Save size={20} />
                        </button>
                        {!isNew && (
                            <button
                                className={`${drawerStyles.closeBtn} text-danger hover:bg-danger-subtle`}
                                onClick={() => {
                                    if (!confirmDelete(form.name || form.sup_id)) return;
                                    deleteSupplier(form.sup_id);
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
                        <div className={drawerStyles.sectionTitle}>{t('suppliers.sectionBasic')}</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('suppliers.thName')}</label>
                            <input className={drawerStyles.input} value={form.name} onChange={e => set('name', e.target.value)} />
                        </div>
                        {isMultiCountryMode && (
                            <div className="flex gap-3">
                                <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                    <label className={drawerStyles.label}>{t('suppliers.thCountry')}</label>
                                    <div className="flex items-center gap-2">
                                        <CountryFlag country={form.country} size={20} style={{ marginRight: 0 }} />
                                        <select className={drawerStyles.input} style={{ flex: 1 }} value={form.country} onChange={e => set('country', e.target.value)}>
                                            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                    <label className={drawerStyles.label}>{t('suppliers.thCurrency')}</label>
                                    <select className={drawerStyles.input} value={form.currency} onChange={e => set('currency', e.target.value)}>
                                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('suppliers.address')}</label>
                            <input className={drawerStyles.input} value={form.address || ''} onChange={e => set('address', e.target.value)} placeholder="Full mailing address..." />
                        </div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('suppliers.website')}</label>
                            <input className={drawerStyles.input} value={form.website || ''} onChange={e => set('website', e.target.value)} placeholder="https://..." />
                        </div>
                    </div>

                    {/* Contact */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('suppliers.sectionContact')}</div>
                        <div className={drawerStyles.inputGroup}>
                            <label className={drawerStyles.label}>{t('suppliers.thContact')}</label>
                            <input className={drawerStyles.input} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} />
                        </div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>Email</label>
                                <input className={drawerStyles.input} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>Phone</label>
                                <input className={drawerStyles.input} value={form.phone} onChange={e => set('phone', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Terms */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('suppliers.sectionTerms')}</div>
                        <div className="flex gap-3">
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>{t('suppliers.thPayment')}</label>
                                <select className={drawerStyles.input} value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)}>
                                    {PAYMENT_TERMS.map(p => <option key={p}>{p}</option>)}
                                </select>
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>{t('suppliers.leadTime')} (Days)</label>
                                <input className={drawerStyles.input} type="number" value={form.lead_time_avg} onChange={e => set('lead_time_avg', parseInt(e.target.value) || 0)} />
                            </div>
                            <div className={drawerStyles.inputGroup} style={{ flex: 1 }}>
                                <label className={drawerStyles.label}>{t('suppliers.thRating')}</label>
                                <input className={drawerStyles.input} type="number" step="0.1" min="0" max="5" value={form.rating} onChange={e => set('rating', parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                    </div>

                    {/* Categories */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('suppliers.categories')}</div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {Array.from(new Set([...CATEGORIES, ...(form.categories || [])])).map(cat => (
                                <button key={cat} onClick={() => toggleCategory(cat)}
                                    style={{
                                        padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                                        background: form.categories.includes(cat) ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                        color: form.categories.includes(cat) ? 'white' : 'var(--text-secondary)',
                                        border: '1px solid var(--border-color)', transition: 'all 0.15s',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                    {cat}
                                    {form.categories.includes(cat) && <span style={{ opacity: 0.7 }}>×</span>}
                                </button>
                            ))}
                            <input
                                type="text"
                                placeholder="+ Add Tag (Enter)"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                                onKeyDown={handleAddCategory}
                                style={{
                                    padding: '4px 8px', borderRadius: '6px', fontSize: '0.75rem', width: '120px',
                                    background: 'transparent', border: '1px dashed var(--border-color)',
                                    color: 'var(--text-primary)', outline: 'none'
                                }}
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>{t('suppliers.notes')}</div>
                        <textarea
                            className={drawerStyles.input}
                            style={{ minHeight: '100px', resize: 'vertical' }}
                            value={form.notes || ''}
                            onChange={e => set('notes', e.target.value)}
                            placeholder={t('suppliers.notesPlaceholder')}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SupplierDrawer;
