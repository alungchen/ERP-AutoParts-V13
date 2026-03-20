import React, { useState } from 'react';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import { Search, Plus, Edit2 } from 'lucide-react';
import styles from './Contacts.module.css';
import CustomerDrawer from './CustomerDrawer';
import CountryFlag from '../../components/CountryFlag';

const CustomerList = () => {
    const { customers, searchQuery, setSearchQuery } = useCustomerStore();
    const { isMultiCountryMode, defaultCurrency } = useAppStore();
    const { t } = useTranslation();
    const [drawerTarget, setDrawerTarget] = useState(undefined);

    const filtered = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.contact_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const tierClass = (tier) => {
        if (tier === 'A') return styles['tier-a'];
        if (tier === 'B') return styles['tier-b'];
        return styles['tier-c'];
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div>
                    <h1 className={styles.title}>{t('customers.title')}</h1>
                    <p className={styles.subtitle}>{t('customers.subtitle')}</p>
                </div>
                <button className={styles.addBtn} onClick={() => setDrawerTarget(null)}>
                    <Plus size={16} /> {t('customers.add')}
                </button>
            </div>

            <div className={styles.searchBar}>
                <Search size={16} className="text-muted" />
                <input
                    placeholder={t('customers.search')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className={styles.card}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>{t('customers.thName')}</th>
                            {isMultiCountryMode && <th>{t('customers.thCountry')}</th>}
                            <th>{t('customers.thContact')}</th>
                            <th>{t('customers.thTier')}</th>
                            <th>{t('customers.thCredit')}</th>
                            <th>{t('customers.thPayment')}</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(cust => (
                            <tr key={cust.cust_id} onClick={() => setDrawerTarget(cust)} style={{ cursor: 'pointer' }}>
                                <td><span className="font-mono text-muted text-xs">{cust.cust_id}</span></td>
                                <td>
                                    <div className="font-semibold">{cust.name}</div>
                                    <div className="text-xs text-muted">{cust.address}</div>
                                    {cust.notes && <div className="text-xs text-muted mt-1" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cust.notes}</div>}
                                </td>
                                {isMultiCountryMode && (
                                    <td>
                                        <div className="flex items-center">
                                            <CountryFlag country={cust.country} />
                                            <span>{cust.country}</span>
                                        </div>
                                    </td>
                                )}
                                <td>
                                    <div>{cust.contact_name}</div>
                                    <div className="text-xs text-muted">{cust.email}</div>
                                    {cust.website && <div className="text-xs" style={{ color: 'var(--accent-hover)' }}>{cust.website}</div>}
                                </td>
                                <td>
                                    <span className={`${styles.badge} ${tierClass(cust.tier)}`}>
                                        {t('customers.tier')} {cust.tier}
                                    </span>
                                </td>
                                <td className="font-mono">
                                    {defaultCurrency} {cust.credit_limit.toLocaleString()}
                                </td>
                                <td className="text-sm">{cust.payment_terms}</td>
                                <td>
                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                        <button className={styles.actionBtn} onClick={() => setDrawerTarget(cust)}><Edit2 size={14} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {drawerTarget !== undefined && (
                <CustomerDrawer customer={drawerTarget} onClose={() => setDrawerTarget(undefined)} />
            )}
        </div>
    );
};

export default CustomerList;
