import React, { useState } from 'react';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import { Search, Plus, Star, Edit2 } from 'lucide-react';
import styles from './Contacts.module.css';
import SupplierDrawer from './SupplierDrawer';
import CountryFlag from '../../components/CountryFlag';

const SupplierList = () => {
    const { suppliers, searchQuery, setSearchQuery } = useSupplierStore();
    const { isMultiCountryMode } = useAppStore();
    const { t } = useTranslation();
    const [drawerTarget, setDrawerTarget] = useState(undefined); // undefined = closed, null = new, obj = edit

    const filtered = suppliers.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.country.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>{t('suppliers.title')}</h1>
                    <p className={styles.subtitle}>{t('suppliers.subtitle')}</p>
                </div>
                <button className={styles.addBtn} onClick={() => setDrawerTarget(null)}>
                    <Plus size={16} /> {t('suppliers.add')}
                </button>
            </div>

            <div className={styles.searchBar}>
                <Search size={16} className="text-muted" />
                <input
                    placeholder={t('suppliers.search')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className={styles.card}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>{t('suppliers.thName')}</th>
                            {isMultiCountryMode && <th>{t('suppliers.thCountry')}</th>}
                            <th>{t('suppliers.thContact')}</th>
                            <th>{t('suppliers.thPayment')}</th>
                            {isMultiCountryMode && <th>{t('suppliers.thCurrency')}</th>}
                            <th>{t('suppliers.thRating')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(sup => (
                            <tr key={sup.sup_id} onClick={() => setDrawerTarget(sup)} style={{ cursor: 'pointer' }}>
                                <td><span className="font-mono text-muted text-xs">{sup.sup_id}</span></td>
                                <td>
                                    <div>
                                        <div className="font-semibold">{sup.name}</div>
                                        <div className="text-xs text-muted">{sup.categories.join(', ')}</div>
                                        {sup.notes && <div className="text-xs text-muted mt-1" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sup.notes}</div>}
                                    </div>
                                </td>
                                {isMultiCountryMode && (
                                    <td>
                                        <div className="flex items-center">
                                            <CountryFlag country={sup.country} />
                                            <span>{sup.country}</span>
                                        </div>
                                    </td>
                                )}
                                <td>
                                    <div>{sup.contact_name}</div>
                                    <div className="text-xs text-muted">{sup.email}</div>
                                    {sup.website && <div className="text-xs" style={{ color: 'var(--accent-hover)' }}>{sup.website}</div>}
                                </td>
                                <td className="text-sm">{sup.payment_terms}</td>
                                {isMultiCountryMode && (
                                    <td>
                                        <span className={`${styles.badge} ${styles['tier-b']}`}>{sup.currency}</span>
                                    </td>
                                )}
                                <td>
                                    <div className="flex items-center gap-1">
                                        <Star size={14} className={styles.star} />
                                        <span className="font-bold">{sup.rating}</span>
                                    </div>
                                </td>
                                <td>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button className={styles.actionBtn} onClick={() => setDrawerTarget(sup)}><Edit2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {drawerTarget !== undefined && (
                <SupplierDrawer supplier={drawerTarget} onClose={() => setDrawerTarget(undefined)} />
            )}
        </div>
    );
};

export default SupplierList;
