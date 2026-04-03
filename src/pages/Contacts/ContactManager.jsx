import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Truck, Users, Plus, Search, Star, Edit2, Download, Upload, UserRound } from 'lucide-react';
import { useSupplierStore } from '../../store/useSupplierStore';
import { useCustomerStore } from '../../store/useCustomerStore';
import { useEmployeeStore } from '../../store/useEmployeeStore';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import styles from './Contacts.module.css';
import CountryFlag from '../../components/CountryFlag';
import SupplierDrawer from './SupplierDrawer';
import CustomerDrawer from './CustomerDrawer';
import EmployeeDrawer from './EmployeeDrawer';
import { sortedCustomersForSelect, sortedSuppliersForSelect } from '../../utils/sortContactsForSelect';

const ContactManager = () => {
    const { t } = useTranslation();
    const { isMultiCountryMode, defaultCurrency, showImportExport, enablePermissionRole } = useAppStore();

    // Supplier Store
    const {
        suppliers,
        searchQuery: supSearch,
        setSearchQuery: setSupSearch,
        bulkUpdateSuppliers
    } = useSupplierStore();

    // Customer Store
    const {
        customers,
        searchQuery: custSearch,
        setSearchQuery: setCustSearch,
        bulkUpdateCustomers
    } = useCustomerStore();

    // Employee Store
    const {
        employees,
        searchQuery: empSearch,
        setSearchQuery: setEmpSearch,
        bulkUpdateEmployees
    } = useEmployeeStore();

    const location = useLocation();
    const [activeTab, setActiveTab] = useState(
        location.pathname.includes('customers')
            ? 'customers'
            : location.pathname.includes('employees')
                ? 'employees'
                : 'suppliers'
    );
    const [drawerTarget, setDrawerTarget] = useState(undefined);
    const fileRef = useRef(null);

    const tierClass = (tier) => {
        if (tier === 'A') return styles['tier-a'];
        if (tier === 'B') return styles['tier-b'];
        if (tier === 'C') return styles['tier-c'];
        return styles['tier-b'];
    };

    // Sync tab with location changes
    useEffect(() => {
        if (location.pathname.includes('customers')) {
            setActiveTab('customers');
        } else if (location.pathname.includes('employees')) {
            setActiveTab('employees');
        } else if (location.pathname.includes('suppliers')) {
            setActiveTab('suppliers');
        }
    }, [location.pathname]);

    const filteredSuppliers = useMemo(() => {
        const q = supSearch.toLowerCase();
        return sortedSuppliersForSelect(suppliers).filter(
            (s) =>
                (s.name || '').toLowerCase().includes(q) ||
                (s.country || '').toLowerCase().includes(q) ||
                (s.sup_id || '').toLowerCase().includes(q)
        );
    }, [suppliers, supSearch]);

    const filteredCustomers = useMemo(() => {
        const q = custSearch.toLowerCase();
        return sortedCustomersForSelect(customers).filter(
            (c) =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.country || '').toLowerCase().includes(q) ||
                (c.contact_name || '').toLowerCase().includes(q) ||
                (c.cust_id || '').toLowerCase().includes(q)
        );
    }, [customers, custSearch]);

    const filteredEmployees = employees.filter(e =>
        (e.name || '').toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.department || '').toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.role || '').toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.email || '').toLowerCase().includes(empSearch.toLowerCase())
    );

    const handleExport = async () => {
        try {
            const data = activeTab === 'suppliers' ? filteredSuppliers : activeTab === 'customers' ? filteredCustomers : filteredEmployees;
            const headers = activeTab === 'suppliers'
                ? ['ID', 'Name', 'Contact', 'Email', 'Payment']
                : activeTab === 'customers'
                    ? ['ID', 'Name', 'Contact', 'Tier', 'Credit']
                : enablePermissionRole
                    ? ['ID', 'Name', 'Department', 'Role', 'Permission', 'Email', 'Phone', 'Status']
                    : ['ID', 'Name', 'Department', 'Role', 'Email', 'Phone', 'Status'];
            const csvRows = [headers.join(',')];
            data.forEach(item => {
                const name = (item.name || '').replace(/"/g, '""');
                if (activeTab === 'suppliers') {
                    csvRows.push([item.sup_id, `"${name}"`, item.contact_name, item.email, item.payment_terms].join(','));
                } else if (activeTab === 'customers') {
                    csvRows.push([item.cust_id, `"${name}"`, item.contact_name, item.tier, item.credit_limit].join(','));
                } else {
                    if (enablePermissionRole) {
                        csvRows.push([item.emp_id, `"${name}"`, item.department, item.role, item.permission_role || '一般', item.email, item.phone, item.status].join(','));
                    } else {
                        csvRows.push([item.emp_id, `"${name}"`, item.department, item.role, item.email, item.phone, item.status].join(','));
                    }
                }
            });
            const csvContent = "\uFEFF" + csvRows.join('\n');
            const fileName = `${activeTab}_export_${new Date().toISOString().slice(0, 10)}.csv`;

            if ('showSaveFilePicker' in window) {
                try {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: fileName,
                        types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
                    });
                    const writable = await handle.createWritable();
                    await writable.write(csvContent);
                    await writable.close();
                    alert("匯出成功！檔案已存入指定位置。");
                } catch (pickerErr) {
                    if (pickerErr.name === 'AbortError') return;
                    throw pickerErr;
                }
            } else {
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                }, 100);
                alert("匯出成功！檔案已存入您的下載資料夾。");
            }
        } catch (err) {
            console.error("Export failed:", err);
            alert("匯出發生錯誤。");
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                const rows = text.split('\n');
                if (rows.length < 2) return;

                const parseCsvRow = (row) =>
                    row
                        .split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
                        .map(p => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

                const normalizeHeader = (value) => (value || '').toLowerCase().replace(/[\s\-_()]/g, '');
                const expectedSupHeaders = ['id', 'name', 'contact', 'email', 'payment'];
                const expectedCustHeaders = ['id', 'name', 'contact', 'tier', 'credit'];
                const expectedEmpHeadersWithPermission = ['id', 'name', 'department', 'role', 'permission', 'email', 'phone', 'status'];
                const expectedEmpHeadersNoPermission = ['id', 'name', 'department', 'role', 'email', 'phone', 'status'];

                const headerParts = parseCsvRow(rows[0] || '');
                const normalizedHeaders = headerParts.map(normalizeHeader);
                const expectedHeaders = activeTab === 'suppliers'
                    ? expectedSupHeaders
                    : activeTab === 'customers'
                        ? expectedCustHeaders
                        : (enablePermissionRole ? expectedEmpHeadersWithPermission : expectedEmpHeadersNoPermission);
                const headersMatched = expectedHeaders.every((h, i) => normalizedHeaders[i] === h);

                if (!headersMatched) {
                    alert(
                        activeTab === 'suppliers'
                            ? '匯入失敗：目前是供應商頁，請匯入供應商格式（ID, Name, Contact, Email, Payment）的 CSV。'
                            : activeTab === 'customers'
                                ? '匯入失敗：目前是客戶頁，請匯入客戶格式（ID, Name, Contact, Tier, Credit）的 CSV。'
                                : `匯入失敗：目前是員工頁，請匯入員工格式（ID, Name, Department, Role, ${enablePermissionRole ? 'Permission, ' : ''}Email, Phone, Status）的 CSV。`
                    );
                    return;
                }

                const dataRows = rows.slice(1);
                const updates = [];
                let skippedByType = 0;

                dataRows.forEach(row => {
                    const trimmedRow = row.trim();
                    if (!trimmedRow) return;

                    const parts = parseCsvRow(trimmedRow);
                    if (parts.length >= 5) {
                        const parsed = parts;

                        if (activeTab === 'suppliers') {
                            const [sup_id, name, contact_name, email, payment_terms] = parsed;
                            if (!sup_id || !sup_id.toUpperCase().startsWith('SUP-')) {
                                skippedByType += 1;
                                return;
                            }
                            const existing = suppliers.find(s => s.sup_id === sup_id);
                            updates.push({
                                ...(existing || {}),
                                sup_id,
                                name: name || (existing?.name || ''),
                                contact_name: contact_name || (existing?.contact_name || ''),
                                email: email || (existing?.email || ''),
                                payment_terms: payment_terms || (existing?.payment_terms || ''),
                                country: existing?.country || '',
                                currency: existing?.currency || defaultCurrency,
                                categories: Array.isArray(existing?.categories) ? existing.categories : [],
                                rating: existing?.rating ?? 0,
                                notes: existing?.notes || '',
                            });
                        } else if (activeTab === 'customers') {
                            const [cust_id, name, contact_name, tier, credit_limit] = parsed;
                            if (!cust_id || !cust_id.toUpperCase().startsWith('CUST-')) {
                                skippedByType += 1;
                                return;
                            }
                            const existing = customers.find(c => c.cust_id === cust_id);
                            updates.push({
                                ...(existing || {}),
                                cust_id,
                                name: name || (existing?.name || ''),
                                contact_name: contact_name || (existing?.contact_name || ''),
                                tier: tier || (existing?.tier || 'B'),
                                credit_limit: parseFloat(credit_limit) || (existing?.credit_limit || 0),
                                country: existing?.country || '',
                                currency: existing?.currency || defaultCurrency,
                                payment_terms: existing?.payment_terms || '',
                                email: existing?.email || '',
                                address: existing?.address || '',
                                notes: existing?.notes || '',
                            });
                        } else {
                            const [emp_id, name, department, role, p5, p6, p7, p8] = parsed;
                            if (!emp_id || !emp_id.toUpperCase().startsWith('EMP-')) {
                                skippedByType += 1;
                                return;
                            }
                            const existing = employees.find(emp => emp.emp_id === emp_id);
                            const permission_role = enablePermissionRole ? p5 : (existing?.permission_role || '一般');
                            const email = enablePermissionRole ? p6 : p5;
                            const phone = enablePermissionRole ? p7 : p6;
                            const status = enablePermissionRole ? p8 : p7;
                            updates.push({
                                ...(existing || {}),
                                emp_id,
                                name: name || (existing?.name || ''),
                                department: department || (existing?.department || ''),
                                role: role || (existing?.role || ''),
                                permission_role: permission_role || (existing?.permission_role || '一般'),
                                email: email || (existing?.email || ''),
                                phone: phone || (existing?.phone || ''),
                                status: status || (existing?.status || '在職'),
                                extension: existing?.extension || '',
                                hire_date: existing?.hire_date || '',
                                address: existing?.address || '',
                                notes: existing?.notes || ''
                            });
                        }
                    }
                });

                if (updates.length > 0) {
                    if (activeTab === 'suppliers') {
                        bulkUpdateSuppliers(updates);
                    } else if (activeTab === 'customers') {
                        bulkUpdateCustomers(updates);
                    } else {
                        bulkUpdateEmployees(updates);
                    }
                    const skippedMsg = skippedByType > 0 ? `\n另有 ${skippedByType} 筆因 ID 類型不符已略過。` : '';
                    alert(`匯入完成！成功處理 ${updates.length} 筆${activeTab === 'suppliers' ? '供應商' : activeTab === 'customers' ? '客戶' : '員工'}資料。${skippedMsg}`);
                } else if (skippedByType > 0) {
                    alert(
                        activeTab === 'suppliers'
                            ? '匯入失敗：資料列 ID 不是 SUP-*，疑似匯入了客戶資料。'
                            : activeTab === 'customers'
                                ? '匯入失敗：資料列 ID 不是 CUST-*，疑似匯入了供應商資料。'
                                : '匯入失敗：資料列 ID 不是 EMP-*，疑似匯入了其他資料。'
                    );
                }
            } catch (err) {
                console.error("Import error:", err);
                alert("解析檔案時發生錯誤。");
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.tabs}>
                    <div
                        className={`${styles.tab} ${activeTab === 'suppliers' ? styles.activeTabSupplier : ''}`}
                        onClick={() => setActiveTab('suppliers')}
                    >
                        <Truck size={22} />
                        {t('sidebar.suppliers')}
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === 'customers' ? styles.activeTabCustomer : ''}`}
                        onClick={() => setActiveTab('customers')}
                    >
                        <Users size={22} />
                        {t('sidebar.customers')}
                    </div>
                    <div
                        className={`${styles.tab} ${activeTab === 'employees' ? styles.activeTabEmployee : ''}`}
                        onClick={() => setActiveTab('employees')}
                    >
                        <UserRound size={22} />
                        員工
                    </div>
                </div>

                <div className="flex-1" />

                <div className="flex gap-2">
                    {showImportExport && (
                        <>
                            <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={handleImport} accept=".csv" />
                            <button className={styles.addBtn} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={() => fileRef.current?.click()}>
                                <Download size={16} />
                                {t('pim.import')}
                            </button>
                            <button className={styles.addBtn} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} onClick={handleExport}>
                                <Upload size={16} />
                                {t('pim.export')}
                            </button>
                        </>
                    )}
                    <button className={styles.addBtn} onClick={() => setDrawerTarget(null)}>
                        <Plus size={16} />
                        {activeTab === 'suppliers' ? t('suppliers.add') : activeTab === 'customers' ? t('customers.add') : t('employees.add')}
                    </button>
                </div>
            </div>

            <div className={styles.searchBar}>
                <Search size={16} className="text-muted" />
                <input
                    placeholder={activeTab === 'suppliers' ? t('suppliers.search') : activeTab === 'customers' ? t('customers.search') : t('employees.search')}
                    value={activeTab === 'suppliers' ? supSearch : activeTab === 'customers' ? custSearch : empSearch}
                    onChange={e =>
                        activeTab === 'suppliers'
                            ? setSupSearch(e.target.value)
                            : activeTab === 'customers'
                                ? setCustSearch(e.target.value)
                                : setEmpSearch(e.target.value)
                    }
                />
            </div>

            <div className={styles.card}>
                {activeTab === 'suppliers' ? (
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
                            {filteredSuppliers.map(sup => (
                                <tr key={sup.sup_id} onClick={() => setDrawerTarget(sup)}>
                                    <td><span className="font-mono text-muted text-xs">{sup.sup_id}</span></td>
                                    <td>
                                        <div className="font-semibold">{sup.name}</div>
                                        <div className="text-xs text-muted">{(sup.categories || []).join(', ')}</div>
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
                ) : activeTab === 'customers' ? (
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
                            {filteredCustomers.map(cust => (
                                <tr key={cust.cust_id} onClick={() => setDrawerTarget(cust)}>
                                    <td><span className="font-mono text-muted text-xs">{cust.cust_id}</span></td>
                                    <td>
                                        <div className="font-semibold">{cust.name}</div>
                                        <div className="text-xs text-muted">{cust.address}</div>
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
                ) : (
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>{t('employees.thName')}</th>
                                <th>{t('employees.thDepartment')}</th>
                                <th>{t('employees.thRole')}</th>
                                {enablePermissionRole && <th>{t('employees.thPermission')}</th>}
                                <th>{t('employees.thContact')}</th>
                                <th>{t('employees.thStatus')}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.emp_id} onClick={() => setDrawerTarget(emp)}>
                                    <td><span className="font-mono text-muted text-xs">{emp.emp_id}</span></td>
                                    <td>
                                        <div className="font-semibold">{emp.name}</div>
                                        <div className="text-xs text-muted">{emp.hire_date || '-'}</div>
                                    </td>
                                    <td>{emp.department || '-'}</td>
                                    <td>{emp.role || '-'}</td>
                                    {enablePermissionRole && (
                                        <td>
                                            <span className={`${styles.badge} ${styles['tier-b']}`}>
                                                {emp.permission_role || '一般'}
                                            </span>
                                        </td>
                                    )}
                                    <td>
                                        <div>{emp.phone || '-'}</div>
                                        <div className="text-xs text-muted">{emp.email || '-'}</div>
                                    </td>
                                    <td>
                                        <span className={`${styles.badge} ${emp.status === '在職' ? styles['tier-a'] : emp.status === '留職停薪' ? styles['tier-c'] : styles['tier-b']}`}>
                                            {emp.status || '在職'}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                            <button className={styles.actionBtn} onClick={() => setDrawerTarget(emp)}><Edit2 size={14} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {drawerTarget !== undefined && (
                activeTab === 'suppliers' ? (
                    <SupplierDrawer supplier={drawerTarget} onClose={() => setDrawerTarget(undefined)} />
                ) : activeTab === 'customers' ? (
                    <CustomerDrawer customer={drawerTarget} onClose={() => setDrawerTarget(undefined)} />
                ) : (
                    <EmployeeDrawer employee={drawerTarget} onClose={() => setDrawerTarget(undefined)} />
                )
            )}
        </div>
    );
};

export default ContactManager;
