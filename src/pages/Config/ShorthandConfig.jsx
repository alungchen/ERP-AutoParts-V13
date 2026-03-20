import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Save, Edit2, Settings, Download, Upload } from 'lucide-react';
import { useShorthandStore } from '../../store/useShorthandStore';
import { useTranslation } from '../../i18n';

const ShorthandConfig = () => {
    const { t } = useTranslation();
    const {
        models, parts, brands,
        addModel, deleteModel, updateModel,
        addPart, deletePart, updatePart,
        addBrand, deleteBrand, updateBrand
    } = useShorthandStore();

    const [activeTab, setActiveTab] = useState('model'); // 'model', 'part', 'brand'

    const [newRow, setNewRow] = useState(null); // null means not adding
    const [editingRowId, setEditingRowId] = useState(null);
    const [editingRowData, setEditingRowData] = useState(null);
    const [focusedNewField, setFocusedNewField] = useState('');
    const [isSaveNewFocused, setIsSaveNewFocused] = useState(false);
    const [isAddPhraseFocused, setIsAddPhraseFocused] = useState(false);
    const [searchKeywords, setSearchKeywords] = useState({
        model: '',
        part: '',
        brand: ''
    });
    const fileInputRef = useRef(null);
    const newFieldRefs = useRef({});
    const saveNewBtnRef = useRef(null);
    const addPhraseBtnRef = useRef(null);
    const tabBtnRefs = useRef({});
    const confirmDelete = (label) => window.confirm(`確定要刪除「${label}」嗎？此操作無法復原。`);

    const handleAddInit = () => {
        setEditingRowId(null);
        setFocusedNewField('');
        setIsSaveNewFocused(false);
        if (activeTab === 'model') {
            setNewRow({ shorthand: '', fullname: '', brand: '' });
        } else if (activeTab === 'part') {
            setNewRow({ shorthand: '', fullname: '', category: '' });
        } else {
            setNewRow({ shorthand: '', fullname: '' });
        }
    };

    const handleAddSave = () => {
        if (!newRow.shorthand || !newRow.fullname) return;

        if (activeTab === 'model') {
            addModel(newRow);
        } else if (activeTab === 'part') {
            addPart(newRow);
        } else {
            addBrand(newRow);
        }
        setNewRow(null);
        setFocusedNewField('');
        setIsSaveNewFocused(false);
    };

    const handleEditInit = (item) => {
        setNewRow(null);
        setEditingRowId(item.id);
        setEditingRowData({ ...item });
    };

    const handleEditSave = () => {
        if (!editingRowData.shorthand || !editingRowData.fullname) return;

        if (activeTab === 'model') {
            updateModel(editingRowData);
        } else if (activeTab === 'part') {
            updatePart(editingRowData);
        } else {
            updateBrand(editingRowData);
        }
        setEditingRowId(null);
        setEditingRowData(null);
    };

    const currentList = activeTab === 'model' ? models : activeTab === 'part' ? parts : brands;
    const keyword = (searchKeywords[activeTab] || '').trim().toLowerCase();
    const filteredList = currentList.filter((item) => {
        if (!keyword) return true;
        const scope = [
            item.shorthand || '',
            item.fullname || '',
            activeTab === 'model' ? (item.brand || '') : (activeTab === 'part' ? (item.category || '') : '')
        ].join(' ').toLowerCase();
        return scope.includes(keyword);
    });

    const tabOrder = ['model', 'part', 'brand'];

    useEffect(() => {
        // 進入系統片語設定時，預設聚焦 A. 車型片語表
        tabBtnRefs.current.model?.focus();
    }, []);

    const handleTabKeyDown = (e) => {
        const currentIdx = tabOrder.indexOf(activeTab);
        if (currentIdx === -1) return;

        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const nextIdx = e.key === 'ArrowRight'
                ? (currentIdx + 1) % tabOrder.length
                : (currentIdx - 1 + tabOrder.length) % tabOrder.length;
            const nextTab = tabOrder[nextIdx];
            setActiveTab(nextTab);
            setNewRow(null);
            setEditingRowId(null);
            requestAnimationFrame(() => tabBtnRefs.current[nextTab]?.focus());
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            addPhraseBtnRef.current?.focus();
        }
    };

    const getNewFieldOrder = () => {
        if (activeTab === 'brand') return ['shorthand', 'fullname'];
        return ['shorthand', 'fullname', activeTab === 'model' ? 'brand' : 'category'];
    };

    const handleNewFieldKeyDown = (e, fieldKey) => {
        const order = getNewFieldOrder();
        const idx = order.indexOf(fieldKey);
        if (idx === -1) return;

        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();
            saveNewBtnRef.current?.focus();
            return;
        }

        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.shiftKey && idx === order.length - 1) {
            // 最後一欄按 Enter，直接帶到儲存
            saveNewBtnRef.current?.focus();
            return;
        }
        const nextIdx = e.shiftKey ? Math.max(0, idx - 1) : Math.min(order.length - 1, idx + 1);
        const nextField = order[nextIdx];
        newFieldRefs.current[nextField]?.focus();
    };

    const toCsvCell = (value) => {
        const str = String(value ?? '');
        if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
        return str;
    };

    const parseCsvRow = (row) => row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        .map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());

    const getExportConfig = () => {
        if (activeTab === 'model') {
            return {
                filePrefix: 'shorthand_models',
                columns: [
                    { key: 'shorthand', label: 'Shorthand' },
                    { key: 'fullname', label: 'Fullname' },
                    { key: 'brand', label: 'Brand' },
                ],
            };
        }
        if (activeTab === 'part') {
            return {
                filePrefix: 'shorthand_parts',
                columns: [
                    { key: 'shorthand', label: 'Shorthand' },
                    { key: 'fullname', label: 'Fullname' },
                    { key: 'category', label: 'Category' },
                ],
            };
        }
        return {
            filePrefix: 'shorthand_brands',
            columns: [
                { key: 'shorthand', label: 'Shorthand' },
                { key: 'fullname', label: 'Fullname' },
            ],
        };
    };

    const handleExportTable = async () => {
        try {
            const config = getExportConfig();
            const headers = config.columns.map((c) => c.label);
            const rows = [headers.join(',')];
            filteredList.forEach((item) => {
                rows.push(config.columns.map((c) => toCsvCell(item[c.key] || '')).join(','));
            });
            const csvContent = '\uFEFF' + rows.join('\n');
            const fileName = `${config.filePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;

            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{ description: 'CSV File', accept: { 'text/csv': ['.csv'] } }],
                });
                const writable = await handle.createWritable();
                await writable.write(csvContent);
                await writable.close();
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
            }
            alert(`匯出成功！已匯出 ${filteredList.length} 筆。`);
        } catch (err) {
            if (err?.name === 'AbortError') return;
            console.error('Export shorthand failed:', err);
            alert('匯出發生錯誤，請稍後再試。');
        }
    };

    const handleImportTable = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = String(event.target?.result || '');
                const rows = text.split('\n').map((r) => r.trim()).filter(Boolean);
                if (rows.length < 2) return;

                const headers = parseCsvRow(rows[0]).map((h) => h.toLowerCase());
                const idxShorthand = headers.findIndex((h) => ['shorthand', '片語', '自定義片語'].includes(h));
                const idxFullname = headers.findIndex((h) => ['fullname', 'full name', '完整名稱', '完整車型名稱', '完整零件名稱', '完整品牌名稱'].includes(h));
                const idxThird = activeTab === 'model'
                    ? headers.findIndex((h) => ['brand', '廠牌'].includes(h))
                    : activeTab === 'part'
                        ? headers.findIndex((h) => ['category', '分類'].includes(h))
                        : -1;

                if (idxShorthand === -1 || idxFullname === -1) {
                    alert('匯入失敗：缺少必要欄位（Shorthand / Fullname）。');
                    return;
                }

                const updateFn = activeTab === 'model' ? updateModel : activeTab === 'part' ? updatePart : updateBrand;
                const addFn = activeTab === 'model' ? addModel : activeTab === 'part' ? addPart : addBrand;
                const existingList = activeTab === 'model' ? models : activeTab === 'part' ? parts : brands;

                let processed = 0;
                let updated = 0;
                let added = 0;
                let skipped = 0;

                rows.slice(1).forEach((row) => {
                    const cols = parseCsvRow(row);
                    const shorthand = (cols[idxShorthand] || '').trim();
                    const fullname = (cols[idxFullname] || '').trim();
                    const thirdVal = idxThird >= 0 ? (cols[idxThird] || '').trim() : '';
                    if (!shorthand || !fullname) {
                        skipped += 1;
                        return;
                    }

                    const existing = existingList.find((x) => String(x.shorthand || '').trim().toLowerCase() === shorthand.toLowerCase());
                    const next = activeTab === 'model'
                        ? { shorthand, fullname, brand: thirdVal }
                        : activeTab === 'part'
                            ? { shorthand, fullname, category: thirdVal }
                            : { shorthand, fullname };

                    if (existing) {
                        updateFn({ ...existing, ...next });
                        updated += 1;
                    } else {
                        addFn(next);
                        added += 1;
                    }
                    processed += 1;
                });

                alert(`匯入完成：處理 ${processed} 筆，更新 ${updated} 筆，新增 ${added} 筆，略過 ${skipped} 筆。`);
            } catch (err) {
                console.error('Import shorthand failed:', err);
                alert('匯入失敗：檔案格式不正確。');
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    };

    return (
        <div className="anim-fade-in" style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Settings size={28} className="text-accent-primary" />
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>系統片語設定 (Shorthand Config)</h1>
                    <p className="text-muted" style={{ marginTop: '0.25rem' }}>設定快速查詢的車型與零件縮寫對照表</p>
                </div>
            </div>

            <div
                style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}
                onKeyDown={handleTabKeyDown}
            >
                <button
                    ref={(el) => { tabBtnRefs.current.model = el; }}
                    onClick={() => { setActiveTab('model'); setNewRow(null); setEditingRowId(null); }}
                    type="button"
                    style={{
                        padding: '10px 20px',
                        fontWeight: 600,
                        background: activeTab === 'model' ? 'var(--accent-subtle)' : 'transparent',
                        color: activeTab === 'model' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    A. 車型片語表 (Model Shorthand)
                </button>
                <button
                    ref={(el) => { tabBtnRefs.current.part = el; }}
                    onClick={() => { setActiveTab('part'); setNewRow(null); setEditingRowId(null); }}
                    type="button"
                    style={{
                        padding: '10px 20px',
                        fontWeight: 600,
                        background: activeTab === 'part' ? 'var(--accent-subtle)' : 'transparent',
                        color: activeTab === 'part' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    B. 零件片語表 (Part Shorthand)
                </button>
                <button
                    ref={(el) => { tabBtnRefs.current.brand = el; }}
                    onClick={() => { setActiveTab('brand'); setNewRow(null); setEditingRowId(null); }}
                    type="button"
                    style={{
                        padding: '10px 20px',
                        fontWeight: 600,
                        background: activeTab === 'brand' ? 'var(--accent-subtle)' : 'transparent',
                        color: activeTab === 'brand' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.2s'
                    }}
                >
                    C. 品牌片語表 (Brand Shorthand)
                </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleImportTable} />
                    <input
                        type="text"
                        value={searchKeywords[activeTab]}
                        onChange={(e) => setSearchKeywords((prev) => ({ ...prev, [activeTab]: e.target.value }))}
                        placeholder={activeTab === 'model' ? '搜尋 A.車型（片語/完整名稱/廠牌）' : activeTab === 'part' ? '搜尋 B.零件（片語/完整名稱/分類）' : '搜尋 C.品牌（片語/完整品牌）'}
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)'
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: '6px',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid var(--border-color)',
                            flexShrink: 0
                        }}
                    >
                        <Download size={16} /> 匯入表格
                    </button>
                    <button
                        type="button"
                        onClick={handleExportTable}
                        style={{
                            background: 'var(--bg-tertiary)', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: '6px',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', border: '1px solid var(--border-color)',
                            flexShrink: 0
                        }}
                    >
                        <Upload size={16} /> 匯出表格
                    </button>
                    <button
                        ref={addPhraseBtnRef}
                        onClick={handleAddInit}
                        type="button"
                        onFocus={() => setIsAddPhraseFocused(true)}
                        onBlur={() => setIsAddPhraseFocused(false)}
                        disabled={!!newRow}
                        style={{
                            background: 'var(--accent-primary)', color: 'white', padding: '8px 16px', borderRadius: '6px',
                            fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: newRow ? 'not-allowed' : 'pointer', border: 'none',
                            opacity: newRow ? 0.5 : 1,
                            flexShrink: 0,
                            outline: 'none',
                            boxShadow: isAddPhraseFocused ? '0 0 0 4px rgba(59, 130, 246, 0.28)' : 'none',
                            transform: isAddPhraseFocused ? 'translateY(-1px)' : 'none',
                            transition: 'box-shadow 0.15s ease, transform 0.15s ease'
                        }}
                    >
                        <Plus size={16} /> 新增片語
                    </button>
                </div>
            </div>

            <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead style={{ background: 'var(--bg-tertiary)' }}>
                        <tr>
                            <th style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', width: '20%' }}>自定義片語</th>
                            <th style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', width: '40%' }}>
                                {activeTab === 'model' ? '完整車型名稱' : activeTab === 'part' ? '完整零件名稱' : '完整品牌名稱'}
                            </th>
                            {activeTab !== 'brand' && (
                                <th style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', width: '25%' }}>
                                    {activeTab === 'model' ? '廠牌' : '分類'}
                                </th>
                            )}
                            <th style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)', width: activeTab === 'brand' ? '40%' : '15%', textAlign: 'center' }}>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {newRow && (
                            <tr style={{ background: 'rgba(52, 211, 153, 0.05)', borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 1.5rem' }}>
                                    <input
                                        className="input"
                                        ref={(el) => { newFieldRefs.current.shorthand = el; }}
                                        value={newRow.shorthand}
                                        onChange={(e) => setNewRow({ ...newRow, shorthand: e.target.value })}
                                        onKeyDown={(e) => handleNewFieldKeyDown(e, 'shorthand')}
                                        onFocus={() => setFocusedNewField('shorthand')}
                                        onBlur={() => setFocusedNewField('')}
                                        placeholder="如: toal"
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            background: 'var(--bg-tertiary)',
                                            border: focusedNewField === 'shorthand' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            outline: 'none',
                                            color: 'var(--text-primary)',
                                            boxShadow: focusedNewField === 'shorthand' ? '0 0 0 4px rgba(59, 130, 246, 0.28)' : 'none'
                                        }}
                                        autoFocus
                                    />
                                </td>
                                <td style={{ padding: '12px 1.5rem' }}>
                                    <input
                                        className="input"
                                        ref={(el) => { newFieldRefs.current.fullname = el; }}
                                        value={newRow.fullname}
                                        onChange={(e) => setNewRow({ ...newRow, fullname: e.target.value })}
                                        onKeyDown={(e) => handleNewFieldKeyDown(e, 'fullname')}
                                        onFocus={() => setFocusedNewField('fullname')}
                                        onBlur={() => setFocusedNewField('')}
                                        placeholder="如: TOYOTA Altis"
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            background: 'var(--bg-tertiary)',
                                            border: focusedNewField === 'fullname' ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            outline: 'none',
                                            color: 'var(--text-primary)',
                                            boxShadow: focusedNewField === 'fullname' ? '0 0 0 4px rgba(59, 130, 246, 0.28)' : 'none'
                                        }}
                                    />
                                </td>
                                {activeTab !== 'brand' && (
                                    <td style={{ padding: '12px 1.5rem' }}>
                                        <input
                                            className="input"
                                            ref={(el) => { newFieldRefs.current[activeTab === 'model' ? 'brand' : 'category'] = el; }}
                                            value={activeTab === 'model' ? newRow.brand : newRow.category}
                                            onChange={(e) => {
                                                if (activeTab === 'model') setNewRow({ ...newRow, brand: e.target.value });
                                                else setNewRow({ ...newRow, category: e.target.value });
                                            }}
                                            onKeyDown={(e) => handleNewFieldKeyDown(e, activeTab === 'model' ? 'brand' : 'category')}
                                            onFocus={() => setFocusedNewField(activeTab === 'model' ? 'brand' : 'category')}
                                            onBlur={() => setFocusedNewField('')}
                                            placeholder={activeTab === 'model' ? "廠牌" : "分類"}
                                            style={{
                                                width: '100%',
                                                padding: '6px 10px',
                                                background: 'var(--bg-tertiary)',
                                                border: focusedNewField === (activeTab === 'model' ? 'brand' : 'category') ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                borderRadius: '6px',
                                                outline: 'none',
                                                color: 'var(--text-primary)',
                                                boxShadow: focusedNewField === (activeTab === 'model' ? 'brand' : 'category') ? '0 0 0 4px rgba(59, 130, 246, 0.28)' : 'none'
                                            }}
                                        />
                                    </td>
                                )}
                                <td style={{ padding: '12px 1.5rem', textAlign: 'center' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                        <button
                                            ref={saveNewBtnRef}
                                            type="button"
                                            onClick={handleAddSave}
                                            onFocus={() => setIsSaveNewFocused(true)}
                                            onBlur={() => setIsSaveNewFocused(false)}
                                            style={{
                                                color: '#34d399',
                                                background: isSaveNewFocused ? 'rgba(52, 211, 153, 0.12)' : 'transparent',
                                                border: isSaveNewFocused ? '1px solid #34d399' : '1px solid transparent',
                                                cursor: 'pointer',
                                                padding: '4px',
                                                borderRadius: '6px',
                                                boxShadow: isSaveNewFocused ? '0 0 0 4px rgba(52, 211, 153, 0.28)' : 'none',
                                                transform: isSaveNewFocused ? 'translateY(-1px)' : 'none',
                                                transition: 'box-shadow 0.15s ease, transform 0.15s ease'
                                            }}
                                            title="儲存"
                                        >
                                            <Save size={18} />
                                        </button>
                                        <button onClick={() => setNewRow(null)} style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }} title="取消"><Trash2 size={18} /></button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {filteredList.map((item) => (
                            editingRowId === item.id ? (
                                <tr key={`edit-${item.id}`} style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
                                    <td style={{ padding: '12px 1.5rem' }}>
                                        <input
                                            className="input"
                                            value={editingRowData.shorthand}
                                            onChange={(e) => setEditingRowData({ ...editingRowData, shorthand: e.target.value })}
                                            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', color: 'var(--text-primary)' }}
                                            autoFocus
                                        />
                                    </td>
                                    <td style={{ padding: '12px 1.5rem' }}>
                                        <input
                                            className="input"
                                            value={editingRowData.fullname}
                                            onChange={(e) => setEditingRowData({ ...editingRowData, fullname: e.target.value })}
                                            style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', color: 'var(--text-primary)' }}
                                        />
                                    </td>
                                    {activeTab !== 'brand' && (
                                        <td style={{ padding: '12px 1.5rem' }}>
                                            <input
                                                className="input"
                                                value={activeTab === 'model' ? editingRowData.brand : editingRowData.category}
                                                onChange={(e) => {
                                                    if (activeTab === 'model') setEditingRowData({ ...editingRowData, brand: e.target.value });
                                                    else setEditingRowData({ ...editingRowData, category: e.target.value });
                                                }}
                                                style={{ width: '100%', padding: '6px 10px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none', color: 'var(--text-primary)' }}
                                            />
                                        </td>
                                    )}
                                    <td style={{ padding: '12px 1.5rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button onClick={handleEditSave} style={{ color: '#3b82f6', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }} title="儲存"><Save size={18} /></button>
                                            <button onClick={() => setEditingRowId(null)} style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }} title="取消"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }} className="hover:bg-bg-tertiary transition">
                                    <td style={{ padding: '12px 1.5rem', fontWeight: 600, color: 'var(--accent-hover)' }}>{item.shorthand}</td>
                                    <td style={{ padding: '12px 1.5rem', fontWeight: 600 }}>{item.fullname}</td>
                                    {activeTab !== 'brand' && (
                                        <td style={{ padding: '12px 1.5rem', color: 'var(--text-secondary)' }}>
                                            <span style={{ background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                                {activeTab === 'model' ? item.brand : item.category}
                                            </span>
                                        </td>
                                    )}
                                    <td style={{ padding: '12px 1.5rem', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handleEditInit(item)}
                                                style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                title="編輯"
                                                className="hover:text-primary transition"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (!confirmDelete(item.fullname || item.shorthand)) return;
                                                    if (activeTab === 'model') deleteModel(item.id);
                                                    else if (activeTab === 'part') deletePart(item.id);
                                                    else deleteBrand(item.id);
                                                }}
                                                style={{ color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                                                title="刪除"
                                                className="hover:text-danger-hover transition"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )
                        ))}

                        {filteredList.length === 0 && !newRow && (
                            <tr>
                                <td colSpan={activeTab === 'brand' ? 3 : 4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {keyword ? '找不到符合搜尋條件的片語。' : '目前無片語資料。'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ShorthandConfig;
