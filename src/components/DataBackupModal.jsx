import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { Upload, Download, X, Database } from 'lucide-react';

const DataBackupModal = ({ onClose }) => {
    const fileInputRef = useRef(null);

    const handleExport = async () => {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('erp-')) {
                data[key] = localStorage.getItem(key);
            }
        }
        const jsonStr = JSON.stringify(data, null, 2);
        const filename = `erp_backup_${new Date().toISOString().split('T')[0]}.json`;

        // Use modern File System Access API (Chrome 86+) — opens real Save As dialog
        if (window.showSaveFilePicker) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: filename,
                    types: [{
                        description: 'JSON 備份檔',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await fileHandle.createWritable();
                await writable.write(jsonStr);
                await writable.close();
                alert('✅ 備份已成功儲存！');
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.error('Export error:', e);
                    alert('儲存失敗：' + e.message);
                }
            }
        } else {
            // Fallback for older browsers
            const blob = new Blob([jsonStr], { type: 'application/octet-stream' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }, 300);
        }
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                let count = 0;
                for (const key in data) {
                    if (key.startsWith('erp-')) {
                        localStorage.setItem(key, data[key]);
                        count++;
                    }
                }
                alert(`成功匯入 ${count} 筆資料群組！系統即將重新載入以套用變更。`);
                window.location.reload();
            } catch (error) {
                alert('匯入失敗：檔案格式不正確');
                console.error('Import error:', error);
            }
        };
        reader.readAsText(file);
    };

    return ReactDOM.createPortal(
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.65)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
            }}
        >
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    background: 'var(--bg-primary)',
                    width: '100%',
                    maxWidth: '480px',
                    borderRadius: '12px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                }}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.25rem',
                    borderBottom: '1px solid var(--border-color)',
                    background: 'var(--bg-secondary)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <Database size={20} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: '1rem' }}>資料備份與還原</span>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-secondary)', padding: '0.25rem',
                            borderRadius: '6px', display: 'flex', alignItems: 'center',
                        }}
                        title="關閉"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                    {/* Export Block */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                            📦 匯出資料 (Export)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                            將目前瀏覽器中所有零件、客戶、採購單等資料匯出成 JSON 檔案，儲存到您的電腦中備用。
                        </div>
                        <button
                            onClick={handleExport}
                            style={{
                                width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: 'var(--accent-primary)', color: 'white',
                                padding: '0.6rem 1rem', borderRadius: '6px',
                                fontWeight: 600, fontSize: '0.875rem',
                                border: 'none', cursor: 'pointer',
                            }}
                        >
                            <Upload size={16} /> 匯出資料（下載備份檔）
                        </button>
                    </div>

                    {/* Import Block */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '1rem 1.25rem',
                        borderRadius: '8px',
                        border: '1px solid var(--warning-subtle)',
                    }}>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.5rem', color: 'var(--warning)' }}>
                            🔄 匯入資料 (Import)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.6 }}>
                            從之前下載的 JSON 備份檔中還原資料。
                            <strong style={{ color: 'var(--danger)' }}> 注意：這將覆蓋目前的資料！</strong>
                        </div>
                        <input
                            type="file"
                            accept=".json"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleImport}
                        />
                        <button
                            onClick={() => fileInputRef.current && fileInputRef.current.click()}
                            style={{
                                width: '100%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                                background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                                padding: '0.6rem 1rem', borderRadius: '6px',
                                fontWeight: 600, fontSize: '0.875rem',
                                cursor: 'pointer',
                            }}
                        >
                            <Download size={16} /> 匯入資料檔（.json）
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DataBackupModal;
