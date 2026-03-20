import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../i18n';
import { Settings, Globe, CircleDollarSign, Database, LayoutPanelTop, ShieldCheck, LockKeyhole, Palette } from 'lucide-react';

const SystemSettings = () => {
    const { t } = useTranslation();
    const {
        defaultCurrency, setDefaultCurrency,
        vatEnabled, setVatEnabled,
        vatRate, setVatRate,
        isMultiCountryMode, setMultiCountryMode,
        showImportExport, setShowImportExport,
        enablePermissionRole, setEnablePermissionRole,
        enableLoginSystem, setEnableLoginSystem,
        operationMode, setOperationMode,
        displayMode, setDisplayMode
    } = useAppStore();
    const [pendingOperationMode, setPendingOperationMode] = useState(operationMode);
    const [systemThemeLabel, setSystemThemeLabel] = useState(() => (
        window.matchMedia('(prefers-color-scheme: dark)').matches ? '深色' : '淺色'
    ));

    useEffect(() => {
        setPendingOperationMode(operationMode);
    }, [operationMode]);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const updateThemeLabel = () => setSystemThemeLabel(mediaQuery.matches ? '深色' : '淺色');
        updateThemeLabel();
        mediaQuery.addEventListener('change', updateThemeLabel);
        return () => mediaQuery.removeEventListener('change', updateThemeLabel);
    }, []);

    const handleSaveOperationMode = () => {
        if (pendingOperationMode === operationMode) return;
        setOperationMode(pendingOperationMode);
        // Refresh to matching layout state immediately
        window.location.href = '/settings';
    };

    const switchTrackStyle = {
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        position: 'relative',
        transition: 'all 0.2s ease',
        border: '1px solid #475569',
    };

    const switchThumbStyle = {
        content: "''",
        position: 'absolute',
        top: '2px',
        left: '2px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'all 0.2s ease',
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '800px' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.8rem' }}>
                    <Settings size={32} /> {t('sidebar.config')}
                </h1>
                <p style={{ color: 'var(--text-muted)' }}>管理 ERP 全域基礎設定與交易模組行為</p>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
                {/* Multi-country Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Globe className="text-accent-primary" />
                            <div>
                                <div style={{ fontWeight: 800 }}>多國/跨境模式開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    關閉後將隱藏「國家地區」相關顯示，簡化操作介面。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMultiCountryMode(!isMultiCountryMode)}
                            style={{ ...switchTrackStyle, background: isMultiCountryMode ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: isMultiCountryMode ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Import/Export Features */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <Database className="text-success" />
                            <div>
                                <div style={{ fontWeight: 800 }}>匯出 / 匯入 功能開啟</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後將在產品、夥伴及採購頁面顯示數據移動按鈕。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowImportExport(!showImportExport)}
                            style={{ ...switchTrackStyle, background: showImportExport ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: showImportExport ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Local Currency Setting */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <CircleDollarSign className="text-warning" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>系統預設交易幣別</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                設定本公司當地交易使用的主要貨幣 (如 TWD, USD, CNY)。
                            </div>
                            <select
                                value={defaultCurrency}
                                onChange={e => setDefaultCurrency(e.target.value)}
                                style={{
                                    padding: '0.6rem 1rem',
                                    backgroundColor: 'var(--bg-tertiary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    color: 'var(--text-primary)',
                                    fontSize: '1rem',
                                    fontWeight: 700,
                                    width: '140px',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="TWD">TWD (NTD)</option>
                                <option value="USD">USD</option>
                                <option value="JPY">JPY</option>
                                <option value="CNY">CNY</option>
                                <option value="EUR">EUR</option>
                                <option value="HKD">HKD</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Display Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <Palette className="text-accent-primary" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>顯示模式</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.9rem' }}>
                                依照操作環境切換整體配色，立即生效。
                            </div>
                            <div style={{ display: 'grid', gap: '0.6rem' }}>
                                {[
                                    {
                                        key: 'nightclub',
                                        title: '選項1：夜店風',
                                        desc: '深色高對比，適合長時間看螢幕與夜間作業。',
                                        swatches: ['#0A0A0B', '#0070F3', '#FF9500']
                                    },
                                    {
                                        key: 'light',
                                        title: '選項2：白底商務風',
                                        desc: '白底搭配藍灰字色，文件感更強，列印視覺更一致。',
                                        swatches: ['#ffffff', '#2563eb', '#16a34a']
                                    },
                                    {
                                        key: 'warm',
                                        title: '選項3：暖白護眼風',
                                        desc: '米白底與暖棕重點色，降低刺眼感，閱讀更柔和。',
                                        swatches: ['#fffdf6', '#8b5e34', '#b7791f']
                                    },
                                    {
                                        key: 'system',
                                        title: '選項4：跟隨系統',
                                        desc: '自動依照 Windows 深色/淺色模式切換（深色=夜店風，淺色=白底商務風）。',
                                        swatches: ['#0A0A0B', '#f8fafc', '#2563eb']
                                    }
                                ].map((mode) => {
                                    const active = displayMode === mode.key;
                                    return (
                                        <button
                                            key={mode.key}
                                            type="button"
                                            onClick={() => setDisplayMode(mode.key)}
                                            style={{
                                                textAlign: 'left',
                                                padding: '0.7rem 0.85rem',
                                                borderRadius: '8px',
                                                border: `1px solid ${active ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                                                background: active ? 'var(--accent-subtle)' : 'var(--bg-tertiary)',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                                                <div style={{ fontWeight: 700 }}>{mode.title}</div>
                                                <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                                                    {mode.swatches.map((color) => (
                                                        <span
                                                            key={`${mode.key}-${color}`}
                                                            style={{
                                                                width: '12px',
                                                                height: '12px',
                                                                borderRadius: '50%',
                                                                background: color,
                                                                border: '1px solid var(--border-color)',
                                                                display: 'inline-block'
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{mode.desc}</div>
                                            {mode.key === 'system' && (
                                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.3rem', fontWeight: 700 }}>
                                                    目前：{systemThemeLabel}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Operation Mode */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                        <LayoutPanelTop className="text-accent-primary" />
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800 }}>操作模式</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.9rem' }}>
                                選擇左側選單點擊後的頁面開啟方式。
                            </div>
                            <div style={{ display: 'grid', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>選項1：傳統配置模式</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            左側選單切換時，維持單一內容區直接切頁。
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingOperationMode('current')}
                                        style={{ ...switchTrackStyle, background: pendingOperationMode === 'current' ? '#2563eb' : '#334155', flexShrink: 0 }}
                                    >
                                        <span style={{ ...switchThumbStyle, transform: pendingOperationMode === 'current' ? 'translateX(20px)' : 'translateX(0)' }} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.8rem' }}>
                                    <div>
                                        <div style={{ fontWeight: 700 }}>選項2：新分頁模式</div>
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                            點選左側六項任一功能時，開新分頁（顯示於原分頁旁）。
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPendingOperationMode('tabbed')}
                                        style={{ ...switchTrackStyle, background: pendingOperationMode === 'tabbed' ? '#2563eb' : '#334155', flexShrink: 0 }}
                                    >
                                        <span style={{ ...switchThumbStyle, transform: pendingOperationMode === 'tabbed' ? 'translateX(20px)' : 'translateX(0)' }} />
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    onClick={handleSaveOperationMode}
                                    disabled={pendingOperationMode === operationMode}
                                    style={{
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.55rem 1rem',
                                        fontWeight: 700,
                                        color: 'white',
                                        background: pendingOperationMode === operationMode ? 'var(--text-muted)' : 'var(--accent-primary)',
                                        cursor: pendingOperationMode === operationMode ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    儲存
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* VAT Setting */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1 }}>
                            <CircleDollarSign className="text-accent-primary" />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 800 }}>VAT 設定</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem', marginBottom: '0.8rem' }}>
                                    可設定單據底部 VAT 稅率，並可隨時啟用/停用。預設為 5%。
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.1"
                                        value={vatRate}
                                        onChange={(e) => setVatRate(e.target.value)}
                                        style={{
                                            width: '120px',
                                            padding: '0.5rem 0.65rem',
                                            backgroundColor: 'var(--bg-tertiary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '1rem',
                                            fontWeight: 700
                                        }}
                                    />
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>%</span>
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setVatEnabled(!vatEnabled)}
                            style={{ ...switchTrackStyle, background: vatEnabled ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: vatEnabled ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Permission Role Toggle */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <ShieldCheck className="text-warning" />
                            <div>
                                <div style={{ fontWeight: 800 }}>權限角色功能開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後可在員工資料中設定與顯示「權限角色」欄位。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEnablePermissionRole(!enablePermissionRole)}
                            style={{ ...switchTrackStyle, background: enablePermissionRole ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: enablePermissionRole ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                {/* Login System Toggle */}
                <div style={{ background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <LockKeyhole className="text-accent-primary" />
                            <div>
                                <div style={{ fontWeight: 800 }}>登入系統功能開關</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    開啟後系統需登入才可進入，並啟用權限角色控制。
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEnableLoginSystem(!enableLoginSystem)}
                            style={{ ...switchTrackStyle, background: enableLoginSystem ? '#2563eb' : '#334155' }}
                        >
                            <span style={{ ...switchThumbStyle, transform: enableLoginSystem ? 'translateX(20px)' : 'translateX(0)' }} />
                        </button>
                    </div>
                </div>

                <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px border-blue-500/30', color: '#60a5fa', fontSize: '0.85rem' }}>
                    ℹ️ 提示：更改設定後，系統將自動調整全域列表與單據的欄位呈現方式。
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;
