import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Truck, Users, Plus, Search, Star, Edit2, Download, Upload, UserRound, MapPin } from 'lucide-react';
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
        bulkUpdateSuppliers,
        clearAllSuppliers,
        fetchSuppliers,
    } = useSupplierStore();

    // Customer Store
    const {
        customers,
        searchQuery: custSearch,
        setSearchQuery: setCustSearch,
        bulkUpdateCustomers,
        fetchCustomers,
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

    // 首次載入時從 D1 取得資料
    useEffect(() => {
        fetchSuppliers();
        fetchCustomers();
    }, []);

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
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                
                // Robust CSV Parser that handles multiline (newlines inside quotes)
                const parseCsv = (csvText) => {
                    const lines = csvText.split(/\r?\n/);
                    const rows = [];
                    let partialLine = '';
                    
                    const parseLine = (line) => {
                        const parts = [];
                        let cell = '';
                        let inQuotes = false;
                        for (let i = 0; i < line.length; i++) {
                            const c = line[i];
                            if (c === '"') {
                                if (inQuotes && line[i+1] === '"') {
                                    cell += '"'; i++;
                                } else {
                                    inQuotes = !inQuotes;
                                }
                            } else if (c === ',' && !inQuotes) {
                                parts.push(cell.trim());
                                cell = '';
                            } else {
                                cell += c;
                            }
                        }
                        parts.push(cell.trim());
                        return parts;
                    };

                    for (let i = 0; i < lines.length; i++) {
                        const line = partialLine ? partialLine + '\n' + lines[i] : lines[i];
                        const quoteCount = (line.match(/"/g) || []).length;
                        if (quoteCount % 2 !== 0) {
                            partialLine = line; // Unbalanced, continue to next line
                        } else {
                            rows.push(parseLine(line));
                            partialLine = '';
                        }
                    }
                    return rows;
                };

                const parsedCsvData = parseCsv(text);
                if (parsedCsvData.length < 2) return;
                
                const rows = parsedCsvData;
                const normalizeHeader = (value) => (value || '').replace(/^\uFEFF/, '').toLowerCase().trim();

                const expectedSupHeaders = ['id', 'name', 'contact', 'email', 'payment'];
                const expectedCustHeaders = ['id', 'name', 'contact', 'tier', 'credit'];
                const expectedEmpHeadersWithPermission = ['id', 'name', 'department', 'role', 'permission', 'email', 'phone', 'status'];
                const expectedEmpHeadersNoPermission = ['id', 'name', 'department', 'role', 'email', 'phone', 'status'];

                const headerParts = rows[0] || [];
                const normalizedHeaders = headerParts.map(normalizeHeader);
                
                // Detect legacy scraper format
                const isLegacyFormat = normalizedHeaders.includes('guid_id') || normalizedHeaders.includes('cname');

                let expectedHeaders = [];
                if (!isLegacyFormat) {
                    expectedHeaders = activeTab === 'suppliers'
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
                }

                const dataRows = rows.slice(1);
                const updates = [];
                let skippedByType = 0;

                // Build a column index map for legacy format
                const legacyMap = {};
                if (isLegacyFormat) {
                    normalizedHeaders.forEach((h, i) => { legacyMap[h] = i; });
                }

                dataRows.forEach(row => {
                    if (!row || row.length === 0 || row.every(cell => cell.trim() === '')) return;

                    const parts = row;
                    
                    if (isLegacyFormat) {
                        // Legacy ASP Scraper Data Mapping
                        const getVal = (keys) => {
                            const keysArr = Array.isArray(keys) ? keys : [keys];
                            for (let k of keysArr) {
                                const idx = legacyMap[normalizeHeader(k)];
                                if (idx !== undefined && parts[idx]) return parts[idx];
                            }
                            return '';
                        };
                        
                        const rawId = getVal(['cid', 'guid_id', 'id']);
                        const name = getVal(['cname', 'name']);
                        const contact_name = getVal(['cmainman', 'ccommman', 'contact']);
                        const responsible_person = getVal(['cmainman', 'ccommman']);
                        const email = getVal(['cemail', 'ce_mail', 'email']);
                        const payment_terms = getVal(['naccday', 'payment']);
                        const phone1 = getVal(['ctel1', 'tel1']);
                        const phone2 = getVal(['ctel2', 'tel2']);
                        const mobile = getVal(['cacttel', 'mobile']);
                        const fax = getVal(['cfax', 'fax']);
                        const tax_id = getVal(['cgeneralno', 'taxid', 'tax_id']);
                        const invoice_title = getVal(['cname2', 'invoice_title']);    // 發票抬頭 = CNAME2
                        const invoice_address = getVal(['cadd2', 'invoice_address']); // 發票地址 = CADD2
                        const zip_code = getVal(['cpono', 'zip_code']);               // 郵遞區號 = CPONO
                        const website = getVal(['cwww', 'website']);                  // 網址 = CWWW
                        const closing_day = getVal(['naccday', 'closing_day']);       // 結帳日
                        const region_code = getVal(['carea', 'region_code']);         // 區域碼 = CAREA
                        const accounting_code = getVal(['service_id', 'accounting_code']); // 會計代號
                        const notes = [getVal('cnote'), tax_id ? `統編:${tax_id}` : ''].filter(Boolean).join(' | ');
                        const address = getVal(['cadd1', 'address']);
                        const categories = getVal(['ctype', 'category']) ? [getVal(['ctype', 'category'])] : [];
                        const supplier_code = getVal(['cid', 'service_id', 'carea']);
                        // 客戶專屬欄位
                        const customer_code = getVal(['cid', 'customer_code']);
                        const delivery_address = getVal(['送貨地址', 'delivery_address']);
                        const collection_day = getVal(['收帳日', 'collection_day']);
                        const salesperson = getVal(['csalesid', 'salesperson']);
                        const full_invoice = getVal(['invm_check', 'full_invoice']) === '1';

                        if (activeTab === 'suppliers') {
                            const sup_id = rawId || `SUP-LEGACY-${Date.now().toString().slice(-4)}${Math.floor(Math.random()*1000)}`;
                            const existing = suppliers.find(s => s.sup_id === sup_id);
                            updates.push({
                                ...(existing || {}),
                                sup_id,
                                supplier_code: supplier_code || existing?.supplier_code || '',
                                name: name || (existing?.name || ''),
                                contact_name: contact_name || (existing?.contact_name || ''),
                                responsible_person: responsible_person || (existing?.responsible_person || ''),
                                email: email || (existing?.email || ''),
                                payment_terms: payment_terms || (existing?.payment_terms || ''),
                                phone1: phone1 || (existing?.phone1 || ''),
                                phone2: phone2 || (existing?.phone2 || ''),
                                mobile: mobile || (existing?.mobile || ''),
                                fax: fax || (existing?.fax || ''),
                                tax_id: tax_id || (existing?.tax_id || ''),
                                invoice_title: invoice_title || (existing?.invoice_title || ''),
                                invoice_address: invoice_address || (existing?.invoice_address || ''),
                                zip_code: zip_code || (existing?.zip_code || ''),
                                website: website || (existing?.website || ''),
                                closing_day: closing_day || (existing?.closing_day || ''),
                                region_code: region_code || (existing?.region_code || ''),
                                accounting_code: accounting_code || (existing?.accounting_code || ''),
                                address: address || (existing?.address || ''),
                                country: existing?.country || 'Taiwan',
                                currency: existing?.currency || defaultCurrency,
                                categories: categories.length ? categories : (Array.isArray(existing?.categories) ? existing.categories : []),
                                rating: existing?.rating ?? 0,
                                notes: notes || (existing?.notes || ''),
                            });
                        } else if (activeTab === 'customers') {
                            const cust_id = rawId || `CUST-LEGACY-${Date.now().toString().slice(-4)}${Math.floor(Math.random()*1000)}`;
                            const existing = customers.find(c => c.cust_id === cust_id);
                            updates.push({
                                ...(existing || {}),
                                cust_id,
                                customer_code: customer_code || existing?.customer_code || '',
                                name: name || (existing?.name || ''),
                                contact_name: contact_name || (existing?.contact_name || ''),
                                responsible_person: responsible_person || (existing?.responsible_person || ''),
                                email: email || (existing?.email || ''),
                                payment_terms: payment_terms || (existing?.payment_terms || ''),
                                phone1: phone1 || (existing?.phone1 || ''),
                                phone2: phone2 || (existing?.phone2 || ''),
                                mobile: mobile || (existing?.mobile || ''),
                                fax: fax || (existing?.fax || ''),
                                tax_id: tax_id || (existing?.tax_id || ''),
                                invoice_title: invoice_title || (existing?.invoice_title || ''),
                                invoice_address: invoice_address || (existing?.invoice_address || ''),
                                zip_code: zip_code || (existing?.zip_code || ''),
                                website: website || (existing?.website || ''),
                                closing_day: closing_day || (existing?.closing_day || ''),
                                collection_day: collection_day || (existing?.collection_day || ''),
                                region_code: region_code || (existing?.region_code || ''),
                                accounting_code: accounting_code || (existing?.accounting_code || ''),
                                address: address || (existing?.address || ''),
                                delivery_address: delivery_address || (existing?.delivery_address || ''),
                                salesperson: salesperson || (existing?.salesperson || ''),
                                full_invoice: full_invoice || existing?.full_invoice || false,
                                tier: getVal('clevel') || (existing?.tier || 'B'),
                                credit_limit: existing?.credit_limit || 0,
                                country: existing?.country || 'Taiwan',
                                currency: existing?.currency || defaultCurrency,
                                notes: notes || (existing?.notes || ''),
                            });
                        }
                    } else if (parts.length >= 5) {
                        // Standard ERP Format Mapping
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
                        alert(`正在匯入 ${updates.length} 筆供應商到資料庫，請稍候...`);
                        await bulkUpdateSuppliers(updates);
                    } else if (activeTab === 'customers') {
                        alert(`正在匯入 ${updates.length} 筆客戶到資料庫，請稍候...`);
                        await bulkUpdateCustomers(updates);
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
                                <th style={{ width: '60px' }}><div className="flex items-center gap-1"><input type="checkbox" /> 項</div></th>
                                <th>代號</th>
                                <th>區域碼</th>
                                <th>名稱 / 地址</th>
                                <th>電話一 / 二</th>
                                <th>負責人</th>
                                <th>行動電話</th>
                                <th>傳真號碼</th>
                                <th>等級</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.map((sup, index) => (
                                <tr key={sup.sup_id} onClick={() => setDrawerTarget(sup)}>
                                    <td onClick={e => e.stopPropagation()}><div className="flex items-center gap-1"><input type="checkbox" /> {index + 1}</div></td>
                                    <td><span className="font-mono text-muted text-sm">{sup.supplier_code || sup.sup_id}</span></td>
                                    <td>{sup.region_code}</td>
                                    <td>
                                        <div className="font-semibold">{sup.name}</div>
                                        {sup.address && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sup.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-accent hover:text-accent-hover flex-shrink-0"
                                                    title="在 Google 地圖開啟"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MapPin size={12} />
                                                </a>
                                                <div className="truncate" style={{ maxWidth: '250px' }} title={sup.address}>{sup.address}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div>{sup.phone1}</div>
                                        {sup.phone2 && <div className="mt-1 text-xs text-muted">{sup.phone2}</div>}
                                    </td>
                                    <td>{sup.responsible_person}</td>
                                    <td>{sup.mobile}</td>
                                    <td>{sup.fax}</td>
                                    <td>
                                        {sup.tier && <span className={`${styles.badge} ${tierClass(sup.tier)}`}>{sup.tier}</span>}
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
                                <th style={{ width: '60px' }}><div className="flex items-center gap-1"><input type="checkbox" /> 項</div></th>
                                <th>代號</th>
                                <th>區域碼</th>
                                <th>名稱 / 地址</th>
                                <th>電話一 / 二</th>
                                <th>負責人</th>
                                <th>行動電話</th>
                                <th>當月結帳日</th>
                                <th>歸屬業務</th>
                                <th>等級</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.map((cust, index) => (
                                <tr key={cust.cust_id} onClick={() => setDrawerTarget(cust)}>
                                    <td onClick={e => e.stopPropagation()}><div className="flex items-center gap-1"><input type="checkbox" /> {index + 1}</div></td>
                                    <td><span className="font-mono text-muted text-sm">{cust.customer_code || cust.cust_id}</span></td>
                                    <td>{cust.region_code}</td>
                                    <td>
                                        <div className="font-semibold">{cust.name}</div>
                                        {cust.address && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cust.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-accent hover:text-accent-hover flex-shrink-0"
                                                    title="在 Google 地圖開啟"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MapPin size={12} />
                                                </a>
                                                <div className="truncate" style={{ maxWidth: '250px' }} title={cust.address}>{cust.address}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div>{cust.phone1}</div>
                                        {cust.phone2 && <div className="mt-1 text-xs text-muted">{cust.phone2}</div>}
                                    </td>
                                    <td>{cust.responsible_person}</td>
                                    <td>{cust.mobile}</td>
                                    <td>{cust.closing_day}</td>
                                    <td>{cust.salesperson}</td>
                                    <td>
                                        {cust.tier && <span className={`${styles.badge} ${tierClass(cust.tier)}`}>{cust.tier}</span>}
                                    </td>
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
                                <th style={{ width: '60px' }}><div className="flex items-center gap-1"><input type="checkbox" /> 項</div></th>
                                <th>代號</th>
                                <th>名稱 / 地址</th>
                                <th>電話 / 行動</th>
                                <th>部門</th>
                                <th>職務</th>
                                {enablePermissionRole && <th>權限角色</th>}
                                <th>狀態</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((emp, index) => (
                                <tr key={emp.emp_id} onClick={() => setDrawerTarget(emp)}>
                                    <td onClick={e => e.stopPropagation()}><div className="flex items-center gap-1"><input type="checkbox" /> {index + 1}</div></td>
                                    <td><span className="font-mono text-muted text-sm">{emp.employee_code || emp.emp_id}</span></td>
                                    <td>
                                        <div className="font-semibold">{emp.name}</div>
                                        {emp.address && (
                                            <div className="flex items-center gap-1 mt-1 text-xs text-muted">
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emp.address)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-accent hover:text-accent-hover flex-shrink-0"
                                                    title="在 Google 地圖開啟"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <MapPin size={12} />
                                                </a>
                                                <div className="truncate" style={{ maxWidth: '250px' }} title={emp.address}>{emp.address}</div>
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <div>{emp.phone || '-'}</div>
                                        {emp.mobile && <div className="mt-1 text-xs text-muted">{emp.mobile}</div>}
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
