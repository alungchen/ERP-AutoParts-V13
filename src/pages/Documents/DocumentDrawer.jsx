import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useDocumentStore } from '../../store/useDocumentStore';
import { useTranslation } from '../../i18n';
import styles from './Documents.module.css';
import drawerStyles from '../PIM/ProductDrawer.module.css';
import { useProductStore } from '../../store/useProductStore';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useCustomerStore } from '../../store/useCustomerStore';

// ?? ??誨?撓?????迂憿舐內??隞???
const CodeLookupInput = ({ value, nameValue, placeholder, suggestions, onSelect, idKey, label }) => {
    const [query, setQuery] = useState(value || '');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => { setQuery(value || ''); }, [value]);

    const filtered = query.length >= 1
        ? suggestions.filter(s =>
            s[idKey]?.toLowerCase().includes(query.toLowerCase()) ||
            s.name?.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 12)
        : [];

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                    className={drawerStyles.input}
                    style={{ width: '140px', fontFamily: 'monospace', flexShrink: 0 }}
                    placeholder={`隞??...`}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                />
                <input
                    className={drawerStyles.input}
                    style={{ flex: 1, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
                    readOnly
                    value={nameValue || ''}
                    placeholder={nameValue ? '' : '??頛詨隞??敺?葆?亙?蝔?}
                />
            </div>
            {open && filtered.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: '0.5rem', maxHeight: '220px', overflowY: 'auto',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.3)', marginTop: '2px'
                }}>
                    {filtered.map(s => (
                        <div
                            key={s[idKey]}
                            onClick={() => { onSelect(s); setQuery(s[idKey]); setOpen(false); }}
                            style={{
                                padding: '0.5rem 0.75rem', cursor: 'pointer',
                                display: 'flex', gap: '0.75rem', alignItems: 'center',
                                borderBottom: '1px solid var(--border-color)',
                                fontSize: '0.85rem'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                            <span style={{ fontFamily: 'monospace', color: 'var(--accent)', minWidth: '90px' }}>{s[idKey]}</span>
                            <span style={{ color: 'var(--text-primary)', flex: 1 }}>{s.name}</span>
                            {s.phone1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.phone1}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const DocumentDrawer = ({ docItem, type, onClose }) => {
    const { t, language } = useTranslation();
    const { addDocument, updateDocument } = useDocumentStore();
    const { products } = useProductStore();
    const { suppliers } = useSupplierStore();
    const { customers } = useCustomerStore();

    const isEdit = !!docItem;

    const [doc, setDoc] = useState(() => {
        if (isEdit) return { ...docItem };
        return {
            type: type,
            date: new Date().toISOString().split('T')[0],
            status: 'pending',
            items: [],
            currency: 'TWD',
            notes: '',
            supplier_name: '',
            customer_name: '',
            discount: 0,
            freight_cost: 0,
            tariff_rate: 0
        };
    });

    const isSupplier = type === 'inquiry' || type === 'purchase';
    const isCustomer = type === 'quotation' || type === 'sales';

    const handleSave = () => {
        if (isEdit) {
            updateDocument(type, doc);
        } else {
            addDocument(type, doc);
        }
        onClose();
    };

    const addItem = () => {
        setDoc({
            ...doc,
            items: [...doc.items, { p_id: '', name: '', qty: 1, unit_price: 0, unit: 'PCS' }]
        });
    };

    const removeItem = (index) => {
        const newItems = [...doc.items];
        newItems.splice(index, 1);
        setDoc({ ...doc, items: newItems });
    };

    const updateItem = (index, field, value) => {
        const newItems = [...doc.items];
        newItems[index] = { ...newItems[index], [field]: value };
        if (field === 'p_id') {
            const product = products.find(p => p.p_id === value);
            if (product) {
                newItems[index].name = product.name;
                if (!newItems[index].unit_price) {
                    newItems[index].unit_price = product.price || 0;
                }
            }
        }
        setDoc({ ...doc, items: newItems });
    };

    return (
        <div className={`${drawerStyles.overlay} ${drawerStyles.open}`} onClick={onClose}>
            <div className={drawerStyles.drawer} onClick={e => e.stopPropagation()}>
                <div className={drawerStyles.header}>
                    <div className="flex-col gap-1">
                        <span className="text-muted text-xs font-mono">{isEdit ? docItem.doc_id : 'NEW'}</span>
                        <span className={drawerStyles.title}>{isEdit ? t('docs.edit') : t('docs.add')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button className={`${drawerStyles.closeBtn} text-success hover:bg-success-subtle`} onClick={handleSave} title="Save">
                            <Plus size={20} />
                        </button>
                        <div className="w-px h-6 bg-border-color mx-1"></div>
                        <button className={drawerStyles.closeBtn} onClick={onClose}><X size={22} /></button>
                    </div>
                </div>

                <div className={drawerStyles.content}>
                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>Basic Info</div>
                        <div className={styles.grid2} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className={drawerStyles.inputGroup}>
                                <label className={drawerStyles.label}>{t('docs.thDate')}</label>
                                <input className={drawerStyles.input} type="date" value={doc.date || ''} onChange={e => setDoc({ ...doc, date: e.target.value })} />
                            </div>
                            <div className={drawerStyles.inputGroup}>
                                <label className={drawerStyles.label}>{t('docs.thStatus')}</label>
                                <select className={drawerStyles.input} value={doc.status} onChange={e => setDoc({ ...doc, status: e.target.value })}>
                                    <option value="pending">Pending</option>
                                    <option value="replied">Replied</option>
                                    <option value="accepted">Accepted</option>
                                    <option value="sent">Sent</option>
                                    <option value="received">Received</option>
                                    <option value="in_transit">In Transit</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="pending_payment">Pending Payment</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            {isSupplier && (
                                <div className={drawerStyles.inputGroup} style={{ gridColumn: 'span 2' }}>
                                    <label className={drawerStyles.label}>{t('docs.thSupplier')}</label>
                                    <CodeLookupInput
                                        value={doc.supplier_id || ''}
                                        nameValue={doc.supplier_name || ''}
                                        suggestions={suppliers}
                                        idKey="sup_id"
                                        onSelect={sup => setDoc({ ...doc, supplier_id: sup.sup_id, supplier_name: sup.name, currency: sup.currency || 'TWD' })}
                                    />
                                </div>
                            )}

                            {isCustomer && (
                                <div className={drawerStyles.inputGroup} style={{ gridColumn: 'span 2' }}>
                                    <label className={drawerStyles.label}>{t('docs.thCustomer')}</label>
                                    <CodeLookupInput
                                        value={doc.customer_id || ''}
                                        nameValue={doc.customer_name || ''}
                                        suggestions={customers}
                                        idKey="cust_id"
                                        onSelect={cust => setDoc({ ...doc, customer_id: cust.cust_id, customer_name: cust.name, currency: cust.currency || 'TWD' })}
                                    />
                                </div>
                            )}

                            <div className={drawerStyles.inputGroup}>
                                <label className={drawerStyles.label}>Currency</label>
                                <input className={drawerStyles.input} type="text" value={doc.currency || 'TWD'} onChange={e => setDoc({ ...doc, currency: e.target.value })} />
                            </div>

                        </div>
                    </div>

                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>
                            Line Items
                            <button className={styles.addBtn} style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem' }} onClick={addItem}>
                                <Plus size={14} /> Add Item
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">
                            {doc.items?.map((item, idx) => (
                                <div key={idx} style={{ border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)' }}>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-bold text-sm text-primary">Item {idx + 1}</span>
                                        <button className={`${drawerStyles.closeBtn} text-danger`} onClick={() => removeItem(idx)}>
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                        <div className={drawerStyles.inputGroup} style={{ gridColumn: 'span 2' }}>
                                            <label className={drawerStyles.label}>Product</label>
                                            <select
                                                className={drawerStyles.input}
                                                value={item.p_id}
                                                onChange={e => updateItem(idx, 'p_id', e.target.value)}
                                            >
                                                <option value="">-- Select Product --</option>
                                                {products.map(p => <option key={p.p_id} value={p.p_id}>{p.p_id} - {p.name}</option>)}
                                            </select>
                                        </div>
                                        <div className={drawerStyles.inputGroup}>
                                            <label className={drawerStyles.label}>Quantity</label>
                                            <input className={drawerStyles.input} type="number" min="1" value={item.qty || 1} onChange={e => updateItem(idx, 'qty', parseInt(e.target.value))} />
                                        </div>
                                        {type !== 'inquiry' && (
                                            <div className={drawerStyles.inputGroup}>
                                                <label className={drawerStyles.label}>Unit Price</label>
                                                <input className={drawerStyles.input} type="number" value={item.unit_price || 0} onChange={e => updateItem(idx, 'unit_price', parseFloat(e.target.value))} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {(!doc.items || doc.items.length === 0) && (
                                <div className="text-center text-sm text-gray-400 py-4">No items added yet.</div>
                            )}
                        </div>
                    </div>

                    <div className={drawerStyles.section}>
                        <div className={drawerStyles.sectionTitle}>Notes</div>
                        <div className={drawerStyles.inputGroup}>
                            <textarea
                                className={drawerStyles.input}
                                rows="3"
                                value={doc.notes || ''}
                                onChange={e => setDoc({ ...doc, notes: e.target.value })}
                                placeholder="Add any relevant notes..."
                                style={{ minHeight: '80px', resize: 'vertical' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DocumentDrawer;
