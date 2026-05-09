import React, { useState, useEffect, useRef } from 'react';

/**
 * 通用「代號輸入 → 名稱顯示」Autocomplete 元件
 * 
 * Props:
 *   value       - 目前選定的 ID（例如 sup_id / cust_id）
 *   nameValue   - 對應的名稱（唯讀顯示）
 *   suggestions - 完整清單 (陣列)，每筆含 [idKey] 與 name 欄位
 *   idKey       - 用作識別的欄位名稱，例如 "sup_id" 或 "cust_id"
 *   onSelect    - callback(item)，使用者選取後呼叫
 *   disabled    - 是否唯讀
 *   inputStyle  - 覆寫 input 的 style
 */
const CodeLookupInput = ({
    value = '',
    nameValue = '',
    suggestions = [],
    idKey = 'id',
    onSelect,
    disabled = false,
    inputStyle = {}
}) => {
    const [query, setQuery] = useState(value);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    // 當外部 value 改變時同步 query（例如載入已存在單據）
    useEffect(() => { setQuery(value || ''); }, [value]);

    const filtered = query.length >= 1
        ? suggestions.filter(s =>
            (s[idKey] || '').toLowerCase().includes(query.toLowerCase()) ||
            (s.name || '').toLowerCase().includes(query.toLowerCase())
          ).slice(0, 15)
        : [];

    // 點擊外部關閉
    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const baseInputStyle = {
        padding: '0.5rem',
        backgroundColor: disabled ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
        border: '1px solid var(--border-color)',
        borderRadius: '4px',
        color: 'var(--text-primary)',
        fontSize: '1rem',
        fontWeight: 700,
        ...inputStyle
    };

    return (
        <div ref={ref} style={{ position: 'relative', width: '100%' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
                {/* 左：代號輸入框 */}
                <input
                    disabled={disabled}
                    style={{ ...baseInputStyle, width: '140px', flexShrink: 0, fontFamily: 'monospace' }}
                    placeholder="代號..."
                    value={query}
                    onChange={e => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => !disabled && setOpen(true)}
                    autoComplete="off"
                />
                {/* 右：名稱唯讀框 */}
                <input
                    readOnly
                    style={{ ...baseInputStyle, flex: 1, cursor: 'default', color: nameValue ? 'var(--text-primary)' : 'var(--text-muted)' }}
                    value={nameValue || ''}
                    placeholder="← 輸入代號自動帶入名稱"
                />
            </div>

            {/* 下拉建議清單 */}
            {open && !disabled && filtered.length > 0 && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                    marginTop: '3px'
                }}>
                    {filtered.map(item => (
                        <div
                            key={item[idKey]}
                            onMouseDown={e => {
                                e.preventDefault(); // 避免 blur 先觸發
                                onSelect?.(item);
                                setQuery(item[idKey]);
                                setOpen(false);
                            }}
                            style={{
                                padding: '0.55rem 0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                gap: '0.75rem',
                                alignItems: 'center',
                                borderBottom: '1px solid var(--border-color)',
                                fontSize: '0.875rem',
                                transition: 'background 0.1s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                            onMouseLeave={e => e.currentTarget.style.background = ''}
                        >
                            <span style={{ fontFamily: 'monospace', color: 'var(--accent)', minWidth: '100px', flexShrink: 0 }}>
                                {item[idKey]}
                            </span>
                            <span style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {item.name}
                            </span>
                            {item.phone1 && (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', flexShrink: 0 }}>
                                    {item.phone1}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CodeLookupInput;
